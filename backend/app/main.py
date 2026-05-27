"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.database import Base, engine
from app.core.middleware import LoggingMiddleware
from app.routers import auth, users, students, documents, applications, services, dashboard, chat, admin,notes,student_enquiry
from app.routers.student_self import router as student_self_router
from app.routers.admin import router as admin_config_router
from app.routers import notes   # adjust path to match your project structure
from app.routers import student_notes
from app.routers import country_templates
# Create all tables (idempotent; prefer Alembic for production migrations)
Base.metadata.create_all(bind=engine)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import FastAPI
from app.routers import whatsapp as whatsapp_router




# Ensure upload directories exist
for d in ["./uploads", "./uploads/chat"]:
    Path(d).mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Student Counselling Portal API",
    description=(
        "## Role-based portal backend\n\n"
        "### Roles\n"
        "- **admin** – full access; creates users and students, activates accounts\n"
        "- **counsellor** – manages own students; registers new students\n"
        "- **student** – views own profile, changes password, uploads documents, "
        "views applications and chats\n\n"
        "### Authentication\n"
        "POST `/api/auth/login` → JWT Bearer token. "
        "Include `Authorization: Bearer <token>` on every protected request.\n\n"
        "### Real-time Chat\n"
        "Connect via WebSocket: `ws://host/ws/chat/{application_id}?token=<access_token>`"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Restrict to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(documents.router)
app.include_router(applications.router)
app.include_router(services.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(student_self_router)
app.include_router(admin_config_router)
app.include_router(notes.router)   # ✅ notes registered here, after app is created
app.include_router(applications.uni_router)
app.include_router(applications.app_router)
app.include_router(applications.notif_router)
app.include_router(student_notes.router)
app.include_router(student_enquiry.router)
app.include_router(country_templates.router)
app.include_router(whatsapp_router.router)

# ─── Static file serving for uploads ─────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="./uploads"), name="uploads")



@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc.errors())}  # 👈 SAFE stringify
    )

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "1.0.0"}

from fastapi.responses import FileResponse
import os

BASE_DIR = Path(__file__).resolve().parent.parent
BUILD_DIR = BASE_DIR / "build"

# Serve Vite assets (js/css/images)
assets_path = BUILD_DIR / "assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


# Catch-all route for SPA (React/Vite)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """
    Serve React frontend for all non-API routes
    """
    index_file = BUILD_DIR / "index.html"

    if index_file.exists():
        return FileResponse(index_file)

    return JSONResponse(
        status_code=404,
        content={"detail": "Frontend not built"}
    )

