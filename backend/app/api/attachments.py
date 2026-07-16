import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Attachment, User

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 25 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))

attachments_router = APIRouter(prefix="/attachments", tags=["Attachments"])


def has_valid_image_signature(extension: str, header: bytes) -> bool:
    if extension in {".jpg", ".jpeg"}:
        return header.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    if extension == ".webp":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    return False


@attachments_router.post("")
async def upload_attachment(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original_name = file.filename or "upload"
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_uuid = uuid.uuid4()
    file_path = UPLOAD_DIR / f"{file_uuid}{extension}"
    total_size = 0
    header = b""

    try:
        with file_path.open("wb") as destination:
            while chunk := await file.read(CHUNK_SIZE):
                if not header:
                    header = chunk[:16]
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large. Maximum allowed size is 25 MB.",
                    )
                destination.write(chunk)

        if not has_valid_image_signature(extension, header):
            raise HTTPException(status_code=400, detail="File content is not a valid image")

        attachment = Attachment(
            id=str(file_uuid),
            original_name=original_name,
            creator_id=current_user.id,
        )
        db.add(attachment)
        await db.commit()
    except Exception:
        file_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    return {"url": f"/api/attachments/download/{file_uuid}"}


@attachments_router.get("/download/{file_uuid}")
async def download_attachment(
    file_uuid: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment_id = str(file_uuid)
    result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.creator_id == current_user.id,
        )
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(status_code=404, detail="File not found")

    files = list(UPLOAD_DIR.glob(f"{attachment_id}.*"))
    if len(files) != 1:
        raise HTTPException(status_code=404, detail="File on disk not found")

    return FileResponse(files[0], filename=attachment.original_name)
