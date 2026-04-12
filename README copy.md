# LekirraX - Advanced OSINT & Cyber Threat Intelligence Platform

LekirraX is a powerful cybersecurity platform designed for Open Source Intelligence (OSINT) gathering, deep web scanning, and real-time cyber threat visualization. Built with a modern tech stack, it provides security researchers and penetration testers with a comprehensive suite of tools to analyze domains, track digital footprints, and monitor global threat activities.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-19-cyan.svg)

## 🚀 Key Features

### 🌐 Cyber Threat Map
- **Real-Time Visualization**: Interactive 3D globe ([react-globe.gl](https://github.com/vasturiano/react-globe.gl)) displaying live cyber attack vectors.
- **Live Monitoring**: Tracks DDoS, Phishing, Malware, and other threat types with geolocation data.
- **Interactive UI**: Clickable threat markers, zoom controls, and detailed attack metadata.

### 🔍 Deep Web Scanning
- **Comprehensive Reconnaissance**: Analyzes DNS records, SSL certificates, HTTP headers, and open ports.
- **Vulnerability Assessment**: Detects weak security configurations (CSP, HSTS, etc.) and exposes potential risks.
- **Tech Stack Detection**: Identifies server technologies, firewalls (WAF), and CMS platforms.

### 🕵️ OSINT Modules
- **Asset Radar**: Discovers hidden subdomains and related assets.
- **Alias Finder**: Correlates usernames across social media and developer platforms.
- **Leak Check**: Checks for compromised credentials in data breaches.
- **Geo Spy**: Geolocation tracking of server infrastructure.
- **Code Hunter**: Scans public repositories for leaked secrets and API keys.

### 🤖 AI-Powered Intelligence
- **Smart Analysis**: Integrates OpenAI, Exa, and Firecrawl for intelligent data correlation and risk assessment.
- **Automated Reporting**: Generates human-readable security reports and remediation plans.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS (Dark Security Theme)
- **3D Graphics**: Three.js, React Globe GL
- **Animations**: GSAP, Lenis (Smooth Scroll)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MariaDB
- **Logging**: Winston
- **AI Integration**: OpenAI SDK, Exa JS, Firecrawl JS

## 📂 Project Structure

```
LekirraX/
├── frontend/               # React Frontend Application
│   ├── src/
│   │   ├── components/     # Reusable UI Components (CyberThreatMap, etc.)
│   │   ├── pages/          # Application Pages (Dashboard, ScanResults, etc.)
│   │   └── services/       # Frontend API Connectors
├── services/               # Backend Micro-Services
│   ├── osint/              # OSINT Modules (AliasFinder, CodeHunter, etc.)
│   ├── ai/                 # AI Integration Services
│   └── ...                 # Scanner Modules (DNS, Ports, SSL, etc.)
├── database/               # Database Configuration & Storage Logic
├── middleware/             # Express Middleware (Rate Limiting, Validation)
├── scripts/                # Utility & Migration Scripts
└── server.js               # Backend Entry Point
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MariaDB
- NPM or Yarn

### Installation

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
    - Configure your database credentials and API keys (OpenAI, Exa, etc.).

### Running the Application

1.  **Start the Backend Server**
    ```bash
    npm start
    # Server runs on http://localhost:3000
    ```

2.  **Start the Frontend Development Server**
    ```bash
    cd frontend
    npm run dev
    # UI accessible at http://localhost:5173
    ```

## 🚧 Roadmap
- [x] Core Web Scanning Engine
- [x] Cyber Threat Map Visualization
- [x] Basic OSINT Modules
- [ ] Advanced Report Export (PDF/JSON)
- [ ] User Authentication & History
- [ ] Real-time WebSocket Integration for Scans

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## 📄 License
This project is licensed under the ISC License.
