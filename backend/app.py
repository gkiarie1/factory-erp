import logging
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
import click
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import decode_token
from flask_socketio import join_room
from sqlalchemy.exc import IntegrityError, OperationalError
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from extensions import db, bcrypt, jwt, socketio, migrate


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        PRODUCTION=os.environ.get('APP_ENV') == 'production',
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URL', 'sqlite:///factory.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={'pool_pre_ping': True},
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY'), JWT_ACCESS_TOKEN_EXPIRES=1800,
        MAX_CONTENT_LENGTH=16384, RATE_LIMIT_ENABLED=True,
        APP_TIMEZONE=os.environ.get('APP_TIMEZONE', 'Africa/Nairobi'),
        PUBLIC_APP_URL=os.environ.get('PUBLIC_APP_URL', 'http://localhost:3000'),
        CORS_ORIGINS=os.environ.get('CORS_ORIGINS', 'http://localhost:3000'),
        SMTP_HOST=os.environ.get('SMTP_HOST', ''), SMTP_PORT=int(os.environ.get('SMTP_PORT', 587)),
        SMTP_STARTTLS=os.environ.get('SMTP_STARTTLS', 'true').lower() == 'true',
        SMTP_USERNAME=os.environ.get('SMTP_USERNAME', ''), SMTP_PASSWORD=os.environ.get('SMTP_PASSWORD', ''),
        SMTP_FROM=os.environ.get('SMTP_FROM', 'factory@localhost'),
    )
    if config:
        app.config.update(config)
    ZoneInfo(app.config['APP_TIMEZONE'])
    if app.config['PRODUCTION']:
        if len(app.config['JWT_SECRET_KEY'] or '') < 32:
            raise RuntimeError('Production requires JWT_SECRET_KEY with at least 32 characters.')
        if not app.config['SQLALCHEMY_DATABASE_URI'].startswith(('postgresql://', 'postgresql+psycopg2://')):
            raise RuntimeError('Production requires a PostgreSQL DATABASE_URL.')
        if urlparse(app.config['PUBLIC_APP_URL']).scheme != 'https':
            raise RuntimeError('Production requires an HTTPS PUBLIC_APP_URL.')
        if '*' in app.config['CORS_ORIGINS'] or any(not origin.strip().startswith('https://') for origin in app.config['CORS_ORIGINS'].split(',')):
            raise RuntimeError('Production requires explicit HTTPS CORS_ORIGINS.')
        if app.config['SMTP_HOST'] and not app.config['SMTP_STARTTLS']:
            raise RuntimeError('Production SMTP requires STARTTLS.')
    if not app.config['JWT_SECRET_KEY']:
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)
        secret_file = Path(app.instance_path) / 'jwt-secret'
        try:
            descriptor = os.open(secret_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(descriptor, 'w') as stream:
                stream.write(secrets.token_hex(32))
        app.config['JWT_SECRET_KEY'] = secret_file.read_text().strip()
    if len(app.config['JWT_SECRET_KEY']) < 32:
        raise RuntimeError('JWT_SECRET_KEY must contain at least 32 characters.')
    if os.environ.get('TRUST_PROXY') == '1':
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
    origins = [origin.strip() for origin in app.config['CORS_ORIGINS'].split(',') if origin.strip()]
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db, directory=str(Path(__file__).parent / 'migrations'), compare_type=True)
    socketio.init_app(app, cors_allowed_origins=origins)
    CORS(app, origins=origins)
    app.config['DUMMY_PASSWORD_HASH'] = bcrypt.generate_password_hash(secrets.token_hex(16)).decode()
    from routes import routes_bp
    from accounts import accounts_bp
    from security import token_is_revoked
    app.register_blueprint(routes_bp)
    app.register_blueprint(accounts_bp)
    jwt.token_in_blocklist_loader(lambda header, claims: token_is_revoked(claims))

    @app.after_request
    def response_headers(response):
        response.headers.update({'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                                 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
                                 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'})
        if app.config['PRODUCTION']:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        return response

    @app.get('/health')
    def health():
        from models import User
        db.session.query(User.id, User.session_version).limit(1).all()
        return jsonify(status='ok')

    @app.errorhandler(HTTPException)
    def http_error(error):
        if error.response is not None:
            return error.response
        return jsonify(message=error.description), error.code

    @app.errorhandler(IntegrityError)
    def conflict(error):
        db.session.rollback()
        return jsonify(message='A record with these details already exists.'), 409

    @app.errorhandler(OperationalError)
    def database_error(error):
        db.session.rollback()
        app.logger.error('Database unavailable; check connectivity and migrations.')
        return jsonify(message='Database unavailable. Check database settings and run migrations.'), 503

    @app.errorhandler(Exception)
    def unexpected_error(error):
        db.session.rollback()
        app.logger.error('Unhandled %s on %s', type(error).__name__, request.path)
        if app.testing:
            raise error
        return jsonify(message='An unexpected error occurred. Please try again.'), 500

    @app.cli.command('init-db')
    def init_db():
        """Apply all versioned database migrations."""
        from flask_migrate import upgrade
        upgrade()
        click.echo('Database migrations applied.')

    @app.cli.command('seed-demo')
    def seed_demo():
        """Create demonstration accounts in development only."""
        if app.config['PRODUCTION']:
            raise click.ClickException('Demo accounts are disabled in production.')
        from models import create_default_users
        create_default_users()
        click.echo('Demo accounts ready: ADM001 / admin123; EMP001 / employee123')

    @app.cli.command('create-admin')
    @click.option('--staff-id', prompt=True)
    @click.option('--email', prompt=True)
    @click.password_option()
    def create_admin(staff_id, email, password):
        """Create an administrator without enabling demo accounts."""
        from models import User
        from security import audit
        if len(password) < 12 or len(password.encode()) > 72:
            raise click.ClickException('Password must contain at least 12 characters and at most 72 UTF-8 bytes.')
        if not staff_id.strip() or len(staff_id) > 50 or '@' not in email or len(email) > 150:
            raise click.ClickException('Provide a valid staff ID and email.')
        user = User(staff_id=staff_id.strip().upper(), email=email.strip().lower(), password=bcrypt.generate_password_hash(password).decode(), role='admin')
        db.session.add(user)
        try:
            db.session.flush()
            audit('account.admin_created', user.staff_id, user)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise click.ClickException('Staff ID or email already exists.')
        click.echo(f'Administrator {user.staff_id} created.')

    @app.cli.command('reset-link')
    @click.argument('staff_id')
    def operator_reset(staff_id):
        """Issue a sensitive, one-use recovery link for administrator delivery."""
        from models import User
        from security import reset_link, audit
        user = User.query.filter_by(staff_id=staff_id.upper(), is_active=True).first()
        if not user:
            raise click.ClickException('Active account not found.')
        link = reset_link(user)
        audit('password.operator_link_issued', user.staff_id)
        db.session.commit()
        click.echo('Deliver this sensitive link privately. It expires in 30 minutes:')
        click.echo(link)

    @app.cli.command('prune-security')
    def prune_security():
        """Remove expired throttle buckets, revocations and reset links."""
        from security import prune_security_records
        prune_security_records()
        click.echo('Expired security records removed. Audit events retained.')

    logging.basicConfig(level=logging.INFO)
    return app


@socketio.on('connect')
def connect(auth=None):
    from models import User
    from security import token_is_revoked
    try:
        claims = decode_token((auth or {}).get('token'))
        if token_is_revoked(claims):
            return False
        user = db.session.get(User, int(claims['sub']))
        join_room('admins' if user.role == 'admin' else f'employee:{user.employee_id}')
    except Exception:
        return False


if __name__ == '__main__':
    app = create_app()
    if app.config['PRODUCTION']:
        raise RuntimeError('Use Gunicorn for production; see DEPLOYMENT.md.')
    socketio.run(app, host='127.0.0.1', port=int(os.environ.get('PORT', 5000)), allow_unsafe_werkzeug=True)
