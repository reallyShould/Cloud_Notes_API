from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import os, uuid

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, Attachment

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

attachments_router = APIRouter(prefix="/attachments", tags=["Attachments"])


@attachments_router.post("")
async def upload_attachments(
        file: UploadFile,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    file_uuid = uuid.uuid4()
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

@attachments_router.get("/download/{file_uuid}")
async def download_attachment(
    file_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Attachment).where(Attachment.id == file_uuid)
    result = await db.execute(query)
    attachment = result.scalar_one_or_none()

    if attachment is None or attachment.creator_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found")

    files = [f for f in os.listdir("uploads") if f.startswith(file_uuid)]
    if not files:
        raise HTTPException(status_code=404, detail="File on disk not found")

    file_name = files[0]
    file_path = f"uploads/{file_name}"

    return FileResponse(file_path)

