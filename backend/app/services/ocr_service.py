"""
ocr_service.py
Gemini-powered OCR extraction for specific document types.
"""
import io
import json
import re
import logging

import google.generativeai as genai
from PIL import Image
import fitz  # PyMuPDF

from app.models.user import DocumentType

logger = logging.getLogger("portal.ocr")

OCR_ENABLED_TYPES = {
    DocumentType.passport,
    DocumentType.marksheet_10,
    DocumentType.marksheet_12,
    DocumentType.diploma_transcripts,
    DocumentType.ug_degree_transcripts,
    DocumentType.masters_transcript,
    DocumentType.cv,
    DocumentType.offer_letter,   # ← triggers application autofill
    DocumentType.ielts,
    DocumentType.toefl,
    DocumentType.pte,
    DocumentType.duolingo,
    DocumentType.gre,
    DocumentType.gmat,
    DocumentType.sat,
    DocumentType.act,
}

SCHEMAS = {
    DocumentType.passport: """
Return ONLY a JSON object:
{
  "first_name": string or null,
  "middle_name": string or null,
  "last_name": string or null,
  "date_of_birth": "DD-MM-YYYY" or null,
  "gender": "Male"/"Female"/"Other" or null,
  "nationality": string or null,
  "passport_number": string or null,
  "passport_issue_date": "DD-MM-YYYY" or null,
  "passport_expiry": "DD-MM-YYYY" or null,
  "passport_issue_country": string or null,
  "city_of_birth": string or null,
  "country_of_birth": string or null,
  "permanent_address1":string or null,
  "permanent_address2":string or null,
  "permanent_city": string or null,
  "permanent_state": string or null,
  "permanent_country": string or null,
  "permanent_pincode": string or null,
}
RULES:
- Extract full address EXACTLY as written into "raw_address".
- Then split the address into structured fields:

Address splitting rules:
- permanent_address1 = house/building + street/area
- permanent_city = city/town/village
- permanent_state = state/province
- permanent_country = country
- permanent_pincode = last 5–6 digit number

- If unsure, still fill raw_address and best-guess structured fields.
- Never return all address fields as null if address exists.
- Indian addresses usually end with PIN code (6 digits).
""",

    DocumentType.marksheet_10: """
Return ONLY a JSON object:
{
  "institution": string or null,
  "board_university": string or null,
  "stream": string or null,
  "end_year": integer or null,
  "percentage_cgpa": number or null,
  "grading_scale": "percentage"/"cgpa_10"/"cgpa_4" or null
}
RULES: end_year is the year of exam/result. percentage_cgpa is the total score as a number. null if not found.
""",

    DocumentType.marksheet_12: """
Return ONLY a JSON object:
{
  "institution": string or null,
  "board_university": string or null,
  "stream": string or null,
  "end_year": integer or null,
  "percentage_cgpa": number or null,
  "grading_scale": "percentage"/"cgpa_10"/"cgpa_4" or null
}
RULES: end_year is the year of exam/result. percentage_cgpa is the total score as a number. null if not found.
""",

    DocumentType.ug_degree_transcripts: """
Return ONLY a JSON object:
{
  "institution": string or null,
  "board_university": string or null,
  "degree_name": string or null,
  "field_of_study": string or null,
  "specialization": string or null,
  "start_year": integer or null,
  "end_year": integer or null,
  "percentage_cgpa": number or null,
  "grading_scale": "percentage"/"cgpa_10"/"cgpa_4" or null,
  "backlogs": integer or null
}
RULES: null if not found. backlogs defaults to 0 if document confirms no backlogs.
""",

    DocumentType.diploma_transcripts: """
Return ONLY a JSON object:
{
  "institution": string or null,
  "board_university": string or null,
  "degree_name": string or null,
  "field_of_study": string or null,
  "specialization": string or null,
  "start_year": integer or null,
  "end_year": integer or null,
  "percentage_cgpa": number or null,
  "grading_scale": "percentage"/"cgpa_10"/"cgpa_4" or null,
  "backlogs": integer or null
}
RULES: null if not found. backlogs defaults to 0 if document confirms no backlogs.
""",
    DocumentType.masters_transcript: """
Return ONLY a JSON object:
{
  "institution": string or null,
  "board_university": string or null,
  "degree_name": string or null,
  "field_of_study": string or null,
  "specialization": string or null,
  "start_year": integer or null,
  "end_year": integer or null,
  "percentage_cgpa": number or null,
  "grading_scale": "percentage"/"cgpa_10"/"cgpa_4" or null,
  "backlogs": integer or null
}
RULES: null if not found. backlogs defaults to 0 if document confirms no backlogs.
""",

    DocumentType.cv: """
Return ONLY a JSON object:
{
  "work_experiences": [
    {
      "company_name": string or null,
      "job_title": string or null,
      "employment_type": "Full-time"/"Part-time"/"Internship"/"Contract" or null,
      "start_date": "DD-MM-YYYY" or null,
      "end_date": "DD-MM-YYYY" or null,
      "is_current": boolean,
      "description": string or null,
      "country": string or null
    }
  ]
}
RULES: Extract ALL work experiences. is_current=true if end date is "present"/"current". null if not found.
""",

    # ── Offer Letter ────────────────────────────────────────────────────────────
    DocumentType.offer_letter: """
Return ONLY a JSON object:
{
  "university_name": string or null,
  "university_country": string or null,
  "course_name": string or null,
  "specialization": string or null,
  "course_start_date": "DD-MM-YYYY" or null,
  "course_end_date": "DD-MM-YYYY" or null,
  "course_duration_months": integer or null,
  "intake_month": string or null,
  "intake_year": integer or null,
  "application_deadline": "DD-MM-YYYY" or null,
  "tuition_fee": number or null,
  "currency": string or null,
  "scholarship_amount": number or null,
  "campus_location": string or null,
  "delivery_mode": string or null,
  "student_id_on_letter": string or null,
  "offer_type": "conditional"/"unconditional" or null
}

RULES:
- university_name: The full name of the university/institution issuing the letter.
- university_country: The country where the university is located. Infer from address, logo, or context if not stated explicitly.
- course_name: The full degree/program name offered (e.g. "Master of Professional Engineering").
- course_start_date: Date the course begins. DD-MM-YYYY format.
- course_end_date: Date the course ends. DD-MM-YYYY format.
- course_duration_months: Total duration as an integer in months. "2 years" = 24, "18 months" = 18. null if not stated.
- intake_month: Month name only (e.g. "February", "September"). Derive from course_start_date if not stated separately.
- intake_year: 4-digit year of intake. Derive from course_start_date if not stated separately.
- application_deadline: Acceptance/response deadline if mentioned. DD-MM-YYYY.
- tuition_fee: The annual OR total fee as a plain number with no currency symbol or commas (e.g. 52000 not "AUD $52,000").
- currency: 3-letter ISO code (AUD, GBP, USD, EUR, CAD, NZD, INR). Infer from context/country if not explicit.
- scholarship_amount: Scholarship or bursary value as plain number. null if none mentioned.
- offer_type: "unconditional" if acceptance is unconditional, "conditional" if conditions are listed. null if unclear.
- All dates MUST be DD-MM-YYYY format. null for any field not found.
""",
}

TEST_SCORE_SCHEMA = """
Return ONLY a JSON object:
{
  "overall_score": number or null,
  "test_date": "DD-MM-YYYY" or null,
  "expiry_date": "DD-MM-YYYY" or null,
  "section_scores": {
    "section_name": score_number
  }
}
RULES: section_scores can be empty {}. Dates must be DD-MM-YYYY. null if not found.
"""

TEST_TYPES = {
    DocumentType.ielts, DocumentType.toefl, DocumentType.pte,
    DocumentType.duolingo, DocumentType.gre, DocumentType.gmat,
    DocumentType.sat, DocumentType.act,
}


def _pdf_to_image(content: bytes) -> Image.Image:
    pdf_doc = fitz.open(stream=content, filetype="pdf")
    page_images = []
    for page in pdf_doc:
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        page_images.append(img)

    if len(page_images) == 1:
        return page_images[0]

    # Stitch all pages vertically into one tall image
    total_width  = max(img.width for img in page_images)
    total_height = sum(img.height for img in page_images)
    combined = Image.new("RGB", (total_width, total_height), color=(255, 255, 255))
    y_offset = 0
    for img in page_images:
        combined.paste(img, (0, y_offset))
        y_offset += img.height

    return combined

def _image_bytes(content: bytes, mime_type: str) -> bytes:
    if mime_type == "application/pdf":
        img = _pdf_to_image(content)
    else:
        img = Image.open(io.BytesIO(content))

    # Downscale if the stitched image is excessively tall (> 8000 px)
    MAX_HEIGHT = 8000
    if img.height > MAX_HEIGHT:
        ratio = MAX_HEIGHT / img.height
        img = img.resize(
            (int(img.width * ratio), MAX_HEIGHT),
            Image.LANCZOS,
        )

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _clean_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())


def extract_with_gemini(content: bytes, mime_type: str, doc_type: DocumentType) -> dict:
    if doc_type not in OCR_ENABLED_TYPES:
        logger.debug(f"[OCR] Skipping — doc_type '{doc_type.value}' not in OCR_ENABLED_TYPES")
        return {}

    logger.info(f"[OCR] ▶ Starting Gemini OCR  doc_type='{doc_type.value}'  mime='{mime_type}'  size={len(content)} bytes")

    raw_text = ""
    try:
        img_bytes = _image_bytes(content, mime_type)
        logger.info(f"[OCR] Image/PDF → PNG  {len(img_bytes)} bytes")

        if doc_type in TEST_TYPES:
            schema = TEST_SCORE_SCHEMA
            prompt = f"You are extracting data from a {doc_type.value.upper()} score report."
        else:
            schema = SCHEMAS.get(doc_type, "")
            prompt = f"You are extracting data from a {doc_type.value.replace('_', ' ')} document."

        model = genai.GenerativeModel("gemini-2.5-flash")
        logger.info(f"[OCR] Sending to Gemini…")

        response = model.generate_content([
            prompt,
            schema,
            {"mime_type": "image/png", "data": img_bytes}
        ])

        raw_text = response.text.strip()
        logger.info(f"[OCR] ◀ Gemini raw response:\n{raw_text}")

        result = _clean_json(raw_text)
        result["_doc_type"] = doc_type.value
        logger.info(f"[OCR] ✅ Parsed successfully:\n{json.dumps(result, indent=2, default=str)}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"[OCR] ❌ JSON parse error: {e}  raw='{raw_text!r}'")
        return {"error": f"JSON parse failed: {e}", "_doc_type": doc_type.value}
    except Exception as e:
        logger.error(f"[OCR] ❌ Gemini failed: {type(e).__name__}: {e}", exc_info=True)
        return {"error": str(e), "_doc_type": doc_type.value}