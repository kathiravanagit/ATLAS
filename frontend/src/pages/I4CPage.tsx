import { useEffect, useState } from 'react';
import { authFetch, isDemoRoute } from '@/lib/auth';
import type { I4CSummaryResponse } from '@/types';

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
      <section className="card p-6">
        <h1 className="text-xl font-semibold">I4C summary</h1>
        <p className="mt-3 text-sm">The national aggregation is backend-backed and disabled in local demo.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1F2937]">I4C summary</h2>
        <p className="text-base text-[#374151] mt-1">National counts by district — aggregation only, no case detail.</p>
      </div>
      {data && <p className="text-sm text-[#6B7280]">{data.label}.</p>}
      {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      {data && data.districts.length > 0 && (
        <div className="card p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#6B7280] uppercase">
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
                <tr key={d.district} className="border-t border-[#E5E7EB]">
                  <td className="py-2 pr-4 text-[#1F2937]">{d.district}</td>
                  <td className="py-2 pr-4 text-[#1F2937]">{d.cases_total}</td>
                  <td className="py-2 pr-4 text-[#374151]">{d.cases_active}</td>
                  <td className="py-2 pr-4 text-[#374151]">{d.cases_resolved}</td>
                  <td className="py-2 pr-4 text-[#374151]">{d.alerts_total}</td>
                  <td className="py-2 text-[#374151]">{d.alerts_pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
