# Idk Virtual Machine Backend

Backend API for the Idk Virtual Machine manager.

## Current stage

This is the server/API foundation. It stores VM configurations and exposes lifecycle endpoints. QEMU execution is deliberately disabled by default.

## Run

```bash
cd backend
npm install
npm start
```

The API listens on `http://localhost:8787`.

## Endpoints

- `GET /api/health`
- `GET /api/host`
- `GET /api/vms`
- `POST /api/vms`
- `GET /api/vms/:id`
- `PATCH /api/vms/:id`
- `DELETE /api/vms/:id`
- `POST /api/vms/:id/start`
- `POST /api/vms/:id/stop`
- `POST /api/vms/:id/restart`

## QEMU/KVM

The adapter is prepared for a dedicated Linux virtualization host. Set `ENABLE_QEMU=true` only after QEMU/KVM is installed and the host is configured securely. The current adapter intentionally starts with a minimal headless process; disk, ISO, networking, graphics/console, sound, and permissions will be wired in the next backend phase.

Do not expose this API directly to the public internet without authentication, authorization, rate limiting, and a hardened VM execution policy.
