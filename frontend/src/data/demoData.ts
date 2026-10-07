import cities from './demoCities.json';
import { FALLBACK_STATS, FALLBACK_CASES, FALLBACK_ALERTS, FALLBACK_PREDICTIONS } from './fallbackData';
import type { Prediction, PredictionLocation } from '../types';

// Snapshot of backend/city_data.py's synthetic fixtures. Preserve its risk signals;
// do not re-score or randomize them to make the demonstration look more varied.
export function getDemoCity(cityId: string) {
  const city = cities[cityId as keyof typeof cities];
  if (!city) throw new Error(`No synthetic city fixture for ${cityId}`);
  const locations: PredictionLocation[] = [...city.atms]
    .sort((a, b) => b.risk - a.risk)
    .map((atm, index) => ({
      rank: index + 1, atm_id: atm.id, location_name: atm.name,
      latitude: atm.lat, longitude: atm.lng, risk_score: Math.round(atm.risk * 100),
      expected_window: 'Not provided in city fixture', distance: 'Not provided',
      reason: 'Synthetic city fixture risk signal (not a model inference)', status: 'Fixture',
    }));
  const prediction: Prediction = {
    case_id: `DEMO-CITY-${cityId}`, status: 'SYNTHETIC CITY OVERVIEW',
    primary_location: locations[0], ranked_locations: locations, risk_trend: [], evidence: {},
  };
  return {
    prediction, center: city.center as [number, number],
    // Registry and alerts are national fixtures, not city-scoped records.
    cases: structuredClone(FALLBACK_CASES), alerts: structuredClone(FALLBACK_ALERTS),
    stats: { ...FALLBACK_STATS },
  };
}

export function getDemoCase(caseId: string): Prediction {
  const prediction = FALLBACK_PREDICTIONS[caseId];
  if (!prediction) throw new Error(`No synthetic prediction fixture for case ${caseId}`);
  return structuredClone(prediction);
}
