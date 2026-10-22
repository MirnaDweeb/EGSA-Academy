# Egyptian Space Agency (EGSA) — Academy Unified Platform

A human-engineered, unified training and academy management platform for the **Egyptian Space Agency (EGSA)**.
This repository unifies the **Student Portal**, **Instructor Mission Control**, and **Admin Management Platform** into a clean, decoupled architecture: `frontend/` and `backend/`.

---

## 1. Architectural Layout

```text
EGSA-Academy/
├── frontend/
│   ├── src/
│   │   ├── assets/            # Official EGSA logo & aerospace media assets
│   │   ├── components/
│   │   │   ├── common/        # Shared minimal components (Button, Modal, SimpleTable, Badge, StatCard)
│   │   │   ├── student/       # Preserved student components & dashboard subcomponents
│   │   │   ├── instructor/    # Benchmark instructor components (tables, ui, logo)
│   │   │   └── admin/         # Admin components & visual charts
│   │   ├── context/           # Unified AuthContext & ToastContext (role-aware session management)
│   │   ├── layouts/           # Minimal Navbar & Sidebar layout shared by all three roles (AppLayout)
│   │   ├── pages/
│   │   │   ├── auth/          # Benchmark Login (AuthShell), Register & Recovery screens
│   │   │   ├── student/       # 13 core student lifecycle pages
│   │   │   ├── instructor/    # Benchmark instructor management pages
│   │   │   └── admin/         # Admin gateway, division overview, students, cohorts, finance
│   │   ├── services/          # Unified Axios apiClient with single-flight silent refresh
│   │   └── styles/            # palette.css, custom-bootstrap.scss, global.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── config/                # Database connection, constants, environment settings
│   ├── controllers/           # Unified domain controllers (student, instructor, admin, auth)
│   ├── middleware/            # JWT authentication, role authorization, upload, error handlers
│   ├── models/                # Unified Mongoose models
│   ├── routes/                # Express routes mounted under /api and /api/v1
│   ├── seed/                  # Seed script with demo accounts for all roles
│   ├── services/              # Domain business logic services (payments, readiness, attendance, etc.)
│   ├── server.js              # Express HTTP server entrypoint
│   └── package.json
```

---

## 2. Brand Color Palette & Design Benchmark

Visual styling across all three portals is harmonized using the **Instructor Portal** as the design benchmark:
- **Primary (Deep Cosmos Blue):** `#3A6985`
- **Secondary / Success (Deep Teal-Green):** `#1E7C85`
- **Accent / Warning (Gold-Tan):** `#D4B87C`
- **Danger (Red-Coral):** `#DF4F4C`
- **Dark / Text (Black):** `#000000` (with `#0E1A22` / `#142A3A`)
- **Backgrounds:** Clean, non-busy light slate tones (`#f8fafc` / `#f9fbfd`)

### Key Design Principles:
- **Clean & Human:** Flat cards, restrained border radius (6–10px), subtle elevation shadows, and no loud decorative filler components.
- **Unified Login:** Centered, elegant login screen using `AuthShell` with the aerospace brand left identity and clean right form panel.
- **Utilitarian Copy:** Direct, concise labels and micro-text without verbose fluff.
- **Bilingual Support:** Full English and Arabic (RTL) localization.

---

## 3. Getting Started

### Prerequisites
- **Node.js**: v18+
- **MongoDB**: Local `mongod` on `localhost:27017` or MongoDB Atlas URI

### Backend Setup
```bash
cd backend
npm install
npm run seed     # Seeds demo courses, cohorts, and accounts
npm run dev      # Runs API on http://localhost:5000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev      # Runs Vite dev server on http://localhost:5173
```

---

## 4. Demo Accounts (from Seed)

| Role | Email | Password | Landing Portal |
|---|---|---|---|
| **Student** | `sara.demo@egsa-academy.example` | `Password123!` | `/student/dashboard` |
| **Instructor** | `instructor@egsa-academy.example` | `InstructorPass123!` | `/instructor/dashboard` |
| **Instructor (Dev)** | `instructor@egsa-dev.test` | `Instructor#Dev123` | `/instructor/dashboard` |
| **Administrator** | `admin@egsa-academy.example` | `AdminPass123!` | `/admin` |
