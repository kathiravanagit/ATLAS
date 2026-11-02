import type { RiskArea } from '../types';

/** Rank-first presentation shared by every score display (Part B). */

/**
 * The model score ranks locations within one case; it does not estimate the
 * chance of a cash-out at any particular ATM. Serving feeds it case-level
 * features (mule count, withdrawal frequency), so it moves with the complaint,
 * not with the ATM — which is why every screen calls it severity and ranks by
 * the ATM-level ranker instead.
 */
export const SCORE_TOOLTIP =
  'Uncalibrated ranking on synthetic fixtures. We prioritise by rank (Priority / Watch / Background). The score reflects how severe the case is judged, not the probability an offender is at this ATM.';

export const CASE_SEVERITY_NOTE =
  'Case-severity score, not a per-ATM chance';

/** Backend risk_area with a rank-derived fallback for local/demo fixtures. */
export function riskArea(rank: number, total: number, area?: RiskArea | string | null): RiskArea {
  if (area === 'priority' || area === 'watch' || area === 'background') return area;
  let pEnd: number, wEnd: number;
  if (total >= 10) {
    pEnd = 3; wEnd = 10;
  } else {
    pEnd = Math.max(1, Math.ceil(total * 0.3));
    wEnd = Math.max(pEnd, Math.min(10, Math.ceil(total * 0.7)));
  }
  if (rank <= pEnd) return 'priority';
  if (rank <= wEnd) return 'watch';
  return 'background';
}

export function areaPrimary(area: RiskArea, rank: number, total: number): string {
  const zone = area === 'priority' ? 'Priority zone' : area === 'watch' ? 'Watch zone' : 'Background';
  return `${zone} · Rank #${rank} of ${total}`;
}

export function areaSecondary(
  area: RiskArea, display?: number | null, raw?: number | null,
): string {
  const d = display == null ? '—' : display;
  if (area === 'priority') {
    const s = raw == null ? '—' : raw;
    return `Display score ${d} · Uncalibrated case-severity score ${s} · Synthetic — not a real-world probability`;
  }
  if (area === 'watch') return `Display score ${d} · Relative rank only · Synthetic`;
  return 'Lower priority · Map context · Synthetic ranking';
}

export const AREA_LABEL: Record<RiskArea, string> = {
  priority: 'Priority',
  watch: 'Watch',
  background: 'Background',
};
