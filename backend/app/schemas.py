from pydantic import BaseModel, Field

class Register(BaseModel):
    login: str
    password: str

class Login(BaseModel):
    login: str
    password: str

class NoteCreate(BaseModel):
    title: str
    text: str

class NoteUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    text: str | None = None
