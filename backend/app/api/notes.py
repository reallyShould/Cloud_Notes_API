import json
import re

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case, desc

from ..models import User, Note
from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import NoteCreate, NoteUpdate, NotePublic

notes_router = APIRouter(prefix="/notes", tags=["Notes"])
LEGACY_ATTACHMENT_URL = re.compile(
    r"https?://(?:localhost|127\.0\.0\.1):8000/attachments/download/"
)


def normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []

    for tag in tags:
        clean = tag.strip().lower()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        normalized.append(clean[:24])

    return normalized[:12]

def serialize_note(note: Note) -> NotePublic:
    try:
        tags = json.loads(note.tags or "[]")
    except json.JSONDecodeError:
        tags = []

    normalized_text = LEGACY_ATTACHMENT_URL.sub(
        "/api/attachments/download/",
        note.text or "",
    )

    return NotePublic(
        id=note.id,
        title=note.title,
        text=normalized_text,
        summary=note.summary,
        tags=tags if isinstance(tags, list) else [],
        is_pinned=note.is_pinned,
        is_favorite=note.is_favorite,
        is_archived=note.is_archived,
        created_time=note.created_time,
        edit_time=note.edit_time,
        creator_id=note.creator_id,
    )



@notes_router.post("", response_model=NotePublic)
async def create_note(userdata: NoteCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = Note(
        title=userdata.title,
        text=userdata.text,
        summary=userdata.summary,
        tags=json.dumps(normalize_tags(userdata.tags)),
        is_pinned=userdata.is_pinned,
        is_favorite=userdata.is_favorite,
        is_archived=userdata.is_archived,
        creator_id=current_user.id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return serialize_note(note)

@notes_router.get("", response_model=list[NotePublic])
async def get_notes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        select(Note)
        .where(Note.creator_id == current_user.id)
        .order_by(
            desc(case((Note.is_pinned.is_(True), 1), else_=0)),
            desc(Note.edit_time),
        )
    )
    result = await db.execute(query)
    return [serialize_note(note) for note in result.scalars().all()]

@notes_router.get("/{note_id}", response_model=NotePublic)
async def get_note(note_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Note).where(Note.id == note_id, Note.creator_id == current_user.id)
    result = await db.execute(query)
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return serialize_note(note)

@notes_router.delete("/{note_id}")
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Note).where(Note.creator_id == current_user.id, Note.id == note_id)
    result = await db.execute(query)
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()
    return {"message": "Note deleted successfully"}

@notes_router.put("/{note_id}", response_model=NotePublic)
async def update_note(
    note_id: int,
    userdata: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Note).where(Note.creator_id == current_user.id, Note.id ==note_id)
    result = await db.execute(query)
    note = result.scalar_one_or_none()

    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    note.title = userdata.title
    note.text = userdata.text
    note.summary = userdata.summary
    note.tags = json.dumps(normalize_tags(userdata.tags))
    note.is_pinned = userdata.is_pinned
    note.is_favorite = userdata.is_favorite
    note.is_archived = userdata.is_archived

    await db.commit()
    await db.refresh(note)
    return serialize_note(note)
