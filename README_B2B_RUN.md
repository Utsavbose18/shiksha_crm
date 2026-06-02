# Running EduCRM SaaS Platform

This project has been transformed into a fully isolated multi-tenant B2B application.

## 1. Setup Backend
1. Go into the backend directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Run migrations and seed data:
   ```bash
   alembic upgrade head
   python seed.py
   ```
4. Start backend: `fastapi run app/main.py --port 8000`

## 2. Setup Frontend
1. Go into the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

## 3. Usage
Navigate to the frontend login page. You can use the seeded users:
- **Platform Super Admin:** `superadmin@saas.com` / `Super@1234`
- **Tenant Admin (Demo):** `admin@demo.com` / `Admin@1234`
