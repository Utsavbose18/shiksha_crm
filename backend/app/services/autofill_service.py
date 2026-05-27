"""
autofill_service.py
After OCR extraction, auto-fill matching DB fields for the student.

Offer letter → updates the Application row (application_id must be passed in).
All other doc types → update Student / AcademicQualification / WorkExperience / TestScore.
"""
import json
import logging
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import (
    Student, AcademicQualification, WorkExperience, TestScore,
    Application, ApplicationStatus,
    AcademicLevel, DocumentType,
)

logger = logging.getLogger("portal.autofill")


def _parse_date(val: Optional[str]) -> Optional[date]:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except Exception as e:
        logger.warning(f"[AUTOFILL] Cannot parse date '{val}': {e}")
        return None


# ─── Map offer_type string → ApplicationStatus ────────────────────────────────
OFFER_TYPE_STATUS = {
    "conditional":   ApplicationStatus.conditional_offer,
    "unconditional": ApplicationStatus.unconditional_offer,
}


def autofill_from_extraction(
    db: Session,
    student: Student,
    doc_type: DocumentType,
    extracted: dict,
    test_type_id: Optional[int] = None,
    application_id: Optional[int] = None,   # ← required for offer_letter
) -> dict:
    """
    Routes OCR-extracted data to the correct DB table.
    Returns a summary dict: {autofilled: bool, updated_fields: [...]}
    """
    logger.info(
        f"[AUTOFILL] ▶ student_id={student.id}  doc_type='{doc_type.value}'  "
        f"application_id={application_id}"
    )
    logger.info(f"[AUTOFILL] Extracted:\n{json.dumps(extracted, indent=2, default=str)}")

    if not extracted:
        logger.warning("[AUTOFILL] Empty extraction — skipping")
        return {"autofilled": False, "reason": "no data"}

    if "error" in extracted:
        logger.warning(f"[AUTOFILL] Extraction error: {extracted['error']} — skipping")
        return {"autofilled": False, "reason": extracted["error"]}

    updated = []

    # ── Passport ──────────────────────────────────────────────────────────────
    if doc_type == DocumentType.passport:
        logger.info(f"[AUTOFILL] PASSPORT → students table")
        str_fields = {
            "first_name":             extracted.get("first_name"),
            "middle_name":            extracted.get("middle_name"),
            "last_name":              extracted.get("last_name"),
            "gender":                 extracted.get("gender"),
            "nationality":            extracted.get("nationality"),
            "passport_number":        extracted.get("passport_number"),
            "passport_issue_country": extracted.get("passport_issue_country"),
            "city_of_birth":          extracted.get("city_of_birth"),
            "country_of_birth":       extracted.get("country_of_birth"),
            "permanent_address1":extracted.get("permanent_address1"),
            "permanent_address2":extracted.get("permanent_address2"),
            "permanent_city": extracted.get("permanent_city"),
            "permanent_state": extracted.get("permanent_state"),
            "permanent_country": extracted.get("permanent_country"),
            "permanent_pincode":extracted.get("permanent_pincode"),
        }
        date_fields = {
            "date_of_birth":      _parse_date(extracted.get("date_of_birth")),
            "passport_issue_date":_parse_date(extracted.get("passport_issue_date")),
            "passport_expiry":    _parse_date(extracted.get("passport_expiry")),
        }
        for k, v in {**str_fields, **date_fields}.items():
            current = getattr(student, k, None)
            if v is not None and current is None:
                setattr(student, k, v)
                updated.append(k)
                logger.info(f"[AUTOFILL]   ✓ student.{k} = {v!r}")
            elif v is not None:
                logger.debug(f"[AUTOFILL]   — skip student.{k} (has value: {current!r})")
        db.commit()

    # ── 10th Marksheet ────────────────────────────────────────────────────────
    elif doc_type == DocumentType.marksheet_10:
        _upsert_academic(db, student, AcademicLevel.tenth, extracted, updated)

    # ── 12th Marksheet ────────────────────────────────────────────────────────
    elif doc_type == DocumentType.marksheet_12:
        _upsert_academic(db, student, AcademicLevel.twelfth, extracted, updated)

    # ── UG Transcripts ────────────────────────────────────────────────────────
    elif doc_type == DocumentType.diploma_transcripts:
        _upsert_academic(db, student, AcademicLevel.diploma, extracted, updated)

    elif doc_type == DocumentType.ug_degree_transcripts:
        _upsert_academic(db, student, AcademicLevel.ug, extracted, updated)
    
    elif doc_type == DocumentType.masters_transcript:
        _upsert_academic(db, student, AcademicLevel.pg, extracted, updated)

    # ── CV ────────────────────────────────────────────────────────────────────
    elif doc_type == DocumentType.cv:
        experiences = extracted.get("work_experiences", [])
        logger.info(f"[AUTOFILL] CV → {len(experiences)} work experience(s)")
        for exp in experiences:
            company = exp.get("company_name")
            title   = exp.get("job_title")
            if not company and not title:
                continue
            exists = db.query(WorkExperience).filter(
                WorkExperience.student_id == student.id,
                WorkExperience.company_name == company,
                WorkExperience.job_title == title,
            ).first()
            if exists:
                logger.info(f"[AUTOFILL]   Duplicate '{company}/{title}' — skip")
                continue
            we = WorkExperience(
                student_id=student.id,
                company_name=company,
                job_title=title,
                employment_type=exp.get("employment_type"),
                start_date=_parse_date(exp.get("start_date")),
                end_date=_parse_date(exp.get("end_date")),
                is_current=exp.get("is_current", False),
                description=exp.get("description"),
                country=exp.get("country"),
            )
            db.add(we)
            updated.append(f"work_exp:{company}")
            logger.info(f"[AUTOFILL]   ✓ Created WorkExperience '{company}/{title}'")
        db.commit()

    # ── Offer Letter → Application ────────────────────────────────────────────
    elif doc_type == DocumentType.offer_letter:
        logger.info(f"[AUTOFILL] OFFER LETTER → applications table  application_id={application_id}")

        if not application_id:
            logger.warning(
                "[AUTOFILL] offer_letter OCR ran but no application_id was provided."
            )
            return {"autofilled": False, "reason": "no application_id for offer letter"}

        app = db.query(Application).filter(
            Application.id == application_id,
            Application.student_id == student.id,
        ).first()

        if not app:
            logger.warning(f"[AUTOFILL] Application id={application_id} not found")
            return {"autofilled": False, "reason": f"application {application_id} not found"}

        updated = []

        # ─── STATUS ─────────────────────────────────────────────
        offer_type = (extracted.get("offer_type") or "").lower()
        new_status = OFFER_TYPE_STATUS.get(offer_type)
        if new_status and app.application_status not in (
            ApplicationStatus.conditional_offer,
            ApplicationStatus.unconditional_offer
        ):
            app.application_status = new_status
            updated.append("application_status")

        # ─── BASIC FIELDS ───────────────────────────────────────
        if extracted.get("course_name") and not app.course_name:
            app.course_name = extracted["course_name"]
            updated.append("course_name")

        if extracted.get("specialization") and not app.specialization:
            app.specialization = extracted["specialization"]
            updated.append("specialization")

        # ─── DATES ──────────────────────────────────────────────
        start_date = _parse_date(extracted.get("course_start_date"))
        if start_date and not app.course_start_date:
            app.course_start_date = start_date
            updated.append("course_start_date")

        end_date = _parse_date(extracted.get("course_end_date"))
        if end_date and not app.course_end_date:
            app.course_end_date = end_date
            updated.append("course_end_date")

        deadline = _parse_date(extracted.get("application_deadline"))
        if deadline and not app.application_deadline:
            app.application_deadline = deadline
            updated.append("application_deadline")

        # ─── INTAKE ─────────────────────────────────────────────
        if extracted.get("intake_month") and not app.intake_month:
            app.intake_month = extracted["intake_month"]
            updated.append("intake_month")

        if extracted.get("intake_year") and not app.intake_year:
            app.intake_year = extracted["intake_year"]
            updated.append("intake_year")

        # ─── NUMERIC FIELDS ─────────────────────────────────────
        if extracted.get("course_duration_months") and not app.course_duration_months:
            app.course_duration_months = int(extracted["course_duration_months"])
            updated.append("course_duration_months")

        if extracted.get("tuition_fee") is not None and not app.tuition_fee:
            app.tuition_fee = float(extracted["tuition_fee"])
            updated.append("tuition_fee")

        if extracted.get("scholarship_amount") is not None and not app.scholarship_amount:
            app.scholarship_amount = float(extracted["scholarship_amount"])
            updated.append("scholarship_amount")

        # ─── CURRENCY ───────────────────────────────────────────
        currency = extracted.get("currency")
        if currency and app.currency in (None, "USD"):
            app.currency = currency.upper()
            updated.append("currency")

        # ─── OTHER FIELDS ───────────────────────────────────────
        if extracted.get("campus_location") and not app.campus_location:
            app.campus_location = extracted["campus_location"]
            updated.append("campus_location")

        if extracted.get("delivery_mode") and not app.delivery_mode:
            app.delivery_mode = extracted["delivery_mode"]
            updated.append("delivery_mode")

        if extracted.get("student_id_on_letter") and not app.student_id_on_letter:
            app.student_id_on_letter = extracted["student_id_on_letter"]
            updated.append("student_id_on_letter")

        # ─── OPTIONAL: UNIVERSITY VALIDATION (no overwrite) ─────
        if extracted.get("university_name"):
            if app.university and app.university.name != extracted["university_name"]:
                logger.warning(
                    f"[AUTOFILL] University mismatch: DB='{app.university.name}' OCR='{extracted['university_name']}'"
                )

        # ─── FALLBACK NOTES (ONLY IF NOTHING UPDATED) ───────────
        if not updated:
            extra_note = "[OCR parsed but no fields updated]"
            app.notes = (app.notes or "") + "\n" + extra_note

        db.commit()

        logger.info(f"[AUTOFILL] Updated fields: {updated}")
    # ── Test Scores ───────────────────────────────────────────────────────────
    elif doc_type in {
        DocumentType.ielts, DocumentType.toefl, DocumentType.pte,
        DocumentType.duolingo, DocumentType.gre, DocumentType.gmat,
        DocumentType.sat, DocumentType.act,
    }:
        logger.info(f"[AUTOFILL] TEST SCORE  doc_type='{doc_type.value}'  test_type_id={test_type_id}")
        if not test_type_id:
            logger.warning(
                f"[AUTOFILL] No test_type_id — cannot save score. "
                f"Create a TestType named '{doc_type.value}' in the admin panel."
            )
        else:
            exists = db.query(TestScore).filter(
                TestScore.student_id == student.id,
                TestScore.test_type_id == test_type_id,
            ).first()
            if exists:
                logger.info(f"[AUTOFILL] TestScore already exists (id={exists.id}) — skip")
            else:
                ts = TestScore(
                    student_id=student.id,
                    test_type_id=test_type_id,
                    overall_score=extracted.get("overall_score"),
                    test_date=_parse_date(extracted.get("test_date")),
                    expiry_date=_parse_date(extracted.get("expiry_date")),
                    section_scores=extracted.get("section_scores") or {},
                    status="pending",
                )
                db.add(ts)
                db.commit()
                updated.append(f"test_score:type_{test_type_id}")
                logger.info(
                    f"[AUTOFILL]   ✓ TestScore created  overall={extracted.get('overall_score')}"
                    f"  date={extracted.get('test_date')}"
                )

    result = {"autofilled": len(updated) > 0, "updated_fields": updated}
    logger.info(f"[AUTOFILL] ◀ Complete: {result}")
    return result


# ─── Academic helper ──────────────────────────────────────────────────────────

def _upsert_academic(
    db: Session,
    student: Student,
    level: AcademicLevel,
    extracted: dict,
    updated: list,
):
    logger.info(f"[AUTOFILL] Academic upsert  level='{level.value}'  student_id={student.id}")

    existing = db.query(AcademicQualification).filter(
        AcademicQualification.student_id == student.id,
        AcademicQualification.level == level,
    ).first()

    fill = {
        "institution":    extracted.get("institution"),
        "board_university": extracted.get("board_university"),
        "degree_name":    extracted.get("degree_name"),
        "field_of_study": extracted.get("field_of_study"),
        "specialization": extracted.get("specialization"),
        "stream":         extracted.get("stream"),
        "start_year":     extracted.get("start_year"),
        "end_year":       extracted.get("end_year"),
        "percentage_cgpa":extracted.get("percentage_cgpa"),
        "grading_scale":  extracted.get("grading_scale"),
        "backlogs":       extracted.get("backlogs"),
    }
    logger.info(f"[AUTOFILL] Fill map: {json.dumps(fill, default=str)}")

    if existing:
        logger.info(f"[AUTOFILL] Existing record id={existing.id} — patch null fields only")
        for k, v in fill.items():
            current = getattr(existing, k, None)
            if v is not None and current is None:
                setattr(existing, k, v)
                updated.append(f"{level.value}:{k}")
                logger.info(f"[AUTOFILL]   ✓ academic.{k} = {v!r}")
            elif v is not None:
                logger.debug(f"[AUTOFILL]   — skip academic.{k} (has: {current!r})")
    else:
        non_null = {k: v for k, v in fill.items() if v is not None}
        aq = AcademicQualification(student_id=student.id, level=level, **non_null)
        db.add(aq)
        updated.append(f"created:{level.value}")
        logger.info(f"[AUTOFILL]   ✓ Created AcademicQualification fields={list(non_null.keys())}")

    db.commit()
    logger.info(f"[AUTOFILL] Academic done. updated so far: {updated}")