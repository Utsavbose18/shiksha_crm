
"""
invoice_service.py
------------------
Routes invoice generation to the correct PDF builder based on payment_type.

  - Test / language programs  (IELTS, TOEFL, Duolingo, GRE, GMAT,
                                French, German, Japanese)
        → build_ielts_pdf()   (test-prep invoice layout)

  - Study-abroad service fees  (visa_fee, service_fee, accommodation,
                                forex, other)
        → build_invoice_pdf()  (study-abroad / consultation invoice layout)

Both "done" AND "partial" statuses trigger invoice generation.
"""

import os
import re
from datetime import datetime, date

# ── Payment-type classification ───────────────────────────────────────────────

TEST_PREP_TYPES = {
    "ielts", "toefl", "duolingo", "gre", "gmat",
    "french", "german", "japanese", "dmit",
}

# Statuses that should trigger invoice generation
INVOICE_STATUSES = {"done", "partial"}


def _is_test_prep(payment_type: str) -> bool:
    pt = (payment_type or "").lower().strip()

    return any(x in pt for x in [
        "ielts", "toefl", "duolingo", "gre", "gmat",
        "french", "german", "japanese","dmit",
    ])

def _should_generate_invoice(status: str) -> bool:
    return str(status).lower().strip() in INVOICE_STATUSES


# ── Filename helper ───────────────────────────────────────────────────────────

def get_student_filename(student, pay_id, manual_name=None):
    # ✅ Priority: manual name (walk-in)
    if manual_name:
        safe_name = manual_name.strip().replace(" ", "_")
        return f"{safe_name}_Invoice_{pay_id}.pdf"

    # ✅ Registered student
    if student:
        first = (getattr(student, "first_name", "") or "").strip()
        last  = (getattr(student, "last_name", "") or "").strip()
        name  = f"{first}_{last}".strip("_")
        return f"{name or 'Student'}_Invoice_{pay_id}.pdf"

    # ✅ Final fallback
    return f"Invoice_{pay_id}.pdf"


# ── Date formatter ────────────────────────────────────────────────────────────

def _fmt_date(d) -> str:
    """Return  '24th March 2026'  from a date / datetime / ISO string."""
    if d is None:
        return datetime.now().strftime("%-d %B %Y")

    if isinstance(d, str):
        try:
            d = date.fromisoformat(d[:10])
        except ValueError:
            return str(d)

    day = d.day
    suffix = (
        "th" if 11 <= day <= 13
        else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    )
    return f"{day}{suffix} {d.strftime('%B %Y')}"


# ── Amount formatter ──────────────────────────────────────────────────────────

def _fmt_amount(amount) -> str:
    """Convert  25000  →  '25,000'"""
    try:
        return f"{float(amount):,.0f}"
    except (TypeError, ValueError):
        return str(amount or "0")


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_invoice(payment, student, db) -> None:
    status = (payment.status or "").lower().strip()

    print("STATUS:", status)

    # 🔥 VERY IMPORTANT FIX
    db.refresh(payment)

    pdf_bytes = _build_pdf(payment, student)

    print("PDF SIZE:", len(pdf_bytes) if pdf_bytes else "EMPTY")

    payment.invoice_pdf = pdf_bytes
    db.commit()



def _financial_year(dt: date) -> str:
    """
    Returns financial year like:
    2026-2027 (April to March cycle)
    """
    if dt.month >= 4:  # April or later
        start_year = dt.year
        end_year = dt.year + 1
    else:  # Jan–March
        start_year = dt.year - 1
        end_year = dt.year

    return f"{start_year}-{end_year}"


def _build_pdf(payment, student) -> bytes:
    payment_type = (payment.payment_type or "").lower().strip()
    status = str(payment.status).split(".")[-1].lower().strip()

    
    manual_name = (payment.manual_student_name or "").strip()

    db_name = ""
    if student:
        db_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip()

    student_name = manual_name or db_name or "Student"

    invoice_date  = _fmt_date(payment.payment_date or payment.created_at)
    
    total_amount = float(payment.amount or 0)
    db_paid      = float(payment.paid_amount or 0)

    # 2. Logic for Paid and Balance
    # if status == "done":
    #     paid_amount = total_amount
    #     balance = 0.0   
    # elif status == "partial":
    #     paid_amount = db_paid
    #     balance = total_amount - paid_amount
    # else:
    #     paid_amount = db_paid
    #     balance = total_amount - paid_amount
    
    if status == "done":
     paid_amount = total_amount
     balance = 0.0
    elif status == "partial":
        paid_amount = db_paid
        balance = total_amount - paid_amount
    else:  # pending
        paid_amount = 0.0        # nothing received yet
        balance = total_amount   # entire amount is pending

    print("FINAL STATUS USED:", status)
    print("TOTAL:", total_amount, "PAID:", paid_amount)
    balance = max(0.0, balance)

    total_str   = _fmt_amount(total_amount) 
    paid_str    = _fmt_amount(paid_amount)
    balance_str = _fmt_amount(balance) if balance > 0 else "NIL"

    # invoice_number = f"LETZSTUDY/{payment.id}/2026-2027"
    
    invoice_dt = payment.payment_date or payment.created_at or datetime.now()
    fy = _financial_year(invoice_dt)

    invoice_number = f"LETZSTUDY/{payment.id}/{fy}"

    base = {
        "invoice_number":    invoice_number,
        "invoice_date":      invoice_date,
        "student_name":      student_name,
        "total_amount":      total_str,
        "paid_amount":       paid_str,  
        "currency":          payment.currency or "INR",
        "payment_mode":      payment.payment_mode or "",
        "payment_reference": payment.reference or "",
        "payment_status":    status,
        "download_date":     datetime.now().strftime("%d %B %Y"),
    }

    if _is_test_prep(payment_type):
        from app.services.generate_ielts_pdf import build_ielts_pdf
        return build_ielts_pdf({
            **base,
            "payment_type":   payment_type,
            "balance_amount": balance_str,
        })
    else:
        from app.services.generate_invoice_pdf import build_invoice_pdf
        destination = _destination_label(payment_type, payment.notes or "")
        return build_invoice_pdf({**base, "balance_amount": balance_str, "destination": destination})
# ── Destination label for study-abroad invoices ───────────────────────────────

_DEST_MAP = {
    "visa_fee":      "visa application",
    "service_fee":   "study abroad services",
    "accommodation": "accommodation",
    "forex":         "foreign exchange",
    "other":         "study abroad services",
}


def _destination_label(payment_type: str, notes: str) -> str:
    label = _DEST_MAP.get(payment_type.lower(), "study abroad services")
    for keyword in ("Australia", "UK", "USA", "Canada", "Germany", "France",
                    "New Zealand", "Singapore", "Dubai", "Ireland"):
        if keyword.lower() in notes.lower():
            label = f"{keyword} university application"
            break
    return label