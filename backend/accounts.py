import hashlib
from datetime import datetime, timezone
from flask import Blueprint, abort, current_app, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import update
from extensions import db, bcrypt
from models import Employee, PasswordReset, RevokedToken, User
from routes import body, text, access
from security import audit, auth_limits, reset_link, send_reset_email, utcnow

accounts_bp = Blueprint('accounts', __name__)


def new_password(data):
    value = data.get('password')
    if not isinstance(value, str) or len(value) < 12 or len(value.encode()) > 72:
        abort(400, 'Use at least 12 characters and at most 72 UTF-8 bytes for your password.')
    return bcrypt.generate_password_hash(value).decode()


@accounts_bp.post('/auth/forgot-password')
def forgot_password():
    data = body()
    email = text(data, 'email').lower()
    auth_limits('recovery', email, 3, 10, 3600)
    # Always give the same response; links are never returned by this public API.
    user = User.query.filter_by(email=email, is_active=True).first()
    if user and current_app.config['SMTP_HOST']:
        link = reset_link(user)
        audit('password.reset_requested', user.staff_id)
        db.session.commit()
        try:
            send_reset_email(user, link)
        except Exception:
            current_app.logger.error('Password reset email delivery failed; check SMTP configuration.')
    return jsonify(message='If an active account matches and email delivery is configured, a reset link will arrive shortly. You can also contact your administrator.')


@accounts_bp.post('/auth/reset-password')
def reset_password():
    data = body()
    auth_limits('reset', 'public', 100, 15, 3600)
    token = text(data, 'token', 200)
    hashed = hashlib.sha256(token.encode()).hexdigest()
    item = PasswordReset.query.filter_by(token_hash=hashed).first()
    if not item or item.used_at or item.expires_at <= utcnow():
        abort(400, 'This reset link is invalid or has expired. Request a new one.')
    user = db.session.get(User, item.user_id)
    if not user or not user.is_active:
        abort(400, 'This reset link is invalid or has expired. Request a new one.')
    password_hash = new_password(data)
    # One transaction claims the token and replaces the credential.
    claimed = db.session.execute(update(PasswordReset).where(PasswordReset.id == item.id, PasswordReset.used_at.is_(None), PasswordReset.expires_at > utcnow()).values(used_at=utcnow()))
    if claimed.rowcount != 1:
        db.session.rollback()
        abort(400, 'This reset link has already been used.')
    db.session.execute(update(User).where(User.id == user.id).values(password=password_hash, session_version=User.session_version + 1))
    if user.employee:
        user.employee.password = password_hash
    db.session.query(PasswordReset).filter_by(user_id=user.id, used_at=None).update({'used_at': utcnow()})
    audit('password.reset_completed', user.staff_id, user)
    db.session.commit()
    return jsonify(message='Password updated. Sign in with your new password.')


@accounts_bp.post('/auth/change-password')
@jwt_required()
def change_password():
    user = db.get_or_404(User, int(get_jwt_identity()))
    data = body()
    auth_limits('change-password', str(user.id), 5, 20, 3600)
    current = data.get('current_password')
    if not isinstance(current, str) or len(current.encode()) > 72:
        abort(400, 'Provide your current password.')
    if not bcrypt.check_password_hash(user.password, current):
        abort(400, 'The current password is incorrect.')
    password_hash = new_password(data)
    db.session.execute(update(User).where(User.id == user.id).values(password=password_hash, session_version=User.session_version + 1))
    if user.employee:
        user.employee.password = password_hash
    db.session.query(PasswordReset).filter_by(user_id=user.id, used_at=None).update({'used_at': utcnow()})
    audit('password.changed', user.staff_id, user)
    db.session.commit()
    return jsonify(message='Password changed. Please sign in again on all devices.')


@accounts_bp.post('/auth/logout')
@jwt_required()
def logout():
    claims = get_jwt()
    user = db.session.get(User, int(get_jwt_identity()))
    db.session.add(RevokedToken(jti=claims['jti'], expires_at=datetime.fromtimestamp(claims['exp'], timezone.utc).replace(tzinfo=None)))
    audit('session.logged_out', user.staff_id, user)
    db.session.commit()
    return jsonify(message='Signed out.')


@accounts_bp.get('/auth/me')
@jwt_required()
def me():
    user = db.get_or_404(User, int(get_jwt_identity()))
    return jsonify(id=user.id, staff_id=user.staff_id, email=user.email, role=user.role,
                   name=user.employee.name if user.employee else 'Administrator')


@accounts_bp.patch('/admin/accounts/<int:user_id>')
@access('admin')
def account_status(user_id):
    from flask import g
    user = db.get_or_404(User, user_id)
    data = body()
    active = data.get('is_active')
    if not isinstance(active, bool):
        abort(400, 'Provide an active status.')
    if user.id == g.user.id:
        abort(400, 'You cannot deactivate your own account.')
    db.session.execute(update(User).where(User.id == user.id).values(is_active=active, session_version=User.session_version + 1))
    if not active and user.employee_id:
        db.session.execute(update(Employee).where(Employee.id == user.employee_id).values(clock_in_status='Not Clocked In', clock_in_status_timestamp=None))
    audit('account.activated' if active else 'account.deactivated', user.staff_id, g.user)
    db.session.commit()
    from routes import notify
    notify(user.employee_id)
    return jsonify(message='Account access updated.')
