from database import engine, SessionLocal, Base
from sqlalchemy import text
from models_db import (
    Case, Prediction, RankedLocation, Alert, Suspect,
    AuditLog, AtmLocation, FieldOutcome
)
from datetime import datetime, timedelta, timezone
import random
import json
import math
import os
from encryption import is_encrypted, encrypt as aes_encrypt

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

# City center coordinates for distance calculations
CITY_CENTERS = {
    "PNY": (11.9416, 79.8083), "CHN": (13.0827, 80.2707),
    "DEL": (28.7041, 77.1025), "MUM": (19.0760, 72.8777),
    "BLR": (12.9716, 77.5946), "KOL": (22.5726, 88.3639),
    "HYD": (17.3850, 78.4867), "AMD": (23.0225, 72.5714),
}

# Map case IDs to city prefixes
CASE_CITY_MAP = {
    "CC-2026-0147": "PNY", "CC-2026-0146": "PNY", "CC-2026-0145": "PNY",
    "CC-2026-0144": "CHN", "CC-2026-0143": "CHN", "CC-2026-0142": "CHN",
    "CC-2026-0141": "DEL", "CC-2026-0140": "DEL", "CC-2026-0139": "DEL",
    "CC-2026-0138": "MUM", "CC-2026-0137": "MUM", "CC-2026-0136": "MUM",
    "CC-2026-0135": "BLR", "CC-2026-0134": "BLR", "CC-2026-0133": "BLR",
    "CC-2026-0132": "KOL", "CC-2026-0131": "KOL", "CC-2026-0130": "KOL",
    "CC-2026-0129": "HYD", "CC-2026-0128": "HYD", "CC-2026-0127": "HYD",
    "CC-2026-0126": "AMD", "CC-2026-0125": "AMD",
}


def _haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _enc(val):
    if not ENCRYPTION_KEY or not val:
        return val
    return aes_encrypt(val, ENCRYPTION_KEY) if not is_encrypted(val) else val


def create_tables():
    Base.metadata.create_all(bind=engine)


def seed_data(force=False):
    db = SessionLocal()

    try:
        if not force and db.query(Case).first():
            print("Database already seeded. Use --force to re-seed.")
            return

        if force:
            print("Force re-seeding: clearing existing data...")
            db.execute(text("DELETE FROM ranked_locations"))
            db.execute(text("DELETE FROM field_outcomes"))
            db.execute(text("DELETE FROM predictions"))
            db.execute(text("DELETE FROM audit_logs"))
            db.execute(text("DELETE FROM alerts"))
            db.execute(text("DELETE FROM suspects"))
            db.execute(text("DELETE FROM cases"))
            db.execute(text("DELETE FROM atm_locations"))
            db.commit()
            print("Existing data cleared.")

        now = datetime.now(timezone.utc)

        # ─── ATM Locations (66 ATMs across 8 cities) ─────────────────
        atm_locations = [
            # Puducherry (8)
            AtmLocation(atm_id="PNY-001", name="White Town Main Road", latitude=11.9335, longitude=79.8075, area="White Town"),
            AtmLocation(atm_id="PNY-002", name="MG Road Commercial", latitude=11.9355, longitude=79.8085, area="MG Road"),
            AtmLocation(atm_id="PNY-003", name="Lawspet Junction", latitude=11.9450, longitude=79.8105, area="Lawspet"),
            AtmLocation(atm_id="PNY-004", name="Muthialpet Bazaar", latitude=11.9295, longitude=79.8055, area="Muthialpet"),
            AtmLocation(atm_id="PNY-005", name="Reddiarpalayam Town", latitude=11.9395, longitude=79.8035, area="Reddiarpalayam"),
            AtmLocation(atm_id="PNY-006", name="Kurumbapet Highway", latitude=11.9520, longitude=79.8085, area="Kurumbapet"),
            AtmLocation(atm_id="PNY-007", name="Thattanchavady East", latitude=11.9315, longitude=79.8155, area="Thattanchavady"),
            AtmLocation(atm_id="PNY-008", name="Nehru Park Branch", latitude=11.9350, longitude=79.8115, area="Nehru Park"),
            # Chennai (8)
            AtmLocation(atm_id="CHN-001", name="T Nagar Main Road", latitude=13.0405, longitude=80.2342, area="T Nagar"),
            AtmLocation(atm_id="CHN-002", name="Anna Nagar West", latitude=13.0850, longitude=80.2105, area="Anna Nagar"),
            AtmLocation(atm_id="CHN-003", name="Velachery Main", latitude=12.9815, longitude=80.2180, area="Velachery"),
            AtmLocation(atm_id="CHN-004", name="Adyar Bridge Road", latitude=13.0030, longitude=80.2520, area="Adyar"),
            AtmLocation(atm_id="CHN-005", name="Mylapore Junction", latitude=13.0330, longitude=80.2670, area="Mylapore"),
            AtmLocation(atm_id="CHN-006", name="Porur Junction", latitude=13.0380, longitude=80.1560, area="Porur"),
            AtmLocation(atm_id="CHN-007", name="Tambaram Sanitorium", latitude=12.9249, longitude=80.1000, area="Tambaram"),
            AtmLocation(atm_id="CHN-008", name="Chromepet Main Road", latitude=12.9516, longitude=80.1414, area="Chromepet"),
            # Delhi (8)
            AtmLocation(atm_id="DEL-001", name="Connaught Place", latitude=28.6315, longitude=77.2167, area="Connaught Place"),
            AtmLocation(atm_id="DEL-002", name="Karol Bagh Main", latitude=28.6519, longitude=77.1904, area="Karol Bagh"),
            AtmLocation(atm_id="DEL-003", name="Lajpat Nagar Market", latitude=28.5677, longitude=77.2405, area="Lajpat Nagar"),
            AtmLocation(atm_id="DEL-004", name="Rohini Sector 7", latitude=28.7495, longitude=77.0654, area="Rohini"),
            AtmLocation(atm_id="DEL-005", name="Dwarka Sector 10", latitude=28.5921, longitude=77.0460, area="Dwarka"),
            AtmLocation(atm_id="DEL-006", name="Saket Main Road", latitude=28.5244, longitude=77.2066, area="Saket"),
            AtmLocation(atm_id="DEL-007", name="Janakpuri District Centre", latitude=28.6216, longitude=77.0816, area="Janakpuri"),
            AtmLocation(atm_id="DEL-008", name="Pitampura TV Tower", latitude=28.7026, longitude=77.1318, area="Pitampura"),
            # Mumbai (8)
            AtmLocation(atm_id="MUM-001", name="Bandra West Linking Road", latitude=19.0544, longitude=72.8370, area="Bandra"),
            AtmLocation(atm_id="MUM-002", name="Andheri West Lokhandwala", latitude=19.1364, longitude=72.8296, area="Andheri"),
            AtmLocation(atm_id="MUM-003", name="Lower Parel Phoenix Mall", latitude=19.0176, longitude=72.8562, area="Lower Parel"),
            AtmLocation(atm_id="MUM-004", name="Powai Lake Market", latitude=19.1189, longitude=72.9064, area="Powai"),
            AtmLocation(atm_id="MUM-005", name="Thane West Ghodbunder", latitude=19.2183, longitude=72.9580, area="Thane"),
            AtmLocation(atm_id="MUM-006", name="Navi Mumbai Vashi", latitude=19.0762, longitude=72.9987, area="Vashi"),
            AtmLocation(atm_id="MUM-007", name="Kurla Station Road", latitude=19.0726, longitude=72.8794, area="Kurla"),
            AtmLocation(atm_id="MUM-008", name="Dadar TT Circle", latitude=19.0178, longitude=72.8478, area="Dadar"),
            # Bangalore (8)
            AtmLocation(atm_id="BLR-001", name="MG Road Brigade Road", latitude=12.9758, longitude=77.6079, area="MG Road"),
            AtmLocation(atm_id="BLR-002", name="Indiranagar 100 Feet Road", latitude=12.9784, longitude=77.6408, area="Indiranagar"),
            AtmLocation(atm_id="BLR-003", name="Koramangala 5th Block", latitude=12.9352, longitude=77.6245, area="Koramangala"),
            AtmLocation(atm_id="BLR-004", name="Whitefield Main Road", latitude=12.9698, longitude=77.7500, area="Whitefield"),
            AtmLocation(atm_id="BLR-005", name="Electronic City Phase 1", latitude=12.8456, longitude=77.6602, area="Electronic City"),
            AtmLocation(atm_id="BLR-006", name="Hebbal Flyover Area", latitude=13.0358, longitude=77.5970, area="Hebbal"),
            AtmLocation(atm_id="BLR-007", name="Jayanagar 4th Block", latitude=12.9241, longitude=77.5845, area="Jayanagar"),
            AtmLocation(atm_id="BLR-008", name="HSR Layout Sector 1", latitude=12.9116, longitude=77.6389, area="HSR Layout"),
            # Kolkata (8)
            AtmLocation(atm_id="KOL-001", name="Park Street", latitude=22.5505, longitude=88.3580, area="Park Street"),
            AtmLocation(atm_id="KOL-002", name="Salt Lake Sector V", latitude=22.5729, longitude=88.4337, area="Salt Lake"),
            AtmLocation(atm_id="KOL-003", name="New Market Area", latitude=22.5600, longitude=88.3500, area="New Market"),
            AtmLocation(atm_id="KOL-004", name="Ballygunge Crossing", latitude=22.5300, longitude=88.3650, area="Ballygunge"),
            AtmLocation(atm_id="KOL-005", name="Dum Dum Junction", latitude=22.6200, longitude=88.4200, area="Dum Dum"),
            AtmLocation(atm_id="KOL-006", name="Howrah Station Area", latitude=22.5800, longitude=88.3300, area="Howrah"),
            AtmLocation(atm_id="KOL-007", name="Gariahat Road", latitude=22.5100, longitude=88.3680, area="Gariahat"),
            AtmLocation(atm_id="KOL-008", name="Behala Chowrasta", latitude=22.4900, longitude=88.3300, area="Behala"),
            # Hyderabad (8)
            AtmLocation(atm_id="HYD-001", name="Banjara Hills Road No 10", latitude=17.4156, longitude=78.4347, area="Banjara Hills"),
            AtmLocation(atm_id="HYD-002", name="Madhapur IT Hub", latitude=17.4486, longitude=78.3908, area="Madhapur"),
            AtmLocation(atm_id="HYD-003", name="Gachibowli Main Road", latitude=17.4400, longitude=78.3489, area="Gachibowli"),
            AtmLocation(atm_id="HYD-004", name="Ameerpet Junction", latitude=17.4374, longitude=78.4488, area="Ameerpet"),
            AtmLocation(atm_id="HYD-005", name="Kukatpally Hitech City", latitude=17.4849, longitude=78.3913, area="Kukatpally"),
            AtmLocation(atm_id="HYD-006", name="Secunderabad Station Road", latitude=17.4399, longitude=78.4983, area="Secunderabad"),
            AtmLocation(atm_id="HYD-007", name="LB Nagar Cross Roads", latitude=17.3044, longitude=78.5533, area="LB Nagar"),
            AtmLocation(atm_id="HYD-008", name="Dilshuknagar Main", latitude=17.3688, longitude=78.5254, area="Dilshuknagar"),
            # Ahmedabad (8)
            AtmLocation(atm_id="AMD-001", name="CG Road Navrangpura", latitude=23.0360, longitude=72.5480, area="Navrangpura"),
            AtmLocation(atm_id="AMD-002", name="SG Highway Thaltej", latitude=23.0504, longitude=72.5080, area="Thaltej"),
            AtmLocation(atm_id="AMD-003", name="Vastrapur Lake Area", latitude=23.0380, longitude=72.5200, area="Vastrapur"),
            AtmLocation(atm_id="AMD-004", name="Satellite Cross Roads", latitude=23.0230, longitude=72.5020, area="Satellite"),
            AtmLocation(atm_id="AMD-005", name="Paldi Double Six", latitude=23.0100, longitude=72.5600, area="Paldi"),
            AtmLocation(atm_id="AMD-006", name="Ashram Road", latitude=23.0350, longitude=72.5660, area="Ashram Road"),
            AtmLocation(atm_id="AMD-007", name="Maninagar Cross Roads", latitude=22.9900, longitude=72.6000, area="Maninagar"),
            AtmLocation(atm_id="AMD-008", name="Naroda Road", latitude=23.0600, longitude=72.6300, area="Naroda"),
        ]
        db.add_all(atm_locations)
        db.flush()

        # ─── Cases (23 active across cities) ─────────────────────────
        case_data = [
            ("CC-2026-0147", "UPI Fraud", 73500, 3, "High", "active", "VICTIM-SYN-014", "+91-SYN-1014", "Unauthorized UPI transfer to unknown beneficiary. Rs.73,500 debited from account."),
            ("CC-2026-0146", "Card Cloning", 35200, 2, "High", "active", "VICTIM-SYN-015", "+91-SYN-1015", "Card cloned at ATM-014. Two rapid withdrawals of Rs.15,000 and Rs.20,200."),
            ("CC-2026-0145", "Investment Fraud", 150000, 6, "High", "active", "VICTIM-SYN-016", "+91-SYN-1016", "Fake crypto trading platform via Telegram. Rs.1,50,000 lost."),
            ("CC-2026-0144", "Phishing", 28900, 2, "Medium", "active", "VICTIM-SYN-017", "+91-SYN-1017", "Phishing link SMS claiming electricity bill disconnection. Rs.28,900 lost."),
            ("CC-2026-0143", "Identity Theft", 67800, 3, "Medium", "active", "VICTIM-SYN-018", "+91-SYN-1018", "Stolen PAN and Aadhaar details used to take unauthorized loan. Rs.67,800 transferred."),
            ("CC-2026-0142", "Card Cloning", 21700, 2, "Medium", "active", "VICTIM-SYN-019", "+91-SYN-1019", "ATM skimming device suspected at PNY-003. Rs.21,700 withdrawn."),
            ("CC-2026-0141", "Loan App Fraud", 45000, 3, "Medium", "resolved", "VICTIM-SYN-020", "+91-SYN-1020", "Predatory instant loan app harassment and unauthorized debit. Resolved via bank freeze."),
            ("CC-2026-0140", "UPI Fraud", 12400, 1, "Low", "resolved", "VICTIM-SYN-021", "+91-SYN-1021", "Wrongful QR code scan payment. Rs.12,400 recovered."),
            ("CC-2026-0139", "Investment Fraud", 76200, 4, "High", "active", "VICTIM-SYN-022", "+91-SYN-1022", "High-yield task scam on WhatsApp. Rs.76,200 transferred."),
            ("CC-2026-0138", "SIM Swap", 92000, 5, "High", "active", "VICTIM-SYN-023", "+91-SYN-1023", "SIM port-out fraud followed by OTP interception and bank account drainage of Rs.92,000."),
            ("CC-2026-0137", "Phishing", 41200, 2, "Medium", "active", "VICTIM-SYN-024", "+91-SYN-1024", "Fake credit card reward points redemption link. Rs.41,200 lost."),
            ("CC-2026-0136", "Loan App Fraud", 38500, 3, "Medium", "active", "VICTIM-SYN-025", "+91-SYN-1025", "Illegal loan app data extortion. Rs.38,500 transferred under duress."),
            ("CC-2026-0135", "Phishing", 33100, 2, "Low", "resolved", "VICTIM-SYN-026", "+91-SYN-1026", "Phishing email led to credential theft. Rs.33,100 transferred. Case resolved."),
            ("CC-2026-0134", "UPI Fraud", 54300, 4, "High", "active", "VICTIM-SYN-027", "+91-SYN-1027", "Multiple unauthorized UPI transactions totaling Rs.54,300. Funds split across 4 mule accounts."),
            ("CC-2026-0133", "Card Skimming", 28900, 2, "Medium", "active", "VICTIM-SYN-028", "+91-SYN-1028", "ATM card skimmed at White Town branch. Rs.28,900 withdrawn in 3 transactions."),
            ("CC-2026-0132", "Identity Theft", 156000, 5, "High", "active", "VICTIM-SYN-029", "+91-SYN-1029", "Full identity theft. Forged documents used to open 3 new accounts. Rs.1,56,000 transferred."),
            ("CC-2026-0131", "QR Code Fraud", 8900, 1, "Low", "resolved", "VICTIM-SYN-030", "+91-SYN-1030", "Fake payment QR code at local shop. Rs.8,900 deducted."),
            ("CC-2026-0130", "Investment Fraud", 210000, 7, "High", "active", "VICTIM-SYN-031", "+91-SYN-1031", "Ponzi scheme promising daily returns. Rs.2,10,000 invested over 1 month."),
            ("CC-2026-0129", "UPI Fraud", 17600, 2, "Low", "resolved", "VICTIM-SYN-032", "+91-SYN-1032", "Unauthorized UPI transfer. Rs.17,600 recovered through bank dispute."),
            ("CC-2026-0128", "Identity Theft", 89400, 4, "Medium", "active", "VICTIM-SYN-033", "+91-SYN-1033", "Stolen identity used for 4 bank transfers totaling Rs.89,400."),
            ("CC-2026-0127", "Card Cloning", 44500, 3, "Medium", "active", "VICTIM-SYN-034", "+91-SYN-1034", "Card cloned at multiple ATMs. Rs.44,500 withdrawn across 3 locations."),
            ("CC-2026-0126", "Phishing", 22300, 2, "Low", "resolved", "VICTIM-SYN-035", "+91-SYN-1035", "Fake bank SMS phishing. Rs.22,300 transferred. Case resolved."),
            ("CC-2026-0125", "SIM Swap", 78000, 4, "High", "active", "VICTIM-SYN-036", "+91-SYN-1036", "SIM swap fraud. Rs.78,000 drained from 4 accounts after number porting."),
        ]

        cases = []
        for cid, ctype, amt, linked, risk, status, vname, contact, desc in case_data:
            cases.append(Case(
                case_id=cid, crime_type=ctype, amount=amt,
                linked_accounts=linked, current_risk=risk, last_updated="just now",
                status=status, victim_name=_enc(vname), contact=_enc(contact),
                description=_enc(desc),
            ))
        db.add_all(cases)
        db.flush()

        # ─── Alerts (14 active + acknowledged) ───────────────────────
        alert_data = [
            ("ALT-001", "CC-2026-0147", "HIGH-RISK: Case CC-2026-0147 has high predicted cash-out risk at PNY-001 during 18:00-20:00.", "High", "PNY-001, White Town Main Road", "18:00-20:00", False),
            ("ALT-002", "CC-2026-0145", "CRITICAL: Case CC-2026-0145 - Rs.1,25,000 investment fraud. 6 mule accounts active.", "High", "PNY-006, Kurumbapet Highway", "19:00-21:00", False),
            ("ALT-003", "CC-2026-0146", "HIGH-RISK: Card cloning alert. PNY-002 shows elevated skimming risk.", "High", "PNY-002, MG Road Commercial", "17:00-19:00", False),
            ("ALT-004", "CC-2026-0139", "MEDIUM-RISK: Case CC-2026-0139 shows elevated cash-out risk at PNY-002.", "Medium", "PNY-002, MG Road Commercial", "19:00-21:00", False),
            ("ALT-005", "CC-2026-0143", "MEDIUM-RISK: Identity theft case. Multiple account linkage detected.", "Medium", "PNY-003, Lawspet Junction", "19:30-21:30", True),
            ("ALT-006", "CC-2026-0138", "HIGH-RISK: SIM swap fraud. Rs.92,000 at risk. Urgent action required.", "High", "PNY-001, White Town Main Road", "18:00-20:00", True),
            ("ALT-007", "CC-2026-0142", "WATCH: Case CC-2026-0142 activity detected near PNY-003.", "Watch", "PNY-003, Lawspet Junction", "20:00-22:00", True),
            ("ALT-008", "CC-2026-0134", "MEDIUM-RISK: Multiple UPI transactions detected. Fund splitting pattern.", "Medium", "PNY-004, Muthialpet Bazaar", "19:00-21:00", True),
            ("ALT-009", "CC-2026-0132", "HIGH-RISK: Large identity theft case. Rs.1,56,000 at risk.", "High", "PNY-006, Kurumbapet Highway", "20:00-22:00", True),
            ("ALT-010", "CC-2026-0130", "CRITICAL: Ponzi scheme detected. Rs.2,10,000 across 7 accounts.", "High", "PNY-007, Thattanchavady East", "19:00-21:00", True),
            ("ALT-011", "CC-2026-0128", "WATCH: Case CC-2026-0128 - new account linkage detected.", "Watch", "PNY-004, Muthialpet Bazaar", "19:00-21:00", True),
            ("ALT-012", "CC-2026-0127", "MEDIUM-RISK: Card cloning across multiple ATMs detected.", "Medium", "PNY-002, MG Road Commercial", "18:00-20:00", True),
            ("ALT-013", "CC-2026-0125", "HIGH-RISK: SIM swap fraud. Rs.78,000 at risk.", "High", "PNY-001, White Town Main Road", "18:00-20:00", True),
            ("ALT-014", "CC-2026-0147", "UPDATE: Case CC-2026-0147 - risk score increased from 85% to 92%.", "High", "PNY-001, White Town Main Road", "18:00-20:00", True),
        ]

        alerts = []
        for aid, cid, msg, level, loc, tw, ack in alert_data:
            ts = (now - timedelta(minutes=random.randint(5, 120))).strftime("%H:%M:%S")
            alerts.append(Alert(
                alert_id=aid, case_id=cid, message=_enc(msg),
                risk_level=level, location=loc, time_window=tw,
                timestamp=ts, acknowledged=ack,
                acknowledged_at=(now - timedelta(minutes=random.randint(1, 30))).strftime("%H:%M:%S") if ack else None,
            ))
        db.add_all(alerts)

        # ─── Suspects ────────────────────────────────────────────────
        suspect_data = [
            ("SUS-001", "CC-2026-0147", "Unknown Suspect A", "High", "PNY-001 area", 3, "active"),
            ("SUS-002", "CC-2026-0145", "Unknown Suspect B", "High", "PNY-006 area", 6, "active"),
            ("SUS-003", "CC-2026-0138", "Unknown Suspect C", "High", "PNY-001 area", 3, "active"),
            ("SUS-004", "CC-2026-0132", "Unknown Suspect D", "High", "Multiple locations", 5, "active"),
            ("SUS-005", "CC-2026-0130", "Unknown Suspect E", "High", "PNY-007 area", 7, "active"),
            ("SUS-006", "CC-2026-0146", "Unknown Suspect F", "Medium", "PNY-002 area", 2, "active"),
            ("SUS-007", "CC-2026-0134", "Unknown Suspect G", "Medium", "PNY-004 area", 4, "active"),
            ("SUS-008", "CC-2026-0125", "Unknown Suspect H", "High", "PNY-001 area", 4, "active"),
            ("SUS-009", "CC-2026-0143", "Unknown Suspect I", "Medium", "PNY-003 area", 3, "active"),
            ("SUS-010", "CC-2026-0139", "Unknown Suspect J", "High", "PNY-006 area", 5, "active"),
            ("SUS-011", "CC-2026-0128", "Unknown Suspect K", "Medium", "PNY-004 area", 4, "active"),
            ("SUS-012", "CC-2026-0136", "Unknown Suspect L", "Medium", "PNY-005 area", 2, "active"),
            ("SUS-013", "CC-2026-0127", "Unknown Suspect M", "Medium", "PNY-002 area", 3, "active"),
            ("SUS-014", "CC-2026-0137", "Unknown Suspect N", "High", "PNY-001 area", 3, "active"),
            ("SUS-015", "CC-2026-0133", "Unknown Suspect O", "Medium", "PNY-003 area", 2, "active"),
            ("SUS-016", "CC-2026-0144", "Unknown Suspect P", "Medium", "PNY-005 area", 2, "active"),
            ("SUS-017", "CC-2026-0147", "Unknown Suspect Q", "High", "PNY-001 area", 3, "active"),
            ("SUS-018", "CC-2026-0145", "Unknown Suspect R", "High", "PNY-006 area", 6, "active"),
            ("SUS-019", "CC-2026-0132", "Unknown Suspect S", "High", "PNY-002 area", 5, "active"),
            ("SUS-020", "CC-2026-0130", "Unknown Suspect T", "High", "PNY-007 area", 7, "active"),
        ]
        suspects = []
        for sid, cid, name, risk, last, accounts, status in suspect_data:
            suspects.append(Suspect(
                id=sid, case_id=cid, name=_enc(name),
                risk_level=risk, last_seen=last,
                accounts_linked=accounts, status=status,
            ))
        db.add_all(suspects)

        # ─── Predictions + Ranked Locations ───────────────────────────
        windows = ["17:00-19:00", "18:00-20:00", "18:30-20:30", "19:00-21:00", "19:30-21:30"]
        reasons = [
            "Evening withdrawal pattern matches historical behavior",
            "Transaction velocity spike detected in linked accounts",
            "Geographic cluster aligns with previous activity",
            "Historical cash-out similarity in this area",
            "Account network shows coordinated movement",
            "Amount pattern matches known fraud signature",
            "Multiple accounts activated within 24-hour window",
            "Location anomaly detected — distance from registered address",
        ]

        active_cases = [c for c in cases if c.status == "active"]
        prediction_count = 0
        ranked_count = 0
        for case in active_cases:
            random.seed(hash(case.case_id) % 10000)
            pred = Prediction(
                case_id=case.case_id,
                status="HIGH PRIORITY" if case.current_risk == "High" else "MEDIUM PRIORITY",
                risk_trend=json.dumps([10, 18, 27, 44, 67, min(random.randint(60, 95), 99)]),
                created_at=now,
            )
            db.add(pred)
            db.flush()
            prediction_count += 1

            # Filter ATMs to the same city as the case
            city_prefix = CASE_CITY_MAP.get(case.case_id, "PNY")
            city_center = CITY_CENTERS.get(city_prefix, (11.9416, 79.8083))
            city_atms = [a for a in atm_locations if a.atm_id.startswith(city_prefix)]
            if not city_atms:
                city_atms = atm_locations

            # Generate victim location near city center
            victim_lat = city_center[0] + random.gauss(0, 0.01)
            victim_lng = city_center[1] + random.gauss(0, 0.01)

            # Top 12 ranked locations per case from the same city
            sample_atms = random.sample(city_atms, min(12, len(city_atms)))
            for i, atm in enumerate(sample_atms):
                score = random.randint(30, 98)
                level = "High" if score > 70 else "Medium" if score > 45 else "Watch"
                dist = round(_haversine(victim_lat, victim_lng, atm.latitude, atm.longitude), 1)
                db.add(RankedLocation(
                    prediction_id=pred.id, rank=i+1, atm_id=atm.atm_id,
                    location_name=atm.name, risk_score=score,
                    expected_window=random.choice(windows),
                    distance=f"{dist} km",
                    reason=random.choice(reasons), status=level,
                    latitude=atm.latitude, longitude=atm.longitude,
                ))
                ranked_count += 1

        print(f"  Predictions: {prediction_count}, Ranked Locations: {ranked_count}")

        # ─── Audit Log ────────────────────────────────────────────────
        officers = ["Inspector Sharma", "Inspector Verma", "Inspector Patel", "Inspector Reddy", "Inspector Nair"]
        audit_entries = [
            ("System Initialized", "Database seeded with 64 ATMs across 8 cities, 23 cases, 14 alerts", "system"),
            ("Model Loaded", "Ensemble model (RF+XGBoost) loaded with 72.7% accuracy", "system"),
            ("Data Refresh", "Case data synchronized: 23 cases, 14 active alerts across 8 cities", "system"),
            ("User Login", "Inspector Sharma logged in from 103.25.x.x - Chrome/Windows", "session"),
            ("User Login", "Inspector Verma logged in from 103.25.x.x - Firefox/Windows", "session"),
            ("User Login", "Inspector Patel logged in from 172.16.x.x - Safari/macOS", "session"),
            ("User Login", "Inspector Reddy logged in from 10.0.x.x - Edge/Windows", "session"),
            ("User Login", "Inspector Nair logged in from 192.168.x.x - Chrome/Linux", "session"),
            ("Case Assigned", f"CC-2026-0147 assigned to {officers[0]} - UPI fraud, PNY district", "case"),
            ("Case Assigned", f"CC-2026-0145 assigned to {officers[1]} - Investment fraud, 6 mule accounts", "case"),
            ("Case Assigned", f"CC-2026-0138 assigned to {officers[2]} - SIM swap, high-value", "case"),
            ("Case Assigned", f"CC-2026-0132 assigned to {officers[3]} - Identity theft, 5 linked accounts", "case"),
            ("Case Assigned", f"CC-2026-0130 assigned to {officers[4]} - Ponzi scheme, 7 mule accounts", "case"),
            ("Status Changed", "CC-2026-0141 status changed from active to resolved (loan app fraud)", "case"),
            ("Status Changed", "CC-2026-0140 status changed from active to resolved (UPI fraud)", "case"),
            ("Status Changed", "CC-2026-0135 status changed from active to resolved (phishing)", "case"),
            ("Status Changed", "CC-2026-0131 status changed from active to resolved (QR code fraud)", "case"),
            ("Status Changed", "CC-2026-0126 status changed from active to resolved (phishing)", "case"),
            ("Status Changed", "CC-2026-0129 status changed from active to resolved (UPI fraud)", "case"),
            ("Alert Acknowledged", f"ALT-005 acknowledged by {officers[0]} - identity theft verified", "alert"),
            ("Alert Acknowledged", f"ALT-006 acknowledged by {officers[1]} - SIM swap fraud under investigation", "alert"),
            ("Alert Acknowledged", f"ALT-007 acknowledged by {officers[2]} - Watch level activity reviewed", "alert"),
            ("Alert Acknowledged", f"ALT-008 acknowledged by {officers[3]} - UPI splitting pattern confirmed", "alert"),
            ("Alert Acknowledged", f"ALT-009 acknowledged by {officers[4]} - identity theft escalation approved", "alert"),
            ("Alert Acknowledged", f"ALT-010 acknowledged by {officers[0]} - Ponzi scheme flagged for priority", "alert"),
            ("Alert Generated", "ALT-011 created for CC-2026-0128 - Watch level account linkage", "alert"),
            ("Alert Generated", "ALT-012 created for CC-2026-0127 - MEDIUM-RISK card cloning", "alert"),
            ("Alert Generated", "ALT-013 created for CC-2026-0125 - HIGH-RISK SIM swap", "alert"),
            ("Alert Generated", "ALT-014 created for CC-2026-0147 - risk score update", "alert"),
            ("Evidence Exported", f"Exported evidence chain for CC-2026-0147 - 5 signals anchored", "evidence"),
            ("Evidence Exported", f"Exported evidence chain for CC-2026-0145 - 5 signals anchored", "evidence"),
            ("Evidence Exported", f"Exported evidence chain for CC-2026-0138 - SIM swap evidence package", "evidence"),
            ("Evidence Exported", f"Exported evidence chain for CC-2026-0132 - identity theft package", "evidence"),
            ("Model Prediction Run", "Batch prediction completed for 17 active cases across 8 cities", "system"),
            ("Model Prediction Run", "SHAP explanation generated for CC-2026-0147 - top feature: distance_from_victim_km", "system"),
            ("Model Prediction Run", "Mule network analysis completed - 3 suspicious clusters detected", "system"),
            ("API Error", "Rate limit exceeded for IP 103.25.x.x on /api/predictions/CC-2026-0147 (429)", "error"),
            ("API Error", "WebSocket connection failed: invalid ticket for session INS-003", "error"),
            ("API Error", "POST /api/transactions rejected: CSRF token mismatch", "error"),
            ("Prediction Updated", "CC-2026-0147 risk score increased to 92% - evening peak activity", "prediction"),
            ("Prediction Updated", "CC-2026-0145 risk score increased to 88% - 6 mule accounts confirmed", "prediction"),
            ("Prediction Updated", "CC-2026-0138 risk score increased to 85% - SIM swap pattern detected", "prediction"),
            ("Prediction Updated", "CC-2026-0130 risk score updated to 91% - 7 mule accounts", "prediction"),
            ("Transaction Simulated", "Rs.25,000 simulated for CC-2026-0147 at PNY-001", "prediction"),
            ("Transaction Simulated", "Rs.48,500 simulated for CC-2026-0145 at PNY-006", "prediction"),
            ("Transaction Simulated", "Rs.15,000 simulated for CC-2026-0142 at CHN-003", "prediction"),
            ("Transaction Simulated", "Rs.35,200 simulated for CC-2026-0133 at BLR-001", "prediction"),
            ("Case Viewed", f"Inspector viewed CC-2026-0145 prediction details", "case"),
            ("Case Viewed", f"Inspector viewed CC-2026-0147 prediction details", "case"),
            ("Case Viewed", f"Inspector viewed CC-2026-0138 prediction details", "case"),
            ("Case Updated", "CC-2026-0128 - Linked accounts increased to 4", "case"),
            ("Case Updated", "CC-2026-0132 - Risk level changed to High", "case"),
        ]
        for action, details, atype in audit_entries:
            db.add(AuditLog(
                action=action, details=_enc(details),
                action_type=atype,
                timestamp=now - timedelta(minutes=random.randint(5, 720)),
            ))

        # ─── Field Outcomes ──────────────────────────────────────────
        field_outcomes = [
            ("CC-2026-0141", "PNY-001", "transaction_prevented", "INS-001", "QRT intercepted suspect at ATM. Rs.17,600 transfer blocked."),
            ("CC-2026-0135", "CHN-003", "cash_recovered", "INS-002", "Rs.33,100 recovered through inter-bank coordination within 48 hours."),
            ("CC-2026-0140", "DEL-005", "false_positive", "INS-003", "QR code scan was legitimate merchant payment. No fraud confirmed."),
            ("CC-2026-0129", "HYD-002", "transaction_prevented", "INS-001", "UPI transfer blocked at source. Rs.17,600 saved."),
            ("CC-2026-0126", "AMD-003", "cash_recovered", "INS-004", "Phishing amount Rs.22,300 recovered via NPCI dispute process."),
            ("CC-2026-0131", "BLR-007", "false_positive", "INS-002", "Suspect verified as legitimate cardholder. Duplicate transaction reversed."),
            ("CC-2026-0135", "KOL-005", "transaction_prevented", "INS-003", "Card cloned ATM withdrawal blocked by fraud detection system."),
        ]
        for case_id, atm_id, outcome, officer, notes in field_outcomes:
            db.add(FieldOutcome(
                case_id=case_id, atm_id=atm_id, outcome=outcome,
                officer_id=officer, notes=notes,
                created_at=now - timedelta(hours=random.randint(1, 72)),
            ))

        db.commit()
        print(f"Database seeded: {len(atm_locations)} ATMs, {len(cases)} cases, {prediction_count} predictions, {ranked_count} ranked locations, {len(alerts)} alerts, {len(suspects)} suspects, {len(audit_entries)} audit logs, {len(field_outcomes)} field outcomes")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    print("Creating tables...")
    create_tables()
    print("Seeding data...")
    seed_data(force=force)
