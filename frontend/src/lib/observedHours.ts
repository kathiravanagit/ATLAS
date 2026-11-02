/**
 * Time-of-day buckets for the cash-out records a case actually shows.
 *
 * These replace a filter over predicted two-hour windows. The windows came from
 * the mean hour of the records the request itself had generated, so filtering on
 * them was filtering on an echo of the input. Bands over observed hours describe
 * the rows on file and cannot imply a forecast.
 */
export type TimeBucket = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';

export const TIME_BUCKETS: { id: TimeBucket; label: string }[] = [
  { id: 'all', label: 'Any' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];

/** Inclusive hour ranges; night wraps past midnight. */
const RANGES: Record<Exclude<TimeBucket, 'all'>, [number, number]> = {
  morning: [5, 11],
  afternoon: [12, 16],
  evening: [17, 20],
  night: [21, 4],
};

export const OBSERVED_HOURS_TIP =
  'Hours that appear in this case\'s cash-out records (UTC), not a prediction of when a withdrawal will happen.';

export function matchesTimeBucket(hours: number[] | undefined, bucket: TimeBucket): boolean {
  if (bucket === 'all') return true;
  const [from, to] = RANGES[bucket];
  return (hours ?? []).some((hour) =>
    from <= to ? hour >= from && hour <= to : hour >= from || hour <= to);
}
