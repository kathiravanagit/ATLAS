import { useEffect, useState } from 'react';
import { authFetch, isDemoRoute } from '@/lib/auth';
import type { CampaignsResponse } from '@/types';

// Cross-complaint campaign query: accounts receiving transfers in >= 2 cases.
// A query, not a model. Labelled synthetic — the fixtures recycle a small
// token pool (modulo 97), so most hits are token reuse, not discovered rings.
export default function CampaignsPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoRoute()) return;
    authFetch('/api/campaigns?min_cases=2')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setData(d);
        else setError('Campaign query unavailable.');
      })
      .catch(() => setError('Campaign query unavailable.'));
  }, []);

  if (isDemoRoute()) {
    return (
      <section className="card p-6">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <p className="mt-3 text-sm">The campaign query is backend-backed and disabled in local demo.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1F2937]">Campaigns</h2>
        <p className="text-base text-[#374151] mt-1">
          Destination accounts appearing across multiple cases — a query, not a model.
        </p>
      </div>
      {data && (
        <p className="text-sm text-[#6B7280]">{data.label} · {data.query} · minimum {data.min_cases} cases.</p>
      )}
      {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      {data && data.campaigns.length === 0 && (
        <p className="text-sm text-[#6B7280]">No account appears in {data.min_cases} or more cases.</p>
      )}
      {data && data.campaigns.length > 0 && (
        <div className="card p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#6B7280] uppercase">
                <th className="py-2 pr-4">Account token</th>
                <th className="py-2 pr-4">Cases</th>
                <th className="py-2">Linked case IDs</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.account_token} className="border-t border-[#E5E7EB]">
                  <td className="py-2 pr-4 font-mono text-[#1F2937]">{c.account_token}</td>
                  <td className="py-2 pr-4 text-[#1F2937]">{c.case_count}</td>
                  <td className="py-2 font-mono text-[#374151]">{c.case_ids.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
