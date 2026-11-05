from datetime import date, datetime, timedelta, timezone
from functools import wraps
import math
import re
import uuid
from zoneinfo import ZoneInfo
from flask import Blueprint, abort, jsonify, request, g, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from sqlalchemy import update
from extensions import db, bcrypt, socketio
from models import User, Employee, WorkRequest, AuditEvent
from security import audit, auth_limits

routes_bp = Blueprint('routes', __name__)


def business_date():
    return datetime.now(ZoneInfo(current_app.config['APP_TIMEZONE'])).date()


def access(role):
    def decorate(fn):
        @wraps(fn)
        @jwt_required()
        def wrapped(*args, **kwargs):
            try:
                g.user = db.session.get(User, int(get_jwt_identity()))
            except (ValueError, TypeError):
                abort(401, 'Invalid session.')
            if not g.user:
                abort(401, 'Session user no longer exists.')
            if g.user.role != role or (role == 'employee' and not g.user.employee):
                abort(403, 'You do not have access to this action.')
            return fn(*args, **kwargs)
        return wrapped
    return decorate


def body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, 'Provide a JSON object.')
    return data


def text(data, key, maximum=150, required=True):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value.strip()) > maximum or (required and not value.strip()):
        abort(400, f'Provide a valid {key.replace("_", " ")} (maximum {maximum} characters).')
    return value.strip()


def notify(employee_id=None):
    socketio.emit('data_changed', {}, to='admins')
    if employee_id:
        socketio.emit('data_changed', {}, to=f'employee:{employee_id}')


@routes_bp.post('/login')
def login():
    data = body()
    staff = text(data, 'staff_id', 50).upper()
    password = data.get('password')
    if not isinstance(password, str) or len(password.encode('utf-8')) > 72:
        abort(400, 'Provide a valid password.')
    auth_limits('login', staff, 10, 60)
    user = User.query.filter_by(staff_id=staff).first()
    try:
        valid = bcrypt.check_password_hash(user.password if user else current_app.config['DUMMY_PASSWORD_HASH'], password)
    except ValueError:
        valid = False
    if not valid or not user or not user.is_active:
        audit('session.login_failed', staff)
        db.session.commit()
        abort(401, 'Invalid staff ID or password.')
    audit('session.logged_in', user.staff_id, user)
    db.session.commit()
    return jsonify(access_token=create_access_token(identity=str(user.id), additional_claims={'version': user.session_version}), role=user.role)



@routes_bp.post('/register')
@access('admin')
def register():
    data = body()
    name = text(data, 'name')
    email = text(data, 'email').lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        abort(400, 'Provide a valid email address.')
    password = data.get('password')
    if not isinstance(password, str) or not 12 <= len(password) <= 72 or len(password.encode('utf-8')) > 72:
        abort(400, 'Password must contain at least 12 characters and at most 72 UTF-8 bytes.')
    role = data.get('role', 'employee')
    if role not in ('employee', 'admin'):
        abort(400, 'Invalid role.')
    staff = text(data, 'staff_id', 50, False).upper() or uuid.uuid4().hex[:8].upper()
    hashed = bcrypt.generate_password_hash(password).decode()
    user = User(staff_id=staff, email=email, password=hashed, role=role)
    if role == 'employee':
        user.employee = Employee(name=name, email=email, password=hashed, staff_id=staff,
                                 machine_line=text(data, 'machine_line', 200, False),
                                 contract_details=text(data, 'contract_details', 5000, False))
    db.session.add(user)
    db.session.flush()
    audit('employee.created' if role == 'employee' else 'account.admin_created', staff, g.user)
    db.session.commit()
    notify()
    return jsonify(message=f'Account created. Staff ID: {staff}', staff_id=staff), 201


@routes_bp.get('/all')
@access('admin')
def all_users():
    return jsonify([dict(id=u.id, staff_id=u.staff_id, email=u.email, role=u.role, is_active=u.is_active) for u in User.query.all()])


@routes_bp.get('/admin/dashboard')
@access('admin')
def dashboard():
    return jsonify(activity=[e.serialize() for e in AuditEvent.query.order_by(AuditEvent.id.desc()).limit(30).all()], attendance=[e.serialize() for e in Employee.query.order_by(Employee.name).all()],
                   requests=[r.serialize() for r in WorkRequest.query.order_by(WorkRequest.created_at.desc()).all()])


@routes_bp.get('/employee/profile')
@access('employee')
def profile():
    return jsonify(**g.user.employee.serialize(), requests=[r.serialize() for r in WorkRequest.query.filter_by(employee_id=g.user.employee_id).order_by(WorkRequest.created_at.desc()).all()])


@routes_bp.patch('/employee/<int:employee_id>/edit')
@access('admin')
def edit(employee_id):
    employee = db.get_or_404(Employee, employee_id)
    data = body()
    if not data or set(data) - {'name', 'machine_line', 'contract_details'}:
        abort(400, 'Only name, machine line and contract details can be edited.')
    for key in data:
        setattr(employee, key, text(data, key, 5000 if key == 'contract_details' else 150, key == 'name'))
    audit('employee.updated', employee.staff_id, g.user, fields=sorted(data))
    db.session.commit()
    notify(employee.id)
    return jsonify(message='Employee updated.')


@routes_bp.post('/employee/<int:employee_id>/add-warning')
@access('admin')
def warning(employee_id):
    employee = db.get_or_404(Employee, employee_id)
    employee.warnings.append(text(body(), 'warning', 500))
    audit('employee.warning_recorded', employee.staff_id, g.user)
    db.session.commit()
    notify(employee.id)
    return jsonify(message='Warning recorded.')


@routes_bp.post('/employee/<action>')
@access('employee')
def employee_action(action):
    employee = g.user.employee
    if action in ('clock-in', 'clock-out'):
        clock_in = action == 'clock-in'
        target = 'Clocked In' if clock_in else 'Not Clocked In'
        expected = 'Not Clocked In' if clock_in else 'Clocked In'
        result = db.session.execute(update(Employee).where(Employee.id == employee.id, Employee.clock_in_status == expected).values(clock_in_status=target, clock_in_status_timestamp=datetime.now(timezone.utc).replace(tzinfo=None) if clock_in else None))
        if result.rowcount != 1:
            abort(409, 'Attendance is already in that state.')
        audit('attendance.clocked_in' if clock_in else 'attendance.clocked_out', employee.staff_id, g.user)
        db.session.commit()
        notify(employee.id)
        return jsonify(message='Clocked in.' if clock_in else 'Clocked out.')
    if action not in ('apply-leave', 'apply-overtime'):
        abort(404)
    data = body()
    kind = action.split('-')[1]
    try:
        requested_date = date.fromisoformat(data.get(f'{kind}_date', ''))
    except (ValueError, TypeError):
        abort(400, 'Choose a valid date in YYYY-MM-DD format.')
    if requested_date < business_date():
        abort(400, 'Requests cannot be made for past dates.')
    hours = 0
    if kind == 'overtime':
        raw = data.get('overtime_hours')
        try:
            hours = float(raw)
        except (ValueError, TypeError):
            abort(400, 'Provide overtime hours between 0 and 16.')
        if isinstance(raw, bool) or not math.isfinite(hours) or not 0 < hours <= 16:
            abort(400, 'Provide overtime hours between 0 and 16.')
    if kind == 'leave' and employee.remaining_leave_days <= 0:
        abort(409, 'No leave days remaining.')
    db.session.add(WorkRequest(employee_id=employee.id, kind=kind, date=requested_date, hours=hours))
    audit('request.submitted', employee.staff_id, g.user, kind=kind, date=requested_date.isoformat())
    db.session.commit()
    notify(employee.id)
    return jsonify(message='Request submitted.'), 201


@routes_bp.post('/admin/requests/<int:request_id>/<decision>')
@access('admin')
def decide(request_id, decision):
    if decision not in ('approve', 'reject'):
        abort(404)
    item = db.get_or_404(WorkRequest, request_id)
    data = body()
    reason = text(data, 'reason', 500, False)
    result = db.session.execute(update(WorkRequest).where(WorkRequest.id == item.id, WorkRequest.status == 'pending').values(status='approved' if decision == 'approve' else 'rejected', reason=reason))
    if result.rowcount != 1:
        abort(409, 'This request has already been reviewed.')
    if decision == 'approve':
        if item.kind == 'leave':
            result = db.session.execute(update(Employee).where(Employee.id == item.employee_id, Employee.remaining_leave_days > 0).values(remaining_leave_days=Employee.remaining_leave_days - 1))
            if result.rowcount != 1:
                db.session.rollback()
                abort(409, 'No leave days remaining.')
        else:
            db.session.execute(update(Employee).where(Employee.id == item.employee_id).values(overtime_hours=Employee.overtime_hours + item.hours))
    audit('request.approved' if decision == 'approve' else 'request.rejected', item.employee.staff_id, g.user, request_id=item.id, kind=item.kind)
    db.session.commit()
    notify(item.employee_id)
    return jsonify(message=f'Request {"approved" if decision == "approve" else "rejected"}.')


@routes_bp.get('/admin/activity')
@access('admin')
def activity():
    page = request.args.get('page', 1, type=int)
    if page < 1:
        abort(400, 'Invalid page.')
    result = AuditEvent.query.order_by(AuditEvent.id.desc()).paginate(page=page, per_page=30, error_out=False)
    return jsonify(events=[e.serialize() for e in result.items], page=page, pages=result.pages, total=result.total)
