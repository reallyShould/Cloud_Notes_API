from fastapi import APIRouter, Depends

from sqlalchemy.ext.asyncio import AsyncSession

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