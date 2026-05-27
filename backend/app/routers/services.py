
"""
Services and Payments management.
Invoice auto-generated as PDF when payment status -> "done" OR "partial".
GET /api/payments/{id}/invoice streams the PDF for download.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import StudentService, Payment, Student, UserRole
from app.schemas.schemas import (
    StudentServiceCreate, StudentServiceOut,
    PaymentCreate, PaymentUpdate, PaymentOut, PaymentListResponse,
)
import traceback
from app.core.security import get_current_user
router      = APIRouter(tags=["Services & Payments"])
from app.core.security import get_current_user
from sqlalchemy import or_, and_

staff_roles = require_roles(UserRole.admin, UserRole.counsellor)

INVOICE_STATUSES = {"done", "partial"}


# def _try_generate_invoice(payment: Payment, db: Session) -> None:
#     try:
#         from app.services.invoice_service import generate_invoice
#         student = db.query(Student).filter(Student.id == payment.student_id).first()
#         if student:
#             generate_invoice(payment, student, db)
#     except Exception as exc:
#         print(f"[invoice_service] WARNING: Could not generate invoice for payment {payment.id}: {exc}")



def _try_generate_invoice(payment: Payment, db: Session) -> None:
    try:
        from app.services.invoice_service import generate_invoice

        student = None

        # ✅ If registered student
        student = None
        if payment.student_id:
            student = db.query(Student).filter(Student.id == payment.student_id).first()

        # ✅ Fallback for walk-in
        if not student and payment.manual_student_name:
            class DummyStudent:
                def __init__(self, name):
                    self.first_name = name
                    self.last_name = ""

            student = DummyStudent(payment.manual_student_name)

        if student:
            generate_invoice(payment, student, db)

    except Exception:
        print("🔥 INVOICE ERROR:")
        traceback.print_exc()


def _status_str(payment: Payment) -> str:
    return payment.status.value if hasattr(payment.status, "value") else str(payment.status).lower()


svc_router = APIRouter(prefix="/api/services")


@svc_router.post("/", response_model=StudentServiceOut, status_code=201)
def add_service(payload: StudentServiceCreate, db: Session = Depends(get_db), _=Depends(staff_roles)):
    svc = StudentService(**payload.model_dump())
    db.add(svc); db.commit(); db.refresh(svc)
    return svc


@svc_router.get("/", response_model=List[StudentServiceOut])
def list_services(
    db: Session = Depends(get_db), _=Depends(staff_roles),
    student_id: Optional[int] = None, service_type: Optional[str] = None,
    skip: int = 0, limit: int = 100,
):
    q = db.query(StudentService)
    if student_id:   q = q.filter(StudentService.student_id == student_id)
    if service_type: q = q.filter(StudentService.service_type == service_type)
    return q.offset(skip).limit(limit).all()


@svc_router.get("/{svc_id}", response_model=StudentServiceOut)
def get_service(svc_id: int, db: Session = Depends(get_db), _=Depends(staff_roles)):
    svc = db.query(StudentService).filter(StudentService.id == svc_id).first()
    if not svc: raise HTTPException(status_code=404, detail="Service not found")
    return svc


@svc_router.patch("/{svc_id}", response_model=StudentServiceOut)
def update_service(svc_id: int, payload: StudentServiceCreate, db: Session = Depends(get_db), _=Depends(staff_roles)):
    svc = db.query(StudentService).filter(StudentService.id == svc_id).first()
    if not svc: raise HTTPException(status_code=404, detail="Service not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(svc, k, v)
    db.commit(); db.refresh(svc)
    return svc


@svc_router.delete("/{svc_id}", status_code=204)
def delete_service(svc_id: int, db: Session = Depends(get_db), _=Depends(staff_roles)):
    svc = db.query(StudentService).filter(StudentService.id == svc_id).first()
    if not svc: raise HTTPException(status_code=404, detail="Service not found")
    db.delete(svc); db.commit()


pay_router = APIRouter(prefix="/api/payments")

@pay_router.post("/", response_model=PaymentOut, status_code=201)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),   # 👈 added
    _=Depends(staff_roles)
):
    payment = Payment(**payload.model_dump())

    # 🔥 THIS IS THE MAIN FIX
    payment.created_by = current_user.id

    status = str(payment.status).lower()

    if status == "done":
        payment.paid_amount = payment.amount

    elif status == "partial":
        if not payment.paid_amount or payment.paid_amount <= 0:
            raise HTTPException(status_code=400, detail="paid_amount required for partial payment")

    elif status == "pending":
        if payment.paid_amount is None:
            payment.paid_amount = 0

    db.add(payment)
    db.commit()
    db.refresh(payment)

    if _status_str(payment) in INVOICE_STATUSES:
        _try_generate_invoice(payment, db)

    return payment


# @pay_router.get("/", response_model=List[PaymentOut])
# def list_payments(
#     db: Session = Depends(get_db),
#     _=Depends(staff_roles),
#     student_name: Optional[str] = None,   # ← replaces student_id filter
#     student_id: Optional[int] = None,     # ← keep for backward compat if needed
#     status: Optional[str] = None,
#     skip: int = 0,
#     limit: int = 100,
# ):
#     q = db.query(Payment).outerjoin(Student, Payment.student_id == Student.id)

#     if student_id:
#         q = q.filter(Payment.student_id == student_id)

#     if student_name:
#         name = f"%{student_name.strip()}%"
#         q = q.filter(
#             or_(
#                 Payment.manual_student_name.ilike(name),
#                 (Student.first_name + " " + Student.last_name).ilike(name),
#                 Student.first_name.ilike(name),
#                 Student.last_name.ilike(name),
#             )
#         )

#     if status:
#         q = q.filter(Payment.status == status)

#     return q.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()


# @pay_router.get("/", response_model=PaymentListResponse)
# def list_payments(
#     db: Session = Depends(get_db),
#     current_user = Depends(get_current_user), 
#     _=Depends(staff_roles),
#     student_name: Optional[str] = None,
#     student_id: Optional[int] = None,
#     status: Optional[str] = None,
#     skip: int = 0,
#     limit: int = 100,
# ):
#  q = db.query(Payment).outerjoin(Student, Payment.student_id == Student.id)

# # ✅ ADMIN → see everything
#  if current_user.role != UserRole.admin:
#     # ✅ COUNSELLOR → only their students
#     q = q.filter(Student.counsellor_id == current_user.id)
#     if student_id:
#         q = q.filter(Payment.student_id == student_id)

#     if student_name:
#         name = f"%{student_name.strip()}%"
#         q = q.filter(
#             or_(
#                 Payment.manual_student_name.ilike(name),
#                 (Student.first_name + " " + Student.last_name).ilike(name),
#                 Student.first_name.ilike(name),
#                 Student.last_name.ilike(name),
#             )
#         )

#     if status:
#         q = q.filter(Payment.status == status)

#     # ✅ COUNT BEFORE PAGINATION
#     total = q.count()

#     # ✅ APPLY PAGINATION
#     items = (
#         q.order_by(Payment.created_at.desc())
#          .offset(skip)
#          .limit(limit)
#          .all()
#     )

#     # ✅ RETURN STRUCTURED RESPONSE
#     return {
#         "items": items,
#         "total": total
#     }


@pay_router.get("/", response_model=PaymentListResponse)
def list_payments(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    _=Depends(staff_roles),
    student_name: Optional[str] = None,
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
):
    q = db.query(Payment).outerjoin(Student, Payment.student_id == Student.id)

    # Admins see everything; counsellors see:
    #   1. Payments for their own students
    #   2. Walk-in payments they personally created
    if current_user.role != UserRole.admin:
        q = q.filter(
            or_(
                Student.counsellor_id == current_user.id,          # their students
                and_(
                    Payment.student_id == None,                      # walk-in
                    Payment.created_by == current_user.id            # they recorded it
                )
            )
        )

    # ✅ Apply filters for ALL roles
    if student_id:
        q = q.filter(Payment.student_id == student_id)

    if student_name:
        name = f"%{student_name.strip()}%"
        q = q.filter(
            or_(
                Payment.manual_student_name.ilike(name),
                (Student.first_name + " " + Student.last_name).ilike(name),
                Student.first_name.ilike(name),
                Student.last_name.ilike(name),
            )
        )

    if status:
        q = q.filter(Payment.status == status)

    # ✅ Count before pagination
    total = q.count()

    # ✅ Pagination
    items = (
        q.order_by(Payment.created_at.desc())
         .offset(skip)
         .limit(limit)
         .all()
    )

    return {
        "items": items,
        "total": total
    }

@pay_router.get("/{pay_id}", response_model=PaymentOut)
def get_payment(pay_id: int, db: Session = Depends(get_db), _=Depends(staff_roles)):
    p = db.query(Payment).filter(Payment.id == pay_id).first()
    if not p: raise HTTPException(status_code=404, detail="Payment not found")
    return p



# @pay_router.patch("/{pay_id}", response_model=PaymentOut)
# def update_payment(pay_id: int, payload: PaymentUpdate, db: Session = Depends(get_db), _=Depends(staff_roles)):
#     p = db.query(Payment).filter(Payment.id == pay_id).first()
#     if not p:
#         raise HTTPException(status_code=404, detail="Payment not found")

#     for k, v in payload.model_dump(exclude_unset=True).items():
#         setattr(p, k, v)

#     status = str(p.status).lower()

#     # ✅ Correct handling
#     if status == "done":
#         p.paid_amount = p.amount

#     elif status == "partial":
#         if not p.paid_amount or p.paid_amount <= 0:
#             raise HTTPException(status_code=400, detail="paid_amount required for partial payment")

#     else:
#         p.paid_amount = 0

#     db.commit()
#     db.refresh(p)

#     if _status_str(p) in INVOICE_STATUSES:
#         _try_generate_invoice(p, db)

#     return p


@pay_router.patch("/{pay_id}", response_model=PaymentOut)
def update_payment(pay_id: int, payload: PaymentUpdate, db: Session = Depends(get_db), _=Depends(staff_roles)):
    p = db.query(Payment).filter(Payment.id == pay_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)

    status = str(p.status).lower()

    if status == "done":
        p.paid_amount = p.amount
    elif status == "partial":
        if not p.paid_amount or p.paid_amount <= 0:
            raise HTTPException(status_code=400, detail="paid_amount required for partial payment")
    # ✅ FIX: Remove the else block — don't zero out paid_amount for pending

    db.commit()
    db.refresh(p)

    if _status_str(p) in INVOICE_STATUSES:
        _try_generate_invoice(p, db)

    return p

@pay_router.delete("/{pay_id}", status_code=204)
def delete_payment(pay_id: int, db: Session = Depends(get_db), _=Depends(require_roles(UserRole.admin))):
    p = db.query(Payment).filter(Payment.id == pay_id).first()
    if not p: raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(p); db.commit()








@pay_router.get("/{pay_id}/invoice")
def download_invoice(pay_id: int, db: Session = Depends(get_db), _=Depends(staff_roles)):
    p = db.query(Payment).filter(Payment.id == pay_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")

    student = db.query(Student).filter(Student.id == p.student_id).first()
    
    try:
        from app.services.invoice_service import generate_invoice, get_student_filename
        
        # 1. Generate the invoice content
        generate_invoice(p, student, db)
        
        if not p.invoice_pdf:
            raise ValueError("PDF generation returned empty content")
            
        # 2. Generate the dynamic filename using the student object and payment ID
        filename = get_student_filename( student,pay_id,manual_name=p.manual_student_name)
        
        # 3. Return the response
        return Response(
            content=p.invoice_pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition" # Important for some browsers/frontends
            },
        )
    except Exception as e:
        import traceback
        print(f"Detailed Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"PDF Error: {str(e)}")
    
router.include_router(pay_router)
router.include_router(svc_router)