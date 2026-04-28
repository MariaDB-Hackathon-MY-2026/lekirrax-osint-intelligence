# LekirraX Frontend

React + TypeScript client for LekirraX. It provides:
- Login (dev: admin/admin) and session token handling
- Dashboard with threat-map visualization (WebSocket + HTTP fallback)
- Recon scan input + results pages (polling recon job status)
- OSINT results panels and scan history pages

## Setup

From the repository root:
```bash
cd frontend
npm install
```

## Run (dev)
```bash
npm run dev
```

The frontend expects the backend to be running on http://localhost:3000 and uses /api/* routes during development.

## Build
```bash
npm run build
```

## Lint
```bash
npm run lint
```
