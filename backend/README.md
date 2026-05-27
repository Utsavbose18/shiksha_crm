# Student Counselling Portal — Backend

FastAPI + MySQL backend for a multi-role student counselling management portal.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI 0.111 |
| Database | MySQL 8+ via SQLAlchemy 2 |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| File storage | Local filesystem or AWS S3 |
| OCR | Tesseract via pytesseract + PyMuPDF |
| Real-time chat | FastAPI WebSockets |

---

## Project Structure

```
portal/
├── app/
│   ├── main.py                   # App entry, middleware, router registration
│   ├── core/
│   │   ├── config.py             # Pydantic settings (reads .env)
│   │   ├── database.py           # SQLAlchemy engine + session
│   │   ├── security.py           # JWT, password hashing, role guards
│   │   └── middleware.py         # Request logging, global error handler
│   ├── models/
│   │   └── user.py               # All ORM models + Enums
│   ├── schemas/
│   │   └── schemas.py            # All Pydantic v2 request/response schemas
│   └── routers/
│       ├── auth.py               # Login, refresh, /me, change-password
│       ├── users.py              # Admin: manage staff accounts
│       ├── students.py           # Students: CRUD, academic, work, tests
│       ├── documents.py          # Document upload + OCR autofill
│       ├── applications.py       # Applications + per-university REST chat
│       ├── services.py           # Services (test_prep, accommodation…) + payments
│       ├── dashboard.py          # KPI aggregation for dashboard
│       ├── chat.py               # WebSocket real-time chat
│       └── student_self.py       # Student self-service (own profile, password)
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial.py       # Full initial schema migration
├── alembic.ini
├── seed.py                       # Creates first admin + optional sample data
├── requirements.txt
└── .env.example
```

---

## Setup

### 1. Prerequisites

- Python 3.11+
- MySQL 8+
- Tesseract OCR (optional, for document autofill)

```bash
# Ubuntu / Debian
sudo apt install tesseract-ocr tesseract-ocr-eng poppler-utils

# macOS
brew install tesseract poppler
```

### 2. Install dependencies

```bash
cd portal
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY at minimum
```

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `mysql+pymysql://user:pass@host:3306/portal_db` |
| `SECRET_KEY` | Random 32+ char string. Generate: `openssl rand -hex 32` |
| `STORAGE_BACKEND` | `local` (default) or `s3` |
| `UPLOAD_DIR` | Local upload path (default `./uploads`) |
| `TESSERACT_CMD` | Path to tesseract binary |

### 4. Create database

```sql
CREATE DATABASE portal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Run migrations

```bash
alembic upgrade head
```

### 6. Seed first admin

```bash
python seed.py               # creates admin only
python seed.py --sample      # admin + counsellor + 3 students + sample data
```

Default credentials after seeding:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@portal.com | Admin@1234 |
| Counsellor | counsellor@portal.com | Counsel@1234 |
| Student | rahul.sharma@student.com | Student@1234 |

**Change all default passwords immediately in production.**

### 7. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: http://localhost:8000/docs

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

### Login
```
POST /api/auth/login
{
  "email": "admin@portal.com",
  "password": "Admin@1234",
  "role": "admin"          // "admin" | "counsellor" | "student"
}
```
Returns `access_token` (60 min) and `refresh_token` (7 days).

### Refresh
```
POST /api/auth/refresh
{ "refresh_token": "..." }
```

### Change password (all roles)
```
POST /api/auth/change-password
{ "current_password": "...", "new_password": "..." }
```

### Student self change password
```
POST /api/me/change-password
{ "current_password": "...", "new_password": "..." }
```

---

## Role Permissions Summary

| Endpoint group | Admin | Counsellor | Student |
|----------------|-------|-----------|---------|
| Create / activate users | ✅ | ❌ | ❌ |
| Register students | ✅ | ✅ | ❌ |
| View all students | ✅ | own only | own only |
| Edit student info | ✅ | own only | own profile only |
| Upload documents | ✅ | ✅ | own only |
| Manage applications | ✅ | ✅ | view own |
| Chat in application | ✅ | ✅ | own apps |
| Dashboard KPIs | ✅ | own students | ❌ |
| Services / Payments | ✅ | ✅ | ❌ |

---

## API Reference

### Users (Admin only)
```
POST   /api/users/                    Create staff user
GET    /api/users/                    List users (filter by ?role=)
GET    /api/users/{id}                Get user
PATCH  /api/users/{id}                Update user
POST   /api/users/{id}/activate       Activate account
POST   /api/users/{id}/deactivate     Deactivate account
POST   /api/users/{id}/reset-password Reset password
DELETE /api/users/{id}                Delete user
```

### Students
```
POST   /api/students/                          Register student
GET    /api/students/                          List students (?search= &lead_status=)
GET    /api/students/{id}                      Get full profile
PATCH  /api/students/{id}                      Update personal info
POST   /api/students/{id}/activate             Activate (admin)
POST   /api/students/{id}/deactivate           Deactivate (admin)
POST   /api/students/{id}/reset-password       Reset password (admin)

GET    /api/students/{id}/pre-application      Pre-app KPI summary

POST   /api/students/{id}/academic             Add qualification
GET    /api/students/{id}/academic             List qualifications
PATCH  /api/students/{id}/academic/{eid}       Update
DELETE /api/students/{id}/academic/{eid}       Delete

POST   /api/students/{id}/work                 Add work experience
GET    /api/students/{id}/work                 List
PATCH  /api/students/{id}/work/{eid}           Update
DELETE /api/students/{id}/work/{eid}           Delete

POST   /api/students/{id}/tests                Add test score
GET    /api/students/{id}/tests                List
PATCH  /api/students/{id}/tests/{eid}          Update
DELETE /api/students/{id}/tests/{eid}          Delete
```

### Documents
```
POST   /api/students/{id}/documents/            Upload (multipart/form-data)
GET    /api/students/{id}/documents/            List documents
GET    /api/students/{id}/documents/{doc_id}    Get metadata + extracted_data
GET    /api/students/{id}/documents/{doc_id}/download  Download file
DELETE /api/students/{id}/documents/{doc_id}    Delete
```

OCR-extracted fields are returned in `extracted_data` field, including:
- **passport**: `passport_number`, `date_of_birth`, `nationality`, `mrz_lines`
- **transcript**: `institution`, `percentage_cgpa`
- **ielts/toefl**: `overall_score`, `section_scores`

### Universities
```
POST   /api/universities/       Create
GET    /api/universities/       List (?search= &country=)
GET    /api/universities/{id}   Get
PATCH  /api/universities/{id}   Update
```

### Applications (Post-Application)
```
POST   /api/students/{id}/applications/         Create application
GET    /api/students/{id}/applications/         List all (with university details)
GET    /api/students/{id}/applications/{app_id} Get single
PATCH  /api/students/{id}/applications/{app_id} Update (status, visa_status, etc.)
DELETE /api/students/{id}/applications/{app_id} Delete (staff only)
```

Application statuses: `shortlisted` → `applied` → `under_review` → `conditional_offer` →
`unconditional_offer` → `accepted` | `rejected` | `waitlisted` | `withdrawn`

Visa statuses: `not_applied` → `visa_applied` → `visa_approved` | `visa_rejected`

### Application Chat (REST)
```
GET    /api/students/{id}/applications/{app_id}/messages         Get message history
POST   /api/students/{id}/applications/{app_id}/messages         Send message
POST   /api/students/{id}/applications/{app_id}/messages/attachment  Send with file
DELETE /api/students/{id}/applications/{app_id}/messages/{msg_id}   Delete (staff)
```

### WebSocket Real-time Chat

Connect: `ws://host/ws/chat/{application_id}?token=<access_token>`

**Send:**
```json
{ "type": "message", "text": "Hello!" }
{ "type": "ping" }
```

**Receive:**
```json
{ "type": "history", "messages": [...] }          // on connect
{ "type": "message", "id": 1, "sender_type": "user", "sender_id": 5,
  "text": "Hello!", "created_at": "2025-01-01T10:00:00" }
{ "type": "pong" }
{ "type": "error", "detail": "reason" }
```

Each `application_id` has its own isolated room — messages never leak between universities.

### Dashboard (Admin + Counsellor)
```
GET /api/dashboard/                  Full KPI response
GET /api/dashboard/students/recent   Last 10 students
GET /api/dashboard/applications/recent  Last 10 applications
```

**KPI Response:**
```json
{
  "student_kpis": {
    "total_leads": 42,
    "total_converted": 18,
    "total_applications": 67,
    "admits_received": 24,
    "visa_applied": 15,
    "visa_approved": 11,
    "visa_rejected": 2,
    "total_payment_done": 850000.0,
    "payment_pending": 320000.0
  },
  "service_kpis": {
    "test_prep": 31,
    "accommodation": 12,
    "flywire": 8,
    "loan": 5,
    "forex": 3,
    "visa_assistance": 19
  }
}
```

### Services
```
POST   /api/services/         Add service for student
GET    /api/services/         List (?student_id= &service_type=)
GET    /api/services/{id}     Get
PATCH  /api/services/{id}     Update
DELETE /api/services/{id}     Delete
```

Service types: `test_prep`, `accommodation`, `flywire`, `loan`, `forex`, `visa_assistance`

### Payments
```
POST   /api/payments/         Add payment
GET    /api/payments/         List (?student_id= &status=)
GET    /api/payments/{id}     Get
PATCH  /api/payments/{id}     Update (mark as done, add reference)
DELETE /api/payments/{id}     Delete (admin only)
```

Payment statuses: `pending`, `done`, `partial`

### Student Self-Service
```
GET    /api/me/profile         View own profile
PATCH  /api/me/profile         Update own profile (cannot change lead_status)
POST   /api/me/change-password Change own password
GET    /api/me/applications    View own applications
GET    /api/me/documents       View own documents
```

---

## Database Schema (ERD summary)

```
users ──< students (via counsellor_id, created_by)
students ──< academic_qualifications
students ──< work_experiences
students ──< test_scores
students ──< documents
students ──< student_services
students ──< payments
students ──< applications ──> universities
applications ──< application_messages
```

---

## Production Checklist

- [ ] Set strong `SECRET_KEY` (32+ random chars)
- [ ] Restrict `CORS allow_origins` to your frontend domain
- [ ] Use `STORAGE_BACKEND=s3` with a private bucket
- [ ] Run behind HTTPS (nginx / AWS ALB)
- [ ] Set `DEBUG=False` / remove `--reload`
- [ ] Configure MySQL with a dedicated user (not root)
- [ ] Set up automated DB backups
- [ ] Use environment variables, not `.env` file, in production
- [ ] Rate-limit the `/api/auth/login` endpoint (nginx or slowapi)
- [ ] Change all default seeded passwords immediately

---

## Running with Docker (optional)

```dockerfile
# Dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y tesseract-ocr poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: portal_db
    ports: ["3306:3306"]
    volumes: [mysql_data:/var/lib/mysql]

  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db]
    volumes: [./uploads:/app/uploads]

volumes:
  mysql_data:
```

```bash
docker-compose up -d
docker-compose exec api alembic upgrade head
docker-compose exec api python seed.py --sample
```
