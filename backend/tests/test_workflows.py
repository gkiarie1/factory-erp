import unittest
import os
from sqlalchemy.engine import make_url
from datetime import date
from app import create_app
from extensions import db, socketio
from models import create_default_users, Employee, User
from routes import business_date


class Workflows(unittest.TestCase):
    def setUp(self):
        test_url = os.environ.get('FACTORY_TEST_DATABASE_URL', 'sqlite://')
        if test_url != 'sqlite://' and not (make_url(test_url).database or '').startswith('factory_test_'):
            raise RuntimeError('Integration database names must start with factory_test_. Never use a live database.')
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': test_url, 'JWT_SECRET_KEY': 'test-secret-that-is-at-least-32-bytes'})
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        create_default_users()
        self.client = self.app.test_client()
        self.admin = self.login('ADM001', 'admin123')
        self.employee = self.login('EMP001', 'employee123')

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def login(self, staff, password):
        response = self.client.post('/login', json={'staff_id': staff, 'password': password})
        self.assertEqual(response.status_code, 200)
        return {'Authorization': 'Bearer ' + response.json['access_token']}

    def test_create_employee_and_login(self):
        response = self.client.post('/register', headers=self.admin, json={'staff_id': 'NEW001', 'name': 'Jane Doe', 'email': 'jane@example.com', 'password': 'new-password-123'})
        self.assertEqual(response.status_code, 201)
        headers = self.login('NEW001', 'new-password-123')
        self.assertEqual(self.client.get('/employee/profile', headers=headers).json['name'], 'Jane Doe')
        self.assertEqual(Employee.query.count(), 2)

    def test_leave_persists_and_can_only_be_decided_once(self):
        payload = {'leave_date': business_date().isoformat()}
        self.assertEqual(self.client.post('/employee/apply-leave', headers=self.employee, json=payload).status_code, 201)
        self.assertEqual(self.client.post('/employee/apply-leave', headers=self.employee, json=payload).status_code, 409)
        item = self.client.get('/admin/dashboard', headers=self.admin).json['requests'][0]
        path = f'/admin/requests/{item["id"]}/approve'
        self.assertEqual(self.client.post(path, headers=self.admin, json={}).status_code, 200)
        self.assertEqual(self.client.post(path, headers=self.admin, json={}).status_code, 409)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).json['leave_days'], 13)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).json['requests'][0]['status'], 'approved')

    def test_overtime_and_rejection(self):
        self.client.post('/employee/apply-overtime', headers=self.employee, json={'overtime_date': business_date().isoformat(), 'overtime_hours': 2.5})
        item = self.client.get('/admin/dashboard', headers=self.admin).json['requests'][0]
        self.assertEqual(self.client.post(f'/admin/requests/{item["id"]}/approve', headers=self.admin, json={}).status_code, 200)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).json['overtime_hours'], 2.5)
        self.client.post('/employee/apply-leave', headers=self.employee, json={'leave_date': business_date().isoformat()})
        items = self.client.get('/admin/dashboard', headers=self.admin).json['requests']
        leave = next(r for r in items if r['kind'] == 'leave')
        self.client.post(f'/admin/requests/{leave["id"]}/reject', headers=self.admin, json={'reason': 'Coverage needed'})
        profile = self.client.get('/employee/profile', headers=self.employee).json
        self.assertEqual(profile['leave_days'], 14)
        self.assertEqual(next(r for r in profile['requests'] if r['kind'] == 'leave')['reason'], 'Coverage needed')

    def test_access_validation_and_attendance(self):
        self.assertEqual(self.client.get('/all').status_code, 401)
        self.assertEqual(self.client.get('/admin/dashboard', headers=self.employee).status_code, 403)
        self.assertEqual(self.client.post('/employee/apply-leave', headers=self.admin, json={}).status_code, 403)
        self.assertEqual(self.client.post('/employee/apply-leave', headers=self.employee, json={'leave_date': 'bad'}).status_code, 400)
        self.assertEqual(self.client.post('/employee/apply-overtime', headers=self.employee, json={'overtime_date': business_date().isoformat(), 'overtime_hours': -4}).status_code, 400)
        self.assertEqual(self.client.post('/employee/clock-in', headers=self.employee).status_code, 200)
        self.assertEqual(self.client.post('/employee/clock-in', headers=self.employee).status_code, 409)
        self.assertEqual(self.client.post('/employee/clock-out', headers=self.employee).status_code, 200)
        self.assertEqual(self.client.post('/employee/clock-out', headers=self.employee).status_code, 409)

    def test_edit_warning_and_demo_seed_idempotence(self):
        employee = Employee.query.first()
        self.assertEqual(self.client.patch(f'/employee/{employee.id}/edit', headers=self.admin, json={'name': 'Updated Name'}).status_code, 200)
        self.assertEqual(self.client.post(f'/employee/{employee.id}/add-warning', headers=self.admin, json={'warning': 'Safety briefing required'}).status_code, 200)
        db.session.expire_all()
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).json['warnings'], ['Safety briefing required'])
        create_default_users()
        self.assertEqual(User.query.count(), 2)
        self.assertEqual(Employee.query.first().name, 'Updated Name')

    def test_socket_rooms_are_private(self):
        admin = socketio.test_client(self.app, auth={'token': self.admin['Authorization'][7:]})
        employee = socketio.test_client(self.app, auth={'token': self.employee['Authorization'][7:]})
        anonymous = socketio.test_client(self.app)
        self.assertFalse(anonymous.is_connected())
        self.assertTrue(admin.is_connected())
        self.assertTrue(employee.is_connected())
        socketio.emit('private_test', {}, to='admins')
        self.assertTrue(any(event['name'] == 'private_test' for event in admin.get_received()))
        self.assertEqual(employee.get_received(), [])
        admin.disconnect()
        employee.disconnect()



class StartupPersistence(unittest.TestCase):
    def test_new_app_preserves_existing_database(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            config = {'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{Path(directory) / "test.db"}', 'JWT_SECRET_KEY': 'test-secret-that-is-at-least-32-bytes'}
            first = create_app(config)
            with first.app_context():
                db.create_all()
                create_default_users()
                Employee.query.first().name = 'Persisted Employee'
                db.session.commit()
                db.session.remove()
                db.engine.dispose()
            second = create_app(config)
            with second.app_context():
                self.assertEqual(Employee.query.first().name, 'Persisted Employee')
                self.assertEqual(User.query.count(), 2)
                db.session.remove()
                db.engine.dispose()


if __name__ == '__main__':
    unittest.main()
