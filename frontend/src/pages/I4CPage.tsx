import { useEffect, useState } from 'react';
import { authFetch, isDemoRoute } from '@/lib/auth';
import type { I4CSummaryResponse } from '@/types';
import DemoNotice from '@/components/DemoNotice';

// National aggregation: counts by district, no case detail.
// District-scoped accounts get a 403 from the API and an explicit message.
export default function I4CPage() {
  const [data, setData] = useState<I4CSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoRoute()) return;
    authFetch('/api/i4c/summary')
      .then(async r => {
        if (r.ok) return r.json();
        if (r.status === 403) { setError('National view requires a national account (empty district).'); return null; }
        setError('I4C summary unavailable.');
        return null;
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setError('I4C summary unavailable.'));
  }, []);

  if (isDemoRoute()) {
    return (
      <DemoNotice
        title="I4C summary"
        description="National counts by district are aggregated from the case database, with no case detail. The demo has no case database, so the aggregation is left empty rather than filled with invented district figures."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1C1F]">I4C summary</h2>
        <p className="text-sm text-[#33373B] mt-1">National counts by district — aggregation only, no case detail.</p>
      </div>
      {data && <p className="text-sm text-[#5F6368]">{data.label}.</p>}
      {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      {data && data.districts.length > 0 && (
        <div className="card p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#5F6368] ">
                <th className="py-2 pr-4">District</th>
                <th className="py-2 pr-4">Cases</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Resolved</th>
                <th className="py-2 pr-4">Alerts</th>
                <th className="py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.districts.map(d => (
                <tr key={d.district} className="border-t border-[#E2E1DB]">
                  <td className="py-2 pr-4 text-[#1A1C1F]">{d.district}</td>
                  <td className="py-2 pr-4 text-[#1A1C1F]">{d.cases_total}</td>
                  <td className="py-2 pr-4 text-[#33373B]">{d.cases_active}</td>
                  <td className="py-2 pr-4 text-[#33373B]">{d.cases_resolved}</td>
                  <td className="py-2 pr-4 text-[#33373B]">{d.alerts_total}</td>
                  <td className="py-2 text-[#33373B]">{d.alerts_pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
