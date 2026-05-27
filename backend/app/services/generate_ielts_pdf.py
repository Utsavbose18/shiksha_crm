"""
generate_ielts_pdf.py
---------------------
Generates a LetzStudy invoice PDF for test-preparation services
(IELTS, GRE, GMAT, French, German, Japanese, etc.)

Mirrors the layout of the IELTS sample document.
"""

import os
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image


# ── Font registration (same as invoice) ──────────────────────────────────────
try:
    pdfmetrics.registerFont(TTFont("Arial",      "arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "arialbd.ttf"))
    _BODY_FONT = "Arial"
    _HEAD_FONT = "Arial-Bold"
except Exception:
    _BODY_FONT = "Times-Roman"
    _HEAD_FONT = "Times-Bold"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ASSETS_DIR = os.path.join(BASE_DIR, "assets")

LOGO_PATH = os.path.join(ASSETS_DIR, "Letzstudy logo.png")
PHONE_PATH = os.path.join(ASSETS_DIR, "phone_icon.png")
SEAL_PATH = os.path.join(ASSETS_DIR, "seal.png")


BLACK      = colors.HexColor("#000000")
MUTED      = colors.HexColor("#555555")
LIGHT_GRAY = colors.HexColor("#F2F2F2")
TEAL       = colors.HexColor("#0D7377")

PAGE_W, PAGE_H = A4
MARGIN    = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

# ── Label mapping for payment_type ───────────────────────────────────────────
PROGRAM_LABELS = {
    "ielts":    "IELTS",
    "toefl":    "TOEFL",
    "duolingo": "Duolingo",
    "gre":      "GRE",
    "gmat":     "GMAT",
    "french":   "French",
    "german":   "German",
    "japanese": "Japanese",
}


def _program_label(payment_type: str) -> str:
    return PROGRAM_LABELS.get((payment_type or "").lower(), payment_type.upper())


def S(name, **kw):
    return ParagraphStyle(name, **kw)


def get_styles():
    base = dict(fontName=_BODY_FONT, fontSize=9.5, textColor=BLACK, leading=16)
    # bold = dict(fontName=_HEAD_FONT, leading=13, textColor=BLACK, leading=16)
    return {
        "body":         S("body",        **base, alignment=TA_JUSTIFY, spaceAfter=8, wordWrap="LTR"),
        "body_left":    S("body_left",   **base, alignment=TA_LEFT,    spaceAfter=6),
        "meta":         S("meta",        fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14, alignment=TA_LEFT),
        "section_bold": S("section_bold",fontName="Times-Bold",  fontSize=10, textColor=BLACK, leading=14, spaceAfter=4, spaceBefore=8),
        "th":           S("th",          fontName="Times-Bold",  fontSize=10, textColor=BLACK, alignment=TA_LEFT,  leading=14),
        "th_r":         S("th_r",        fontName="Times-Bold",  fontSize=10, textColor=BLACK, alignment=TA_RIGHT, leading=14),
        "td":           S("td",          fontName="Times-Roman", fontSize=10, textColor=BLACK, alignment=TA_LEFT,  leading=14),
        "td_r":         S("td_r",        fontName="Times-Roman", fontSize=10, textColor=BLACK, alignment=TA_RIGHT, leading=14),
        "td_teal":      S("td_teal",     fontName="Times-Roman", fontSize=10, textColor=TEAL,  alignment=TA_LEFT,  leading=14),
        "td_teal_r":    S("td_teal_r",   fontName="Times-Roman", fontSize=10, textColor=TEAL,  alignment=TA_RIGHT, leading=14),
        "bullet":       S("bullet",      fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14, leftIndent=18, spaceAfter=3),
        "pay_bullet":   S("pay_bullet",  fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14, leftIndent=14, spaceAfter=2),
        "decl_label":   S("decl_label",  fontName="Times-Bold",  fontSize=10, textColor=BLACK, leading=14, spaceBefore=6, spaceAfter=2),
        "decl_body":    S("decl_body",   fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14, alignment=TA_JUSTIFY, spaceAfter=14),
        "sig":          S("sig",         fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14),
        "footer":       S("footer",      fontName="Times-Roman", fontSize=10, textColor=MUTED, alignment=TA_CENTER, leading=14),
        "confirm_text": S("confirm_text",fontName="Times-Roman", fontSize=10, textColor=BLACK, leading=14, alignment=TA_LEFT, spaceAfter=4),
    }


def checkbox(label, checked):
    mark = "[x]" if checked else "[ ]"
    return f"{mark} {label}"


def make_on_page(logo_path, phone_path):
    def draw_page(canvas, doc):
        canvas.saveState()
        if os.path.exists(logo_path):
            lw, lh = 38 * mm, 28 * mm
            canvas.drawImage(
                logo_path, MARGIN, PAGE_H - MARGIN - lh + 4 * mm,
                width=lw, height=lh, preserveAspectRatio=True, mask="auto",
            )
        fy = 10 * mm
        canvas.setFont("Times-Roman", 8.5)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(PAGE_W / 2, fy + 22, "#371/1, 04th Floor, Shreya Arcade, 80 Feet Road, JP Nagar Phase 8th Phase,")
        canvas.drawCentredString(PAGE_W / 2, fy + 11, "Bengaluru- 560083, Karnataka, India")
        if os.path.exists(phone_path):
            ix = PAGE_W / 2 - 50
            canvas.drawImage(phone_path, ix, fy, width=9, height=9,
                             preserveAspectRatio=True, mask="auto")
            canvas.drawString(ix + 11, fy + 0.5, "93804-86921, 90357-36290")
        else:
            canvas.drawCentredString(PAGE_W / 2, fy, "93804-86921, 90357-36290")
        canvas.setFillColor(TEAL)
        canvas.drawCentredString(PAGE_W / 2, fy - 10, "www.letzstudy.com   Mail: info@letzstudy.com")
        canvas.restoreState()

    return draw_page

def build_ielts_pdf(data: dict) -> bytes:
    print("IELTS DATA RECEIVED:", data)
  
  
def build_ielts_pdf(data: dict) -> bytes:
    """
    Build a test-prep invoice PDF.

    Expected keys in `data`:
        invoice_number, invoice_date, student_name,
        payment_type,       # e.g. "IELTS", "GRE", "French"
        total_amount,       # e.g. "5,000"
        paid_amount,        # e.g. "5,000"
        currency,           # e.g. "INR"
        payment_mode,       # e.g. "UPI"
        payment_reference,  # transaction ref or ""
        payment_status,     # "done" | "pending"
        download_date,
    """
    styles  = get_styles()
    buffer  = BytesIO()
    on_page = make_on_page(LOGO_PATH, PHONE_PATH)

    doc = SimpleDocTemplate(
    buffer, pagesize=A4,
    leftMargin=12 * mm,
    rightMargin=12 * mm,
    topMargin=30 * mm,
    bottomMargin=20 * mm,
)

    story = []
    program = _program_label(data.get("payment_type", ""))
    currency = data.get("currency", "INR")

    # ── Invoice meta ──────────────────────────────────────────────────────
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(f"Invoice No &nbsp; : {data['invoice_number']}", styles["meta"]))
    story.append(Paragraph(f"Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : {data['invoice_date']}", styles["meta"]))
    story.append(Spacer(1, 2 * mm))

    # ── Salutation & intro ────────────────────────────────────────────────
    story.append(Paragraph(f"Dear {data['student_name']},", styles["body_left"]))
    story.append(Paragraph(
        "Thank you for choosing LetzStudy for your test preparation and language learning journey. "
        "We truly appreciate your trust in us.",
        styles["body"],
    ))
    story.append(Paragraph(
        "Please review the terms and conditions in the attached invoice and confirm your acceptance "
        "to proceed further. Kindly note that the fees mentioned apply only to the selected program "
        f"({program} / IELTS / GRE / GMAT / German / other test preparation services).",
        styles["body"],
    ))
    story.append(Paragraph(
        "For any queries or clarifications, feel free to reach out — we\u2019re happy to assist.",
        styles["body"],
    ))

    # ── Service & Payment Details ─────────────────────────────────────────
    story.append(Paragraph("<b>Service &amp; Payment Details:</b>", styles["section_bold"]))

    story.append(Paragraph(
        f"This is to confirm that the fee for <b>{program}</b> classes is "
        f"Rs {data['total_amount']}/- on {data['invoice_date']}",
        styles["confirm_text"],
    ))
    story.append(Paragraph(
        f"An amount of {currency} {data['paid_amount']}/- has been received towards the same.",
        styles["confirm_text"],
    ))
    balance = data.get("balance_amount", "NIL")
    story.append(Paragraph(
        f"Balance Amount: {currency} {balance}/-",
        styles["confirm_text"],
    ))
    story.append(Spacer(1, 3 * mm))

    # ── Payment Details block ─────────────────────────────────────────────
    story.append(Paragraph("Payment Details:", styles["section_bold"]))

    pm = data.get("payment_mode", "")
    ps = data.get("payment_status", "pending")

    mode_line = (
        f"Mode of Payment:  "
        f"{checkbox('Cash', pm in ('Cash', 'cash'))}  "
        f"{checkbox('UPI',  pm == 'UPI')}  "
        f"{checkbox('Bank Transfer', pm in ('bank transfers', 'Bank Transfer'))}  "
        f"{checkbox('Card', pm in ('Card', 'card'))}"
    )
    story.append(Paragraph(f"\u2022  {mode_line}", styles["pay_bullet"]))

    ref_val = data.get("payment_reference") or ""
    story.append(Paragraph(f"\u2022  Transaction Reference No:  {ref_val}", styles["pay_bullet"]))
    story.append(Spacer(1, 2 * mm))

    # ── Terms ─────────────────────────────────────────────────────────────
    story.append(Paragraph("<b>Terms &amp; Conditions \u2013 LetzStudy Test Preparation</b>", styles["section_bold"]))

    terms = [
        ("<b>Coaching Scope:</b> This fee covers coaching/training only. Examination fees "
         "(IELTS / GRE / GMAT / SAT / French / German / Japanese exams, etc.) must be paid "
         "separately by the student."),
        ("<b>Fees Policy:</b> All fees are strictly non-refundable and non-transferable under "
         "any circumstances. Enrollment is confirmed only after payment."),
        ("<b>Attendance &amp; Classes:</b> Students must attend scheduled classes. Missed sessions "
         "will not be repeated, rescheduled, or compensated."),
        ("<b>Batch &amp; Validity:</b> Batch timings are fixed based on availability. Course "
         "validity is limited and will not be extended."),
        ("<b>Results &amp; Conduct:</b> LetzStudy does not guarantee scores. Students are expected "
         "to maintain discipline; any misconduct may lead to termination without refund."),
        ("<b>Study Material Usage:</b> All materials provided are for personal use only and must "
         "not be shared or reproduced."),
    ]
    for term in terms:
        story.append(Paragraph(f"\u2022  {term}", styles["bullet"]))

#     story.append(Spacer(1, 8 * mm))

#     # ── Signatures ────────────────────────────────────────────────────────
#     sig_col_l = CONTENT_W * 0.55
#     sig_col_r = CONTENT_W * 0.45
#     sig_row = Table(
#         [[
#             Paragraph("Student Signature: ______________________", styles["sig"]),
#             Paragraph("Date: ___________",                        styles["sig"]),
#         ]],
#         colWidths=[sig_col_l, sig_col_r],
#         style=[
#             ("LEFTPADDING",   (0, 0), (-1, -1), 0),
#             ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
#             ("TOPPADDING",    (0, 0), (-1, -1), 0),
#             ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
#             ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
#         ],
#     )
#     story.append(sig_row)
#     story.append(Spacer(1, 8 * mm))
# # 
    print("SEAL PATH:", SEAL_PATH)
    print("FILE EXISTS:", os.path.exists(SEAL_PATH))

    # ── Seal + Authorized Signatory ───────────────────────────────────────
    if os.path.exists(SEAL_PATH):
        seal = Image(SEAL_PATH, width=20 * mm, height=20 * mm)
        story.append(seal)

    story.append(Paragraph("Authorized Signatory (LetzStudy): ______________________", styles["sig"]))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes