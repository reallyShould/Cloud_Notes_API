from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import os, uuid

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, Attachment

attachments_router = APIRouter(prefix="/attachments", tags=["Attachments"])


@attachments_router.post("")
async def upload_attachments(
        file: UploadFile,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    file_uuid = uuid.uuid4()
    extension = os.path.splitext(file.filename)[1]
    saved_name = f"{file_uuid}{extension}"

    file_path = f"uploads/{saved_name}"
    file_bytes = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)

    new_attachment = Attachment(
        id=str(file_uuid),
        original_name=file.filename,
        creator_id=current_user.id
    )

    db.add(new_attachment)
    await db.commit()

    return {"url": f"http://localhost:8000/attachments/download/{file_uuid}"}
