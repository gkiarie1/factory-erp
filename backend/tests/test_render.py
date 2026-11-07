import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from app import create_app
from bootstrap_admin import bootstrap_admin
from extensions import db, bcrypt
from models import User, AuditEvent


class RenderBootstrap(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'PRODUCTION': False,
                              'SQLALCHEMY_DATABASE_URI': 'sqlite://', 'JWT_SECRET_KEY': 'x' * 32})
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    @patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'test-only-strong-password'})
    def test_first_admin_is_created_once_without_resetting_credentials(self):
        result = bootstrap_admin()
        self.assertNotIn('test-only-strong-password', result)
        admin = User.query.one()
        original = admin.password
        self.assertTrue(bcrypt.check_password_hash(original, 'test-only-strong-password'))
        with patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'different-strong-password'}):
            bootstrap_admin()
        self.assertEqual(User.query.count(), 1)
        self.assertEqual(User.query.one().password, original)
        self.assertEqual(AuditEvent.query.count(), 1)

    @patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'short'})
    def test_weak_bootstrap_password_is_rejected(self):
        with self.assertRaises(ValueError):
            bootstrap_admin()
        self.assertEqual(User.query.count(), 0)

    @patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'test-only-strong-password'})
    def test_bootstrap_cannot_promote_an_existing_employee(self):
        db.session.add(User(staff_id='ADM001', email='employee@example.com', password='unused', role='employee'))
        db.session.commit()
        with self.assertRaisesRegex(ValueError, 'conflicts'):
            bootstrap_admin()
        self.assertEqual(User.query.one().role, 'employee')


class RenderStart(unittest.TestCase):
    def test_start_script_normalizes_url_and_orders_migrations_before_server(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = root / 'calls'
            # Stubs observe configuration without contacting a database or binding a port.
            stub = '#!/bin/sh\nprintf "%s|%s|%s|%s\\n" "$*" "$DATABASE_URL" "$PUBLIC_APP_URL" "$CORS_ORIGINS" >> "$CALLS"\n'
            for name in ('python', 'gunicorn'):
                binary = root / name
                binary.write_text(stub)
                binary.chmod(0o755)
            environment = dict(os.environ, PATH=f'{directory}:/usr/bin:/bin', CALLS=str(calls),
                               DATABASE_URL='postgres://test-only/db', RENDER_EXTERNAL_URL='https://api.example.test', PORT='10000')
            for key in ('PUBLIC_APP_URL', 'CORS_ORIGINS'):
                environment.pop(key, None)
            script = Path(__file__).resolve().parents[1] / 'render-start.sh'
            subprocess.run(['sh', str(script)], env=environment, check=True)
            entries = calls.read_text().splitlines()
            self.assertEqual(len(entries), 3)
            self.assertTrue(entries[0].startswith('-m flask --app app:create_app db upgrade|'))
            self.assertTrue(entries[1].startswith('bootstrap_admin.py|'))
            self.assertIn('--bind 0.0.0.0:10000', entries[2])
            for entry in entries:
                self.assertTrue(entry.endswith('|postgresql://test-only/db|https://api.example.test|https://api.example.test'))
