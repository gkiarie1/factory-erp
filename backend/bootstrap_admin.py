"""Create a first preview administrator from environment secrets, never reset one."""
import os
import re
from sqlalchemy.exc import IntegrityError
from app import create_app
from extensions import db, bcrypt
from models import User
from security import audit


def bootstrap_admin():
    if User.query.filter_by(role='admin').first():
        return 'Administrator already exists; credentials unchanged.'
    password = os.environ.get('INITIAL_ADMIN_PASSWORD', '')
    staff_id = os.environ.get('INITIAL_ADMIN_STAFF_ID', 'ADM001').strip().upper()
    email = os.environ.get('INITIAL_ADMIN_EMAIL', 'preview-admin@factory.invalid').strip().lower()
    if len(password) < 12 or len(password.encode()) > 72:
        raise ValueError('Set INITIAL_ADMIN_PASSWORD to at least 12 characters and at most 72 UTF-8 bytes.')
    if not staff_id or len(staff_id) > 50 or len(email) > 150 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('Provide a valid INITIAL_ADMIN_STAFF_ID and INITIAL_ADMIN_EMAIL.')
    if User.query.filter((User.staff_id == staff_id) | (User.email == email)).first():
        raise ValueError('Initial administrator identity conflicts with an existing account; no changes made.')
    user = User(staff_id=staff_id, email=email, password=bcrypt.generate_password_hash(password).decode(), role='admin')
    db.session.add(user)
    try:
        db.session.flush()
        audit('account.admin_created', user.staff_id, user, source='render_bootstrap')
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        # A competing first-start process may have created the administrator.
        if User.query.filter_by(role='admin').first():
            return 'Administrator already exists; credentials unchanged.'
        raise ValueError('Initial administrator could not be created; check account identity conflicts.') from None
    return 'Initial administrator created. Retrieve its password from the Render environment settings.'


if __name__ == '__main__':
    with create_app().app_context():
        print(bootstrap_admin())
