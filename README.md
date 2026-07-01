# ⚙️ Cloud_Notes_api

Async cloud notes backend powered by FastAPI + PostgreSQL. Clean architecture, authentication, and containerization out of the box.

---

## 🛠️ Technology Stack

[![Python](https://img.shields.io/badge/python-grey?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/fastapi-grey?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-grey?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/docker-grey?style=for-the-badge&logo=docker)](https://docker.com)
[![JWT](https://img.shields.io/badge/JWT-grey?style=for-the-badge&logo=jsonwebtokens)](https://www.jwt.io)
[![Pydantic](https://img.shields.io/badge/Pydantic-grey?style=for-the-badge&logo=pydantic)](https://pydantic.dev)

- **Backend Framework:** [FastAPI](https://tiangolo.com) (Asynchronous, High performance)
- **Database Engine:** [PostgreSQL](https://postgresql.org)
- **ORM:** [SQLAlchemy 2.0](https://sqlalchemy.org) (Async extension with `asyncpg`)
- **Data Validation:** [Pydantic v2](https://pydantic.dev)
- **Security:** JWT (JSON Web Tokens) inside secure **HttpOnly Cookies** + `bcrypt` password hashing
- **Environment:** [Docker](https://docker.com) / [OrbStack](https://orbstack.dev) for full containerization

## 🚀 Quick Start (Docker)

Make sure you have **Docker** or **OrbStack** running on your system. You don't need to install Python or PostgreSQL locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/reallyShould/Cloud_Notes_api.git
   cd Cloud_Notes_api
   ```

2. **Launch the environment:**
   This command automatically creates the database, runs migrations (tables initialization), and starts the backend server:
   ```bash
   docker compose up --build
   ```

3. **Explore the API:**
   Once the terminal prints `Uvicorn running on http://0.0.0.0`, open your browser at:
   - **Interactive API Docs (Swagger UI):** `http://localhost:8000/docs`

---

## 📂 Project Structure

```text
Cloud_Notes_api/
├── backend/
│   ├── app/
│   │   ├── api/          # Modular API Routers (Separation of Concerns)
│   │   │   ├── notes.py  # Notes CRUD logic (Markdown supported)
│   │   │   ├── system.py # Health checks and monitoring
│   │   │   └── users.py  # Registration & Authentication
│   │   ├── database.py   # Async SQLAlchemy engine & session setup
│   │   ├── dependencies.py # Secure request filters (Token decoding & User fetch)
│   │   ├── main.py       # Application entrypoint & Lifespan setup
│   │   ├── models.py     # SQLAlchemy DB models (User, Note)
│   │   ├── schemas.py    # Pydantic validation DTOs
│   │   └── utils.py      # Hashing & JWT utility functions
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

---

## 🔒 Security Features

- **XSS Protection:** Access tokens are strictly transmitted via **HttpOnly** cookies, preventing malicious JavaScript from stealing sessions.
- **CSRF Mitigation:** Cookie management utilizes `samesite="lax"` policy configuration.
- **Credential Safety:** Passwords are encrypted with a slow `bcrypt` hashing context. No raw credentials ever enter the database.
