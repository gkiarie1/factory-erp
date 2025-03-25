from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from models import db, User, Employee
import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db, socketio, bcrypt
from flask_socketio import emit

routes_bp = Blueprint('routes', __name__)
# ------------------ AUTH ROUTES ------------------ #

@routes_bp.route('/all', methods=['GET'])
def get_all_users():
    users = User.query.all()
    return jsonify([{'id': user.id, 'email': user.email, 'role': user.role, 'staff_id': user.staff_id} for user in users]),200

@routes_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)
    
    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    data = request.get_json()
    email, password, role = data.get('email'), data.get('password'), data.get('role', 'employee')
    name, machine_line = data.get('name'), data.get('machine_line')
    contract_details = data.get('contract_details', 'No contract details')

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 400

    staff_id = str(uuid.uuid4().hex[:5]).upper()
    while User.query.filter_by(staff_id=staff_id).first():
        staff_id = str(uuid.uuid4().hex[:5]).upper()

    hashed_password = generate_password_hash(password)

    if role == 'employee':
        new_employee = Employee(name=name, staff_id=staff_id, machine_line=machine_line, contract_details=contract_details)
        db.session.add(new_employee)
        db.session.flush() 

        new_user = User(email=email, password=hashed_password, role=role, staff_id=staff_id, employee_id=new_employee.id)
        db.session.add(new_user)
    else:
        new_user = User(email=email, password=hashed_password, role=role, staff_id=staff_id)
        db.session.add(new_user)

    db.session.commit()

    socketio.emit('employee_created', {'staff_id': staff_id, 'name': name, 'role': role}, broadcast=True)
    return jsonify({'message': 'User created successfully!', 'staff_id': staff_id}), 201


@routes_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    staff_id = data.get('staff_id')
    password = data.get('password')

    user = User.query.filter_by(staff_id=staff_id).first()
    if user and bcrypt.check_password_hash(user.password, password):
        access_token = create_access_token(identity=user.id, expires_delta=datetime.timedelta(days=1))
        
        # Update clock-in status if employee logs in
        if user.role == 'employee':
            employee = Employee.query.filter_by(staff_id=staff_id).first()
            if employee:
                employee.clock_in_status = 'Clocked In'
                employee.clock_in_status_timestamp = datetime.datetime.now()
                db.session.commit()

                
                # Emit clock-in event
                socketio.emit('employee_clocked_in', {'employee_id': employee.id, 'name': employee.name})

        return jsonify({'access_token': access_token, 'role': user.role}), 200 
    return jsonify({'message': 'Invalid credentials'}), 401


# ------------------ EMPLOYEE ROUTES ------------------ #

@routes_bp.route('/employee/clock-out', methods=['POST'])
@jwt_required()
def clock_out():
    current_user = get_jwt_identity()
    user = User.query.get(current_user)

    if not user or not user.employee_id:
        return jsonify({'message': 'Unauthorized'}), 403

    employee = Employee.query.get(user.employee_id)
    if employee:
        clock_out_time = datetime.datetime.now()
        shift_end = datetime.datetime.combine(clock_out_time.date(), datetime.time(17, 0))

        if clock_out_time > shift_end:
            employee.overtime_hours += (clock_out_time - shift_end).total_seconds() / 3600

        employee.clock_in_status = 'Not Clocked In'
        db.session.commit()

        socketio.emit('employee_clocked_out', {'employee_id': employee.id, 'name': employee.name}, broadcast=True)
        return jsonify({'message': 'Clocked Out successfully!'}), 200

    return jsonify({'message': 'Employee not found'}), 404


@routes_bp.route('/employee/profile', methods=['GET'])
@jwt_required()
def get_employee_profile():
    current_user = get_jwt_identity()
    user = User.query.get(current_user)
    print(user)

    if not user or not user.employee_id:
        return jsonify({'message': 'Unauthorized'}), 403
    
    employee = Employee.query.get(user.employee_id)
    if not employee:
        return jsonify({'message': 'Profile not found'}), 404

    return jsonify({
        'staff_id': employee.staff_id,
        'name': employee.name,
        'clock_in_status': employee.clock_in_status,
        'machine_line': employee.machine_line,
        'leave_days': employee.remaining_leave_days,
        'warnings': employee.warnings,
        'contract_details': employee.contract_details or 'No contract details',
        'overtime_hours': employee.overtime_hours
    }), 200


@routes_bp.route('/employee/apply-leave', methods=['POST'])
@jwt_required()
def apply_leave():
    current_user = get_jwt_identity()
    user = User.query.get(current_user)

    data = request.get_json()
    leave_date = data.get('leave_date')

    socketio.emit('leave_request', {'id': user.id, 'email': user.email, 'leave_date': leave_date})
    return jsonify({'message': 'Leave request submitted successfully!'}), 200


@routes_bp.route('/employee/apply-overtime', methods=['POST'])
@jwt_required()
def apply_overtime():
    current_user = get_jwt_identity()
    user = User.query.get(current_user)

    data = request.get_json()
    overtime_date = data.get('overtime_date')

    socketio.emit('overtime_request', {'id': user.id, 'email': user.email, 'overtime_date': overtime_date})
    return jsonify({'message': 'Overtime request submitted successfully!'}), 200


# ------------------ ADMIN ROUTES ------------------ #

@routes_bp.route('/admin/dashboard', methods=['GET'])
@jwt_required()
def admin_dashboard():
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)

    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    employees = Employee.query.all()
    return jsonify({'attendance': [{
        'id': emp.id, 'staff_id': emp.staff_id, 'name': emp.name,
        'contract_details': emp.contract_details or 'No contract details',
        'clock_in_status': emp.clock_in_status, 'machine_line': emp.machine_line,
        'leave_days': emp.remaining_leave_days, 'warnings': emp.warnings, 'overtime_hours': emp.overtime_hours
    } for emp in employees]}), 200


@routes_bp.route('/employee/<int:employee_id>/add-warning', methods=['POST'])
@jwt_required()
def add_warning(employee_id):
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)

    if admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    data = request.get_json()
    warning_text = data.get('warning', '').strip()

    employee = Employee.query.get(employee_id)
    if employee:
        employee.warnings.append(warning_text)
        db.session.commit()
        emit('warning_added', {'employee_id': employee.id, 'warnings': employee.warnings}, broadcast=True)
        return jsonify({'message': 'Warning added successfully!'}), 200

    return jsonify({'message': 'Employee not found'}), 404

# ------------------ APPROVAL ROUTES ------------------ #

@routes_bp.route('/admin/approve-leave/<int:employee_id>', methods=['POST'])
@jwt_required()
def approve_leave(employee_id):
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)

    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'message': 'Employee not found'}), 404

    data = request.get_json()
    leave_date = data.get('leave_date')

    employee.leave_day = leave_date  
    db.session.commit()

    socketio.emit('leave_approved', {'employee_id': employee.id, 'name': employee.name, 'leave_date': leave_date})
    return jsonify({'message': 'Leave approved successfully!'}), 200

@routes_bp.route('/admin/reject-leave/<int:employee_id>', methods=['POST'])
@jwt_required()
def reject_leave(employee_id): 
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)
    print(admin_user)
    

    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'message': 'Employee not found'}), 404

    data = request.get_json()
    reason = data.get('reason', 'No reason provided')

    employee.rejected_leaves.append({'date': data.get('leave_date'), 'reason': reason})
    db.session.commit()

    socketio.emit('leave_rejected', {'employee_id': employee_id, 'reason': reason})
    return jsonify({'message': 'Leave request rejected and recorded'}), 200


@routes_bp.route('/admin/approve-overtime/<int:employee_id>', methods=['POST'])
@jwt_required()
def approve_overtime(employee_id):
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)

    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'message': 'Employee not found'}), 404

    data = request.get_json()
    overtime_hours = data.get('overtime_hours', 0)

    employee.overtime_hours += overtime_hours
    db.session.commit()

    socketio.emit('overtime_approved', {'employee_id': employee.id, 'name': employee.name, 'overtime_hours': overtime_hours})
    return jsonify({'message': 'Overtime approved successfully!'}), 200

@routes_bp.route('/admin/reject-overtime/<int:employee_id>', methods=['POST'])
@jwt_required()
def reject_overtime(employee_id):
    current_user = get_jwt_identity()
    admin_user = User.query.get(current_user)

    if not admin_user or admin_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'message': 'Employee not found'}), 404

    data = request.get_json()
    reason = data.get('reason', 'No reason provided')

    employee.rejected_overtimes.append({'date': data.get('overtime_date'), 'reason': reason})
    db.session.commit()

    socketio.emit('overtime_rejected', {'employee_id': employee_id, 'reason': reason})
    return jsonify({'message': 'Overtime request rejected and recorded'}), 200
