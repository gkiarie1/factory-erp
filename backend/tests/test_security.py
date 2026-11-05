import hashlib
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
from sqlalchemy import inspect, text
from app import create_app
from extensions import db, socketio
from models import AuditEvent, PasswordReset, RateBucket, RevokedToken, User, create_default_users
from security import reset_link, utcnow, prune_security_records
import test_workflows


class Security(unittest.TestCase):
    setUp = test_workflows.Workflows.setUp
    tearDown = test_workflows.Workflows.tearDown
    login = test_workflows.Workflows.login

    def test_login_rate_limit_is_persistent(self):
        for _ in range(10):
            response = self.client.post('/login', json={'staff_id': 'UNKNOWN', 'password': 'wrong'})
            self.assertEqual(response.status_code, 401)
        response = self.client.post('/login', json={'staff_id': 'UNKNOWN', 'password': 'wrong'})
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response.headers['Retry-After']), 0)
        self.assertGreater(RateBucket.query.count(), 0)
        self.assertEqual(AuditEvent.query.filter_by(action='session.login_failed').count(), 10)

    def test_recovery_is_one_use_and_revokes_sessions(self):
        user = User.query.filter_by(staff_id='EMP001').one()
        link = reset_link(user)
        db.session.commit()
        token = parse_qs(urlparse(link).query)['token'][0]
        self.assertNotEqual(PasswordReset.query.one().token_hash, token)
        self.assertEqual(PasswordReset.query.one().token_hash, hashlib.sha256(token.encode()).hexdigest())
        body = {'token': token, 'password': 'a-long-new-password'}
        self.assertEqual(self.client.post('/auth/reset-password', json=body).status_code, 200)
        self.assertEqual(self.client.post('/auth/reset-password', json=body).status_code, 400)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 401)
        self.employee = self.login('EMP001', body['password'])
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 200)
        self.assertEqual(AuditEvent.query.filter_by(action='password.reset_completed').count(), 1)

    def test_expired_and_replaced_reset_links_fail(self):
        user = User.query.filter_by(staff_id='EMP001').one()
        old = parse_qs(urlparse(reset_link(user)).query)['token'][0]
        new = parse_qs(urlparse(reset_link(user)).query)['token'][0]
        db.session.commit()
        self.assertEqual(self.client.post('/auth/reset-password', json={'token': old, 'password': 'long-new-password'}).status_code, 400)
        record = PasswordReset.query.filter_by(token_hash=hashlib.sha256(new.encode()).hexdigest()).one()
        record.expires_at = utcnow() - timedelta(seconds=1)
        db.session.commit()
        self.assertEqual(self.client.post('/auth/reset-password', json={'token': new, 'password': 'long-new-password'}).status_code, 400)

    @patch('accounts.send_reset_email')
    def test_recovery_response_does_not_expose_account_or_token(self, deliver):
        self.app.config['SMTP_HOST'] = 'mail.example.test'
        known = self.client.post('/auth/forgot-password', json={'email': 'employee@example.com'})
        unknown = self.client.post('/auth/forgot-password', json={'email': 'nobody@example.com'})
        self.assertEqual(known.json, unknown.json)
        self.assertEqual(known.status_code, 200)
        deliver.assert_called_once()
        self.assertNotIn('token=', known.get_data(as_text=True))
        self.assertIn('/reset-password?token=', deliver.call_args.args[1])

    def test_logout_revokes_http_and_socket_access(self):
        self.assertEqual(self.client.post('/auth/logout', headers=self.employee).status_code, 200)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 401)
        socket = socketio.test_client(self.app, auth={'token': self.employee['Authorization'][7:]})
        self.assertFalse(socket.is_connected())
        self.assertEqual(RevokedToken.query.count(), 1)

    def test_password_change_and_access_deactivation(self):
        self.assertEqual(self.client.post('/auth/change-password', headers=self.employee, json={'current_password': 'wrong', 'password': 'a-long-new-password'}).status_code, 400)
        response = self.client.post('/auth/change-password', headers=self.employee, json={'current_password': 'employee123', 'password': 'a-long-new-password'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 401)
        self.employee = self.login('EMP001', 'a-long-new-password')
        user = User.query.filter_by(staff_id='EMP001').one()
        self.assertEqual(self.client.patch(f'/admin/accounts/{user.id}', headers=self.admin, json={'is_active': False}).status_code, 200)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 401)
        self.assertEqual(self.client.post('/login', json={'staff_id': 'EMP001', 'password': 'a-long-new-password'}).status_code, 401)
        admin = User.query.filter_by(staff_id='ADM001').one()
        self.assertEqual(self.client.patch(f'/admin/accounts/{admin.id}', headers=self.admin, json={'is_active': False}).status_code, 400)
        self.assertEqual(self.client.patch(f'/admin/accounts/{user.id}', headers=self.admin, json={'is_active': True}).status_code, 200)
        self.assertEqual(self.client.get('/employee/profile', headers=self.employee).status_code, 401)

    def test_security_headers_audit_access_and_pruning(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(self.client.get('/admin/activity', headers=self.employee).status_code, 403)
        result = self.client.get('/admin/activity', headers=self.admin)
        self.assertEqual(result.status_code, 200)
        self.assertGreaterEqual(result.json['total'], 2)
        for event in result.json['events']:
            self.assertNotIn('password', event['details'])
        db.session.add(RateBucket(key='old', count=1, expires_at=utcnow() - timedelta(days=1)))
        db.session.commit()
        prune_security_records()
        self.assertIsNone(db.session.get(RateBucket, 'old'))
        self.assertGreater(AuditEvent.query.count(), 0)


class Migrations(unittest.TestCase):
    def test_empty_database_upgrade_and_idempotence(self):
        with tempfile.TemporaryDirectory() as directory:
            app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{Path(directory) / "fresh.db"}', 'JWT_SECRET_KEY': 'x'*32})
            runner = app.test_cli_runner()
            first = runner.invoke(args=['db', 'upgrade'])
            self.assertEqual(first.exit_code, 0, first.output)
            with app.app_context():
                create_default_users()
            again = runner.invoke(args=['db', 'upgrade'])
            self.assertEqual(again.exit_code, 0, again.output)
            with app.app_context():
                self.assertEqual(User.query.count(), 2)
                self.assertEqual(set(db.metadata.tables) - set(inspect(db.engine).get_table_names()), set())
                db.session.remove()
                db.engine.dispose()

    def test_legacy_database_adoption_preserves_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{Path(directory) / "legacy.db"}', 'JWT_SECRET_KEY': 'x'*32})
            with app.app_context():
                db.create_all()
                create_default_users()
                db.session.remove()
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users DROP COLUMN session_version'))
                    connection.execute(text('ALTER TABLE users DROP COLUMN is_active'))
                    for table in ['password_reset', 'audit_event', 'rate_bucket', 'revoked_token', 'work_request']:
                        connection.execute(text(f'DROP TABLE {table}'))
            result = app.test_cli_runner().invoke(args=['db', 'upgrade'])
            self.assertEqual(result.exit_code, 0, result.output)
            with app.app_context():
                user = User.query.filter_by(staff_id='EMP001').one()
                self.assertTrue(user.is_active)
                self.assertEqual(user.session_version, 0)
                self.assertEqual(user.employee.name, 'Default Employee')
                self.assertEqual(User.query.count(), 2)
                db.session.remove()
                db.engine.dispose()

    def test_production_configuration_rejects_unsafe_defaults(self):
        with self.assertRaisesRegex(RuntimeError, 'JWT_SECRET_KEY'):
            create_app({'PRODUCTION': True, 'JWT_SECRET_KEY': None})
        with self.assertRaisesRegex(RuntimeError, 'PostgreSQL'):
            create_app({'PRODUCTION': True, 'JWT_SECRET_KEY': 'x'*32, 'SQLALCHEMY_DATABASE_URI': 'sqlite://'})
        with self.assertRaisesRegex(RuntimeError, 'HTTPS PUBLIC_APP_URL'):
            create_app({'PRODUCTION': True, 'JWT_SECRET_KEY': 'x'*32, 'SQLALCHEMY_DATABASE_URI': 'postgresql://local/db', 'PUBLIC_APP_URL': 'http://example.test'})
