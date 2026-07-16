from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

class Register(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

class Login(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

class ThemeUpdate(BaseModel):
    theme: Literal["light", "dark"]

class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    text: str | None = None
    summary: str | None = Field(default=None, max_length=280)
    tags: list[str] = Field(default_factory=list, max_length=12)
    is_pinned: bool = False
    is_favorite: bool = False
    is_archived: bool = False

class NoteUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    text: str | None = None
    summary: str | None = Field(default=None, max_length=280)
    tags: list[str] = Field(default_factory=list, max_length=12)
    is_pinned: bool = False
    is_favorite: bool = False
    is_archived: bool = False

class NotePublic(BaseModel):
    id: int
    title: str
    text: str | None
    summary: str | None
    tags: list[str]
    is_pinned: bool
    is_favorite: bool
    is_archived: bool
    created_time: datetime
    edit_time: datetime
    creator_id: int

    model_config = {"from_attributes": True}

class UserPublic(BaseModel):
    id: int
    login: str
    theme: str

    model_config = {"from_attributes": True}
