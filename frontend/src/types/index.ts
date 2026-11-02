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

export interface ObservedWindow {
  /** Human-readable span of the cash-out records on file, e.g. "17:32–23:05 UTC". */
  label: string;
  start: string | null;
  end: string | null;
  /** 0 or 1: whether the span crosses midnight. */
  end_day_offset: number;
  /** Distinct hours that appear in the records, for the time-of-day filter. */
  hours: number[];
  records: number;
}

export interface PredictionLocation {
  rank: number;
  atm_id: string;
  location_name: string;
  risk_score: number;
  /** Descriptive span of stored records. Never a predicted window. */
  observed_window?: ObservedWindow;
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
  observed_window?: ObservedWindow;
  risk_trend: number[];
  evidence: Record<string, EvidenceItem>;
  disclaimer?: string;
  /** Server-built H3 hexbin of the same ranking. Absent in local fixtures. */
  risk_surface?: RiskSurface;
  /** Adjacent priority/watch cells grouped into an area to check. */
  intervention_zones?: InterventionZones;
}

export type ZoneLevel = 'priority' | 'watch';

export interface InterventionZone {
  zone_id: string;
  level: ZoneLevel;
  cells: number;
  priority_cells: number;
  watch_cells: number;
  score_mean: number;
  score_max: number;
  top_atm: string;
  atm_count: number;
  center: [number, number];
  h3_cells: string[];
  /** Convex hull of the member cells as [[lat, lng], ...]. */
  boundary: [number, number][];
}

export interface InterventionZones {
  zones: InterventionZone[];
  summary: {
    zones: number;
    clustered_cells: number;
    noise_cells: number;
    priority_cells: number;
    watch_cells: number;
  };
  eps_hops: number;
  min_samples: number;
  method: string;
  note: string;
}

export type RiskCellLevel = 'priority' | 'watch' | 'background' | 'none';

export interface RiskCell {
  h3: string;
  center: [number, number];
  /** Polygon ring as [[lat, lng], ...]. */
  boundary: [number, number][];
  /** Null means "no coverage": no ATM within the surface's reach. */
  score: number | null;
  level: RiskCellLevel;
  atm_count: number;
  nearest_atm: string;
  nearest_m: number | null;
  top_atm: string;
  top_atm_score: number | null;
}

export interface RiskSurface {
  cells: RiskCell[];
  summary: {
    cells: number;
    scored: number;
    priority: number;
    watch: number;
    background: number;
  };
  resolution: number;
  sigma_m: number;
  cell_edge_m: number;
  reach_m: number;
  /** Quantile cut points of this city's own cells, not absolute risk levels.
   *  Both are null when the field carries no spread, in which case no cell is
   *  banded as priority or watch (see `flat`). */
  bands: { priority_at: number | null; watch_at: number | null };
  /** True when every scored cell is equal: the ranking cannot separate them. */
  flat: boolean;
  method: string;
  basis: 'ranker_score' | 'risk_score';
  calibrated: false;
  note: string;
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
  /** Column name kept for storage compatibility; carries the observed cash-out span. */
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
export type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';
