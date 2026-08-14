"""Create the initial Cloud Notes schema."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260814_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    existing_tables = set(sa.inspect(connection).get_table_names())

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("login", sa.String(length=50), nullable=False),
            sa.Column("pass_hash", sa.String(length=255), nullable=False),
            sa.Column("theme", sa.String(length=20), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("login"),
        )

    if "notes" not in existing_tables:
        op.create_table(
            "notes",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("title", sa.String(length=100), nullable=False),
            sa.Column("text", sa.Text(), nullable=True),
            sa.Column("summary", sa.String(length=280), nullable=True),
            sa.Column("tags", sa.Text(), nullable=False),
            sa.Column("is_pinned", sa.Boolean(), nullable=False),
            sa.Column("is_favorite", sa.Boolean(), nullable=False),
            sa.Column("is_archived", sa.Boolean(), nullable=False),
            sa.Column("created_time", sa.DateTime(), nullable=False),
            sa.Column("edit_time", sa.DateTime(), nullable=False),
            sa.Column("creator_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "attachments" not in existing_tables:
        op.create_table(
            "attachments",
            sa.Column("id", sa.String(length=256), nullable=False),
            sa.Column("original_name", sa.String(length=256), nullable=False),
            sa.Column("creator_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    op.drop_table("attachments")
    op.drop_table("notes")
    op.drop_table("users")
