# ---- Build the frontend ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend runtime, serving the built frontend as static files ----
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV PORT=5050
EXPOSE 5050

# Re-seeds on every container start so the demo data is always in a known
# state, since the SQLite file lives inside the container's writable layer
# and isn't expected to persist across restarts/redeploys.
CMD ["sh", "-c", "python seed.py && gunicorn --bind 0.0.0.0:${PORT} app:app"]
