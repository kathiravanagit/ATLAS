export interface Case {
  case_id: string;
  crime_type: string;
  amount: number;
  linked_accounts: number;
  current_risk: string;
  last_updated: string;
  status: 'new' | 'investigating' | 'resolved';
  district?: string;
  department?: string;
  victim_name?: string;
  contact?: string;
  description?: string;
}

export type RiskArea = 'priority' | 'watch' | 'background';

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
  risk_area?: RiskArea;
  rank_total?: number;
  display_score?: number;
  ranker_score?: number;
}

export interface Prediction {
  case_id: string;
  status: string;
  primary_location: PredictionLocation;
  ranked_locations: PredictionLocation[];
  risk_trend: number[];
  evidence: Record<string, EvidenceItem>;
  disclaimer?: string;
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
  prevented_fraud: number | null;
  mules_flagged: number | null;
  resolved_case_amount?: number | null;
  metrics_note?: string | null;
}

export interface AuditEntry {
  time: string;
  action: string;
  details: string;
  action_type: string;
  date?: string;
  case_id?: string;
}

export type RiskFilter = 'all' | 'High' | 'Medium' | 'Low' | 'Watch';
export type TimeFilter = 'all' | '17:00-19:00' | '18:00-20:00' | '19:00-21:00' | '20:00-22:00';
