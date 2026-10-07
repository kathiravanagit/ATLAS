"""Case visibility and action policy, shared by every case-owned resource."""
from fastapi import HTTPException
from sqlalchemy import and_, or_
from models_db import Case


ACTION_ROLES = {
    "read": {"admin", "inspector", "analyst", "bank_officer"},
    "write": {"admin", "inspector", "analyst", "bank_officer"},
    "acknowledge": {"admin", "inspector", "analyst", "bank_officer"},
    "request_verification": {"admin", "inspector", "analyst", "bank_officer"},
    "assign": {"admin", "inspector"},
    "escalate": {"admin", "inspector"},
    "close": {"admin", "inspector"},
    "review": {"admin", "inspector"},
    "override": {"admin", "inspector"},
    "evidence": {"admin", "inspector", "analyst"},
    "field_outcome": {"admin", "inspector"},
    "manage_users": {"admin"},
}


def check_action(user: dict, action: str):
    if user.get("role") not in ACTION_ROLES.get(action, set()):
        raise HTTPException(status_code=403, detail=f"Missing permission: {action}")


def visibility_filter(user: dict):
    check_action(user, "read")
    if user.get("role") == "admin":
        return True
    # Only the unassigned, department-less pool is shared. Assignment is not
    # an escape hatch into another department's cases.
    dept = user.get("department") or ""
    return or_(
        and_(or_(Case.department == "", Case.department.is_(None)),
             or_(Case.assigned_to == "", Case.assigned_to.is_(None), Case.assigned_to == user.get("id"))),
        Case.department == dept if dept else False,
    )


def visible_cases(db, user):
    return db.query(Case).filter(visibility_filter(user))


def require_case(db, user, case_id: str, action: str = "read"):
    check_action(user, action)
    case = visible_cases(db, user).filter(Case.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


def visible_case_ids(db, user):
    return {row.case_id for row in visible_cases(db, user).all()}
