from flask import Flask,request
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO, disconnect
from flask_jwt_extended import decode_token
from apscheduler.schedulers.background import BackgroundScheduler
import datetime
from models import db, bcrypt, create_default_users,Employee
from routes import routes_bp
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] ='postgresql://kiarie:Georgeluke2018#@localhost/erp'
JWT_SECRET_KEY = 'super-secret'

# Initialize Extensions
db.init_app(app)
bcrypt.init_app(app)  
jwt = JWTManager(app)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000"], logger=True, engineio_logger=True)

app.register_blueprint(routes_bp)

def valid_token(token):
    try:
        decode_token(token)
        return True
    except Exception as e:
        print(f"Token validation failed: {e}")
        return False

# Socket.IO Events
@socketio.on('connect')
def connect():
    token = request.args.get('token')
    if not token or not valid_token(token):
        disconnect()
        return  
    print("Client connected with a valid token")

@socketio.on('message')
def handle_message(data):
    print(f"Message received: {data}")

# Create Database Tables
with app.app_context():
    db.create_all()
    create_default_users()

# Initialize a scheduler for periodic tasks
scheduler = BackgroundScheduler()
scheduler.start()

def auto_clock_out():
    with app.app_context():
        employees = Employee.query.filter_by(clock_in_status='Clocked In').all()
        for employee in employees:
            clock_in_time = employee.clock_in_status_timestamp  
            if clock_in_time:
                elapsed_hours = (datetime.datetime.now() - clock_in_time).total_seconds() / 3600
                if elapsed_hours >= 8 and employee.overtime_hours <= 0: 
                    employee.clock_in_status = 'Not Clocked In'
                    db.session.commit()

                    socketio.emit('employee_clocked_out', {
                        'employee_id': employee.id,
                        'name': employee.name,
                        'reason': 'Auto Clocked Out'
                    })

scheduler.add_job(auto_clock_out, 'interval', hours=1)

def deduct_leave_days():
    with app.app_context():
        employees = Employee.query.all()
        for employee in employees:
            approved_leaves = employee.approved_leaves  
            if approved_leaves:
                for leave_date in approved_leaves:
                    leave_datetime = datetime.datetime.strptime(leave_date, '%Y-%m-%d')
                    if leave_datetime.date() < datetime.datetime.now().date(): 
                        if employee.leave_day > 0:
                            employee.leave_day -= 1
                            approved_leaves.remove(leave_date) 
                        db.session.commit()

                        socketio.emit('leave_day_deducted', {
                            'employee_id': employee.id,
                            'name': employee.name,
                            'remaining_leave_days': employee.leave_day
                        })

# Schedule leave day deduction at midnight
scheduler.add_job(deduct_leave_days, 'cron', hour=0, minute=0)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True, host='0.0.0.0',port=port)
