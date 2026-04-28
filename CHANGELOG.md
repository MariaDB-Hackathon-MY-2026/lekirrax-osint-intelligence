# Changelog

All notable changes to the LekirraX project will be documented in this file.

## [Unreleased] - 2026-04-22

### Added
- Initial implementation phase setup.
- Security dependencies: `jsonwebtoken`, `bcryptjs`, `helmet`, `compression`, `morgan`, `cookie-parser`.
- Foundational project structure cleanup.
- JWT Authentication middleware (`middleware/auth.js`).
- Mock login endpoint (`/api/auth/login`).
- Frontend Login component (`components/Login.tsx`) and authentication flow.
- Real **Censys API integration** for `AssetRadar` OSINT module.
- New **Google Dorking** intelligence module (`googleDorking.js`).
- Unit tests for `utils.js` and `riskEngine.js`.
- Atomic transaction support for saving scans (`saveCompleteScan`).

### Fixed
- **Scan Failure: Unauthorized**: Resolved by implementing a full authentication flow from frontend to backend.
- Fixed `servises` typo in frontend directory structure and imports.
- Standardized file naming for `ScanInputPage.tsx`.
- Corrected named import issues in `ScanResultsPage.tsx`.
- Enhanced SSRF protection with comprehensive IP range blocklist.
- Fixed database connection leak in `recommendationEngine.js`.
- Optimized database performance by implementing bulk port insertion.
- Refactored `AssetRadar` to support real Censys infrastructure data.
- **Fixed "Start Scan" button**: Corrected prop name mismatch in `App.tsx` that prevented the scan input from updating.
- **Codebase Audit & Hygiene**:
    - Removed 5+ redundant files including legacy background components (`Particle3DTextBackground`, `BackgroundParticles`) and duplicate OSINT pages.
    - Uninstalled heavyweight unused dependencies: `three`, `react-globe.gl`, `gsap`, and `@types/three` (Reduced frontend bundle size by ~500KB+).
    - Standardized OSINT Toolkit entry point to `OsintPage.tsx`.
    - Cleaned up `logs/` directory and enforced Git exclusion.




### Changed
- Refactored frontend directory `servises` to `services`.
- Updated `App.tsx` and `OsintCard.tsx` to reflect directory and filename changes.
- Protected sensitive API endpoints with JWT authentication.
- Improved API security with Helmet headers and response compression.
- Enhanced code documentation with inline JSDoc comments.

