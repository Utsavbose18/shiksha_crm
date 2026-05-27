#!/usr/bin/env python3
"""
Seed script: Creates Platform Super Admin, Demo Tenant, Roles, and optional sample data.
Run once after setting up the database:
    python seed.py
"""
import sys
from datetime import date

sys.path.insert(0, ".")

from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.models.rbac import Role, Permission, RolePermission, UserRoleMapping
from app.models.user import (
    User, Student, University, UserRole, LeadStatus,
    AcademicQualification, TestScore, Application,
    ApplicationStatus, VisaStatus, StudentService, ServiceType, Payment, PaymentStatus
)

Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    try:
        # 1. Platform Super Admin
        super_admin = db.query(User).filter(User.role == "platform_super_admin").first()
        if not super_admin:
            super_admin = User(
                email="superadmin@saas.com",
                hashed_password=hash_password("Super@1234"),
                full_name="Platform Super Admin",
                role="platform_super_admin",
                is_active=True,
                must_change_password=False
            )
            db.add(super_admin)
            db.commit()
            db.refresh(super_admin)
            print(f"[+] Platform Super Admin created: {super_admin.email}")

        # 2. Demo Tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "demo").first()
        if not tenant:
            tenant = Tenant(
                name="Demo Education Agency",
                slug="demo",
                custom_domain="demo.saas.com",
                subscription_plan="Professional",
                is_active=True
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"[+] Demo Tenant created: {tenant.name} (Slug: {tenant.slug})")

        # 3. Branch
        branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
        if not branch:
            branch = Branch(
                tenant_id=tenant.id,
                name="Main Office",
                city="London",
                country="UK"
            )
            db.add(branch)
            db.commit()
            db.refresh(branch)

        # 4. Default Permissions
        permissions = [
            {"key": "manage_users", "name": "Manage Users", "module": "users", "action": "manage"},
            {"key": "manage_roles", "name": "Manage Roles", "module": "roles", "action": "manage"},
            {"key": "manage_custom_fields", "name": "Manage Custom Fields", "module": "custom_fields", "action": "manage"},
            {"key": "manage_workflows", "name": "Manage Workflows", "module": "workflows", "action": "manage"},
            {"key": "view_students", "name": "View Students", "module": "students", "action": "view"},
            {"key": "edit_students", "name": "Edit Students", "module": "students", "action": "edit"},
        ]

        for p_data in permissions:
            perm = db.query(Permission).filter(Permission.key == p_data["key"]).first()
            if not perm:
                perm = Permission(**p_data)
                db.add(perm)
        db.commit()

        # 5. Roles & Admin User mapping
        admin_role = db.query(Role).filter(Role.tenant_id == tenant.id, Role.name == "Tenant Admin").first()
        if not admin_role:
            admin_role = Role(tenant_id=tenant.id, name="Tenant Admin", is_system_role=True)
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)

            # Map all permissions to Tenant Admin
            all_perms = db.query(Permission).all()
            for p in all_perms:
                db.add(RolePermission(role_id=admin_role.id, permission_id=p.id))
            db.commit()

        # 6. Tenant Admin User
        tenant_admin = db.query(User).filter(User.email == "admin@demo.com").first()
        if not tenant_admin:
            tenant_admin = User(
                tenant_id=tenant.id,
                branch_id=branch.id,
                email="admin@demo.com",
                hashed_password=hash_password("Admin@1234"),
                full_name="Tenant Admin",
                role="admin", # Keep basic role for backward compatibility
                is_active=True,
                must_change_password=False
            )
            db.add(tenant_admin)
            db.commit()
            db.refresh(tenant_admin)

            db.add(UserRoleMapping(user_id=tenant_admin.id, role_id=admin_role.id, tenant_id=tenant.id))
            db.commit()
            print(f"[+] Tenant Admin created: {tenant_admin.email}")

        # 7. Sample University
        uni = db.query(University).filter(University.tenant_id == tenant.id).first()
        if not uni:
            uni = University(tenant_id=tenant.id, name="University of Example", country="UK", city="London", category="Public")
            db.add(uni)
            db.commit()

        print("\nSeed completed successfully!")
        print("-" * 40)
        print("Default Credentials:")
        print("1. Platform Super Admin: superadmin@saas.com / Super@1234")
        print("2. Tenant Admin (Demo): admin@demo.com / Admin@1234")
        print("-" * 40)

    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
