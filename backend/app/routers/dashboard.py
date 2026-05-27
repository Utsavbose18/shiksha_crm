from datetime import date, timedelta
from sqlalchemy import extract, func, case, and_, or_
from sqlalchemy.orm import Session
from fastapi import Depends, Query
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import (
    Student, Application, StudentService, Payment,
    UserRole, LeadStatus, ApplicationStatus, VisaStatus,
    PaymentStatus, ServiceType, University, User,
    AcademicQualification, AcademicLevel, WorkExperience,
    TestScore, DocumentField, DocumentFile, HighestEducation,
)
from app.schemas.schemas import DashboardResponse, StudentKPIs, ServiceKPIs


router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
staff_roles = require_roles(UserRole.admin, UserRole.counsellor)


# ─── Response Models ──────────────────────────────────────────────────────────

class LeadFunnelItem(BaseModel):
    status: str
    count: int

class ApplicationStatusBreakdown(BaseModel):
    status: str
    count: int

class VisaBreakdown(BaseModel):
    status: str
    count: int

class UniversityStats(BaseModel):
    university_id: int
    university_name: str
    country: str
    category: str
    total_applications: int
    offers_received: int        # unconditional_offer + accepted
    visa_approved: int

class CountryStats(BaseModel):
    country: str
    total_applications: int
    offers: int
    visas_approved: int

class IntakeStats(BaseModel):
    intake_month: Optional[str]
    intake_year: Optional[int]
    count: int

class PaymentSummary(BaseModel):
    total_invoiced: float
    total_collected: float
    total_pending: float
    total_partial: float
    overdue_count: int
    overdue_amount: float

class CounsellorPerformance(BaseModel):
    counsellor_id: int
    counsellor_name: str
    total_students: int
    leads: int
    converted: int
    conversion_rate: float
    total_applications: int
    offers: int
    visas_approved: int
    revenue_collected: float

class MonthlyActivity(BaseModel):
    month: str          # "YYYY-MM"
    new_students: int
    new_applications: int
    offers: int
    payments_collected: float

class DocumentStats(BaseModel):
    total_fields: int
    total_files_uploaded: int
    verified_files: int
    pending_verification: int

class ServiceStats(BaseModel):
    service_type: str
    count: int

class OfferDetail(BaseModel):
    application_id: int
    student_id: int
    student_name: str
    university_name: str
    course_name: str
    intake_month: Optional[str]
    intake_year: Optional[int]
    application_status: str
    application_status: str
    tuition_fee: Optional[float]
    currency: str

class RecentStudentItem(BaseModel):
    id: int
    name: str
    email: str
    lead_status: str
    counsellor_name: Optional[str]
    created_at: Any

class RecentApplicationItem(BaseModel):
    id: int
    student_id: int
    student_name: str
    university_name: str
    course_name: str
    application_status: str
    application_status: str
    created_at: Any

class FullDashboardResponse(BaseModel):
    # ── Core KPIs ──
    student_kpis: StudentKPIs
    service_kpis: ServiceKPIs

    # ── Funnel & Breakdowns ──
    lead_funnel: List[LeadFunnelItem]
    application_status_breakdown: List[ApplicationStatusBreakdown]
    visa_breakdown: List[VisaBreakdown]

    # ── Top Performers ──
    top_universities: List[UniversityStats]
    top_countries: List[CountryStats]
    intake_distribution: List[IntakeStats]

    # ── Financial ──
    

    # ── Offers ──
    recent_offers: List[OfferDetail]

    # ── People ──
    counsellor_performance: List[CounsellorPerformance]   # admin only
    recent_students: List[RecentStudentItem]
    recent_applications: List[RecentApplicationItem]

    # ── Docs & Activity ──
    document_stats: DocumentStats
    monthly_activity: List[MonthlyActivity]          # last 6 months
    service_breakdown: List[ServiceStats]

    # ── Today ──
    birthdays_today: List[Dict[str, Any]]
    applications_deadline_soon: List[Dict[str, Any]]  # deadlines in next 7 days


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _student_ids_for_user(db: Session, current_user) -> Optional[List[int]]:
    """
    Returns a list of student IDs visible to the current user.
    Admin → None  (meaning: no filter, all students)
    Counsellor → list of their student IDs
    """
    if current_user.role == UserRole.admin:
        return None
    ids = [
        s.id for s in db.query(Student.id)
        .filter(Student.counsellor_id == current_user.id)
        .all()
    ]
    return ids


def _apply_student_filter(query, ids: Optional[List[int]]):
    if ids is None:
        return query
    return query.filter(Student.id.in_(ids))


def _apply_app_filter(query, ids: Optional[List[int]]):
    if ids is None:
        return query
    return query.filter(Application.student_id.in_(ids))


def _apply_payment_filter(query, ids):
    if ids is None:
        return query
    return query.filter(
        or_(
            Payment.student_id.in_(ids),
            Payment.student_id.is_(None)   # ✅ include manual payments
        )
    )

# ─── Main Dashboard ──────────────────────────────────────────────────────────

@router.get("/", response_model=FullDashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Full management dashboard.
    Admins see global data; counsellors see only their own students.
    """
    tenant_id = getattr(current_user, "active_tenant_id", None)
    visible_ids = _student_ids_for_user(db, current_user)
    today = date.today()
    student_q = db.query(Student).filter(Student.tenant_id == tenant_id)
    student_q = _apply_student_filter(student_q, visible_ids)

    # Resolve actual ID list for joins (needed even for admin for subqueries)
    if visible_ids is None:
        all_ids = [row.id for row in db.query(Student.id).all()]
    else:
        all_ids = visible_ids

    # ── Student KPIs ──────────────────────────────────────────────────────────
    total_students  = student_q.count()
    total_leads     = student_q.filter(Student.lead_status == LeadStatus.lead).count()
    total_hot       = student_q.filter(Student.lead_status == LeadStatus.hot).count()
    total_warm      = student_q.filter(Student.lead_status == LeadStatus.warm).count()
    total_cold      = student_q.filter(Student.lead_status == LeadStatus.cold).count()
    total_converted = student_q.filter(Student.lead_status == LeadStatus.converted).count()
    total_lost      = student_q.filter(Student.lead_status == LeadStatus.lost).count()

    app_q = db.query(Application).filter(Application.student_id.in_(all_ids))

    total_apps = app_q.count()

    admits = app_q.filter(
        Application.application_status.in_([
            ApplicationStatus.unconditional_offer,
            ApplicationStatus.offer_accepted,
        ])
    ).count()

    visa_applied = app_q.filter(
        Application.application_status.in_([
            VisaStatus.visa_applied,
            VisaStatus.visa_approved,
            VisaStatus.visa_rejected,
        ])
    ).count()
    visa_approved = app_q.filter(Application.application_status == VisaStatus.visa_approved).count()
    visa_rejected = app_q.filter(Application.application_status == VisaStatus.visa_rejected).count()

    pay_q = db.query(Payment).filter(
        or_(
            Payment.student_id.in_(all_ids),
            Payment.manual_student_name.isnot(None)  # include walk-in / manual payments
        )
    )   

    total_paid = (
        pay_q.filter(Payment.status.in_([PaymentStatus.done, PaymentStatus.partial]))
        .with_entities(func.coalesce(func.sum(
            func.coalesce(Payment.paid_amount, Payment.amount)
        ), 0.0))
        .scalar()
    )
    total_pending = (
        pay_q.filter(Payment.status == PaymentStatus.pending)
        .with_entities(func.coalesce(func.sum(Payment.amount), 0.0))
        .scalar()
    )

    student_kpis = StudentKPIs(
        total_leads=total_leads,
        total_students = total_students,
        total_converted=total_converted,
        total_applications=total_apps,
        admits_received=admits,
        visa_applied=visa_applied,
        visa_approved=visa_approved,
        visa_rejected=visa_rejected,
        total_payment_done=float(total_paid),
        payment_pending=float(total_pending),
    )

    # ── Service KPIs ─────────────────────────────────────────────────────────
    def svc_count(stype):
        return (
            db.query(StudentService)
            .filter(
                StudentService.student_id.in_(all_ids),
                StudentService.service_type == stype,
            )
            .count()
        )

    service_kpis = ServiceKPIs(
        test_prep=svc_count(ServiceType.test_prep),
        accommodation=svc_count(ServiceType.accommodation),
        flywire=svc_count(ServiceType.flywire),
        loan=svc_count(ServiceType.loan),
        forex=svc_count(ServiceType.forex),
        visa_assistance=svc_count(ServiceType.visa_assistance),
    )

    # ── Lead Funnel ───────────────────────────────────────────────────────────
    lead_funnel = [
        LeadFunnelItem(status=LeadStatus.lead.value,      count=total_leads),
        LeadFunnelItem(status=LeadStatus.hot.value,       count=total_hot),
        LeadFunnelItem(status=LeadStatus.warm.value,      count=total_warm),
        LeadFunnelItem(status=LeadStatus.cold.value,      count=total_cold),
        LeadFunnelItem(status=LeadStatus.converted.value, count=total_converted),
        LeadFunnelItem(status=LeadStatus.lost.value,      count=total_lost),
    ]

    # ── Application Status Breakdown ──────────────────────────────────────────
    app_status_rows = (
        db.query(Application.application_status, func.count(Application.id))
        .filter(Application.student_id.in_(all_ids))
        .group_by(Application.application_status)
        .all()
    )
    application_status_breakdown = [
        ApplicationStatusBreakdown(status=row[0].value if row[0] else "unknown", count=row[1])
        for row in app_status_rows
    ]

    # ── Visa Breakdown ────────────────────────────────────────────────────────
    visa_rows = (
        db.query(Application.application_status, func.count(Application.id))
        .filter(Application.student_id.in_(all_ids))
        .group_by(Application.application_status)
        .all()
    )
    visa_breakdown = [
        VisaBreakdown(status=row[0].value if row[0] else "unknown", count=row[1])
        for row in visa_rows
    ]

    # ── Top Universities ──────────────────────────────────────────────────────
    uni_rows = (
        db.query(
            University.id,
            University.name,
            University.country,
            University.category,
            func.count(Application.id).label("total"),
            func.sum(
                case(
                    (Application.application_status.in_([
                        ApplicationStatus.unconditional_offer,
                        ApplicationStatus.offer_accepted,
                        ApplicationStatus.conditional_offer,
                    ]), 1),
                    else_=0,
                )
            ).label("offers"),
            func.sum(
                case(
                    (Application.application_status == VisaStatus.visa_approved, 1),
                    else_=0,
                )
            ).label("visas"),
        )
        .join(Application, Application.university_id == University.id)
        .filter(Application.student_id.in_(all_ids))
        .group_by(University.id, University.name, University.country, University.category)
        .order_by(func.count(Application.id).desc())
        .limit(10)
        .all()
    )
    top_universities = [
        UniversityStats(
            university_id=r.id,
            university_name=r.name,
            country=r.country,
            category=r.category,
            total_applications=r.total,
            offers_received=int(r.offers or 0),
            visa_approved=int(r.visas or 0),
        )
        for r in uni_rows
    ]

    # ── Top Countries ─────────────────────────────────────────────────────────
    country_rows = (
        db.query(
            University.country,
            func.count(Application.id).label("total"),
            func.sum(
                case(
                    (Application.application_status.in_([
                        ApplicationStatus.unconditional_offer,
                        ApplicationStatus.offer_accepted,
                    ]), 1),
                    else_=0,
                )
            ).label("offers"),
            func.sum(
                case(
                    (Application.application_status == VisaStatus.visa_approved, 1),
                    else_=0,
                )
            ).label("visas"),
        )
        .join(Application, Application.university_id == University.id)
        .filter(Application.student_id.in_(all_ids))
        .group_by(University.country)
        .order_by(func.count(Application.id).desc())
        .limit(10)
        .all()
    )
    top_countries = [
        CountryStats(
            country=r.country,
            total_applications=r.total,
            offers=int(r.offers or 0),
            visas_approved=int(r.visas or 0),
        )
        for r in country_rows
    ]

    # ── Intake Distribution ───────────────────────────────────────────────────
    intake_rows = (
        db.query(
            Application.intake_month,
            Application.intake_year,
            func.count(Application.id).label("cnt"),
        )
        .filter(Application.student_id.in_(all_ids))
        .group_by(Application.intake_month, Application.intake_year)
        .order_by(Application.intake_year.desc(), Application.intake_month)
        .limit(20)
        .all()
    )
    intake_distribution = [
        IntakeStats(intake_month=r.intake_month, intake_year=r.intake_year, count=r.cnt)
        for r in intake_rows
    ]

    # ── Payment Summary ───────────────────────────────────────────────────────
    

    # ── Recent Offers ─────────────────────────────────────────────────────────
    offer_rows = (
        db.query(Application, Student, University)
        .join(Student, Student.id == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(
            Application.student_id.in_(all_ids),
            Application.application_status.in_([
                ApplicationStatus.unconditional_offer,
                ApplicationStatus.offer_accepted,
                ApplicationStatus.conditional_offer,
            ]),
        )
        .order_by(Application.updated_at.desc())
        .limit(20)
        .all()
    )
    recent_offers = [
        OfferDetail(
            application_id=app.id,
            student_id=stu.id,
            student_name=f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            university_name=uni.name,
            course_name=app.course_name,
            intake_month=app.intake_month,
            intake_year=app.intake_year,
            application_status=app.application_status.value,
            tuition_fee=app.tuition_fee,
            currency=app.currency,
        )
        for app, stu, uni in offer_rows
    ]

    # ── Counsellor Performance  (admin only, empty list for counsellors) ──────
    counsellor_performance: List[CounsellorPerformance] = []
    if current_user.role == UserRole.admin:
        counsellors = db.query(User).filter(User.role == UserRole.counsellor, User.is_active == True).all()
        for c in counsellors:
            c_ids = [s.id for s in db.query(Student.id).filter(Student.counsellor_id == c.id).all()]
            if not c_ids:
                continue
            c_total     = len(c_ids)
            c_leads     = db.query(Student).filter(Student.id.in_(c_ids), Student.lead_status == LeadStatus.lead).count()
            c_converted = db.query(Student).filter(Student.id.in_(c_ids), Student.lead_status == LeadStatus.converted).count()
            c_apps      = db.query(Application).filter(Application.student_id.in_(c_ids)).count()
            c_offers    = db.query(Application).filter(
                Application.student_id.in_(c_ids),
                Application.application_status.in_([ApplicationStatus.unconditional_offer, ApplicationStatus.offer_accepted]),
            ).count()
            c_visa_ok   = db.query(Application).filter(
                Application.student_id.in_(c_ids),
                Application.application_status == VisaStatus.visa_approved,
            ).count()
            c_revenue   = float(
                db.query(func.coalesce(func.sum(Payment.amount), 0.0))
                .filter(Payment.student_id.in_(c_ids), Payment.status == PaymentStatus.done)
                .scalar()
            )
            counsellor_performance.append(CounsellorPerformance(
                counsellor_id=c.id,
                counsellor_name=c.full_name,
                total_students=c_total,
                leads=c_leads,
                converted=c_converted,
                conversion_rate=round(c_converted / c_total * 100, 1) if c_total else 0.0,
                total_applications=c_apps,
                offers=c_offers,
                visas_approved=c_visa_ok,
                revenue_collected=c_revenue,
            ))

    # ── Recent Students ───────────────────────────────────────────────────────
    recent_student_rows = (
        db.query(Student, User)
        .outerjoin(User, User.id == Student.counsellor_id)
        .filter(Student.id.in_(all_ids))
        .order_by(Student.created_at.desc())
        .limit(10)
        .all()
    )
    recent_students = [
        RecentStudentItem(
            id=s.id,
            name=f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
            email=s.email,
            lead_status=s.lead_status.value,
            counsellor_name=u.full_name if u else None,
            created_at=s.created_at,
        )
        for s, u in recent_student_rows
    ]

    # ── Recent Applications ───────────────────────────────────────────────────
    recent_app_rows = (
        db.query(Application, Student, University)
        .join(Student, Student.id == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(Application.student_id.in_(all_ids))
        .order_by(Application.created_at.desc())
        .limit(10)
        .all()
    )
    recent_applications = [
        RecentApplicationItem(
            id=app.id,
            student_id=stu.id,
            student_name=f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            university_name=uni.name,
            course_name=app.course_name,
            application_status=app.application_status.value,
            created_at=app.created_at,
        )
        for app, stu, uni in recent_app_rows
    ]

    # ── Document Stats ────────────────────────────────────────────────────────
    total_doc_fields = (
        db.query(DocumentField)
        .filter(DocumentField.student_id.in_(all_ids))
        .count()
    )
    file_rows = (
        db.query(
            func.count(DocumentFile.id).label("total"),
            func.sum(case((DocumentFile.is_verified == True, 1), else_=0)).label("verified"),
        )
        .filter(DocumentFile.student_id.in_(all_ids))
        .first()
    )
    total_files    = int(file_rows.total or 0)
    verified_files = int(file_rows.verified or 0)

    document_stats = DocumentStats(
        total_fields=total_doc_fields,
        total_files_uploaded=total_files,
        verified_files=verified_files,
        pending_verification=total_files - verified_files,
    )

    # ── Monthly Activity  (last 6 months) ─────────────────────────────────────
    monthly_activity: List[MonthlyActivity] = []
    for i in range(5, -1, -1):
        # approximate month start/end
        ref = today.replace(day=1) - timedelta(days=1)  # end of last month
        # walk back i months
        m = today.replace(day=1)
        for _ in range(i):
            m = (m - timedelta(days=1)).replace(day=1)
        m_end = (m.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

        new_stu = (
            db.query(Student)
            .filter(
                Student.id.in_(all_ids),
                func.date(Student.created_at) >= m,
                func.date(Student.created_at) <= m_end,
            )
            .count()
        )
        new_app = (
            db.query(Application)
            .filter(
                Application.student_id.in_(all_ids),
                func.date(Application.created_at) >= m,
                func.date(Application.created_at) <= m_end,
            )
            .count()
        )
        new_offers = (
            db.query(Application)
            .filter(
                Application.student_id.in_(all_ids),
                Application.application_status.in_([
                    ApplicationStatus.unconditional_offer,
                    ApplicationStatus.offer_accepted,
                ]),
                func.date(Application.updated_at) >= m,
                func.date(Application.updated_at) <= m_end,
            )
            .count()
        )
        month_pay = float(
            db.query(func.coalesce(func.sum(
                case(
                    (Payment.status == PaymentStatus.done, Payment.amount),
                    (Payment.status == PaymentStatus.partial, Payment.paid_amount),
                    else_=0
                )
            ), 0.0))
            .filter(
                or_(
                    Payment.student_id.in_(all_ids),
                    Payment.student_id.is_(None)
                ),
                Payment.payment_date >= m,
                Payment.payment_date <= m_end,
            )
            .scalar()
        )
        monthly_activity.append(MonthlyActivity(
            month=m.strftime("%Y-%m"),
            new_students=new_stu,
            new_applications=new_app,
            offers=new_offers,
            payments_collected=month_pay,
        ))

    # ── Service Breakdown ─────────────────────────────────────────────────────
    svc_rows = (
        db.query(StudentService.service_type, func.count(StudentService.id))
        .filter(StudentService.student_id.in_(all_ids))
        .group_by(StudentService.service_type)
        .all()
    )
    service_breakdown = [
        ServiceStats(service_type=r[0].value, count=r[1])
        for r in svc_rows
    ]

    # ── Birthdays Today ───────────────────────────────────────────────────────
    birthday_students = (
        db.query(Student)
        .filter(
            Student.id.in_(all_ids),
            Student.date_of_birth.isnot(None),
            extract("day",   Student.date_of_birth) == today.day,
            extract("month", Student.date_of_birth) == today.month,
            Student.is_active == True,
        )
        .all()
    )
    birthdays_today = [
        {
            "id":    s.id,
            "name":  f"{s.first_name or ''} {s.last_name or ''}".strip(),
            "email": s.email,
            "dob":   s.date_of_birth,
        }
        for s in birthday_students
    ]

    # ── Applications with Deadlines in Next 7 Days ────────────────────────────
    deadline_cutoff = today + timedelta(days=7)
    deadline_rows = (
        db.query(Application, Student, University)
        .join(Student, Student.id == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(
            Application.student_id.in_(all_ids),
            Application.application_deadline.isnot(None),
            Application.application_deadline >= today,
            Application.application_deadline <= deadline_cutoff,
            Application.application_status.not_in([
                ApplicationStatus.rejected,
                ApplicationStatus.withdrawn,
            ]),
        )
        .order_by(Application.application_deadline.asc())
        .all()
    )
    applications_deadline_soon = [
        {
            "application_id":   app.id,
            "student_id":       stu.id,
            "student_name":     f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            "university_name":  uni.name,
            "course_name":      app.course_name,
            "deadline":         app.application_deadline,
            "days_left":        (app.application_deadline - today).days,
        }
        for app, stu, uni in deadline_rows
    ]

    return FullDashboardResponse(
        student_kpis=student_kpis,
        service_kpis=service_kpis,
        lead_funnel=lead_funnel,
        application_status_breakdown=application_status_breakdown,
        visa_breakdown=visa_breakdown,
        top_universities=top_universities,
        top_countries=top_countries,
        intake_distribution=intake_distribution,
        recent_offers=recent_offers,
        counsellor_performance=counsellor_performance,
        recent_students=recent_students,
        recent_applications=recent_applications,
        document_stats=document_stats,
        monthly_activity=monthly_activity,
        service_breakdown=service_breakdown,
        birthdays_today=birthdays_today,
        applications_deadline_soon=applications_deadline_soon,
    )


# ─── Granular / Drilldown Endpoints ──────────────────────────────────────────

@router.get("/students/recent")
def recent_students(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    limit: int = Query(default=10, le=50),
):
    """Quick list of recently added students with counsellor name."""
    visible_ids = _student_ids_for_user(db, current_user)
    q = db.query(Student, User).outerjoin(User, User.id == Student.counsellor_id)
    if visible_ids is not None:
        q = q.filter(Student.id.in_(visible_ids))
    rows = q.order_by(Student.created_at.desc()).limit(limit).all()
    return [
        {
            "id":              s.id,
            "name":            f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
            "email":           s.email,
            "phone":           s.phone,
            "lead_status":     s.lead_status,
            "highest_education": s.highest_education,
            "counsellor_name": u.full_name if u else None,
            "created_at":      s.created_at,
        }
        for s, u in rows
    ]


@router.get("/applications/recent")
def recent_applications(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    limit: int = Query(default=10, le=50),
):
    """Recent applications with student and university detail."""
    visible_ids = _student_ids_for_user(db, current_user)
    q = (
        db.query(Application, Student, University)
        .join(Student,    Student.id    == Application.student_id)
        .join(University, University.id == Application.university_id)
    )
    if visible_ids is not None:
        q = q.filter(Application.student_id.in_(visible_ids))
    rows = q.order_by(Application.created_at.desc()).limit(limit).all()
    return [
        {
            "id":                 app.id,
            "student_id":         stu.id,
            "student_name":       f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            "university_name":    uni.name,
            "university_country": uni.country,
            "course_name":        app.course_name,
            "intake_month":       app.intake_month,
            "intake_year":        app.intake_year,
            "application_status": app.application_status,
            "application_status":        app.application_status,
            "tuition_fee":        app.tuition_fee,
            "currency":           app.currency,
            "deadline":           app.application_deadline,
            "created_at":         app.created_at,
        }
        for app, stu, uni in rows
    ]


@router.get("/offers")
def all_offers(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    status: Optional[str] = Query(default=None, description="Filter: conditional_offer | unconditional_offer | offer_accepted"),
    limit: int = Query(default=50, le=200),
):
    """
    All offer-stage applications (conditional, unconditional, offer_accepted).
    Optional ?status= filter to drill into one bucket.
    """
    visible_ids = _student_ids_for_user(db, current_user)

    offer_statuses = [
        ApplicationStatus.conditional_offer,
        ApplicationStatus.unconditional_offer,
        ApplicationStatus.offer_accepted,
    ]
    if status:
        try:
            offer_statuses = [ApplicationStatus(status)]
        except ValueError:
            pass

    q = (
        db.query(Application, Student, University)
        .join(Student,    Student.id    == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(Application.application_status.in_(offer_statuses))
    )
    if visible_ids is not None:
        q = q.filter(Application.student_id.in_(visible_ids))

    rows = q.order_by(Application.updated_at.desc()).limit(limit).all()
    return [
        {
            "application_id":    app.id,
            "student_id":        stu.id,
            "student_name":      f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            "student_email":     stu.email,
            "university_name":   uni.name,
            "university_country":uni.country,
            "university_category":uni.category,
            "course_name":       app.course_name,
            "specialization":    app.specialization,
            "intake_month":      app.intake_month,
            "intake_year":       app.intake_year,
            "application_status":app.application_status,
            "application_status":       app.application_status,
            "tuition_fee":       app.tuition_fee,
            "scholarship_amount":app.scholarship_amount,
            "currency":          app.currency,
            "course_start_date": app.course_start_date,
            "updated_at":        app.updated_at,
        }
        for app, stu, uni in rows
    ]


@router.get("/students/all")
def all_students(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    lead_status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
):
    """
    Paginated full student list with key fields.
    Optional ?lead_status= filter.
    """
    visible_ids = _student_ids_for_user(db, current_user)
    q = db.query(Student, User).outerjoin(User, User.id == Student.counsellor_id)
    if visible_ids is not None:
        q = q.filter(Student.id.in_(visible_ids))
    if lead_status:
        try:
            q = q.filter(Student.lead_status == LeadStatus(lead_status))
        except ValueError:
            pass

    total = q.count()
    rows  = q.order_by(Student.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "students": [
            {
                "id":                s.id,
                "name":              f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
                "email":             s.email,
                "phone":             s.phone,
                "lead_status":       s.lead_status,
                "highest_education": s.highest_education,
                "nationality":       s.nationality,
                "counsellor_id":     s.counsellor_id,
                "counsellor_name":   u.full_name if u else None,
                "created_at":        s.created_at,
            }
            for s, u in rows
        ],
    }




@router.get("/birthdays")
def get_today_birthdays(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """Students with birthdays today (role-filtered)."""
    today = date.today()
    visible_ids = _student_ids_for_user(db, current_user)
    q = db.query(Student).filter(
        Student.date_of_birth.isnot(None),
        extract("day",   Student.date_of_birth) == today.day,
        extract("month", Student.date_of_birth) == today.month,
        Student.is_active == True,
    )
    if visible_ids is not None:
        q = q.filter(Student.id.in_(visible_ids))
    students = q.all()
    return [
        {
            "id":    s.id,
            "name":  f"{s.first_name or ''} {s.last_name or ''}".strip(),
            "email": s.email,
            "dob":   s.date_of_birth,
        }
        for s in students
    ]


@router.get("/deadlines")
def upcoming_deadlines(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    days: int = Query(default=14, le=90),
):
    """Applications with deadlines in the next N days (default 14)."""
    today  = date.today()
    cutoff = today + timedelta(days=days)
    visible_ids = _student_ids_for_user(db, current_user)
    q = (
        db.query(Application, Student, University)
        .join(Student,    Student.id    == Application.student_id)
        .join(University, University.id == Application.university_id)
        .filter(
            Application.application_deadline.isnot(None),
            Application.application_deadline >= today,
            Application.application_deadline <= cutoff,
            Application.application_status.not_in([
                ApplicationStatus.rejected,
                ApplicationStatus.withdrawn,
            ]),
        )
    )
    if visible_ids is not None:
        q = q.filter(Application.student_id.in_(visible_ids))
    rows = q.order_by(Application.application_deadline.asc()).all()
    return [
        {
            "application_id":  app.id,
            "student_id":      stu.id,
            "student_name":    f"{stu.first_name or ''} {stu.last_name or ''}".strip() or stu.email,
            "university_name": uni.name,
            "course_name":     app.course_name,
            "deadline":        app.application_deadline,
            "days_left":       (app.application_deadline - today).days,
            "status":          app.application_status,
        }
        for app, stu, uni in rows
    ]