"""Initial workforce and security schema

Revision ID: eb2f8cbec000
Revises: 
Create Date: 2026-11-05 17:55:21.105926

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eb2f8cbec000'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if 'employee' not in tables:
        op.create_table('employee',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('password', sa.String(length=200), nullable=False),
        sa.Column('clock_in_status', sa.String(length=50), nullable=True),
        sa.Column('clock_in_status_timestamp', sa.DateTime(), nullable=True),
        sa.Column('machine_line', sa.String(length=200), nullable=True),
        sa.Column('remaining_leave_days', sa.Integer(), nullable=True),
        sa.Column('approved_leaves', sa.JSON(), nullable=True),
        sa.Column('rejected_leaves', sa.JSON(), nullable=True),
        sa.Column('warnings', sa.JSON(), nullable=True),
        sa.Column('contract_details', sa.Text(), nullable=True),
        sa.Column('overtime_hours', sa.Float(), nullable=True),
        sa.Column('rejected_overtimes', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('staff_id')
        )
    if 'rate_bucket' not in tables:
        op.create_table('rate_bucket',
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('key')
        )
    if 'ix_rate_bucket_expires_at' not in {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('rate_bucket')}:
        op.create_index('ix_rate_bucket_expires_at', 'rate_bucket', ['expires_at'])

    if 'revoked_token' not in tables:
        op.create_table('revoked_token',
        sa.Column('jti', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('jti')
        )
    if 'users' not in tables:
        op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('password', sa.String(length=200), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('session_version', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['employee.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('staff_id')
        )
    if 'work_request' not in tables:
        op.create_table('work_request',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('hours', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['employee.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id', 'kind', 'date')
        )
    if 'audit_event' not in tables:
        op.create_table('audit_event',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('actor_staff_id', sa.String(length=50), nullable=True),
        sa.Column('action', sa.String(length=80), nullable=False),
        sa.Column('target', sa.String(length=120), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
    if 'ix_audit_event_created_at' not in {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('audit_event')}:
        op.create_index('ix_audit_event_created_at', 'audit_event', ['created_at'])

    if 'password_reset' not in tables:
        op.create_table('password_reset',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash')
        )
    if 'ix_password_reset_user_id' not in {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('password_reset')}:
        op.create_index('ix_password_reset_user_id', 'password_reset', ['user_id'])


    columns = {column['name'] for column in sa.inspect(op.get_bind()).get_columns('users')}
    if 'session_version' not in columns:
        op.add_column('users', sa.Column('session_version', sa.Integer(), nullable=False, server_default='0'))
    if 'is_active' not in columns:
        op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))



def downgrade():
    raise RuntimeError('This adoption migration cannot be safely reversed. Restore a verified backup instead.')
