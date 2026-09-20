import { DashboardStats, Case, Prediction, Alert } from '../types';

export const DEMO_CASE_ID = "CC-2026-0147";

// ─── Live Stats (updates dynamically) ───────────────────────────────────────
export const FALLBACK_STATS: DashboardStats = {
  active_cases: 23,
  high_risk_locations: 8,
  alerts_today: 14,
  avg_lead_time: "38 min",
  prevented_fraud: 2475000,
  mules_flagged: 12,
};

// ─── Cases (23 Active + Resolved) ───────────────────────────────────────────
export const FALLBACK_CASES: Case[] = [
  {
    case_id: "CC-2026-0147",
    crime_type: "UPI Fraud",
    amount: 48500,
    linked_accounts: 3,
    current_risk: "High",
    last_updated: "2 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0147",
    contact: "+91-SYN-10147",
    description: "Unauthorized UPI transaction of ₹48,500 detected. Funds moved through 3 mule accounts within 4 hours. Complaint filed on cybercrime.gov.in. Suspected insider involvement at bank branch."
  },
  {
    case_id: "CC-2026-0146",
    crime_type: "Card Cloning",
    amount: 35200,
    linked_accounts: 2,
    current_risk: "High",
    last_updated: "5 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0146",
    contact: "+91-SYN-10146",
    description: "Credit card cloned at unknown ATM in Puducherry. Two unauthorized withdrawals of ₹15,000 and ₹20,200 within 30 minutes."
  },
  {
    case_id: "CC-2026-0145",
    crime_type: "Investment Fraud",
    amount: 125000,
    linked_accounts: 6,
    current_risk: "High",
    last_updated: "8 min ago",
    status: "new",
    victim_name: "VICTIM-SYN-0145",
    contact: "+91-SYN-10145",
    description: "Fake cryptocurrency investment scheme. Victim invested ₹1,25,000 over 2 weeks. Funds routed through 6 mule accounts."
  },
  {
    case_id: "CC-2026-0144",
    crime_type: "Phishing",
    amount: 28900,
    linked_accounts: 2,
    current_risk: "Medium",
    last_updated: "12 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0144",
    contact: "+91-SYN-10144",
    description: "Phishing email mimicking bank OTP page. Victim entered credentials, ₹28,900 transferred to unknown account."
  },
  {
    case_id: "CC-2026-0143",
    crime_type: "Identity Theft",
    amount: 67800,
    linked_accounts: 4,
    current_risk: "Medium",
    last_updated: "15 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0143",
    contact: "+91-SYN-10143",
    description: "Stolen identity used for 4 bank transfers. KYC documents forged using leaked Aadhaar data."
  },
  {
    case_id: "CC-2026-0142",
    crime_type: "Card Cloning",
    amount: 21700,
    linked_accounts: 2,
    current_risk: "Medium",
    last_updated: "18 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0142",
    contact: "+91-SYN-10142",
    description: "Credit card cloned at unknown ATM. Two unauthorized withdrawals of ₹12,000 and ₹9,700."
  },
  {
    case_id: "CC-2026-0141",
    crime_type: "UPI Fraud",
    amount: 19500,
    linked_accounts: 2,
    current_risk: "Low",
    last_updated: "22 min ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0141",
    contact: "+91-SYN-10141",
    description: "Unauthorized UPI transaction. Funds recovered through inter-bank coordination within 6 hours."
  },
  {
    case_id: "CC-2026-0140",
    crime_type: "QR Code Fraud",
    amount: 15800,
    linked_accounts: 1,
    current_risk: "Low",
    last_updated: "30 min ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0140",
    contact: "+91-SYN-10140",
    description: "Fake QR code scan led to ₹15,800 deduction. Merchant account identified and frozen."
  },
  {
    case_id: "CC-2026-0139",
    crime_type: "Investment Fraud",
    amount: 76200,
    linked_accounts: 5,
    current_risk: "High",
    last_updated: "35 min ago",
    status: "new",
    victim_name: "VICTIM-SYN-0139",
    contact: "+91-SYN-10139",
    description: "Fake investment scheme promising 30% returns. Victim transferred ₹76,200 over 3 weeks."
  },
  {
    case_id: "CC-2026-0138",
    crime_type: "SIM Swap",
    amount: 92000,
    linked_accounts: 3,
    current_risk: "High",
    last_updated: "40 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0138",
    contact: "+91-SYN-10138",
    description: "SIM swap fraud. Attacker ported victim's number, intercepted OTPs, drained ₹92,000 from 3 accounts."
  },
  {
    case_id: "CC-2026-0137",
    crime_type: "Phishing",
    amount: 41200,
    linked_accounts: 3,
    current_risk: "Medium",
    last_updated: "45 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0137",
    contact: "+91-SYN-10137",
    description: "Fake bank website phishing. Victim entered net banking credentials. ₹41,200 transferred to mule accounts."
  },
  {
    case_id: "CC-2026-0136",
    crime_type: "Loan App Fraud",
    amount: 38500,
    linked_accounts: 2,
    current_risk: "Medium",
    last_updated: "50 min ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0136",
    contact: "+91-SYN-10136",
    description: "Fake loan app collected ₹5,000 processing fee, then threatened victim and extorted additional ₹33,500."
  },
  {
    case_id: "CC-2026-0135",
    crime_type: "Phishing",
    amount: 33100,
    linked_accounts: 2,
    current_risk: "Low",
    last_updated: "55 min ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0135",
    contact: "+91-SYN-10135",
    description: "Phishing email led to credential theft. ₹33,100 transferred. Case resolved — funds recovered."
  },
  {
    case_id: "CC-2026-0134",
    crime_type: "UPI Fraud",
    amount: 54300,
    linked_accounts: 4,
    current_risk: "High",
    last_updated: "1 hr ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0134",
    contact: "+91-SYN-10134",
    description: "Multiple unauthorized UPI transactions totaling ₹54,300. Funds split across 4 mule accounts."
  },
  {
    case_id: "CC-2026-0133",
    crime_type: "Card Skimming",
    amount: 28900,
    linked_accounts: 2,
    current_risk: "Medium",
    last_updated: "1 hr ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0133",
    contact: "+91-SYN-10133",
    description: "ATM card skimmed at White Town branch. ₹28,900 withdrawn in 3 transactions."
  },
  {
    case_id: "CC-2026-0132",
    crime_type: "Identity Theft",
    amount: 156000,
    linked_accounts: 5,
    current_risk: "High",
    last_updated: "1.5 hr ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0132",
    contact: "+91-SYN-10132",
    description: "Full identity theft. Forged documents used to open 3 new accounts. ₹1,56,000 transferred."
  },
  {
    case_id: "CC-2026-0131",
    crime_type: "QR Code Fraud",
    amount: 8900,
    linked_accounts: 1,
    current_risk: "Low",
    last_updated: "2 hr ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0131",
    contact: "+91-SYN-10131",
    description: "Fake payment QR code at local shop. ₹8,900 deducted. Merchant account frozen."
  },
  {
    case_id: "CC-2026-0130",
    crime_type: "Investment Fraud",
    amount: 210000,
    linked_accounts: 7,
    current_risk: "High",
    last_updated: "2 hr ago",
    status: "new",
    victim_name: "VICTIM-SYN-0130",
    contact: "+91-SYN-10130",
    description: "Ponzi scheme promising daily returns. ₹2,10,000 invested over 1 month. 7 mule accounts identified."
  },
  {
    case_id: "CC-2026-0129",
    crime_type: "UPI Fraud",
    amount: 17600,
    linked_accounts: 2,
    current_risk: "Low",
    last_updated: "2.5 hr ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0129",
    contact: "+91-SYN-10129",
    description: "Unauthorized UPI transfer. ₹17,600 recovered through bank dispute resolution."
  },
  {
    case_id: "CC-2026-0128",
    crime_type: "Identity Theft",
    amount: 89400,
    linked_accounts: 4,
    current_risk: "Medium",
    last_updated: "3 hr ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0128",
    contact: "+91-SYN-10128",
    description: "Stolen identity used for 4 bank transfers totaling ₹89,400. KYC documents forged."
  },
  {
    case_id: "CC-2026-0127",
    crime_type: "Card Cloning",
    amount: 44500,
    linked_accounts: 3,
    current_risk: "Medium",
    last_updated: "3.5 hr ago",
    status: "investigating",
    victim_name: "VICTIM-SYN-0127",
    contact: "+91-SYN-10127",
    description: "Card cloned at multiple ATMs. ₹44,500 withdrawn across 3 locations within 2 hours."
  },
  {
    case_id: "CC-2026-0126",
    crime_type: "Phishing",
    amount: 22300,
    linked_accounts: 2,
    current_risk: "Low",
    last_updated: "4 hr ago",
    status: "resolved",
    victim_name: "VICTIM-SYN-0126",
    contact: "+91-SYN-10126",
    description: "Fake bank短信 phishing. ₹22,300 transferred. Case resolved with fund recovery."
  },
  {
    case_id: "CC-2026-0125",
    crime_type: "SIM Swap",
    amount: 78000,
    linked_accounts: 4,
    current_risk: "High",
    last_updated: "4.5 hr ago",
    status: "new",
    victim_name: "VICTIM-SYN-0125",
    contact: "+91-SYN-10125",
    description: "SIM swap fraud. ₹78,000 drained from 4 accounts after number porting."
  },
];

// ─── Predictions for Active Cases ───────────────────────────────────────────
export const FALLBACK_PREDICTIONS: Record<string, Prediction> = {
  "CC-2026-0147": {
    case_id: "CC-2026-0147",
    status: "HIGH PRIORITY",
    primary_location: {
      rank: 1, atm_id: "ATM-027", location_name: "White Town Main Road",
      risk_score: 92, expected_window: "18:00-20:00", distance: "1.2 km",
      reason: "Evening withdrawal pattern matches historical behavior",
      status: "High", latitude: 11.9335, longitude: 79.8075
    },
    ranked_locations: [
      { rank: 1, atm_id: "ATM-027", location_name: "White Town Main Road", risk_score: 92, expected_window: "18:00-20:00", distance: "1.2 km", reason: "Evening withdrawal pattern matches historical behavior", status: "High", latitude: 11.9335, longitude: 79.8075 },
      { rank: 2, atm_id: "ATM-014", location_name: "MG Road Commercial", risk_score: 78, expected_window: "18:30-20:30", distance: "2.1 km", reason: "Transaction velocity spike detected", status: "High", latitude: 11.9355, longitude: 79.8085 },
      { rank: 3, atm_id: "ATM-031", location_name: "Lawspet Junction", risk_score: 64, expected_window: "19:00-21:00", distance: "3.4 km", reason: "Geographic cluster alignment", status: "Medium", latitude: 11.9450, longitude: 79.8105 },
      { rank: 4, atm_id: "ATM-009", location_name: "Muthialpet Bazaar", risk_score: 51, expected_window: "19:30-21:30", distance: "4.0 km", reason: "Historical cash-out similarity", status: "Medium", latitude: 11.9295, longitude: 79.8055 },
      { rank: 5, atm_id: "ATM-022", location_name: "Reddiarpalayam Town", risk_score: 38, expected_window: "20:00-22:00", distance: "4.8 km", reason: "Account network coordination", status: "Watch", latitude: 11.9395, longitude: 79.8035 },
    ],
    risk_trend: [10, 18, 27, 44, 67, 92],
    evidence: {
      transaction_pattern: { category: "Transaction Pattern", description: "Rapid fund movement through 3 linked accounts detected", strength: "Strong", details: "₹48,500 moved across 3 accounts within 4 hours before complaint filing." },
      temporal_pattern: { category: "Temporal Pattern", description: "Historical withdrawals concentrated during evening hours", strength: "Moderate", details: "73% of past withdrawals occurred between 17:00–21:00." },
      geographic_signal: { category: "Geographic Signal", description: "Geographic clustering within 4km radius of primary location", strength: "Strong", details: "5 of 7 past withdrawals within 4km of ATM-027." },
      account_network: { category: "Account Network", description: "Multiple linked accounts show coordinated activity", strength: "Moderate", details: "3 linked accounts received transfers from common source within 6 hours." },
      historical_similarity: { category: "Historical Similarity", description: "Pattern matches 82% of past verified cash-out cases", strength: "Strong", details: "Similar fraud typology with evening cash-out pattern observed in 12 prior cases." }
    }
  },
  "CC-2026-0146": {
    case_id: "CC-2026-0146",
    status: "HIGH PRIORITY",
    primary_location: { rank: 1, atm_id: "ATM-014", location_name: "MG Road Commercial", risk_score: 85, expected_window: "17:00-19:00", distance: "1.8 km", reason: "Card cloning pattern matches known skimmer locations", status: "High", latitude: 11.9355, longitude: 79.8085 },
    ranked_locations: [
      { rank: 1, atm_id: "ATM-014", location_name: "MG Road Commercial", risk_score: 85, expected_window: "17:00-19:00", distance: "1.8 km", reason: "Card cloning pattern matches known skimmer locations", status: "High", latitude: 11.9355, longitude: 79.8085 },
      { rank: 2, atm_id: "ATM-027", location_name: "White Town Main Road", risk_score: 71, expected_window: "18:00-20:00", distance: "2.3 km", reason: "High ATM traffic area", status: "High", latitude: 11.9335, longitude: 79.8075 },
      { rank: 3, atm_id: "ATM-009", location_name: "Muthialpet Bazaar", risk_score: 58, expected_window: "19:00-21:00", distance: "3.1 km", reason: "Secondary withdrawal pattern", status: "Medium", latitude: 11.9295, longitude: 79.8055 },
      { rank: 4, atm_id: "ATM-031", location_name: "Lawspet Junction", risk_score: 45, expected_window: "19:30-21:30", distance: "3.8 km", reason: "Low activity monitoring", status: "Medium", latitude: 11.9450, longitude: 79.8105 },
      { rank: 5, atm_id: "ATM-022", location_name: "Reddiarpalayam Town", risk_score: 32, expected_window: "20:00-22:00", distance: "4.5 km", reason: "Minimal risk indicators", status: "Watch", latitude: 11.9395, longitude: 79.8035 },
    ],
    risk_trend: [8, 15, 32, 48, 62, 85],
    evidence: {
      transaction_pattern: { category: "Transaction Pattern", description: "Card skimming pattern detected at 2 ATMs", strength: "Strong", details: "₹35,200 withdrawn in rapid succession within 30 minutes." },
      temporal_pattern: { category: "Temporal Pattern", description: "Afternoon/evening peak activity window", strength: "Moderate", details: "68% of similar frauds occur between 17:00–20:00." },
      geographic_signal: { category: "Geographic Signal", description: "ATM cluster within 2km radius", strength: "Strong", details: "3 related card cloning incidents at nearby ATMs in past week." },
      account_network: { category: "Account Network", description: "Suspicious account linkage pattern", strength: "Weak", details: "2 accounts linked to known fraud database." },
      historical_similarity: { category: "Historical Similarity", description: "Matches 75% of card cloning cases", strength: "Moderate", details: "Similar pattern to recent card skimming cases in Tamil Nadu." }
    }
  },
  "CC-2026-0145": {
    case_id: "CC-2026-0145",
    status: "CRITICAL",
    primary_location: { rank: 1, atm_id: "ATM-005", location_name: "Kurumbapet Highway", risk_score: 88, expected_window: "19:00-21:00", distance: "5.2 km", reason: "High-value investment fraud cash-out pattern", status: "High", latitude: 11.9520, longitude: 79.8085 },
    ranked_locations: [
      { rank: 1, atm_id: "ATM-005", location_name: "Kurumbapet Highway", risk_score: 88, expected_window: "19:00-21:00", distance: "5.2 km", reason: "High-value investment fraud cash-out pattern", status: "High", latitude: 11.9520, longitude: 79.8085 },
      { rank: 2, atm_id: "ATM-018", location_name: "Thattanchavady East", risk_score: 72, expected_window: "18:00-20:00", distance: "3.8 km", reason: "Multi-account fund splitting location", status: "High", latitude: 11.9315, longitude: 79.8155 },
      { rank: 3, atm_id: "ATM-027", location_name: "White Town Main Road", risk_score: 65, expected_window: "20:00-22:00", distance: "1.2 km", reason: "High-value ATM target", status: "Medium", latitude: 11.9335, longitude: 79.8075 },
      { rank: 4, atm_id: "ATM-041", location_name: "Nehru Park Branch", risk_score: 48, expected_window: "19:00-21:00", distance: "2.9 km", reason: "Secondary cash-out location", status: "Medium", latitude: 11.9350, longitude: 79.8115 },
      { rank: 5, atm_id: "ATM-014", location_name: "MG Road Commercial", risk_score: 41, expected_window: "18:00-20:00", distance: "2.1 km", reason: "Monitoring required", status: "Watch", latitude: 11.9355, longitude: 79.8085 },
    ],
    risk_trend: [5, 12, 28, 52, 71, 88],
    evidence: {
      transaction_pattern: { category: "Transaction Pattern", description: "Complex fund splitting across 6 accounts", strength: "Strong", details: "₹1,25,000 split into 6 parts of ₹18,000–25,000 each within 48 hours." },
      temporal_pattern: { category: "Temporal Pattern", description: "Late evening cash-out pattern typical of investment fraud", strength: "Strong", details: "81% of investment fraud cash-outs occur between 19:00–22:00." },
      geographic_signal: { category: "Geographic Signal", description: "Wide geographic spread across 5km radius", strength: "Moderate", details: "Funds routed through accounts in 3 different bank branches." },
      account_network: { category: "Account Network", description: "6 accounts show coordinated activity", strength: "Strong", details: "All 6 accounts received funds within 6-hour window from common source." },
      historical_similarity: { category: "Historical Similarity", description: "Pattern matches 89% of investment fraud cases", strength: "Strong", details: "Classic Ponzi scheme cash-out pattern with evening withdrawal." }
    }
  },
};

// Default prediction for cases without specific data
export const FALLBACK_PREDICTION: Prediction = FALLBACK_PREDICTIONS["CC-2026-0147"];

// ─── Alerts (14 Active + Acknowledged) ──────────────────────────────────────
export const FALLBACK_ALERTS: Alert[] = [
  { alert_id: "ALT-001", case_id: "CC-2026-0147", message: "HIGH-RISK: Case CC-2026-0147 has a high predicted cash-out risk at ATM-027 during 18:00-20:00.", risk_level: "High", location: "ATM-027, White Town Main Road", time_window: "18:00-20:00", timestamp: "14:32:15", acknowledged: false, acknowledged_at: null },
  { alert_id: "ALT-002", case_id: "CC-2026-0145", message: "CRITICAL: Case CC-2026-0145 — ₹1,25,000 investment fraud. 6 mule accounts active. Deploy units NOW.", risk_level: "High", location: "ATM-005, Kurumbapet Highway", time_window: "19:00-21:00", timestamp: "14:28:42", acknowledged: false, acknowledged_at: null },
  { alert_id: "ALT-003", case_id: "CC-2026-0146", message: "HIGH-RISK: Card cloning alert. ATM-014 shows elevated skimming risk.", risk_level: "High", location: "ATM-014, MG Road Commercial", time_window: "17:00-19:00", timestamp: "14:25:11", acknowledged: false, acknowledged_at: null },
  { alert_id: "ALT-004", case_id: "CC-2026-0139", message: "MEDIUM-RISK: Case CC-2026-0139 shows elevated cash-out risk at ATM-014.", risk_level: "Medium", location: "ATM-014, MG Road Commercial", time_window: "19:00-21:00", timestamp: "14:20:33", acknowledged: false, acknowledged_at: null },
  { alert_id: "ALT-005", case_id: "CC-2026-0143", message: "MEDIUM-RISK: Identity theft case. Multiple account linkage detected.", risk_level: "Medium", location: "ATM-031, Lawspet Junction", time_window: "19:30-21:30", timestamp: "14:17:22", acknowledged: true, acknowledged_at: "14:22:15" },
  { alert_id: "ALT-006", case_id: "CC-2026-0138", message: "HIGH-RISK: SIM swap fraud. ₹92,000 at risk. Urgent action required.", risk_level: "High", location: "ATM-027, White Town Main Road", time_window: "18:00-20:00", timestamp: "14:12:45", acknowledged: true, acknowledged_at: "14:18:30" },
  { alert_id: "ALT-007", case_id: "CC-2026-0142", message: "WATCH: Case CC-2026-0142 activity detected near ATM-031.", risk_level: "Watch", location: "ATM-031, Lawspet Junction", time_window: "20:00-22:00", timestamp: "14:02:11", acknowledged: true, acknowledged_at: "14:10:00" },
  { alert_id: "ALT-008", case_id: "CC-2026-0134", message: "MEDIUM-RISK: Multiple UPI transactions detected. Fund splitting pattern.", risk_level: "Medium", location: "ATM-009, Muthialpet Bazaar", time_window: "19:00-21:00", timestamp: "13:57:08", acknowledged: true, acknowledged_at: "14:05:22" },
  { alert_id: "ALT-009", case_id: "CC-2026-0132", message: "HIGH-RISK: Large identity theft case. ₹1,56,000 at risk.", risk_level: "High", location: "ATM-005, Kurumbapet Highway", time_window: "20:00-22:00", timestamp: "13:45:30", acknowledged: true, acknowledged_at: "13:52:15" },
  { alert_id: "ALT-010", case_id: "CC-2026-0130", message: "CRITICAL: Ponzi scheme detected. ₹2,10,000 across 7 accounts.", risk_level: "High", location: "ATM-018, Thattanchavady East", time_window: "19:00-21:00", timestamp: "13:30:00", acknowledged: true, acknowledged_at: "13:38:45" },
  { alert_id: "ALT-011", case_id: "CC-2026-0128", message: "WATCH: Case CC-2026-0128 — new account linkage detected.", risk_level: "Watch", location: "ATM-009, Muthialpet Bazaar", time_window: "19:00-21:00", timestamp: "13:15:00", acknowledged: true, acknowledged_at: "13:22:30" },
  { alert_id: "ALT-012", case_id: "CC-2026-0127", message: "MEDIUM-RISK: Card cloning across multiple ATMs detected.", risk_level: "Medium", location: "ATM-014, MG Road Commercial", time_window: "18:00-20:00", timestamp: "13:00:00", acknowledged: true, acknowledged_at: "13:10:15" },
  { alert_id: "ALT-013", case_id: "CC-2026-0125", message: "HIGH-RISK: SIM swap fraud. ₹78,000 at risk.", risk_level: "High", location: "ATM-027, White Town Main Road", time_window: "18:00-20:00", timestamp: "12:45:00", acknowledged: true, acknowledged_at: "12:55:30" },
  { alert_id: "ALT-014", case_id: "CC-2026-0147", message: "UPDATE: Case CC-2026-0147 — risk score increased from 85% to 92%.", risk_level: "High", location: "ATM-027, White Town Main Road", time_window: "18:00-20:00", timestamp: "12:30:00", acknowledged: true, acknowledged_at: "12:40:15" },
];

// ─── Crime Type Distribution (for charts) ───────────────────────────────────
export const CRIME_TYPE_DISTRIBUTION = [
  { type: "UPI Fraud", count: 8, percentage: 35 },
  { type: "Card Cloning", count: 5, percentage: 22 },
  { type: "Phishing", count: 4, percentage: 17 },
  { type: "Investment Fraud", count: 3, percentage: 13 },
  { type: "Identity Theft", count: 2, percentage: 9 },
  { type: "SIM Swap", count: 1, percentage: 4 },
];
