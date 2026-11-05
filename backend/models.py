from datetime import datetime, timezone
from sqlalchemy.ext.mutable import MutableList
from extensions import db, bcrypt


class Employee(db.Model):
    __tablename__ = 'employee'
    id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    clock_in_status = db.Column(db.String(50), default='Not Clocked In')
    clock_in_status_timestamp = db.Column(db.DateTime)
    machine_line = db.Column(db.String(200))
    remaining_leave_days = db.Column(db.Integer, default=14)
    approved_leaves = db.Column(MutableList.as_mutable(db.JSON), default=list)
    rejected_leaves = db.Column(MutableList.as_mutable(db.JSON), default=list)
    warnings = db.Column(MutableList.as_mutable(db.JSON), default=list)
    contract_details = db.Column(db.Text)
    overtime_hours = db.Column(db.Float, default=0.0)
    rejected_overtimes = db.Column(MutableList.as_mutable(db.JSON), default=list)
    user = db.relationship('User', back_populates='employee', uselist=False)

    def serialize(self):
        return dict(id=self.id, staff_id=self.staff_id, name=self.name, email=self.email,
                    machine_line=self.machine_line or '', contract_details=self.contract_details or '',
                    clock_in_status=self.clock_in_status, clocked_in_at=self.clock_in_status_timestamp.isoformat() + 'Z' if self.clock_in_status_timestamp else None, leave_days=self.remaining_leave_days,
                    overtime_hours=self.overtime_hours, warnings=self.warnings or [])


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    session_version = db.Column(db.Integer, nullable=False, default=0, server_default='0')
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'))
    employee = db.relationship('Employee', back_populates='user', uselist=False)


class WorkRequest(db.Model):
    __tablename__ = 'work_request'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    hours = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending', nullable=False)
    reason = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    employee = db.relationship('Employee')
    __table_args__ = (db.UniqueConstraint('employee_id', 'kind', 'date'),)

    def serialize(self):
        return dict(id=self.id, employee_id=self.employee_id, name=self.employee.name,
                    staff_id=self.employee.staff_id, kind=self.kind, date=self.date.isoformat(),
                    hours=self.hours, status=self.status, reason=self.reason)


def create_default_users():
    for staff, email, password, role in [('ADM001', 'admin@example.com', 'admin123', 'admin'),
                                          ('EMP001', 'employee@example.com', 'employee123', 'employee')]:
        if User.query.filter_by(staff_id=staff).first():
            continue
        hashed = bcrypt.generate_password_hash(password).decode()
        user = User(staff_id=staff, email=email, password=hashed, role=role)
        if role == 'employee':
            user.employee = Employee(staff_id=staff, email=email, password=hashed,
                                     name='Default Employee', machine_line='Assembly 01')
        db.session.add(user)
    db.session.commit()


class PasswordReset(db.Model):
    __tablename__ = 'password_reset'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime)


class RevokedToken(db.Model):
    __tablename__ = 'revoked_token'
    jti = db.Column(db.String(64), primary_key=True)
    expires_at = db.Column(db.DateTime, nullable=False)


class RateBucket(db.Model):
    __tablename__ = 'rate_bucket'
    key = db.Column(db.String(64), primary_key=True)
    count = db.Column(db.Integer, nullable=False, default=0)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)


class AuditEvent(db.Model):
    __tablename__ = 'audit_event'
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    actor_staff_id = db.Column(db.String(50))
    action = db.Column(db.String(80), nullable=False)
    target = db.Column(db.String(120), nullable=False)
    details = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False, index=True)

    def serialize(self):
        return dict(id=self.id, actor=self.actor_staff_id or 'System', action=self.action,
                    target=self.target, details=self.details, created_at=self.created_at.isoformat() + 'Z')
