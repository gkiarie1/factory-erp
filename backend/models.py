from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime

# Initialize the db
db = SQLAlchemy()
bcrypt = Bcrypt()

class Employee(db.Model):
    __tablename__ = 'employee' 
    id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(150), nullable=False)
    clock_in_status = db.Column(db.String(50), default='Not Clocked In')
    clock_in_status_timestamp = db.Column(db.DateTime, nullable=True)
    machine_line = db.Column(db.String(200), nullable=True)
    attendance = db.Column(db.Text, default=0)
    leave_day = db.Column(db.Integer, default=14)
    approved_leaves = db.Column(db.JSON, default=[])
    warnings = db.Column(db.JSON, default=[])
    contract_details = db.Column(db.Text, nullable=True)
    overtime_hours = db.Column(db.Float, default=0.0)

    # Relationship to User
    user = db.relationship('User', back_populates='employee', uselist=False)

class User(db.Model):
    __tablename__ = 'users'  
    id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.String(50), unique=True, nullable=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False) 
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=True)  

    # Relationship with Employee
    employee = db.relationship('Employee', back_populates='user', uselist=False)

def create_default_users():
    admin_email = 'admin@example.com'
    employee_email = 'employee@example.com'
    
    # Check if the admin user exists
    admin_user = User.query.filter_by(email=admin_email).first()
    if not admin_user:
        hashed_password = bcrypt.generate_password_hash('admin123').decode('utf-8')
        new_admin = User(staff_id="ADM001", email=admin_email, password=hashed_password, role='admin')
        db.session.add(new_admin)
        print(f'Admin user {admin_email} created.')

    # Check if the employee user exists
    employee_user = User.query.filter_by(email=employee_email).first()
    if not employee_user:
        hashed_password = bcrypt.generate_password_hash('employee123').decode('utf-8')
        new_employee = Employee(name='Default Employee', staff_id='EMP001') 
        db.session.add(new_employee)
        db.session.flush() 
        new_employee_user = User(email=employee_email, password=hashed_password, role='employee', employee_id=new_employee.id)
        db.session.add(new_employee_user)
        print(f'Employee user {employee_email} created.')

    db.session.commit()
