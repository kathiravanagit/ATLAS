import { useEffect, useState } from 'react';
import { authFetch, isDemoRoute } from '@/lib/auth';
import type { CampaignsResponse } from '@/types';
import DemoNotice from '@/components/DemoNotice';

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
      <DemoNotice
        title="Campaigns"
        description="This query groups destination accounts that appear in more than one case. The demo has no case database to query, so no clusters are computed or invented."
        linkTo="/demo/cases"
        linkLabel="Open the case registry"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1C1F]">Campaigns</h2>
        <p className="text-sm text-[#33373B] mt-1">
          Destination accounts appearing across multiple cases — a query, not a model.
        </p>
      </div>
      {data && (
        <p className="text-sm text-[#5F6368]">{data.label} · {data.query} · minimum {data.min_cases} cases.</p>
      )}
      {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      {data && data.campaigns.length === 0 && (
        <p className="text-sm text-[#5F6368]">No account appears in {data.min_cases} or more cases.</p>
      )}
      {data && data.campaigns.length > 0 && (
        <div className="card p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#5F6368] ">
                <th className="py-2 pr-4">Account token</th>
                <th className="py-2 pr-4">Cases</th>
                <th className="py-2">Linked case IDs</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.account_token} className="border-t border-[#E2E1DB]">
                  <td className="py-2 pr-4 font-mono text-[#1A1C1F]">{c.account_token}</td>
                  <td className="py-2 pr-4 text-[#1A1C1F]">{c.case_count}</td>
                  <td className="py-2 font-mono text-[#33373B]">{c.case_ids.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
