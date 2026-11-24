import { Alert } from '../types';
import { AlertTriangle, CheckCircle, Clock, Plus, X, History, MessageSquare, Mail, Send, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authFetch, isDemoRoute } from '@/lib/auth';
import { can } from '@/lib/roles';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

const API_BASE = '/api';


/** Real dispatch rows from the durable notification_jobs table. */
interface NotificationJob {
  id: number;
  kind: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string | null;
}


export default function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newAlert, setNewAlert] = useState({ case_id: 'CC-2026-0147', message: '', risk_level: 'High', location: '', time_window: '' });
  const [created, setCreated] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "acknowledged">("all");
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [jobsError, setJobsError] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [notifyState, setNotifyState] = useState<Record<string, string>>({});
  const [notifyBusy, setNotifyBusy] = useState<string | null>(null);

  const handleNotify = (alertId: string) => {
    setNotifyBusy(alertId);
    authFetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/notify`, { method: 'POST' })
      .then(async r => {
        const data = r.ok ? await r.json().catch(() => null) : null;
        if (!r.ok || !data) {
          setNotifyState(s => ({ ...s, [alertId]: r.status === 409 ? 'Already acknowledged — no dispatch.' : 'Notify unavailable.' }));
          return;
        }
        const d = data.dispatch || {};
        const sms = d.sms?.queued ? 'SMS queued' : `SMS skipped (${d.sms?.reason || 'guard'})`;
        const email = d.email?.queued ? 'Email queued' : `Email skipped (${d.email?.reason || 'guard'})`;
        // The webhook is silent unless it is actually configured and queued;
        // its "not configured" reason is integration detail, not officer copy.
        const webhook = d.webhook?.queued ? '; signed webhook queued' : '';
        setNotifyState(s => ({ ...s, [alertId]: `${sms}; ${email}${webhook}.` }));
        if (showNotifications) loadJobs();
      })
      .catch(() => setNotifyState(s => ({ ...s, [alertId]: 'Notify unavailable.' })))
      .finally(() => setNotifyBusy(null));
  };

  const loadJobs = () => {
    setJobsLoading(true);
    setJobsError(false);
    authFetch(`${API_BASE}/notifications/jobs?limit=50`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((rows: NotificationJob[]) => setJobs(Array.isArray(rows) ? rows : []))
      .catch(() => setJobsError(true))
      .finally(() => setJobsLoading(false));
  };

  // Fetch the durable dispatch log whenever the notification view opens.
  useEffect(() => {
    if (showNotifications) loadJobs();
  }, [showNotifications]);

  const filtered = alerts.filter(a => {
    if (filter === "pending") return !a.acknowledged;
    if (filter === "acknowledged") return a.acknowledged;
    return true;
  });

  // Only durable backend jobs establish dispatch status.
  const pendingCount = alerts.filter(a => !a.acknowledged).length;

  const handleCreate = async () => {
    if (!newAlert.case_id || !newAlert.message) return;
    setCreateError(false);

    try {
      const res = await authFetch(`${API_BASE}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
      });
      if (!res.ok) throw new Error('API error');
      setCreated(true);
      setTimeout(() => {
        setCreated(false);
        setShowCreate(false);
        setNewAlert({ case_id: 'CC-2026-0147', message: '', risk_level: 'High', location: '', time_window: '' });
      }, 2000);
    } catch {
      setCreateError(true);
      setTimeout(() => {
        setCreateError(false);
      }, 3000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-[#1A1C1F]">
            {showNotifications ? "Notification log" : showHistory ? "Alert history" : "Active alerts"}
          </h3>
          <span className="text-sm text-[#5F6368] bg-[#EFEFEA] px-2 py-0.5 rounded">
            {showNotifications ? `${jobs.length} dispatch jobs` : `${pendingCount} pending`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={isDemoRoute()} aria-label="Notification log"
                        onClick={() => { setShowNotifications(!showNotifications); setShowHistory(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showNotifications ? "bg-[#17406F] text-white" : "bg-[#EFEFEA] hover:bg-[#E2E1DB] text-[#5F6368]"}`}
            title={isDemoRoute() ? 'Backend dispatch log disabled in local demo' : 'Notification Log'}
          >
            <Send size={12} />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setShowNotifications(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? "bg-[#17406F] text-white" : "bg-[#EFEFEA] hover:bg-[#E2E1DB] text-[#5F6368]"}`}
            title="Toggle History"
          >
            <History size={12} />
          </button>
          <button
            disabled={isDemoRoute()}
                        onClick={() => setShowCreate(!showCreate)}
            className={`p-1.5 rounded-lg transition-colors ${showCreate ? "bg-[#17406F] text-white" : "bg-[#EFEFEA] hover:bg-[#E2E1DB] text-[#5F6368]"}`}
            title="Create Alert"
            aria-label="Create alert"
            style={can('alert.create') ? undefined : { display: 'none' }}
          >
            {showCreate ? <X size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </div>

      {!showHistory && !showNotifications && (
        <div className="flex items-center gap-1 bg-[#EFEFEA] border border-[#D2D1CA] rounded-lg p-0.5 mb-2">
          {(["all", "pending", "acknowledged"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                filter === f ? "bg-white text-[#1A1C1F]" : "text-[#5F6368] hover:text-[#1A1C1F]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {showNotifications && (
        <div className="space-y-2">
          {/* Notification Delivery Summary */}
          <div className="card p-4 border-l-2 border-l-[#17406F]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-[#1A1C1F]">Alert & Notification System</div>
              <button
                onClick={loadJobs}
                className="p-1 rounded hover:bg-[#E2E1DB] text-[#5F6368] transition-colors"
                title="Refresh dispatch log"
                aria-label="Refresh notification log"
              >
                <RefreshCw size={12} className={jobsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="text-[11px] text-[#5F6368] mb-3">
              Dispatch log from <span className="font-mono">notification_jobs</span>. HIGH-risk predictions and
              high-risk transaction simulations enqueue SMS/email jobs when a new alert row is committed
              (once per open case+ATM); repeats dispatch nothing new until acknowledged/resolved. These are
              separate commits, not one atomic transaction. Job status records retries and dead-letter failures;
              external delivery requires configured TextBee/SMTP credentials and is not guaranteed.
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                { label: 'SMS jobs', value: jobs.filter(j => j.kind === 'sms').length },
                { label: 'Email jobs', value: jobs.filter(j => j.kind === 'email').length },
                { label: 'Sent', value: jobs.filter(j => j.status === 'sent').length },
                { label: 'Active alerts', value: pendingCount },
              ].map(item => (
                <div key={item.label}>
                  <dd className="num text-[15px] font-medium text-[#1A1C1F]">{item.value}</dd>
                  <dt className="mt-0.5 text-[11px] text-[#5F6368]">{item.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Real dispatch rows from the API */}
          {jobsError && (
            <div className="card p-3 border border-[#B45309]/40 bg-[#B45309]/5">
              <div className="text-[11px] text-[#B45309] text-center">
                Dispatch log unavailable — backend may be offline.
              </div>
            </div>
          )}
          {!jobsError && jobs.length === 0 && !jobsLoading && (
            <div className="card p-3 border border-[#D2D1CA]">
              <div className="text-[11px] text-[#5F6368] text-center">
                No notification jobs recorded — alert creation alone does not establish that a job was queued.
              </div>
            </div>
          )}
          {jobs.map(job => (
            <div key={job.id} className="card p-3 border-l-2 border-l-[#D2D1CA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {job.kind === 'sms' ? (
                    <MessageSquare size={12} className="text-[#15803D]" />
                  ) : (
                    <Mail size={12} className="text-[#17406F]" />
                  )}
                  <span className="text-[11px] font-mono text-[#1A1C1F]">job #{job.id}</span>
                  <span className="text-[11px] text-[#5F6368]">→</span>
                  <span className="text-[11px] text-[#43474C] ">{job.kind}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                    job.status === 'sent' ? "bg-[#15803D]/10 text-[#15803D]" :
                    job.status === 'queued' || job.status === 'sending' ? "bg-[#B45309]/10 text-[#B45309]" :
                    "bg-[#B91C1C]/10 text-[#B91C1C]"
                  }`}>
                    {job.status}
                  </span>
                  <span className="text-[11px] text-[#5F6368]">
                    attempt {job.attempts}/{job.max_attempts}
                  </span>
                </div>
              </div>
              {job.last_error && (
                <div className="mt-1.5 text-[11px] text-[#B91C1C]">{job.last_error}</div>
              )}
              {job.created_at && (
                <div className="mt-1 text-[11px] text-[#5F6368]">{job.created_at}</div>
              )}
            </div>
          ))}

          <div className="card p-3 border border-[#D2D1CA]">
            <div className="text-[11px] text-[#5F6368] text-center">
              Queued notification jobs, when present, are recorded in the backend. SMS (TextBee), Email (SMTP) and the signed webhook require configured credentials; an alert record alone is not evidence of external delivery.
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 border-l-2 border-l-[#12355B]">
          {created ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-2">
                <CheckCircle size={16} className="text-[#15803D]" />
                <span className="text-sm text-[#15803D]">Alert Created</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[#5F6368]">
                <span className="flex items-center gap-1"><MessageSquare size={10} className="text-[#15803D]" /> Alert saved — SMS dispatch happens at the backend when the alert is recorded, not here</span>
                <span className="flex items-center gap-1"><Mail size={10} className="text-[#17406F]" /> Email dispatch likewise records the job, not the send</span>
              </div>
            </div>
          ) : createError ? (
            <div className="flex items-center gap-2 py-2">
              <AlertTriangle size={16} className="text-[#B91C1C]" />
              <span className="text-sm text-[#B91C1C]">Failed to create alert. Backend may be offline.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-[#1A1C1F]">Create New Alert</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Case ID"
                  value={newAlert.case_id}
                  onChange={e => setNewAlert(p => ({ ...p, case_id: e.target.value }))}
                  className="px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F]"
                />
                <select
                  value={newAlert.risk_level}
                  onChange={e => setNewAlert(p => ({ ...p, risk_level: e.target.value }))}
                  className="px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] focus:outline-none focus:border-[#17406F]"
                >
                  <option value="High">High Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="Watch">Watch</option>
                </select>
              </div>
              <input
                placeholder="Location (e.g. ATM-027, White Town)"
                value={newAlert.location}
                onChange={e => setNewAlert(p => ({ ...p, location: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F]"
              />
              <input
                placeholder="Observed cash-out records (e.g. 18:05–20:00 UTC)"
                value={newAlert.time_window}
                onChange={e => setNewAlert(p => ({ ...p, time_window: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F]"
              />
              <textarea
                placeholder="Alert message..."
                value={newAlert.message}
                onChange={e => setNewAlert(p => ({ ...p, message: e.target.value }))}
                rows={2}
                className="w-full px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F] resize-none"
              />
              <button
                onClick={handleCreate}
                className="w-full py-1.5 bg-[#17406F] text-white text-sm font-medium rounded hover:bg-[#12355B] transition-colors"
              >
                Create alert and notify
              </button>
            </div>
          )}
        </div>
      )}

      {!showNotifications && filtered.map((alert) => (
        <div
          key={alert.alert_id}
          className={`card p-4 border-l-2 ${
            alert.acknowledged ? "border-l-[#D2D1CA] opacity-50" :
            alert.risk_level === "High" ? "border-l-[#B91C1C]" :
            alert.risk_level === "Medium" ? "border-l-[#B45309]" :
            "border-l-[#8A8D90]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              alert.acknowledged ? "text-[#5F6368]" :
              alert.risk_level === "High" ? "text-[#B91C1C]" :
              alert.risk_level === "Medium" ? "text-[#B45309]" :
              "text-[#5F6368]"
            }`}>
              {alert.acknowledged ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-medium  px-1.5 py-0.5 rounded ${
                  alert.risk_level === "High" ? "bg-[#B91C1C]/10 text-[#B91C1C]" :
                  alert.risk_level === "Medium" ? "bg-[#B45309]/10 text-[#B45309]" :
                  "bg-[#EFEFEA] text-[#5F6368]"
                }`}>
                  {alert.risk_level}
                </span>
                <span className="text-[11px] text-[#5F6368] flex items-center gap-1">
                  <Clock size={10} /> {alert.timestamp}
                </span>
              </div>
              <p className="text-sm text-[#43474C] mb-2">{alert.message}</p>
              <div className="flex items-center gap-2 text-[11px] text-[#5F6368]">
                <span>Location: {alert.location}</span>
                <span>·</span>
                <span>Records: {alert.time_window}</span>
              </div>

              {/* Notification delivery badges */}
              {!alert.acknowledged && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] flex items-center gap-0.5 text-[#15803D]">
                    <MessageSquare size={8} /> SMS delivery unverified
                  </span>
                  <span className="text-[11px] flex items-center gap-0.5 text-[#17406F]">
                    <Mail size={8} /> Email delivery unverified
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.alert_id)}
                    className="text-[11px] text-[#1A1C1F] bg-[#EFEFEA] hover:bg-[#E2E1DB] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle size={10} /> Acknowledge
                  </button>
                )}
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleNotify(alert.alert_id)}
                    disabled={notifyBusy === alert.alert_id}
                    className="text-[11px] text-[#1A1C1F] bg-[#EFEFEA] hover:bg-[#E2E1DB] px-2 py-0.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="Queue one SMS + one email for this alert (kill-switch, cooldown and daily-cap guarded)"
                    style={can('case.acknowledge') ? undefined : { display: 'none' }}
                  >
                    <Send size={10} /> {notifyBusy === alert.alert_id ? 'Notifying…' : 'Notify officer'}
                  </button>
                )}
                {notifyState[alert.alert_id] && (
                  <span className="text-[11px] text-[#5F6368]">{notifyState[alert.alert_id]}</span>
                )}
                {alert.acknowledged && (
                  <span className="text-[11px] text-[#5F6368] flex items-center gap-1">
                    <CheckCircle size={10} /> Acknowledged at {alert.acknowledged_at}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
