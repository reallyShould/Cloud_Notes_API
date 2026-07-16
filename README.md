# ⚙️ Cloud Notes

Self-hosted cloud notes with a focused React editor, FastAPI backend, PostgreSQL storage, cookie authentication, image uploads, and English/Russian localization.

---

## 🛠️ Technology Stack

[![React](https://img.shields.io/badge/react-grey?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-grey?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/fastapi-grey?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-grey?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/docker-grey?style=for-the-badge&logo=docker)](https://docker.com)
[![Nginx](https://img.shields.io/badge/nginx-grey?style=for-the-badge&logo=nginx)](https://nginx.org)

- **Frontend:** React 19, TypeScript, Vite, TipTap, and Lucide icons
- **Backend:** FastAPI, Pydantic, and async SQLAlchemy 2.0
- **Database:** PostgreSQL 16
- **Authentication:** JWT in HttpOnly cookies with bcrypt password hashing
- **Web server:** Nginx serving the production frontend and proxying `/api`
- **Deployment:** Docker Compose with health checks and persistent volumes

## 🚀 Quick Start (Docker)

Docker or OrbStack is the only requirement. Python, Node.js, Nginx, and PostgreSQL do not need to be installed on the host.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/reallyShould/Cloud_Notes_api.git
   cd Cloud_Notes_api
   ```

2. **Start the complete application with one command:**

   ```bash
   docker compose up -d --build
   ```

3. **Open Cloud Notes:**

   - On the Docker host: `http://localhost:8080`
   - From another device on the home network: `http://SERVER_IP:8080`
   - API documentation: `http://SERVER_IP:8080/api/docs`

The default published port is **8080**. PostgreSQL and FastAPI are not published on the host and are reachable only through the private Docker network. All browser requests use the same Nginx origin, so no domain is required.

---

## ⚙️ Optional Configuration

The application works without an `.env` file. For a permanent home-server installation, copy the example before the first start:

```bash
cp .env.example .env
```

Recommended settings:

```dotenv
APP_PORT=8080
POSTGRES_USER=cloud_notes
POSTGRES_PASSWORD=use-a-long-random-password
POSTGRES_DB=cloud_notes
JWT_SECRET_KEY=use-a-random-secret-at-least-32-bytes-long
COOKIE_SECURE=false
REGISTRATION_ENABLED=true
SQL_ECHO=false
```

- `APP_PORT` changes the single host port exposed by the stack.
- `JWT_SECRET_KEY` keeps existing login sessions valid after backend recreation. Without it, a secure temporary key is generated at every backend start.
- `COOKIE_SECURE=false` is required for plain HTTP access by local IP. Set it to `true` only when the application is served through HTTPS.
- Set `REGISTRATION_ENABLED=false` after creating the required accounts if public registration is not needed.
- Database credentials must be selected before the PostgreSQL volume is initialized. Changing them later does not modify an existing database volume.

Apply configuration changes with:

```bash
docker compose up -d --build
```

## 🔌 Published Ports

| Service | Container port | Host port | Exposure |
|---|---:|---:|---|
| Nginx frontend | 80 | `8080` by default | Home network |
| FastAPI backend | 8000 | Not published | Docker network only |
| PostgreSQL | 5432 | Not published | Docker network only |

If `APP_PORT=9090` is set, the application will be available at `http://SERVER_IP:9090` and no other host ports will be opened by this Compose project.

---

## 💾 Persistent Data and Backups

Docker volumes preserve both database records and uploaded images:

- `pgdata` stores PostgreSQL data.
- `uploads` stores note attachments.

On upgrade, files from the legacy `backend/uploads` directory are copied into the attachment volume automatically. Existing attachment links that used `localhost:8000` are normalized by the API.

Stop containers without deleting data:

```bash
docker compose down
```

Do not use `docker compose down -v` unless all notes and uploaded images may be permanently deleted.

Create a database backup:

```bash
docker compose exec -T db pg_dump -U admin main_db > cloud-notes-backup.sql
```

When custom PostgreSQL values are configured, replace `admin` and `main_db` in the backup command.

## 🩺 Operations

Check container health and published ports:

```bash
docker compose ps
```

Follow application logs:

```bash
docker compose logs -f frontend server db
```

Restart the stack:

```bash
docker compose restart
```

Update after pulling new code:

```bash
git pull
docker compose up -d --build
```

---

## 📂 Project Structure

```text
Cloud_Notes_api/
├── backend/
│   ├── app/
│   │   ├── api/             # Notes, users, attachments, and health routes
│   │   ├── database.py      # Async SQLAlchemy engine and sessions
│   │   ├── dependencies.py  # Authentication dependencies
│   │   ├── main.py          # FastAPI application and startup lifecycle
│   │   ├── models.py        # User, note, and attachment models
│   │   ├── schemas.py       # Request and response validation
│   │   └── utils.py         # Password hashing and JWT helpers
│   └── Dockerfile
├── frontend/
│   ├── src/                 # React application, styles, API client, and localization
│   ├── Dockerfile           # Vite build and Nginx runtime
│   └── nginx.conf           # Static frontend and `/api` reverse proxy
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔒 Security Notes

- Only the Nginx application port is published by default.
- Authentication cookies are HttpOnly and use `SameSite=Lax`.
- Login attempts are limited per client address.
- Uploaded images are size-limited, streamed to disk, and checked by extension, MIME type, and file signature.
- SQL parameter logging is disabled by default.
- The backend container runs as an unprivileged user.
- Plain HTTP does not encrypt credentials or note contents. Use the application only on a trusted LAN, or place it behind HTTPS, Tailscale, or another VPN when remote access is required.
