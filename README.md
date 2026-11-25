# Academic & Student Management

Full-stack Student Management System built with React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Express, and Mongoose/MongoDB.

## Core Capabilities

- **Executive Analytics Overview**: Real-time KPIs, 12-month enrollment growth, monthly admissions, department distribution, status breakdown, and recent activity feed.
- **Student Registry & Profiles**: Full CRUD, search, sorting, multi-filter (department, course, status, admission date), pagination, bulk status updates, profile photo uploads, and PDF profile downloads.
- **Departments & Courses**: Complete CRUD with relational integrity and mandatory reassignment guards when deleting departments or courses with active students.
- **Attendance Tracking**: Daily batch marking (Present / Absent / Late), historical logs, and calculated student-wise and monthly attendance percentages.
- **Reports & Multi-Format Exports**: Department, course, status, and attendance reporting with CSV (formula-safe), Excel (`.xlsx`), PDF, and print support.
- **Security & Role-Based Access Control**: Scrypt password hashing, short-lived Bearer JWTs in memory, HttpOnly refresh cookie rotation with reuse detection, RBAC (`SUPER_ADMIN`, `ADMIN`, `STAFF`), Helmet headers, CORS allowlist, rate limiting, NoSQL operator sanitization, and magic-byte upload verification.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env`):
   ```env
   MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/acadex"
   APP_URL="http://localhost:3000"
   ```
   > If `MONGODB_URI` is left blank, the server automatically uses a file-backed persistent store in `.data/acadex-db.json` so you can explore the full application immediately.
3. Run development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` and complete the one-time **Super Admin Workspace Setup** form.

## Scripts

- `npm run dev` — Start Express + Vite dev server on port 3000
- `npm run build` — Build production frontend bundle (`dist/`)
- `npm start` — Run production server (`tsx server.ts`)
- `npm run lint` — TypeScript type check (`tsc --noEmit`)
- `npm test` — Run unit tests via Node test runner + `tsx`

## Documentation

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for database schemas, REST API endpoints, and security controls.
