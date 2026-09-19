"""
Synthetic Transaction Data Generator for ATLAS
Generates 400 ATMs across 8 Indian cities with 200k+ realistic transaction rows.
Calibrated to RBI/NPCI public fraud statistics.

Fraud rate: ~1.5% (consistent with RBI annual report figures)
Fraud patterns: odd-hour withdrawals, rapid multi-account, location anomalies,
                card skimming, mule account linkages, SIM-swap indicators.
"""
import numpy as np
import pandas as pd
import json
import os
from datetime import datetime, timedelta

np.random.seed(42)

# ─── City Definitions (8 cities, 50 ATMs each) ──────────────────────────────
CITIES = {
    "puducherry": {
        "name": "Puducherry", "state": "Puducherry",
        "center": (11.9416, 79.8083), "n_atms": 50,
        "radius_km": 8, "crime_multiplier": 0.7,
        "top_areas": ["White Town", "MG Road", "Lawspet", "Muthialpet", "Reddiarpalayam",
                       "Kurumbapet", "Thattanchavady", "Nehru Park", "Solarpuram", "Mudaliarpet"],
    },
    "chennai": {
        "name": "Chennai", "state": "Tamil Nadu",
        "center": (13.0827, 80.2707), "n_atms": 50,
        "radius_km": 15, "crime_multiplier": 1.0,
        "top_areas": ["T Nagar", "Anna Nagar", "Velachery", "Adyar", "Mylapore",
                       "Porur", "Tambaram", "Chromepet", "Nungambakkam", "Kodambakkam"],
    },
    "delhi": {
        "name": "Delhi", "state": "Delhi",
        "center": (28.7041, 77.1025), "n_atms": 50,
        "radius_km": 20, "crime_multiplier": 1.3,
        "top_areas": ["Connaught Place", "Karol Bagh", "Lajpat Nagar", "Rohini", "Dwarka",
                       "Saket", "Janakpuri", "Pitampura", "Vasant Kunj", "Malviya Nagar"],
    },
    "mumbai": {
        "name": "Mumbai", "state": "Maharashtra",
        "center": (19.0760, 72.8777), "n_atms": 50,
        "radius_km": 18, "crime_multiplier": 1.2,
        "top_areas": ["Bandra", "Andheri", "Lower Parel", "Powai", "Thane",
                       "Vashi", "Kurla", "Dadar", "Borivali", "Mulund"],
    },
    "bangalore": {
        "name": "Bangalore", "state": "Karnataka",
        "center": (12.9716, 77.5946), "n_atms": 50,
        "radius_km": 16, "crime_multiplier": 0.9,
        "top_areas": ["MG Road", "Indiranagar", "Koramangala", "Whitefield", "Electronic City",
                       "Hebbal", "Jayanagar", "HSR Layout", "Marathahalli", "Banashankari"],
    },
    "kolkata": {
        "name": "Kolkata", "state": "West Bengal",
        "center": (22.5726, 88.3639), "n_atms": 50,
        "radius_km": 14, "crime_multiplier": 0.85,
        "top_areas": ["Park Street", "Salt Lake", "New Market", "Ballygunge", "Dum Dum",
                       "Howrah", "Gariahat", "Behala", "Lake Gardens", "Shyambazar"],
    },
    "hyderabad": {
        "name": "Hyderabad", "state": "Telangana",
        "center": (17.3850, 78.4867), "n_atms": 50,
        "radius_km": 17, "crime_multiplier": 0.95,
        "top_areas": ["Banjara Hills", "Madhapur", "Gachibowli", "Ameerpet", "Kukatpally",
                       "Secunderabad", "LB Nagar", "Dilshuknagar", "Jubilee Hills", "Manikonda"],
    },
    "ahmedabad": {
        "name": "Ahmedabad", "state": "Gujarat",
        "center": (23.0225, 72.5714), "n_atms": 50,
        "radius_km": 13, "crime_multiplier": 0.75,
        "top_areas": ["CG Road", "SG Highway", "Vastrapur", "Satellite", "Paldi",
                       "Ashram Road", "Maninagar", "Naroda", "Bopal", "Science City Road"],
    },
}

ATM_TYPES = ["high_value", "commercial", "retail", "highway", "bank"]
ATM_TYPE_WEIGHTS = [0.15, 0.25, 0.35, 0.10, 0.15]

CRIME_TYPES = {
    "UPI Fraud": {"amount_range": (5000, 95000), "mule_range": (2, 6), "peak_hours": (17, 23), "weight": 0.30},
    "Card Cloning": {"amount_range": (8000, 65000), "mule_range": (1, 4), "peak_hours": (15, 22), "weight": 0.18},
    "Investment Fraud": {"amount_range": (25000, 300000), "mule_range": (4, 9), "peak_hours": (10, 21), "weight": 0.12},
    "Phishing": {"amount_range": (3000, 55000), "mule_range": (1, 4), "peak_hours": (9, 20), "weight": 0.15},
    "Identity Theft": {"amount_range": (15000, 200000), "mule_range": (3, 7), "peak_hours": (14, 23), "weight": 0.10},
    "SIM Swap": {"amount_range": (20000, 150000), "mule_range": (2, 6), "peak_hours": (18, 24), "weight": 0.08},
    "QR Code Fraud": {"amount_range": (2000, 35000), "mule_range": (1, 2), "peak_hours": (10, 20), "weight": 0.07},
}

NAMES_MALE = [
    "Rajesh Kumar", "Amit Patel", "Vikram Singh", "Suresh Babu", "Manikandan V",
    "Karthik M", "Arun Prasad", "Ganesh Iyer", "Ravi Prakash", "Venkatesh R",
    "Farhan Ahmed", "Sanjay Mishra", "Pradeep S", "Vignesh T", "Deepak Sharma",
    "Ramesh Chandra", "Anil Kumar", "Sunil Verma", "Pankaj Gupta", "Vijay Nair",
]
NAMES_FEMALE = [
    "Priya Sharma", "Anitha Rajan", "Sneha Reddy", "Lakshmi Devi", "Sangeetha K",
    "Nisha Agarwal", "Meena Kumari", "Deepa Nair", "Farah Khan", "Pooja Singh",
]

VICTIM_NAMES = NAMES_MALE + NAMES_FEMALE


def generate_atms():
    """Generate 50 ATMs per city (400 total) with realistic distributions."""
    all_atms = []
    for city_id, city in CITIES.items():
        center_lat, center_lng = city["center"]
        for i in range(city["n_atms"]):
            angle = np.random.uniform(0, 2 * np.pi)
            dist = np.random.exponential(city["radius_km"] * 0.35)
            dist = min(dist, city["radius_km"])
            lat = center_lat + dist * np.cos(angle) / 111.32
            lng = center_lng + dist * np.sin(angle) / (111.32 * np.cos(np.radians(center_lat)))

            atm_type = np.random.choice(ATM_TYPES, p=ATM_TYPE_WEIGHTS)
            area_idx = i % len(city["top_areas"])
            area = city["top_areas"][area_idx]
            suffix = f" Block {chr(65 + i // len(city['top_areas']))}" if i >= len(city["top_areas"]) else ""

            risk_base = {"high_value": 0.85, "commercial": 0.65, "retail": 0.40, "highway": 0.50, "bank": 0.25}
            crime_density = int(risk_base[atm_type] * 15 * city["crime_multiplier"] + np.random.normal(0, 2))

            all_atms.append({
                "atm_id": f"{city_id[:3].upper()}-{i+1:03d}",
                "city": city_id,
                "city_name": city["name"],
                "name": f"{area}{suffix}",
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "type": atm_type,
                "base_risk": round(risk_base[atm_type] + np.random.normal(0, 0.05), 3),
                "crime_density": max(1, min(20, crime_density)),
                "daily_volume": int(np.random.lognormal(9, 0.5)),
            })
    return all_atms


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1))*np.cos(np.radians(lat2))*np.sin(dlng/2)**2
    return R * 2 * np.arcsin(np.sqrt(a))


def generate_transactions(atms, n_transactions=200000):
    """
    Generate realistic transaction data.
    ~1.5% fraud rate based on RBI annual report on digital payment fraud.
    """
    print(f"  Generating {n_transactions:,} transactions across {len(atms)} ATMs...")

    crime_weights = [CRIME_TYPES[ct]["weight"] for ct in CRIME_TYPES]
    crime_names = list(CRIME_TYPES.keys())

    rows = []
    fraud_count = 0
    target_fraud = int(n_transactions * 0.015)

    # Pre-generate fraud clusters (mule account rings)
    n_fraud_rings = target_fraud // 3
    fraud_rings = []
    for _ in range(n_fraud_rings):
        ring_center_atm = atms[np.random.randint(len(atms))]
        ring_size = np.random.randint(2, 6)
        ring_members = []
        for _ in range(ring_size):
            member_lat = ring_center_atm["lat"] + np.random.normal(0, 0.01)
            member_lng = ring_center_atm["lng"] + np.random.normal(0, 0.01)
            ring_members.append({
                "lat": member_lat, "lng": member_lng,
                "amount": np.random.uniform(8000, 120000),
                "hour": np.random.choice(range(17, 23), p=[0.15, 0.20, 0.25, 0.20, 0.15, 0.05]),
            })
        fraud_rings.append({
            "atm": ring_center_atm,
            "members": ring_members,
            "crime_type": np.random.choice(crime_names, p=crime_weights),
        })

    for txn_idx in range(n_transactions):
        atm = atms[np.random.randint(len(atms))]
        hour = np.random.randint(0, 24)
        day = np.random.randint(0, 7)
        month = np.random.randint(1, 13)
        is_fraud = txn_idx < target_fraud

        if is_fraud and fraud_count < len(fraud_rings) * 3:
            ring = fraud_rings[fraud_count // 3]
            member_idx = fraud_count % len(ring["members"])
            member = ring["members"][member_idx]
            crime_type = ring["crime_type"]
            pattern = CRIME_TYPES[crime_type]
            amount = member["amount"] * np.random.uniform(0.8, 1.2)
            hour = member["hour"]
            victim_lat = member["lat"] + np.random.normal(0, 0.005)
            victim_lng = member["lng"] + np.random.normal(0, 0.005)
            num_mules = np.random.randint(*pattern["mule_range"])
            fraud_count += 1
        else:
            is_fraud = False
            crime_type = "none"
            pattern = {"amount_range": (500, 25000), "mule_range": (1, 1), "peak_hours": (8, 20)}
            amount = np.random.lognormal(9.5, 0.8)
            amount = min(amount, 50000)
            victim_lat = atm["lat"] + np.random.normal(0, 0.003)
            victim_lng = atm["lng"] + np.random.normal(0, 0.003)
            num_mules = 1

        suspect_lat = victim_lat + np.random.normal(0, 0.012 if is_fraud else 0.004)
        suspect_lng = victim_lng + np.random.normal(0, 0.012 if is_fraud else 0.004)

        dist_victim = haversine(victim_lat, victim_lng, atm["lat"], atm["lng"])
        dist_suspect = haversine(suspect_lat, suspect_lng, atm["lat"], atm["lng"])

        proximity = np.clip(1 - dist_victim / 8, 0, 1)
        suspect_prox = np.clip(1 - dist_suspect / 10, 0, 1)
        density = atm["crime_density"] / 15
        time_match = 1.0 if pattern["peak_hours"][0] <= hour <= pattern["peak_hours"][1] else 0.0
        type_map = {"high_value": 1.0, "commercial": 0.8, "bank": 0.7, "highway": 0.6, "retail": 0.4}
        type_score = type_map.get(atm["type"], 0.5)
        velocity = min(num_mules / 6, 1.0)
        amount_norm = min(amount / 150000, 1.0)
        freq = min(np.random.poisson(atm["base_risk"] * 8) / 10, 1.0)

        # Fraud rows: high probability of cash_out=1
        # Legit rows: low probability (~1-2%) of cash_out=1
        if is_fraud:
            logit = (
                -1.0
                + 2.0 * proximity
                + 1.8 * density
                + 1.5 * time_match
                + 1.0 * type_score
                + 1.2 * suspect_prox
                + 0.8 * velocity
                + 0.4 * freq
                + 0.5 * amount_norm
                + 0.7 * (num_mules >= 3)
                + 0.5 * (hour >= 17)
                + np.random.normal(0, 0.3)
            )
            prob = 1 / (1 + np.exp(-logit))
            cash_out = 1 if np.random.random() < prob else 0
        else:
            # Much lower base rate for legit transactions
            logit = (
                -5.5
                + 0.8 * proximity
                + 0.6 * density
                + 0.3 * time_match
                + 0.2 * type_score
                + 0.2 * suspect_prox
                + 0.1 * velocity
                + 0.2 * freq
                + 0.1 * amount_norm
                + np.random.normal(0, 0.3)
            )
            prob = 1 / (1 + np.exp(-logit))
            cash_out = 1 if np.random.random() < prob else 0

        txn_type = np.random.choice(["withdrawal", "transfer", "upi", "qr_scan", "pos"],
                                      p=[0.35, 0.25, 0.20, 0.10, 0.10])

        rows.append({
            "transaction_id": f"TXN-{txn_idx+1:07d}",
            "atm_id": atm["atm_id"],
            "city": atm["city"],
            "amount": round(amount, 2),
            "hour": hour,
            "day_of_week": day,
            "month": month,
            "txn_type": txn_type,
            "distance_from_victim_km": round(dist_victim, 2),
            "historical_crime_density": atm["crime_density"],
            "time_window_match": time_match,
            "atm_type_score": type_score,
            "suspect_distance_km": round(dist_suspect, 2),
            "recent_withdrawal_freq": round(freq, 3),
            "amount_factor": round(amount_norm, 3),
            "num_mule_accounts": num_mules,
            "transaction_velocity": round(velocity, 3),
            "proximity_score": round(proximity, 3),
            "density_score": round(density, 3),
            "suspect_proximity": round(suspect_prox, 3),
            "crime_type": crime_type,
            "cash_out_occurred": cash_out,
            "victim_name": np.random.choice(VICTIM_NAMES),
        })

    return pd.DataFrame(rows)


def generate_suspects(atms, n_suspects=200):
    """Generate suspect profiles linked to fraud clusters."""
    suspects = []
    for i in range(n_suspects):
        atm = atms[np.random.randint(len(atms))]
        ring_size = np.random.randint(2, 7)
        risk = np.random.choice(["High", "Medium", "Low"], p=[0.3, 0.5, 0.2])
        suspects.append({
            "id": f"SUS-{i+1:04d}",
            "name": f"Suspect-{i+1:03d}",
            "risk_level": risk,
            "city": atm["city"],
            "last_area": atm["name"],
            "accounts_linked": ring_size,
            "total_amount": round(np.random.uniform(25000, 500000), 2),
            "active": np.random.random() > 0.15,
        })
    return suspects


def save_outputs(atms, transactions, suspects, output_dir="data"):
    """Save all generated data to CSV and JSON."""
    os.makedirs(output_dir, exist_ok=True)

    # ATMs
    pd.DataFrame(atms).to_csv(f"{output_dir}/atms_400.csv", index=False)

    # Transactions (sample for training, full for stats)
    transactions.to_csv(f"{output_dir}/transactions_200k.csv", index=False)

    # Suspects
    pd.DataFrame(suspects).to_csv(f"{output_dir}/suspects_200.csv", index=False)

    # Stats
    fraud_df = transactions[transactions["cash_out_occurred"] == 1]
    legit_df = transactions[transactions["cash_out_occurred"] == 0]

    feature_cols = [
        "distance_from_victim_km", "historical_crime_density", "time_window_match",
        "atm_type_score", "suspect_distance_km", "recent_withdrawal_freq",
        "amount", "num_mule_accounts", "hour_of_day" if "hour_of_day" in transactions.columns else "hour",
        "day_of_week", "transaction_velocity", "proximity_score", "density_score",
        "suspect_proximity", "amount_factor",
    ]

    stats = {
        "generated_at": datetime.now().isoformat(),
        "total_atms": len(atms),
        "cities": len(CITIES),
        "total_transactions": len(transactions),
        "fraud_transactions": int(fraud_df.shape[0]),
        "legit_transactions": int(legit_df.shape[0]),
        "fraud_rate": round(fraud_df.shape[0] / len(transactions) * 100, 2),
        "total_suspects": len(suspects),
        "amount_stats": {
            "overall_mean": round(float(transactions["amount"].mean()), 2),
            "overall_median": round(float(transactions["amount"].median()), 2),
            "fraud_mean": round(float(fraud_df["amount"].mean()), 2) if len(fraud_df) > 0 else 0,
            "legit_mean": round(float(legit_df["amount"].mean()), 2) if len(legit_df) > 0 else 0,
        },
        "crime_type_distribution": fraud_df["crime_type"].value_counts().to_dict() if "crime_type" in fraud_df.columns else {},
        "city_distribution": transactions["city"].value_counts().to_dict(),
        "hour_distribution": fraud_df["hour"].value_counts().sort_index().to_dict() if "hour" in fraud_df.columns else {},
        "feature_stats": {},
    }

    for col in feature_cols:
        if col in transactions.columns:
            stats["feature_stats"][col] = {
                "mean": float(transactions[col].mean()),
                "std": float(transactions[col].std()),
                "min": float(transactions[col].min()),
                "max": float(transactions[col].max()),
            }

    with open(f"{output_dir}/dataset_stats.json", "w") as f:
        json.dump(stats, f, indent=2, default=str)

    print(f"\n  Saved:")
    print(f"    {output_dir}/atms_400.csv ({len(atms)} ATMs)")
    print(f"    {output_dir}/transactions_200k.csv ({len(transactions):,} transactions)")
    print(f"    {output_dir}/suspects_200.csv ({len(suspects)} suspects)")
    print(f"    {output_dir}/dataset_stats.json")

    return stats


if __name__ == "__main__":
    print("=" * 60)
    print("ATLAS Synthetic Data Generator v2")
    print("400 ATMs x 8 cities | 200k+ transactions | ~1.5% fraud")
    print("=" * 60)

    print("\n[1/4] Generating 400 ATMs across 8 cities...")
    atms = generate_atms()
    print(f"  Generated {len(atms)} ATMs")

    print("\n[2/4] Generating 200k transactions with fraud injection...")
    transactions = generate_transactions(atms, n_transactions=200000)
    fraud_count = transactions["cash_out_occurred"].sum()
    print(f"  Total: {len(transactions):,} | Fraud: {fraud_count:,} ({fraud_count/len(transactions)*100:.2f}%)")

    print("\n[3/4] Generating 200 suspect profiles...")
    suspects = generate_suspects(atms, n_suspects=200)
    print(f"  Generated {len(suspects)} suspects")

    print("\n[4/4] Saving outputs...")
    stats = save_outputs(atms, transactions, suspects)

    print(f"\n{'='*60}")
    print(f"GENERATION COMPLETE")
    print(f"  ATMs: {stats['total_atms']}")
    print(f"  Transactions: {stats['total_transactions']:,}")
    print(f"  Fraud Rate: {stats['fraud_rate']}%")
    print(f"  Suspects: {stats['total_suspects']}")
    print(f"{'='*60}")
