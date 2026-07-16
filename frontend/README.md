# Cloud Notes Frontend

React, TypeScript, Vite, and TipTap frontend for Cloud Notes.

The production image is built with `frontend/Dockerfile` and served by Nginx. API requests use the relative `/api` path and are proxied to the FastAPI service inside the Docker network.

For the recommended full-stack setup, follow the repository root `README.md` and run:

```bash
docker compose up -d --build
```
