# Employee Attendance & Leave Management System

## Overview

This is a Flask-based Employee Management System that includes:

- User authentication (admin & employee roles)

- Employee clock-in/clock-out tracking

- Automated leave day deduction

- Real-time updates using Socket.IO

- PostgreSQL database integration

- Task scheduling using APScheduler

## Features

- JWT Authentication: Secure authentication using JWT tokens.

- Real-Time Notifications: Uses Socket.IO to send real-time updates.

- Automated Clock-Out: Employees are automatically clocked out after 8 hours.

- Leave Tracking: Approved leave days are deducted automatically.

- Role-Based Access Control: Admin and Employee roles with different privileges.

## Tech Stack

Backend: Flask, Python, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Bcrypt, Flask-CORS, Flask-SocketIO

Database: PostgreSQL

Task Scheduling: APScheduler

Real-time Communication: Socket.IO

## Installation & Setup

1. Clone the repository

 git clone git@github.com:gkiarie1/factory-erp.git
 cd factory-erp/backend

2. Set up a virtual environment

python3 -m venv venv
source venv/bin/activate On macOS/Linux
venv\Scripts\activate On Windows

3. Install dependencies

pip install -r requirements.txt

4. Configure environment variables

Create a .env file and add the following:

DATABASE_URL=postgresql://kiarie:Georgeluke2018#@localhost/erp
JWT_SECRET_KEY=super-secret

5. Initialize the database

flask db upgrade Apply migrations (if using Flask-Migrate)

Or manually create the database in PostgreSQL and run:

python3 -m flask shell
>>> from app import db
>>> db.create_all()

6. Run the application

python app.py

By default, the server will start on http://localhost:5000/.

## API Endpoints

### Authentication

- POST /login → Authenticate user and return JWT token

- POST /register → Register a new user (Admin only)

### Employee Management

- GET /employees → Get all employees (Admin only)

- POST /employees/clock-in → Employee clock-in

- POST /employees/clock-out → Employee clock-out

### Leave Management

- GET /employees/leaves → View leave requests

- POST /employees/apply-leave → Apply for leave

- POST /employees/approve-leave → Approve leave (Admin only)

## WebSocket Events

| Event                 | Description                                    |
|------------------------|------------------------------------------------|
| `connect`             | Client connects with a JWT token               |
| `message`             | Receives general messages                      |
| `employee_clocked_out`| Notifies when an employee is auto-clocked out  |
| `leave_day_deducted`  | Notifies when leave days are deducted          |


## Contribution

Fork the repository

Create a feature branch (git checkout -b feature-name)

Commit your changes (git commit -m 'Add new feature')

Push to your branch (git push origin feature-name)

Open a pull request

## License

This project is licensed under the MIT License.

## Contact

For any inquiries, reach out to gkaris24@gmail.com.