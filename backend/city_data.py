"""
Multi-city ATM and crime data for nationwide demonstration
"""
import random
import math

# ─── City Configurations ──────────────────────────────────────────────────────
CITIES = {
    "puducherry": {
        "name": "Puducherry",
        "state": "Puducherry",
        "center": (11.9416, 79.8083),
        "zoom": 12,
        "atms": [
            {"id": "PNY-001", "name": "White Town Main Road", "lat": 11.9335, "lng": 79.8075, "type": "high_value", "risk": 0.85},
            {"id": "PNY-002", "name": "MG Road Commercial", "lat": 11.9355, "lng": 79.8085, "type": "high_value", "risk": 0.78},
            {"id": "PNY-003", "name": "Lawspet Junction", "lat": 11.9450, "lng": 79.8105, "type": "commercial", "risk": 0.60},
            {"id": "PNY-004", "name": "Muthialpet Bazaar", "lat": 11.9295, "lng": 79.8055, "type": "retail", "risk": 0.45},
            {"id": "PNY-005", "name": "Reddiarpalayam Town", "lat": 11.9395, "lng": 79.8035, "type": "retail", "risk": 0.35},
            {"id": "PNY-006", "name": "Kurumbapet Highway", "lat": 11.9520, "lng": 79.8085, "type": "highway", "risk": 0.50},
            {"id": "PNY-007", "name": "Thattanchavady East", "lat": 11.9315, "lng": 79.8155, "type": "retail", "risk": 0.25},
            {"id": "PNY-008", "name": "Nehru Park Branch", "lat": 11.9350, "lng": 79.8115, "type": "bank", "risk": 0.20},
        ],
        "crime_stats": {"total_cases": 23, "high_risk": 8, "resolved": 7},
    },
    "chennai": {
        "name": "Chennai",
        "state": "Tamil Nadu",
        "center": (13.0827, 80.2707),
        "zoom": 11,
        "atms": [
            {"id": "CHN-001", "name": "T Nagar Main Road", "lat": 13.0405, "lng": 80.2342, "type": "high_value", "risk": 0.90},
            {"id": "CHN-002", "name": "Anna Nagar West", "lat": 13.0850, "lng": 80.2105, "type": "high_value", "risk": 0.82},
            {"id": "CHN-003", "name": "Velachery Main", "lat": 12.9815, "lng": 80.2180, "type": "commercial", "risk": 0.75},
            {"id": "CHN-004", "name": "Adyar Bridge Road", "lat": 13.0030, "lng": 80.2520, "type": "commercial", "risk": 0.68},
            {"id": "CHN-005", "name": "Mylapore Junction", "lat": 13.0330, "lng": 80.2670, "type": "retail", "risk": 0.55},
            {"id": "CHN-006", "name": "Porur Junction", "lat": 13.0380, "lng": 80.1560, "type": "highway", "risk": 0.48},
            {"id": "CHN-007", "name": "Tambaram Sanitorium", "lat": 12.9249, "lng": 80.1000, "type": "retail", "risk": 0.35},
            {"id": "CHN-008", "name": "Chromepet Main Road", "lat": 12.9516, "lng": 80.1414, "type": "retail", "risk": 0.30},
        ],
        "crime_stats": {"total_cases": 47, "high_risk": 15, "resolved": 12},
    },
    "delhi": {
        "name": "Delhi",
        "state": "Delhi",
        "center": (28.7041, 77.1025),
        "zoom": 11,
        "atms": [
            {"id": "DEL-001", "name": "Connaught Place", "lat": 28.6315, "lng": 77.2167, "type": "high_value", "risk": 0.92},
            {"id": "DEL-002", "name": "Karol Bagh Main", "lat": 28.6519, "lng": 77.1904, "type": "high_value", "risk": 0.85},
            {"id": "DEL-003", "name": "Lajpat Nagar Market", "lat": 28.5677, "lng": 77.2405, "type": "commercial", "risk": 0.78},
            {"id": "DEL-004", "name": "Rohini Sector 7", "lat": 28.7495, "lng": 77.0654, "type": "commercial", "risk": 0.65},
            {"id": "DEL-005", "name": "Dwarka Sector 10", "lat": 28.5921, "lng": 77.0460, "type": "retail", "risk": 0.52},
            {"id": "DEL-006", "name": "Saket Main Road", "lat": 28.5244, "lng": 77.2066, "type": "retail", "risk": 0.45},
            {"id": "DEL-007", "name": "Janakpuri District Centre", "lat": 28.6216, "lng": 77.0816, "type": "bank", "risk": 0.38},
            {"id": "DEL-008", "name": "Pitampura TV Tower", "lat": 28.7026, "lng": 77.1318, "type": "retail", "risk": 0.28},
        ],
        "crime_stats": {"total_cases": 89, "high_risk": 32, "resolved": 25},
    },
    "mumbai": {
        "name": "Mumbai",
        "state": "Maharashtra",
        "center": (19.0760, 72.8777),
        "zoom": 11,
        "atms": [
            {"id": "MUM-001", "name": "Bandra West Linking Road", "lat": 19.0544, "lng": 72.8370, "type": "high_value", "risk": 0.88},
            {"id": "MUM-002", "name": "Andheri West Lokhandwala", "lat": 19.1364, "lng": 72.8296, "type": "high_value", "risk": 0.80},
            {"id": "MUM-003", "name": "Lower Parel Phoenix Mall", "lat": 19.0176, "lng": 72.8562, "type": "commercial", "risk": 0.72},
            {"id": "MUM-004", "name": "Powai Lake Market", "lat": 19.1189, "lng": 72.9064, "type": "commercial", "risk": 0.65},
            {"id": "MUM-005", "name": "Thane West Ghodbunder", "lat": 19.2183, "lng": 72.9580, "type": "retail", "risk": 0.50},
            {"id": "MUM-006", "name": "Navi Mumbai Vashi", "lat": 19.0762, "lng": 72.9987, "type": "retail", "risk": 0.42},
            {"id": "MUM-007", "name": "Kurla Station Road", "lat": 19.0726, "lng": 72.8794, "type": "highway", "risk": 0.55},
            {"id": "MUM-008", "name": "Dadar TT Circle", "lat": 19.0178, "lng": 72.8478, "type": "retail", "risk": 0.35},
        ],
        "crime_stats": {"total_cases": 76, "high_risk": 28, "resolved": 18},
    },
    "bangalore": {
        "name": "Bangalore",
        "state": "Karnataka",
        "center": (12.9716, 77.5946),
        "zoom": 11,
        "atms": [
            {"id": "BLR-001", "name": "MG Road Brigade Road", "lat": 12.9758, "lng": 77.6079, "type": "high_value", "risk": 0.87},
            {"id": "BLR-002", "name": "Indiranagar 100 Feet Road", "lat": 12.9784, "lng": 77.6408, "type": "high_value", "risk": 0.79},
            {"id": "BLR-003", "name": "Koramangala 5th Block", "lat": 12.9352, "lng": 77.6245, "type": "commercial", "risk": 0.70},
            {"id": "BLR-004", "name": "Whitefield Main Road", "lat": 12.9698, "lng": 77.7500, "type": "commercial", "risk": 0.62},
            {"id": "BLR-005", "name": "Electronic City Phase 1", "lat": 12.8456, "lng": 77.6602, "type": "retail", "risk": 0.48},
            {"id": "BLR-006", "name": "Hebbal Flyover Area", "lat": 13.0358, "lng": 77.5970, "type": "highway", "risk": 0.52},
            {"id": "BLR-007", "name": "Jayanagar 4th Block", "lat": 12.9241, "lng": 77.5845, "type": "retail", "risk": 0.38},
            {"id": "BLR-008", "name": "HSR Layout Sector 1", "lat": 12.9116, "lng": 77.6389, "type": "retail", "risk": 0.30},
        ],
        "crime_stats": {"total_cases": 62, "high_risk": 22, "resolved": 15},
    },
    "kolkata": {
        "name": "Kolkata",
        "state": "West Bengal",
        "center": (22.5726, 88.3639),
        "zoom": 11,
        "atms": [
            {"id": "KOL-001", "name": "Park Street", "lat": 22.5505, "lng": 88.3580, "type": "high_value", "risk": 0.86},
            {"id": "KOL-002", "name": "Salt Lake Sector V", "lat": 22.5729, "lng": 88.4337, "type": "high_value", "risk": 0.77},
            {"id": "KOL-003", "name": "New Market Area", "lat": 22.5600, "lng": 88.3500, "type": "commercial", "risk": 0.70},
            {"id": "KOL-004", "name": "Ballygunge Crossing", "lat": 22.5300, "lng": 88.3650, "type": "commercial", "risk": 0.58},
            {"id": "KOL-005", "name": "Dum Dum Junction", "lat": 22.6200, "lng": 88.4200, "type": "retail", "risk": 0.45},
            {"id": "KOL-006", "name": "Howrah Station Area", "lat": 22.5800, "lng": 88.3300, "type": "highway", "risk": 0.55},
            {"id": "KOL-007", "name": "Gariahat Road", "lat": 22.5100, "lng": 88.3680, "type": "retail", "risk": 0.35},
            {"id": "KOL-008", "name": "Behala Chowrasta", "lat": 22.4900, "lng": 88.3300, "type": "retail", "risk": 0.25},
        ],
        "crime_stats": {"total_cases": 54, "high_risk": 19, "resolved": 14},
    },
    "hyderabad": {
        "name": "Hyderabad",
        "state": "Telangana",
        "center": (17.3850, 78.4867),
        "zoom": 11,
        "atms": [
            {"id": "HYD-001", "name": "Banjara Hills Road No 10", "lat": 17.4156, "lng": 78.4347, "type": "high_value", "risk": 0.89},
            {"id": "HYD-002", "name": "Madhapur IT Hub", "lat": 17.4486, "lng": 78.3908, "type": "high_value", "risk": 0.81},
            {"id": "HYD-003", "name": "Gachibowli Main Road", "lat": 17.4400, "lng": 78.3489, "type": "commercial", "risk": 0.73},
            {"id": "HYD-004", "name": "Ameerpet Junction", "lat": 17.4374, "lng": 78.4488, "type": "commercial", "risk": 0.65},
            {"id": "HYD-005", "name": "Kukatpally Hitech City", "lat": 17.4849, "lng": 78.3913, "type": "retail", "risk": 0.50},
            {"id": "HYD-006", "name": "Secunderabad Station Road", "lat": 17.4399, "lng": 78.4983, "type": "highway", "risk": 0.52},
            {"id": "HYD-007", "name": "LB Nagar Cross Roads", "lat": 17.3044, "lng": 78.5533, "type": "retail", "risk": 0.38},
            {"id": "HYD-008", "name": "Dilshuknagar Main", "lat": 17.3688, "lng": 78.5254, "type": "retail", "risk": 0.30},
        ],
        "crime_stats": {"total_cases": 58, "high_risk": 21, "resolved": 16},
    },
    "ahmedabad": {
        "name": "Ahmedabad",
        "state": "Gujarat",
        "center": (23.0225, 72.5714),
        "zoom": 11,
        "atms": [
            {"id": "AMD-001", "name": "CG Road Navrangpura", "lat": 23.0360, "lng": 72.5480, "type": "high_value", "risk": 0.84},
            {"id": "AMD-002", "name": "SG Highway Thaltej", "lat": 23.0504, "lng": 72.5080, "type": "high_value", "risk": 0.76},
            {"id": "AMD-003", "name": "Vastrapur Lake Area", "lat": 23.0380, "lng": 72.5200, "type": "commercial", "risk": 0.68},
            {"id": "AMD-004", "name": "Satellite Cross Roads", "lat": 23.0230, "lng": 72.5020, "type": "commercial", "risk": 0.58},
            {"id": "AMD-005", "name": "Paldi Double Six", "lat": 23.0100, "lng": 72.5600, "type": "retail", "risk": 0.45},
            {"id": "AMD-006", "name": "Ashram Road", "lat": 23.0350, "lng": 72.5660, "type": "highway", "risk": 0.50},
            {"id": "AMD-007", "name": "Maninagar Cross Roads", "lat": 22.9900, "lng": 72.6000, "type": "retail", "risk": 0.35},
            {"id": "AMD-008", "name": "Naroda Road", "lat": 23.0600, "lng": 72.6300, "type": "retail", "risk": 0.28},
        ],
        "crime_stats": {"total_cases": 38, "high_risk": 12, "resolved": 10},
    },
}

def get_city(city_id: str):
    return CITIES.get(city_id.lower())

def get_all_cities():
    return [{"id": k, "name": v["name"], "state": v["state"], "center": v["center"]} for k, v in CITIES.items()]

def get_city_atms(city_id: str):
    city = CITIES.get(city_id.lower())
    return city["atms"] if city else []

def get_city_stats(city_id: str):
    city = CITIES.get(city_id.lower())
    return city["crime_stats"] if city else {}

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))
