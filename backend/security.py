"""Persistent authentication controls; never store raw reset tokens or passwords."""
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import secrets
import smtplib
import ssl
from urllib.parse import urlencode
from flask import abort, current_app, jsonify, make_response, request
from sqlalchemy import delete
from extensions import db
from models import AuditEvent, PasswordReset, RateBucket, RevokedToken, User


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def audit(action, target, actor=None, **details):
    db.session.add(AuditEvent(actor_id=actor.id if actor else None,
                              actor_staff_id=actor.staff_id if actor else None,
                              action=action, target=str(target), details=details))


def throttle(scope, identity, limit, seconds=900):
    """Atomic fixed-window counters shared by processes using the same database."""
    if not current_app.config.get('RATE_LIMIT_ENABLED', True):
        return
    now = utcnow()
    bucket = int(now.replace(tzinfo=timezone.utc).timestamp()) // seconds
    key = hashlib.sha256(f'{scope}:{identity}:{bucket}'.encode()).hexdigest()
    if db.engine.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    statement = insert(RateBucket).values(key=key, count=1, expires_at=now + timedelta(seconds=seconds))
    statement = statement.on_conflict_do_update(index_elements=['key'], set_={'count': RateBucket.count + 1}).returning(RateBucket.count)
    count = db.session.execute(statement).scalar_one()
    db.session.commit()
    if count > limit:
        remaining = seconds - int(now.replace(tzinfo=timezone.utc).timestamp()) % seconds
        response = make_response(jsonify(message='Too many attempts. Please try again later.'), 429)
        response.headers['Retry-After'] = str(remaining)
        abort(response)


def auth_limits(scope, identity, account_limit, ip_limit, seconds=900):
    throttle(f'{scope}:ip', request.remote_addr or 'unknown', ip_limit, seconds)
    throttle(f'{scope}:account', identity.lower(), account_limit, seconds)


def token_is_revoked(claims):
    try:
        user = db.session.get(User, int(claims['sub']))
    except (ValueError, TypeError, KeyError):
        return True
    return (not user or not user.is_active or
            claims.get('version') != user.session_version or
            db.session.get(RevokedToken, claims.get('jti', '')) is not None)


def reset_link(user):
    # Invalidate earlier links when issuing a replacement.
    db.session.query(PasswordReset).filter_by(user_id=user.id, used_at=None).update({'used_at': utcnow()})
    token = secrets.token_urlsafe(32)
    db.session.add(PasswordReset(user_id=user.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                 expires_at=utcnow() + timedelta(minutes=30)))
    return current_app.config['PUBLIC_APP_URL'].rstrip('/') + '/reset-password?' + urlencode({'token': token})


def send_reset_email(user, link):
    config = current_app.config
    message = EmailMessage()
    message['Subject'] = 'Reset your Factory password'
    message['From'] = config['SMTP_FROM']
    message['To'] = user.email
    message.set_content(f'A password reset was requested for your Factory account.\n\n{link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email.')
    with smtplib.SMTP(config['SMTP_HOST'], config['SMTP_PORT'], timeout=10) as smtp:
        smtp.ehlo()
        if config['SMTP_STARTTLS']:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if config['SMTP_USERNAME']:
            smtp.login(config['SMTP_USERNAME'], config['SMTP_PASSWORD'])
        smtp.send_message(message)


def prune_security_records():
    now = utcnow()
    for model in (RateBucket, RevokedToken, PasswordReset):
        db.session.execute(delete(model).where(model.expires_at < now))
    db.session.commit()
