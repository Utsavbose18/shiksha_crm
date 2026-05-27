
"""
generate_invoice_pdf.py
-----------------------
Generates a LetzStudy invoice PDF for study-abroad / consultation services.
Mirrors the layout of sample_2_for_study_abroad.docx.

Expected keys in `data`:
    invoice_number, invoice_date, student_name,
    total_amount, paid_amount, balance_amount,
    currency, payment_mode, payment_reference,
    payment_status, download_date,
    destination   # e.g. "Australian university application"
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

# ── Font registration ──────────────────────────────────────────────────────────
try:
    pdfmetrics.registerFont(TTFont("Arial",      "arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "arialbd.ttf"))
    _BODY_FONT = "Arial"
    _HEAD_FONT = "Arial-Bold"
except Exception:
    _BODY_FONT = "Times-Roman"
    _HEAD_FONT = "Times-Bold"

# BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ASSETS_DIR = os.path.join(BASE_DIR, "assets")

LOGO_PATH = os.path.join(ASSETS_DIR, "Letzstudy logo.png")
SEAL_PATH = os.path.join(ASSETS_DIR, "seal.png")
PHONE_PATH = os.path.join(ASSETS_DIR, "phone_icon.png")

print("LOGO PATH:", LOGO_PATH)
print("LOGO EXISTS:", os.path.exists(LOGO_PATH))
print("SEAL PATH:", SEAL_PATH)
print("SEAL EXISTS:", os.path.exists(SEAL_PATH))

BLACK      = colors.HexColor("#000000")
MUTED      = colors.HexColor("#555555")
LIGHT_GRAY = colors.HexColor("#F2F2F2")
TEAL       = colors.HexColor("#0D7377")

PAGE_W, PAGE_H = A4
MARGIN    = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


def S(name, **kw):
    return ParagraphStyle(name, **kw)


def get_styles():
    base = dict(fontName=_BODY_FONT, fontSize=11, textColor=BLACK, leading=16)
    return {
        "body":          S("body_sa",        **base, alignment=TA_JUSTIFY, spaceAfter=8, wordWrap="LTR"),
        "body_left":     S("body_left_sa",   **base, alignment=TA_LEFT,    spaceAfter=6),
        "meta":          S("meta_sa",        fontName="Times-Roman", fontSize=11, textColor=BLACK, leading=20, alignment=TA_LEFT),
        "section_bold":  S("section_bold_sa",fontName="Times-Bold",  fontSize=11, textColor=BLACK, leading=16, spaceAfter=4, spaceBefore=8),
        "th":            S("th_sa",          fontName="Times-Bold",  fontSize=11, textColor=BLACK, alignment=TA_LEFT,  leading=14),
        "th_r":          S("th_r_sa",        fontName="Times-Bold",  fontSize=11, textColor=BLACK, alignment=TA_RIGHT, leading=14),
        "td":            S("td_sa",          fontName="Times-Roman", fontSize=11, textColor=BLACK, alignment=TA_LEFT,  leading=14),
        "td_r":          S("td_r_sa",        fontName="Times-Roman", fontSize=11, textColor=BLACK, alignment=TA_RIGHT, leading=14),
        "td_teal":       S("td_teal_sa",     fontName="Times-Roman", fontSize=11, textColor=TEAL,  alignment=TA_LEFT,  leading=14),
        "td_teal_r":     S("td_teal_r_sa",   fontName="Times-Roman", fontSize=11, textColor=TEAL,  alignment=TA_RIGHT, leading=14),
        "bullet":        S("bullet_sa",      fontName="Times-Roman", fontSize=11, textColor=BLACK, leading=16, leftIndent=18, spaceAfter=3),
        "pay_bullet":    S("pay_bullet_sa",  fontName="Times-Roman", fontSize=11, textColor=BLACK, leading=18, leftIndent=14, spaceAfter=2),
        "decl_label":    S("decl_label_sa",  fontName="Times-Bold",  fontSize=11, textColor=BLACK, leading=16, spaceBefore=6, spaceAfter=2),
        "decl_body":     S("decl_body_sa",   fontName="Times-Roman", fontSize=11, textColor=BLACK, leading=16, alignment=TA_JUSTIFY, spaceAfter=14),
        "sig":           S("sig_sa",         fontName="Times-Roman", fontSize=11, textColor=BLACK, leading=14),
        "footer":        S("footer_sa",      fontName="Times-Roman", fontSize=8.5, textColor=MUTED, alignment=TA_CENTER, leading=13),
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


def build_invoice_pdf(data: dict) -> bytes:
    styles  = get_styles()
    buffer  = BytesIO()
    on_page = make_on_page(LOGO_PATH, PHONE_PATH)

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=38 * mm, bottomMargin=30 * mm,
    )

    story = []
    currency    = data.get("currency", "INR")
    destination = data.get("destination", "study abroad services")

    # ── Invoice meta ──────────────────────────────────────────────────────
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(f"Invoice No &nbsp; : {data['invoice_number']}", styles["meta"]))
    story.append(Paragraph(f"Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : {data['invoice_date']}", styles["meta"]))
    story.append(Spacer(1, 5 * mm))

    # ── Salutation & intro ────────────────────────────────────────────────
    story.append(Paragraph(f"Dear {data['student_name']},", styles["body_left"]))
    story.append(Paragraph(
        "Thank you for choosing LetzStudy to guide you through your study abroad "
        "journey. We are delighted to have you on board and truly appreciate your "
        "trust in us.",
        styles["body"],
    ))
    story.append(Paragraph(
        f"As part of the next step in your application process for {destination}, "
        "we kindly ask that you take a moment to review the terms and conditions "
        "outlined in the attached invoice. Once you have thoroughly reviewed them, "
        "we would appreciate it if you could sign and return a copy of the invoice "
        "to confirm your acceptance and allow us to proceed with the next steps.",
        styles["body"],
    ))
    story.append(Paragraph(
        f"Also, kindly note that the consultation charges mentioned below are for "
        f"{destination}. Should you have any questions or require clarification on "
        "any point, please feel free to reach out to us and we will be more than "
        "happy to assist.",
        styles["body"],
    ))

    # ── Service Details table ─────────────────────────────────────────────
    story.append(Paragraph("<b>Service Details</b>", styles["section_bold"]))

    col_desc = CONTENT_W * 0.70
    col_chg  = CONTENT_W * 0.30
    border   = colors.black

    balance_str = data.get("balance_amount", "NIL")

    svc_rows = [
        [Paragraph("Description", styles["th"]),
         Paragraph("Charges",     styles["th_r"])],
        [Paragraph(
            f"Non refundable Consultation charges for {destination} (max 5 universities), "
            "application, documentation support, visa guidance processing.",
            styles["td"]),
         Paragraph(f"Rs {data['total_amount']}/-", styles["td_r"])],
        [Paragraph("Amount Received", styles["td_teal"]),
         Paragraph(f"{currency} {data['paid_amount']}/-", styles["td_teal_r"])],
        [Paragraph(
            "Balance amount to be paid once the offer is released and accepted from the student",
            styles["td"]),
         Paragraph(f"{currency} {balance_str}/-", styles["td_r"])],
    ]
    svc_table = Table(svc_rows, colWidths=[col_desc, col_chg])
    svc_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  LIGHT_GRAY),
        ("FONTNAME",      (0, 0), (-1, 0),  "Times-Bold"),
        ("BOX",           (0, 0), (-1, -1), 0.75, border),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5,  border),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(svc_table)
    story.append(Spacer(1, 5 * mm))

    # ── Payment Details ───────────────────────────────────────────────────
    story.append(Paragraph("Payment Details", styles["section_bold"]))
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

    status_line = (
        f"Payment Status:  "
        f"{checkbox('Paid',    ps == 'done')}  "
        f"{checkbox('Pending', ps in ('pending', 'partial'))}"
    )
    story.append(Paragraph(f"\u2022  {status_line}", styles["pay_bullet"]))
    story.append(Spacer(1, 5 * mm))

    # ── Terms ─────────────────────────────────────────────────────────────
    story.append(Paragraph("LetzStudy - Terms", styles["section_bold"]))
    terms = [
        "Students must provide true and accurate information in all the forms and documents.",
        "False details may lead to rejection of admission or visa.",
        "LetzStudy acts only as a facilitator; final admission/visa decisions rest with the university or embassy.",
        "Confirm with LetzStudy before making any payment or transaction to the university.",
        "Submit complete documents before deadlines; delays from incomplete files are the student\u2019s responsibility.",
        "Some documents may need stamping or translation. Respective charges to be borne by the student.",
        "Processing/service fees are non-refundable once the process starts.",
        "It is sole discretion of the student to accept or decline the offer.",
        "Tuition/accommodation fees must be paid directly to the university or authorized account.",
        "Payments to unauthorized third parties are not LetzStudy responsibility.",
        "Visa approval depends solely on the embassy\u2019s discretion.",
        "Provide genuine financial proofs and attend visa interviews as required.",
        "Insurance purchased from parties not recognized by the university or embassy will not be accepted.",
        "LetzStudy may guide in accommodation, but does not assure or guarantee any specific arrangement.",
        "Follow all laws and codes of conduct in the host country.",
        "LetzStudy is not liable for any disciplinary, legal, or personal issues abroad.",
        "Check email and WhatsApp regularly for updates; inform any change in contact details.",
        (
            "Students must maintain discretion and confidentiality: do not share documents, IDs, or "
            "passwords with anyone except authorized LetzStudy staff; voice recordings are allowed only "
            "if officially approved; avoid posting confidential or misleading information about the "
            "process on social media, as actions causing reputational harm may lead to legal review; "
            "all disputes, if any, are subject to Bangalore jurisdiction."
        ),
    ]
    for term in terms:
        story.append(Paragraph(f"\u2022  {term}", styles["bullet"]))

    story.append(Spacer(1, 6 * mm))

    # ── Declaration ───────────────────────────────────────────────────────
    story.append(KeepTogether([
        Paragraph("Declaration:", styles["decl_label"]),
        Paragraph(
            "I have read and agreed to the above terms and authorize LetzStudy to proceed "
            "with my application and visa process.",
            styles["decl_body"],
        ),
    ]))

    # ── Signatures ────────────────────────────────────────────────────────
    sig_col_l = CONTENT_W * 0.55
    sig_col_r = CONTENT_W * 0.45
    sig_row = Table(
        [[
            Paragraph("Student Signature: ______________________", styles["sig"]),
            Paragraph("Date: ___________",                        styles["sig"]),
        ]],
        colWidths=[sig_col_l, sig_col_r],
        style=[
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ],
    )

    # ✅ FIX: sig_row was built but never added to story — added here
    story.append(sig_row)
    story.append(Spacer(1, 8 * mm))

    print("SEAL PATH:", SEAL_PATH)
    print("FILE EXISTS:", os.path.exists(SEAL_PATH))

    # ── Seal + Authorized Signatory ───────────────────────────────────────
    if os.path.exists(SEAL_PATH):
        seal = Image(SEAL_PATH, width=40 * mm, height=40 * mm)
        story.append(seal)

    story.append(Paragraph("Authorized Signatory (LetzStudy): ______________________", styles["sig"]))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes