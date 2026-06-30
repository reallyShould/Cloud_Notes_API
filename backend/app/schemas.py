from pydantic import BaseModel

class Register(BaseModel):
    login: str
    password: str

class Login(BaseModel):
    login: str
    password: str

class NoteCreate(BaseModel):
    title: str
    text: str