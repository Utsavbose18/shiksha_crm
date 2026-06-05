import csv
import io
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.audit_logger import log_action
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, require_roles
from app.models.audit import AuditLog, ImpersonationLog
from app.models.branch import Branch
from app.models.custom_field import CustomField
from app.models.tenant import Tenant
from app.models.user import Application, Student, University, User, UserRole
from app.routers.tenants import _not_deleted_filter
from app.schemas.schemas import (
    ImpersonationResponse,
    OnboardingCheck,
    OnboardingStatus,
    PlatformAlert,
    SuperadminAuditLogOut,
    SuperadminBranchOut,
    SuperadminTenantUserOut,
    TenantHealthStats,
    TenantPlanUpdate,
    TenantWithHealth,
)


router = APIRouter(prefix="/api/superadmin", tags=["Superadmin"])
superadmin_only = require_roles("platform_super_admin")


def _role_value(role) -> str:
    return role.value if hasattr(role, "value") else str(role)


def _request_ip(request: Request) -> Optional[str]:
    return request.client.host if request and request.client else None


def _storage_pct(tenant: Tenant) -> float:
    limit = max(float(tenant.storage_limit_mb or 0), 0.001)
    return min((float(tenant.storage_used_mb or 0) / limit) * 100, 100.0)


def _tenant_or_404(db: Session, tenant_id: int) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, _not_deleted_filter()).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _application_tenant_expr():
    return func.coalesce(Application.tenant_id, Student.tenant_id)


def _tenant_health_rows(db: Session, tenant_id: Optional[int] = None):
    users_sq = (
        select(User.tenant_id, func.count(User.id).label("cnt"))
        .where(User.is_active == True)
        .group_by(User.tenant_id)
        .subquery()
    )
    students_sq = (
        select(Student.tenant_id, func.count(Student.id).label("cnt"))
        .group_by(Student.tenant_id)
        .subquery()
    )
    app_tenant_id = _application_tenant_expr()
    applications_sq = (
        select(app_tenant_id.label("tenant_id"), func.count(Application.id).label("cnt"))
        .select_from(Application)
        .outerjoin(Student, Student.id == Application.student_id)
        .where(app_tenant_id.isnot(None))
        .group_by(app_tenant_id)
        .subquery()
    )
    activity_sq = (
        select(AuditLog.tenant_id, func.max(AuditLog.created_at).label("last_at"))
        .group_by(AuditLog.tenant_id)
        .subquery()
    )
    changed_admin_sq = (
        select(User.tenant_id, func.count(User.id).label("cnt"))
        .where(
            User.role == UserRole.admin,
            User.is_active == True,
            User.must_change_password == False,
        )
        .group_by(User.tenant_id)
        .subquery()
    )

    q = (
        db.query(
            Tenant,
            func.coalesce(users_sq.c.cnt, 0).label("total_users"),
            func.coalesce(students_sq.c.cnt, 0).label("total_students"),
            func.coalesce(applications_sq.c.cnt, 0).label("total_applications"),
            activity_sq.c.last_at.label("last_activity_at"),
            func.coalesce(changed_admin_sq.c.cnt, 0).label("changed_admin_count"),
        )
        .outerjoin(users_sq, users_sq.c.tenant_id == Tenant.id)
        .outerjoin(students_sq, students_sq.c.tenant_id == Tenant.id)
        .outerjoin(applications_sq, applications_sq.c.tenant_id == Tenant.id)
        .outerjoin(activity_sq, activity_sq.c.tenant_id == Tenant.id)
        .outerjoin(changed_admin_sq, changed_admin_sq.c.tenant_id == Tenant.id)
        .filter(_not_deleted_filter())
    )
    if tenant_id is not None:
        q = q.filter(Tenant.id == tenant_id)
    return q.order_by(Tenant.created_at.desc()).all()


def _tenant_with_health(row) -> TenantWithHealth:
    tenant = row.Tenant
    total_students = int(row.total_students or 0)
    setup_completed = int(row.changed_admin_count or 0) > 0 and total_students > 0
    return TenantWithHealth(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        secondary_color=tenant.secondary_color,
        custom_domain=tenant.custom_domain,
        subscription_plan=tenant.subscription_plan,
        subscription_status=tenant.subscription_status,
        storage_limit_mb=float(tenant.storage_limit_mb or 0),
        storage_used_mb=float(tenant.storage_used_mb or 0),
        is_active=bool(tenant.is_active),
        created_at=tenant.created_at,
        health=TenantHealthStats(
            tenant_id=tenant.id,
            total_users=int(row.total_users or 0),
            total_students=total_students,
            total_applications=int(row.total_applications or 0),
            storage_used_mb=float(tenant.storage_used_mb or 0),
            storage_limit_mb=float(tenant.storage_limit_mb or 0),
            storage_pct=round(_storage_pct(tenant), 2),
            last_activity_at=row.last_activity_at,
            setup_completed=setup_completed,
            is_active=bool(tenant.is_active),
        ),
    )


def _application_count(db: Session, tenant_id: int) -> int:
    return (
        db.query(Application.id)
        .outerjoin(Student, Student.id == Application.student_id)
        .filter(or_(Application.tenant_id == tenant_id, Student.tenant_id == tenant_id))
        .count()
    )


def _compute_onboarding(db: Session, tenant: Tenant) -> OnboardingStatus:
    tenant_id = tenant.id
    admin_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == UserRole.admin,
    ).count()
    changed_admin_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == UserRole.admin,
        User.must_change_password == False,
    ).count()
    login_count = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant_id,
        AuditLog.action == "login_success",
    ).count()
    branch_count = db.query(Branch).filter(Branch.tenant_id == tenant_id).count()
    student_count = db.query(Student).filter(Student.tenant_id == tenant_id).count()
    app_count = _application_count(db, tenant_id)
    custom_field_count = db.query(CustomField).filter(CustomField.tenant_id == tenant_id).count()

    checks = [
        OnboardingCheck(
            key="admin_created",
            label="Admin account exists",
            status=admin_count > 0,
            is_required=True,
            detail=f"{admin_count} admin account{'s' if admin_count != 1 else ''}",
        ),
        OnboardingCheck(
            key="admin_first_login",
            label="Admin has logged in",
            status=login_count > 0,
            is_required=False,
            detail=f"{login_count} successful login{'s' if login_count != 1 else ''}",
        ),
        OnboardingCheck(
            key="password_changed",
            label="Admin changed default password",
            status=changed_admin_count > 0,
            is_required=True,
            detail=f"{changed_admin_count} admin account{'s' if changed_admin_count != 1 else ''} completed password change",
        ),
        OnboardingCheck(
            key="branch_created",
            label="First branch created",
            status=branch_count > 0,
            is_required=False,
            detail=f"{branch_count} branch{'es' if branch_count != 1 else ''}",
        ),
        OnboardingCheck(
            key="first_student",
            label="First student added",
            status=student_count > 0,
            is_required=True,
            detail=f"{student_count} student{'s' if student_count != 1 else ''}",
        ),
        OnboardingCheck(
            key="first_application",
            label="First application created",
            status=app_count > 0,
            is_required=False,
            detail=f"{app_count} application{'s' if app_count != 1 else ''}",
        ),
        OnboardingCheck(
            key="custom_fields_used",
            label="Custom fields configured",
            status=custom_field_count > 0,
            is_required=False,
            detail=f"{custom_field_count} custom field{'s' if custom_field_count != 1 else ''}",
        ),
    ]
    passed = sum(1 for check in checks if check.status)
    required_complete = all(check.status for check in checks if check.is_required)
    return OnboardingStatus(
        tenant_id=tenant_id,
        tenant_name=tenant.name,
        checks=checks,
        overall_pct=int(round((passed / len(checks)) * 100)) if checks else 0,
        is_complete=required_complete,
    )


@router.get("/tenants", response_model=list[TenantWithHealth])
def list_tenants_with_health(
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    return [_tenant_with_health(row) for row in _tenant_health_rows(db)]


@router.get("/tenants/{tenant_id}", response_model=TenantWithHealth)
def get_tenant_with_health(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    rows = _tenant_health_rows(db, tenant_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_with_health(rows[0])


@router.get("/tenants/{tenant_id}/users", response_model=list[SuperadminTenantUserOut])
def get_tenant_users(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    _tenant_or_404(db, tenant_id)
    users = (
        db.query(User)
        .filter(
            User.tenant_id == tenant_id,
            User.role.in_([UserRole.admin, UserRole.counsellor]),
        )
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        SuperadminTenantUserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=_role_value(user.role),
            is_active=bool(user.is_active),
            must_change_password=bool(user.must_change_password),
            created_at=user.created_at,
            last_login_at=getattr(user, "last_login_at", None),
        )
        for user in users
    ]


@router.get("/tenants/{tenant_id}/activity", response_model=list[SuperadminAuditLogOut])
def get_tenant_activity(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    _tenant_or_404(db, tenant_id)
    rows = (
        db.query(AuditLog, User.email)
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        SuperadminAuditLogOut(
            id=log.id,
            tenant_id=log.tenant_id,
            user_id=log.user_id,
            user_email=email,
            action=log.action,
            module_name=log.module_name,
            record_type=log.record_type,
            record_id=log.record_id,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log, email in rows
    ]


@router.get("/tenants/{tenant_id}/branches", response_model=list[SuperadminBranchOut])
def get_tenant_branches(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    _tenant_or_404(db, tenant_id)
    return (
        db.query(Branch)
        .filter(Branch.tenant_id == tenant_id)
        .order_by(Branch.created_at.desc())
        .all()
    )


@router.get("/tenants/{tenant_id}/onboarding", response_model=OnboardingStatus)
def get_tenant_onboarding(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    return _compute_onboarding(db, _tenant_or_404(db, tenant_id))


@router.patch("/tenants/{tenant_id}/plan", response_model=TenantWithHealth)
def update_tenant_plan(
    tenant_id: int,
    payload: TenantPlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    tenant = _tenant_or_404(db, tenant_id)
    old_values = {
        "subscription_plan": tenant.subscription_plan,
        "storage_limit_mb": tenant.storage_limit_mb,
    }
    tenant.subscription_plan = payload.subscription_plan
    if payload.storage_limit_mb is not None:
        tenant.storage_limit_mb = payload.storage_limit_mb
    db.commit()
    db.refresh(tenant)
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="plan_updated",
        module_name="superadmin",
        record_type="tenant",
        record_id=tenant.id,
        old_values=old_values,
        new_values={
            "subscription_plan": tenant.subscription_plan,
            "storage_limit_mb": tenant.storage_limit_mb,
        },
        ip_address=_request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return _tenant_with_health(_tenant_health_rows(db, tenant_id)[0])


@router.get("/audit-logs", response_model=list[SuperadminAuditLogOut])
def get_audit_logs(
    tenant_id: Optional[int] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    q = db.query(AuditLog, User.email).outerjoin(User, User.id == AuditLog.user_id)
    if tenant_id is not None:
        q = q.filter(AuditLog.tenant_id == tenant_id)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    if from_date:
        q = q.filter(AuditLog.created_at >= datetime.combine(from_date, time.min))
    if to_date:
        q = q.filter(AuditLog.created_at <= datetime.combine(to_date, time.max))

    rows = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        SuperadminAuditLogOut(
            id=log.id,
            tenant_id=log.tenant_id,
            user_id=log.user_id,
            user_email=email,
            action=log.action,
            module_name=log.module_name,
            record_type=log.record_type,
            record_id=log.record_id,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log, email in rows
    ]


@router.post("/impersonate/stop")
def stop_impersonation(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    superadmin_id = getattr(current_user, "impersonated_by", None)
    if not superadmin_id:
        raise HTTPException(status_code=400, detail="Current session is not impersonated")

    tenant_id = getattr(current_user, "active_tenant_id", None)
    db.add(
        ImpersonationLog(
            superadmin_id=superadmin_id,
            target_user_id=current_user.id,
            target_tenant_id=tenant_id,
            action="stop",
            ip_address=_request_ip(request),
            created_at=datetime.utcnow(),
        )
    )
    log_action(
        db=db,
        user_id=superadmin_id,
        tenant_id=tenant_id,
        action="impersonation_stopped",
        module_name="superadmin",
        record_type="user",
        record_id=current_user.id,
        ip_address=_request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return {"ok": True}


@router.post("/impersonate/{user_id}", response_model=ImpersonationResponse)
def impersonate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if _role_value(target.role) == "platform_super_admin":
        raise HTTPException(status_code=403, detail="Cannot impersonate another superadmin")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate inactive user")

    target_role = _role_value(target.role)
    data = {
        "sub": str(target.id),
        "role": target_role,
        "tenant_id": target.tenant_id,
        "impersonated_by": current_user.id,
        "impersonated_email": target.email,
    }
    token = create_access_token(data, expires_delta=timedelta(minutes=15))

    db.add(
        ImpersonationLog(
            superadmin_id=current_user.id,
            target_user_id=target.id,
            target_tenant_id=target.tenant_id,
            action="start",
            ip_address=_request_ip(request),
            created_at=datetime.utcnow(),
        )
    )
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=target.tenant_id,
        action="impersonation_started",
        module_name="superadmin",
        record_type="user",
        record_id=target.id,
        new_values={"target_email": target.email, "target_role": target_role},
        ip_address=_request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return ImpersonationResponse(
        access_token=token,
        target_user={
            "id": target.id,
            "email": target.email,
            "role": target_role,
            "tenant_id": target.tenant_id,
        },
        expires_in_minutes=15,
        warning="This token gives full access as the target user. Use responsibly.",
    )


@router.get("/alerts", response_model=list[PlatformAlert])
def get_platform_alerts(
    severity: Optional[str] = Query(default=None, pattern="^(critical|warning|info)$"),
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    now = datetime.utcnow()
    cutoff_30d = now - timedelta(days=30)
    cutoff_no_students = now - timedelta(days=7)
    cutoff_password = now - timedelta(days=3)

    rows = _tenant_health_rows(db)
    tenant_ids = [row.Tenant.id for row in rows]
    active_admin_counts = dict(
        db.query(User.tenant_id, func.count(User.id))
        .filter(
            User.tenant_id.in_(tenant_ids) if tenant_ids else False,
            User.role == UserRole.admin,
            User.is_active == True,
        )
        .group_by(User.tenant_id)
        .all()
    ) if tenant_ids else {}
    stale_temp_admin_tenants = {
        tenant_id
        for tenant_id, in db.query(User.tenant_id)
        .filter(
            User.tenant_id.in_(tenant_ids) if tenant_ids else False,
            User.role == UserRole.admin,
            User.must_change_password == True,
            User.created_at <= cutoff_password,
        )
        .distinct()
        .all()
    } if tenant_ids else set()

    alerts = []
    for row in rows:
        tenant = row.Tenant
        health = _tenant_with_health(row).health
        storage_pct = health.storage_pct

        def add(alert_type: str, alert_severity: str, title: str, detail: str):
            alerts.append(
                PlatformAlert(
                    alert_id=f"{alert_type}_tenant_{tenant.id}",
                    severity=alert_severity,
                    type=alert_type,
                    title=title,
                    detail=detail,
                    tenant_id=tenant.id,
                    tenant_name=tenant.name,
                    created_at=now,
                )
            )

        if active_admin_counts.get(tenant.id, 0) == 0:
            add("no_admin", "critical", "Tenant has no active admin", "Create or reactivate an admin account.")

        if storage_pct > 90:
            add("storage_critical", "critical", "Storage above 90%", f"Storage is at {storage_pct:.1f}%.")
        elif storage_pct > 75:
            add("storage_warning", "warning", "Storage above 75%", f"Storage is at {storage_pct:.1f}%.")

        if health.total_students > 0 and (not health.last_activity_at or health.last_activity_at <= cutoff_30d):
            add("inactive_30d", "warning", "Tenant inactive 30+ days", "No recorded activity in the last 30 days.")

        if not health.setup_completed:
            add("setup_incomplete", "info", "Onboarding not completed", "Required onboarding checks are still open.")

        if tenant.is_active and health.total_students == 0 and tenant.created_at and tenant.created_at <= cutoff_no_students:
            add("no_students", "info", "No students added yet", "Tenant is active but has no student records after 7 days.")

        if tenant.id in stale_temp_admin_tenants:
            add("password_not_changed", "warning", "Admin has never changed password", "An admin is still using a temporary password.")

    if severity:
        alerts = [alert for alert in alerts if alert.severity == severity]

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    return sorted(
        alerts,
        key=lambda alert: (severity_rank.get(alert.severity, 99), alert.created_at),
        reverse=False,
    )


def _csv_response(output: io.StringIO, filename: str) -> StreamingResponse:
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tenants/{tenant_id}/export/students")
def export_students(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    tenant = _tenant_or_404(db, tenant_id)
    students = db.query(Student).filter(Student.tenant_id == tenant_id).order_by(Student.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "email", "first_name", "last_name", "phone", "lead_status", "nationality", "date_of_birth", "created_at", "is_active"])
    for student in students:
        writer.writerow([
            student.id,
            student.email,
            student.first_name,
            student.last_name,
            student.phone,
            student.lead_status.value if student.lead_status else "",
            student.nationality,
            student.date_of_birth.isoformat() if student.date_of_birth else "",
            student.created_at.isoformat() if student.created_at else "",
            student.is_active,
        ])

    log_action(db, current_user.id, tenant_id, "data_exported", "superadmin", "students", ip_address=_request_ip(request))
    return _csv_response(output, f"{tenant.slug}_students.csv")


@router.get("/tenants/{tenant_id}/export/users")
def export_users(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    tenant = _tenant_or_404(db, tenant_id)
    users = db.query(User).filter(User.tenant_id == tenant_id).order_by(User.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "email", "full_name", "role", "is_active", "must_change_password", "branch_id", "created_at"])
    for user in users:
        writer.writerow([
            user.id,
            user.email,
            user.full_name,
            _role_value(user.role),
            user.is_active,
            user.must_change_password,
            user.branch_id,
            user.created_at.isoformat() if user.created_at else "",
        ])

    log_action(db, current_user.id, tenant_id, "data_exported", "superadmin", "users", ip_address=_request_ip(request))
    return _csv_response(output, f"{tenant.slug}_users.csv")


@router.get("/tenants/{tenant_id}/export/applications")
def export_applications(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(superadmin_only),
):
    tenant = _tenant_or_404(db, tenant_id)
    rows = (
        db.query(Application, Student, University)
        .join(Student, Student.id == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(or_(Application.tenant_id == tenant_id, Student.tenant_id == tenant_id))
        .order_by(Application.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "student_email", "university_name", "course_name", "intake_month", "intake_year", "application_status", "visa_status", "tuition_fee", "currency", "created_at"])
    for app, student, university in rows:
        writer.writerow([
            app.id,
            student.email,
            university.name,
            app.course_name,
            app.intake_month,
            app.intake_year,
            app.application_status.value if app.application_status else "",
            app.visa_status.value if app.visa_status else "",
            app.tuition_fee,
            app.currency,
            app.created_at.isoformat() if app.created_at else "",
        ])

    log_action(db, current_user.id, tenant_id, "data_exported", "superadmin", "applications", ip_address=_request_ip(request))
    return _csv_response(output, f"{tenant.slug}_applications.csv")
