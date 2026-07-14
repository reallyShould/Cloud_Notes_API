# ⚙️ Cloud_Notes

Full-stack cloud notes workspace powered by FastAPI, PostgreSQL, React, and Vite. Includes registration, authorization, notes CRUD, and image attachments in a polished browser UI.

---

## 🛠️ Technology Stack

[![Python](https://img.shields.io/badge/python-grey?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/fastapi-grey?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-grey?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/docker-grey?style=for-the-badge&logo=docker)](https://docker.com)
[![JWT](https://img.shields.io/badge/JWT-grey?style=for-the-badge&logo=jsonwebtokens)](https://www.jwt.io)
[![Pydantic](https://img.shields.io/badge/Pydantic-grey?style=for-the-badge&logo=pydantic)](https://pydantic.dev)
[![React](https://img.shields.io/badge/react-grey?style=for-the-badge&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-grey?style=for-the-badge&logo=vite)](https://vite.dev)

- **Backend Framework:** [FastAPI](https://tiangolo.com) (Asynchronous, High performance)
- **Database Engine:** [PostgreSQL](https://postgresql.org)
- **ORM:** [SQLAlchemy 2.0](https://sqlalchemy.org) (Async extension with `asyncpg`)
- **Data Validation:** [Pydantic v2](https://pydantic.dev)
- **Security:** JWT (JSON Web Tokens) inside secure **HttpOnly Cookies** + `bcrypt` password hashing
- **Frontend:** [React 19](https://react.dev) + [Vite](https://vite.dev)
- **Environment:** [Docker](https://docker.com) / [OrbStack](https://orbstack.dev) for full containerization

## 🚀 Quick Start (Docker)

Make sure you have **Docker** or **OrbStack** running on your system. You don't need to install Python or PostgreSQL locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/reallyShould/Cloud_Notes_api.git
   cd Cloud_Notes_api
   ```

2. **Launch the environment:**
   This command creates the database and starts the full stack:
   ```bash
   docker compose up --build
   ```

3. **Open the apps:**
   - **Web UI:** `http://localhost:5173`
   - **Interactive API Docs (Swagger UI):** `http://localhost:8000/docs`

---

## 📂 Project Structure

```text
Cloud_Notes/
├── backend/
│   ├── app/
│   │   ├── api/          # Modular API Routers (Separation of Concerns)
│   │   │   ├── attachments.py # Authenticated image upload & download
│   │   │   ├── notes.py  # Notes CRUD logic
│   │   │   ├── system.py # Health checks and monitoring
│   │   │   └── users.py  # Registration, login, current user
│   │   ├── database.py   # Async SQLAlchemy engine & session setup
│   │   ├── dependencies.py # Cookie auth and current user lookup
│   │   ├── main.py       # FastAPI entrypoint, startup, CORS
│   │   ├── models.py     # SQLAlchemy DB models (User, Note, Attachment)
│   │   ├── schemas.py    # Pydantic validation DTOs
│   │   └── utils.py      # Password hashing & JWT utility functions
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Auth flow and notes workspace UI
│   │   ├── App.css       # Main application layout and components
│   │   ├── index.css     # Global tokens, typography, background
│   │   ├── lib/api.ts    # Browser API client with cookie credentials
│   │   └── types.ts      # Shared frontend models
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

---

## 🔒 Security Features

- **XSS Protection:** Access tokens are strictly transmitted via **HttpOnly** cookies, preventing malicious JavaScript from stealing sessions.
- **Cookie Policy:** Session cookies use `samesite="lax"` and support `secure=true` through environment configuration.
- **Credential Safety:** Passwords are encrypted with a slow `bcrypt` hashing context. No raw credentials ever enter the database.
- **Frontend Auth Flow:** Browser requests are sent with credentials and validated through `/users/me`.

## ✨ Product Features

- Registration and login with secure cookie-based sessions
- Personal notes workspace with create, edit, delete, and search
- Image uploads that are inserted into note content as Markdown links
- Responsive editorial-style interface for desktop and mobile
