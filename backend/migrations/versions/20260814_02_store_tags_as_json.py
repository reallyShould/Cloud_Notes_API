"""Store note tags as native JSON."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260814_02"
down_revision: Union[str, None] = "20260814_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "notes",
        "tags",
        existing_type=sa.Text(),
        type_=sa.JSON(),
        existing_nullable=False,
        postgresql_using=(
            "CASE WHEN pg_input_is_valid(tags, 'json') "
            "THEN tags::json ELSE '[]'::json END"
        ),
    )


def downgrade() -> None:
    op.alter_column(
        "notes",
        "tags",
        existing_type=sa.JSON(),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using="tags::text",
    )
