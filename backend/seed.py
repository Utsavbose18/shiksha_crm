#!/usr/bin/env python3
"""
Seed script: Creates the first admin user and optional sample data.
Run once after setting up the database:
    python seed.py
    python seed.py --sample   # also creates sample counsellor + students
"""
import sys
import argparse
from datetime import date

# Add project root to path
sys.path.insert(0, ".")

from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.user import (
    User, Student, University, UserRole, LeadStatus,
    AcademicQualification, TestScore, Application,
    ApplicationStatus, VisaStatus, StudentService, ServiceType, Payment, PaymentStatus
)

Base.metadata.create_all(bind=engine)


def create_admin(db):
    existing = db.query(User).filter(User.role == UserRole.admin).first()
    # if existing:
    #     print(f"[skip] Admin already exists: {existing.email}")
    #     return existing

    admin = User(
        email="admin@gmail.com",
        hashed_password=hash_password("admin@1234"),
        full_name="Admin",
        phone="+91-9999999",
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"[+] Admin created: {admin.email}  ")
    return admin


def create_sample_data(db, admin):
    # ── Counsellor ──
    counsellor = db.query(User).filter(User.email == "counsellor@portal.com").first()
    if not counsellor:
        counsellor = User(
            email="counsellor@portal.com",
            hashed_password=hash_password("Counsel@1234"),
            full_name="Priya Sharma",
            phone="+91-9876543210",
            role=UserRole.counsellor,
            is_active=True,
            created_by=admin.id,
        )
        db.add(counsellor)
        db.commit()
        db.refresh(counsellor)
        print(f"[+] Counsellor created: {counsellor.email}  password: Counsel@1234")
    else:
        print(f"[skip] Counsellor exists: {counsellor.email}")

    # ── Universities ──
    unis = []
    uni_data = [
        {"name": "University of Toronto", "country": "Canada", "city": "Toronto", "ranking": 25},
        {"name": "University of Melbourne", "country": "Australia", "city": "Melbourne", "ranking": 33},
        {"name": "University of Edinburgh", "country": "UK", "city": "Edinburgh", "ranking": 22},
        {"name": "TU Munich", "country": "Germany", "city": "Munich", "ranking": 50},
    ]
    for ud in uni_data:
        u = db.query(University).filter(University.name == ud["name"]).first()
        if not u:
            u = University(**ud)
            db.add(u)
            db.commit()
            db.refresh(u)
            print(f"[+] University: {u.name}")
        unis.append(u)

    # ── Students ──
    students_data = [
        {
            "email": "rahul.sharma@student.com",
            "first_name": "Rahul",
            "last_name": "Sharma",
            "phone": "+91-9012345678",
            "lead_status": LeadStatus.converted,
        },
        {
            "email": "ananya.patel@student.com",
            "first_name": "Ananya",
            "last_name": "Patel",
            "phone": "+91-9023456789",
            "lead_status": LeadStatus.lead,
        },
        {
            "email": "arjun.kumar@student.com",
            "first_name": "Arjun",
            "last_name": "Kumar",
            "phone": "+91-9034567890",
            "lead_status": LeadStatus.converted,
        },
    ]

    created_students = []
    for sd in students_data:
        s = db.query(Student).filter(Student.email == sd["email"]).first()
        if not s:
            s = Student(
                email=sd["email"],
                hashed_password=hash_password("Student@1234"),
                first_name=sd["first_name"],
                last_name=sd["last_name"],
                phone=sd["phone"],
                nationality="Indian",
                country="India",
                lead_status=sd["lead_status"],
                counsellor_id=counsellor.id,
                created_by=counsellor.id,
                is_active=True,
                date_of_birth=date(1999, 6, 15),
            )
            db.add(s)
            db.commit()
            db.refresh(s)
            print(f"[+] Student: {s.email}  password: Student@1234")

            # Academic qualification
            aq = AcademicQualification(
                student_id=s.id,
                level="Bachelor's",
                institution="Delhi University",
                field_of_study="Computer Science",
                start_year=2018,
                end_year=2022,
                percentage_cgpa=8.4,
                grading_scale="cgpa-10",
                backlogs=0,
                country="India",
            )
            db.add(aq)

            # Test score
            ts = TestScore(
                student_id=s.id,
                test_type="IELTS",
                overall_score=7.5,
                section_scores={"listening": 8.0, "reading": 7.5, "writing": 7.0, "speaking": 7.5},
                status="completed",
                test_date=date(2024, 3, 10),
                expiry_date=date(2026, 3, 10),
            )
            db.add(ts)
            db.commit()
        else:
            print(f"[skip] Student exists: {s.email}")
        created_students.append(s)

    # ── Applications for first student ──
    if created_students:
        s = created_students[0]
        existing_app = db.query(Application).filter(Application.student_id == s.id).first()
        if not existing_app and unis:
            app1 = Application(
                student_id=s.id,
                university_id=unis[0].id,
                course_name="MSc Computer Science",
                intake_month="September",
                intake_year=2025,
                application_deadline=date(2025, 2, 28),
                tuition_fee=28000.0,
                currency="CAD",
                application_status=ApplicationStatus.unconditional_offer,
                visa_status=VisaStatus.visa_applied,
                visa_applied_date=date(2025, 1, 15),
            )
            app2 = Application(
                student_id=s.id,
                university_id=unis[1].id,
                course_name="Master of IT",
                intake_month="February",
                intake_year=2026,
                application_deadline=date(2025, 8, 31),
                tuition_fee=42000.0,
                currency="AUD",
                application_status=ApplicationStatus.applied,
                visa_status=VisaStatus.not_applied,
            )
            db.add_all([app1, app2])
            db.commit()
            print(f"[+] Applications added for {s.email}")

        # Service
        existing_svc = db.query(StudentService).filter(StudentService.student_id == s.id).first()
        if not existing_svc:
            svc = StudentService(
                student_id=s.id,
                service_type=ServiceType.test_prep,
                provider="British Council",
                status="completed",
            )
            db.add(svc)

            pay = Payment(
                student_id=s.id,
                amount=50000.0,
                currency="INR",
                payment_type="service_fee",
                status=PaymentStatus.done,
                payment_date=date(2024, 11, 1),
                reference="TXN20241101001",
            )
            db.add(pay)
            db.commit()
            print(f"[+] Service + payment added for {s.email}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="Also create sample data")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        admin = create_admin(db)
        if args.sample:
            create_sample_data(db, admin)
        print("\n✅ Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
