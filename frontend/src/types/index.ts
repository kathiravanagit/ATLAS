export interface Case {
  case_id: string;
  crime_type: string;
  amount: number;
  linked_accounts: number;
  current_risk: string;
  last_updated: string;
  status: 'new' | 'investigating' | 'resolved';
  victim_name?: string;
  contact?: string;
  description?: string;
}

export interface PredictionLocation {
  rank: number;
  atm_id: string;
  location_name: string;
  risk_score: number;
  expected_window: string;
  distance: string;
  reason: string;
  status: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
}

export interface Prediction {
  case_id: string;
  status: string;
  primary_location: PredictionLocation;
  ranked_locations: PredictionLocation[];
  risk_trend: number[];
  evidence: Record<string, EvidenceItem>;
}

export interface EvidenceItem {
  category: string;
  description: string;
  strength: string;
  details: string;
}

export interface Alert {
  alert_id: string;
  case_id: string;
  message: string;
  risk_level: string;
  location: string;
  time_window: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface DashboardStats {
  active_cases: number;
  high_risk_locations: number;
  alerts_today: number;
  avg_lead_time: string;
  prevented_fraud: number;
  mules_flagged: number;
}

export interface AuditEntry {
  time: string;
  action: string;
  details: string;
  action_type: string;
}

export interface Suspect {
  id: string;
  name: string;
  risk_level: string;
  last_seen: string;
  accounts_linked: number;
  status: string;
}

export type ActiveView =
  | 'overview'
  | 'predictions'
  | 'map'
  | 'cases'
  | 'alerts'
  | 'evidence'
  | 'audit';

export type RiskFilter = 'all' | 'High' | 'Medium' | 'Low' | 'Watch';
export type TimeFilter = 'all' | '17:00-19:00' | '18:00-20:00' | '19:00-21:00' | '20:00-22:00';
