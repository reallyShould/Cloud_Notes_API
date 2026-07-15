# ⚙️ Cloud_Notes

Full-stack premium writing workspace powered by FastAPI, PostgreSQL, React, Tiptap, and Docker. Includes registration, authorization, rich text editing, autosave, note organization, and image attachments in a polished browser UI.

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
- **Frontend:** [React 19](https://react.dev) + [Vite](https://vite.dev) + [Tiptap](https://tiptap.dev)
- **Environment:** [Docker](https://docker.com) / [OrbStack](https://orbstack.dev) with production-ready containers

## 🚀 Quick Start (Docker)

Make sure you have **Docker** or **OrbStack** running on your system. You don't need to install Python or PostgreSQL locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/reallyShould/Cloud_Notes_api.git
   cd Cloud_Notes_api
   ```

2. **Prepare environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Launch the production-like environment:**
   This command builds the backend image, builds the frontend static bundle, starts PostgreSQL, and serves the app through Nginx:
   ```bash
   docker compose up --build
   ```

4. **Open the apps:**
   - **Web UI:** `http://localhost:5173`
   - **API Docs (Swagger UI):** `http://localhost:8000/docs`

---

## 🐳 Container Notes

- `frontend` is built as static assets and served by **Nginx**
- browser API calls go through `/api`, which Nginx proxies to the FastAPI container
- `server` stores uploaded attachments in a persistent Docker volume
- `db` stores PostgreSQL data in a persistent Docker volume
- for production, replace `JWT_SECRET_KEY` and set `COOKIE_SECURE=true` behind HTTPS

## 🧪 Development Mode

For hot reload during active development:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This mode differs from the default stack:

- `frontend` runs Vite dev server on `http://localhost:5173`
- `server` runs `uvicorn --reload`
- source folders are mounted into the containers
- PostgreSQL still runs in Docker, so no local DB install is required

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
│   ├── requirements.txt
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Auth flow and premium notes workspace UI
│   │   ├── App.css       # Main application layout and components
│   │   ├── index.css     # Global tokens, typography, background
│   │   ├── lib/api.ts    # Browser API client with cookie credentials
│   │   └── types.ts      # Shared frontend models
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── .env.example
├── docker-compose.dev.yml
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
- Rich text editor with visual formatting toolbar
- Autosave without cursor reset during editing
- Pinned, favorite, archived, and searchable notes
- Drag-and-drop image uploads inside the editor
- Slash command palette for fast block insertion
- Focus mode for distraction-free writing
- Responsive premium workspace for desktop and mobile
