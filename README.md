# LekirraX - AI-driven OSINT-based cyber threat intelligence and analytics sentinel system

LekirraX is a powerful cybersecurity platform designed for Open Source Intelligence (OSINT) gathering, deep web scanning, and real-time cyber threat visualization. Built with a modern tech stack, it provides security researchers and penetration testers with a comprehensive suite of tools to analyze domains, track digital footprints, and monitor global threat activities.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-cyan.svg)

## Key Features

### Live Cyber-Threat Map
- **Live Monitoring**: Tracks DDoS, Phishing, Malware, and other threat types with geolocation data.
- **Interactive UI**: Clickable threat markers, zoom controls, and detailed attack metadata.
- Real-time feed via WebSockets (`/ws/threat-map`) with automatic fallback to HTTP polling.

### Deep Web Scanning
- **Comprehensive Reconnaissance**: Analyzes DNS records, SSL certificates, HTTP headers, and open ports.
- **Vulnerability Assessment**: Detects weak security configurations (CSP, HSTS, etc.) and exposes potential risks.
- **Tech Stack Detection**: Identifies server technologies, firewalls (WAF), and CMS platforms.
- **Results**: UI with structured sections and risk hints.

### OSINT Toolkit
- Modular OSINT runners (e.g., Alias Finder, Email Validator, Phishing Detect, Asset Radar).
- **Asset Radar**: Discovers hidden subdomains and related assets.
- **Alias Finder**: Correlates usernames across social media and developer platforms.
- **Leak Check**: Checks for compromised credentials in data breaches.
- **Phone Investigation**: Validates and normalizes phone numbers (E.164) with country calling code support; optional carrier/timezone enrichment.
- **Geo Spy**: Geolocation tracking of server infrastructure.
- **Code Hunter**: Scans public repositories for leaked secrets and API keys.
- **Google Dorking** module that generates curated dorks.
- **Custom Dork Builder** (build, copy, and launch your own dorks from the OSINT page).
- OSINT results viewer supports a readable “Pretty” view and a collapsible “Raw JSON” view.

### AI-Powered Intelligence
- **Smart Analysis**: Integrates OpenAI, Exa, and Firecrawl for intelligent data correlation and risk assessment.
- **Automated Reporting**: Generates human-readable security reports and remediation plans.

### Security Controls
- JWT-gated API endpoints.
- Rate limiting and request validation.
- Login concurrency limit (max **3 operators** simultaneously).
- Logout support.

## Quick Start

```bash
# Backend
npm install
npm run migrate
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open:
- UI: `http://localhost:5173`
- API: `http://localhost:3000`

Login (dev): `admin / admin`

## Tech Stack
### Frontend (`frontend/`)
- **Framework**: React 18 (Vite)
- **UI Styling**: CSS (dark high-contrast theme with neon accents)
- **Map Visualization**: `react-simple-maps` (2D neon threat map)
- **Animations**: GSAP, Lenis (Smooth Scroll)

### Backend (root)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MariaDB
- **Real-time**: WebSockets (`ws`)
- **Logging**: Winston
- **AI Integration**: OpenAI SDK, Exa JS, Firecrawl JS

## Database Schema (MariaDB)

LekirraX stores scans, OSINT investigations, and analyst activity in MariaDB to support **history browsing**, **auditability**, and **executive reporting**.

### Core tables

| Table | Purpose |
| --- | --- |
| `scans` | Main Web-Check scan record (target + timestamp + stored scan snapshot JSON). |
| `ai_analysis` | Threat score (1–10) + executive summary + structured vulnerabilities/remediation. |
| `firewalls` | WAF / firewall detection results linked to a scan. |
| `systems` | Discovered systems/subdomains/IP enrichment + risk scoring. |
| `ports` | Open ports linked to each discovered system. |
| `osint_results` | OSINT module results linked to a scan (module, risk, result JSON). |
| `osint_activity` | OSINT audit log (who ran what, on which target, when) with optional encrypted payload storage. |
| `users` | Operator identity (admin/analyst) metadata. |
| `user_interactions` | Tracks interactions for the recommendation engine (view/click/resolve/etc.). |
| `recommendation_cache` | Cached recommendations per user for fast dashboard rendering. |

### Key relationships

- `ai_analysis.scan_id` → `scans.id`
- `firewalls.scan_id` → `scans.id`
- `systems.scan_id` → `scans.id`
- `ports.system_id` → `systems.id`
- `osint_results.scan_id` → `scans.id`
- `osint_activity.scan_id` → `scans.id` (nullable, for OSINT runs not tied to a scan)
- `user_interactions.user_id` → `users.id`
- `recommendation_cache.user_id` → `users.id`

### Important columns (high level)

**`scans`**
- `target` (VARCHAR): domain/IP scanned
- `scan_date` (TIMESTAMP): scan timestamp
- `page_content` (LONGTEXT): stored scan snapshot JSON used by History details

**`ai_analysis`**
- `threat_level` (INT): 1–10 severity score
- `summary` (TEXT): executive summary
- `vulnerabilities` (JSON), `remediation` (JSON): structured report fields

**`systems` / `ports`**
- `systems` stores location/ISP/ASN fields and `risk_score`, `risk_level`, `risk_reasons` (JSON)
- `ports` stores `port` and `status` per system

**`osint_results`**
- `module` (VARCHAR): OSINT module name
- `risk_level` (VARCHAR): risk label returned by module
- `result_json` (JSON): module output (stored for history/reporting)

**`osint_activity` (audit trail)**
- `actor`, `username`, `investigation_type`, `module`, `target`
- `sources_json` (JSON): source list for transparency/reporting
- `checksum` (SHA-256): payload integrity hash
- `encrypted` + `payload_available`: flags for storage mode
- `payload_json` (JSON) or `payload_enc` (LONGTEXT): stored payload (plain or encrypted envelope)

Notes:
- JSON columns are used to store structured results without losing fidelity.
- OSINT payload encryption is supported when an encryption key is configured.

## Project Structure

```
LekirraX/
├── .vscode/                # VS Code launch config
├── openapi.yaml            # OpenAPI specification (API docs)
├── DEPLOYMENT.md           # Deployment notes
├── CHANGELOG.md            # Release/change history
├── package.json            # Backend dependencies/scripts
├── vitest.config.ts        # Test configuration (backend + frontend)
├── vitest.setup.ts         # Test setup (jsdom matchers)
├── frontend/               # React Frontend Application
│   ├── src/
│   │   ├── components/     # Reusable UI Components (CyberThreatMap, JsonViewer, etc.)
│   │   │   └── __tests__/  # Frontend component tests
│   │   ├── pages/          # Application Pages (Dashboard, ScanResults, OSINT, History, etc.)
│   │   └── services/       # Frontend API connectors (client-side)
├── services/               # Backend modules (recon + OSINT + AI helpers)
│   ├── osint/              # OSINT Modules (AliasFinder, CodeHunter, Phone Investigator, etc.)
│   │   └── phone_lookup.py # Optional Python enrichment for phone carrier/timezone
│   ├── ai/                 # AI Integration Services
│   └── ...                 # Scanner Modules (DNS, Ports, SSL, etc.)
│   └── __tests__/          # Backend unit tests
├── database/               # Database Configuration & Storage Logic
├── middleware/             # Express Middleware (Rate Limiting, Validation)
├── scripts/                # Utility & Migration Scripts
├── logs/                   # Runtime logs (ignored by git)
└── server.js               # Backend Entry Point
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- MariaDB
- NPM or Yarn

### Database setup (one-time)

Before running migrations, you must create a MariaDB database and a user with permissions.

Example SQL:

```sql
CREATE DATABASE lekirrax;

CREATE USER 'lekirrax'@'%' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON lekirrax.* TO 'lekirrax'@'%';
FLUSH PRIVILEGES;
```

### 1) Install dependencies

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/devnifyx/LekirraX.git
    cd LekirraX
    ```

2.  **Install Backend Dependencies**
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

4.  **Environment Setup**
    - Create a `.env` file in the root directory.
    - You can start from `.env.example`.
    - Configure required core settings (DB + JWT) and optional provider keys.
    ```env
    # Server (optional)
    PORT=3000
    NODE_ENV=development
    # Comma-separated. In development, any localhost port is allowed by default,
    # but you can still pin it explicitly (e.g., http://localhost:5173,http://localhost:5174).
    ALLOWED_ORIGINS=http://localhost:5173

    # Auth (required for production)
    JWT_SECRET=replace-with-a-long-random-string

    # Database (required)
    DB_HOST=127.0.0.1
    DB_PORT=3306
    DB_USER=...
    DB_PASSWORD=...
    DB_NAME=...

    # Optional providers (feature is disabled if missing/invalid)
    OPENAI_API_KEY=...
    OPENAI_MODEL_PRIMARY=gpt-4o
    OPENAI_MODEL_FALLBACK=gpt-4o-mini
    EXA_API_KEY=...
    FIRECRAWL_API_KEY=...
    WHOIS_API_KEY=...

    # Optional AssetRadar (Censys) - choose ONE auth method
    CENSYS_API_ID=...
    CENSYS_API_SECRET=...
    # or
    CENSYS_API_TOKEN=...

    # Optional Phone Investigation enrichment (Carrier/Timezone)
    # Requires Python + pip package "phonenumbers"
    PHONE_PY_LOOKUP=0
    ```

If optional provider keys are missing or invalid, LekirraX will keep running and show best-effort results (with warnings), but AI/OSINT enrichment may be disabled for that provider.

5.  **Database migration**
    ```bash
    npm run migrate
    ```

### 2) Run the application

1.  **Start the Backend Server**
    ```bash
    npm start
    # API: http://localhost:3000
    ```

2.  **Start the Frontend Development Server**
    ```bash
    cd frontend
    npm run dev
    # UI accessible at http://localhost:5173
    ```

### Login

Development builds include a mock login.
- Username: `admin`
- Password: `admin`

If you see "System capacity reached", it means 3 sessions are already active.

## Real-time Threat Feed

The dashboard map uses:
- WebSocket: `ws://localhost:3000/ws/threat-map`
- HTTP fallback: `GET /api/dashboard/threat-map`

If you change Vite proxy settings for `/ws`, restart the frontend dev server.

## API Documentation

- OpenAPI spec: openapi.yaml
- Key routes:
  - `POST /api/auth/login`, `POST /api/auth/logout`
  - `GET /api/recon?target=...`
  - `GET /api/osint/:module?target=...`
  - `GET /api/dashboard/threat-map` (fallback)
  - `WS /ws/threat-map` (live feed)

## Logs

Runtime logs are written to `logs/` (ignored by git):
- `logs/combined.log`: request/access logs
- `logs/error.log`: error logs

## Troubleshooting

- **Scan failed: Unauthorized**
  - You must login first (dev: `admin/admin`). If it still happens, clear `localStorage` token and login again.
- **OSINT module '...' not found**
  - Restart the backend after adding or changing OSINT modules.
- **Threat stream connection error**
  - Ensure backend is running and restart the frontend dev server after changing proxy config. The map should still work via HTTP fallback (`/api/dashboard/threat-map`).

## Optional: Phone carrier & timezone enrichment

Phone Investigation always works without Python (parsing, validation, E.164 formatting, region/type). If you want best-effort carrier and timezone metadata, enable the optional Python enrichment:

1. Install Python 3 and ensure it is on PATH.
2. Install the package:
   ```bash
   python -m pip install phonenumbers
   ```
3. In `.env`, enable:
   ```env
   PHONE_PY_LOOKUP=1
   ```
4. Restart the backend server.

Notes:
- Carrier/timezone results are metadata-based and may be inaccurate for ported numbers. For authoritative carrier, use a paid telecom lookup API.
- WhatsApp/Telegram registration status is not checked and is displayed as “Unknown (not checked)”.

## Safety / Legal

Use this tool only on targets you own or have explicit permission to test. You are responsible for complying with applicable laws and policies.

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## 📄 License
This project is licensed under the ISC License.
