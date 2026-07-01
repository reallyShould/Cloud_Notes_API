from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import User, Note
from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import NoteCreate

notes_router = APIRouter(prefix="/notes", tags=["notes"])

@notes_router.post("")
async def create_note(userdata: NoteCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = Note(title=userdata.title, text=userdata.text, creator_id=current_user.id)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@notes_router.get("")
async def get_notes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Note).where(Note.creator_id == current_user.id)
    result = await db.execute(query)
    return result.scalars().all()

@notes_router.get("/{note_id}")
async def get_note(note_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Note).where(Note.id == note_id, Note.creator_id == current_user.id)
    result = await db.execute(query)
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note
