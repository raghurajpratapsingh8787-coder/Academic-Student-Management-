# Architecture, Database & Security Documentation

## 1. Database Models (Mongoose)

Defined in `server/models/mongooseModels.ts`:

- **Admin**: `_id`, `name`, `email` (unique), `role` (`SUPER_ADMIN` | `ADMIN` | `STAFF`), `passwordHash` (scrypt), `avatarUrl`, `departmentId`, `isActive`, `resetTokenHash`, `resetTokenExpiresAt`, `lastLoginAt`.
- **Department**: `_id`, `name` (unique), `code` (unique), `description`, `head`.
- **Course**: `_id`, `name`, `code` (unique), `departmentId` (ref), `durationYears`, `totalSemesters`, `description`.
- **Student**: `_id`, `studentId` (unique), `fullName`, `email` (unique), `phone`, `gender`, `dateOfBirth`, `profilePhoto`, `departmentId` (ref), `courseId` (ref), `semester`, `enrollmentDate`, `address`, `city`, `state`, `postalCode`, `status`.
- **Attendance**: `_id`, `studentId` (ref), `departmentId` (ref), `courseId` (ref), `semester`, `date`, `status` (`PRESENT` | `ABSENT` | `LATE`), `notes`, `markedBy`. Unique compound index on `(studentId, date)`.
- **Notification**: `_id`, `title`, `message`, `type`, `readBy`, `createdBy`.
- **AuditLog**: `_id`, `actorId`, `actorEmail`, `actorRole`, `action`, `entityType`, `entityId`, `summary`, `ip`.
- **Session**: `_id`, `userId`, `tokenHash` (unique), `expiresAt`, `revokedAt`, `userAgent`, `ip`.
- **Settings**: `_id`, `institutionName`, `academicYear`, `attendanceThreshold`, `allowStaffAttendanceEdit`.

## 2. REST API Endpoints

### Authentication (`/api/auth`)
- `GET /api/auth/status` — Checks whether first-run Super Admin setup is required and active storage mode.
- `POST /api/auth/setup` — One-time Super Admin bootstrap (locked permanently once any admin exists).
- `POST /api/auth/login` — Rate-limited credential verification; returns in-memory JWT + sets HttpOnly refresh cookie.
- `POST /api/auth/refresh` — Rotates refresh token and detects token reuse.
- `POST /api/auth/logout` — Revokes active session and clears cookie.
- `POST /api/auth/forgot-password` & `POST /api/auth/reset-password` — Token-based password recovery.
- `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/change-password`.

### Students (`/api/students`)
- `GET /api/students` — Paginated search, sorting, and multi-field filtering.
- `POST /api/students` — Create student (`SUPER_ADMIN`, `ADMIN`).
- `GET /api/students/:id` — Detailed student profile, attendance stats, and audit history.
- `PATCH /api/students/:id` — Update student (`SUPER_ADMIN`, `ADMIN`).
- `PATCH /api/students/bulk-status` — Bulk status updates (`SUPER_ADMIN`, `ADMIN`).
- `POST /api/students/:id/photo` — Magic-byte validated image upload stored outside public root.
- `DELETE /api/students/:id` — Safe deletion (`SUPER_ADMIN`, `ADMIN`).

### Departments & Courses (`/api/academic`)
- `GET/POST/PATCH/DELETE /api/academic/departments`
- `GET/POST/PATCH/DELETE /api/academic/courses`

### Attendance (`/api/attendance`)
- `GET /api/attendance` — Filtered attendance records.
- `POST /api/attendance/mark` — Batch upsert attendance for a date.
- `GET /api/attendance/summary` — Real student-wise and monthly attendance percentages.

### Analytics, Governance & Files (`/api`)
- `GET /api/analytics/overview` & `GET /api/analytics/reports`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- `GET /api/audit-logs`
- `GET/POST/PATCH /api/admins`, `POST /api/admins/:id/reset-token` (`SUPER_ADMIN` only)
- `GET/PATCH /api/settings` (`SUPER_ADMIN` only for updates)
- `GET /api/files/avatars/:filename` — Authenticated, path-confined image delivery.

## 3. Security Controls

- **Passwords**: `crypto.scrypt` with 16-byte random salt and `crypto.timingSafeEqual` comparison.
- **Tokens**: 15-minute access JWT held only in React JS memory; 7-day refresh token hashed (`SHA-256`) in database and issued as `HttpOnly` cookie with `Origin`/`X-Requested-With` CSRF protection.
- **NoSQL Injection**: Recursive sanitization stripping `$`-prefixed operators, dotted keys, and prototype keys, paired with strict Zod request validation.
- **Uploads**: Magic-byte signature inspection (JPEG/PNG/WebP), 2 MB limit, UUID filenames, stored outside public directories in `.uploads/`, and served with path traversal confinement and `X-Content-Type-Options: nosniff`.
