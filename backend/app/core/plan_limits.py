from typing import Dict, Optional


PLAN_LIMITS: Dict[str, Dict[str, Optional[int]]] = {
    "Free Trial": {
        "max_users": 3,
        "max_students": 25,
        "max_applications": 50,
        "storage_limit_mb": 100,
    },
    "Starter": {
        "max_users": 10,
        "max_students": 200,
        "max_applications": 500,
        "storage_limit_mb": 500,
    },
    "Professional": {
        "max_users": 50,
        "max_students": 2000,
        "max_applications": 10000,
        "storage_limit_mb": 5000,
    },
    "Enterprise": {
        "max_users": None,
        "max_students": None,
        "max_applications": None,
        "storage_limit_mb": None,
    },
}


def get_limit(plan: str, key: str) -> Optional[int]:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["Free Trial"]).get(key)


def check_limit(
    current_count: int,
    plan: str,
    key: str,
    resource_label: str,
) -> None:
    from fastapi import HTTPException

    limit = get_limit(plan, key)
    if limit is None:
        return
    if current_count >= limit:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Plan limit reached: your {plan} plan allows {limit} {resource_label}. "
                "Please upgrade to add more."
            ),
        )
