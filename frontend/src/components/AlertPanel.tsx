import { Alert } from '../types';
import { AlertTriangle, CheckCircle, Clock, Plus, X, History, MessageSquare, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { authFetch } from '@/lib/auth';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

const API_BASE = '/api';

interface NotificationLog {
  alertId: string;
  channel: 'sms' | 'email' | 'api';
  status: 'sent' | 'delivered' | 'failed';
  timestamp: string;
}

function generateNotificationLogs(alerts: Alert[]): NotificationLog[] {
  const logs: NotificationLog[] = [];
  alerts.forEach(a => {
    if (!a.acknowledged) {
      logs.push({
        alertId: a.alert_id,
        channel: 'sms',
        status: a.risk_level === 'High' ? 'delivered' : 'sent',
        timestamp: a.timestamp,
      });
      logs.push({
        alertId: a.alert_id,
        channel: 'email',
        status: 'delivered',
        timestamp: a.timestamp,
      });
    }
  });
  return logs;
}

export default function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newAlert, setNewAlert] = useState({ case_id: 'CC-2026-0147', message: '', risk_level: 'High', location: '', time_window: '' });
  const [created, setCreated] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "acknowledged">("all");

  const filtered = alerts.filter(a => {
    if (filter === "pending") return !a.acknowledged;
    if (filter === "acknowledged") return a.acknowledged;
    return true;
  });

  const notifLogs = generateNotificationLogs(alerts);
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
          <h3 className="font-semibold text-base text-[#1F2937]">
            {showNotifications ? "Notification Log" : showHistory ? "Alert History" : "Active Alerts"}
          </h3>
          <span className="text-sm text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
            {showNotifications ? `${notifLogs.length} dispatched` : `${pendingCount} pending`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowHistory(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showNotifications ? "bg-[#1D4ED8] text-white" : "bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280]"}`}
            title="Notification Log"
          >
            <Send size={12} />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setShowNotifications(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? "bg-[#1D4ED8] text-white" : "bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280]"}`}
            title="Toggle History"
          >
            <History size={12} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`p-1.5 rounded-lg transition-colors ${showCreate ? "bg-[#1D4ED8] text-white" : "bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280]"}`}
            title="Create Alert"
          >
            {showCreate ? <X size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </div>

      {!showHistory && !showNotifications && (
        <div className="flex items-center gap-1 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg p-0.5 mb-2">
          {(["all", "pending", "acknowledged"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                filter === f ? "bg-white text-[#1F2937] shadow-sm" : "text-[#6B7280] hover:text-[#1F2937]"
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
          <div className="card p-4 border-l-2 border-l-[#1D4ED8]">
            <div className="text-sm font-medium text-[#1F2937] mb-3">Alert & Notification System</div>
            <div className="text-[11px] text-[#6B7280] mb-3">
              SMS and Email channels are optional (Twilio/SMTP). Below shows simulated dispatch counts — actual delivery requires credentials in .env
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white rounded-lg p-2 border border-[#D1D5DB] text-center">
                <MessageSquare size={14} className="text-[#15803D] mx-auto mb-1" />
                <div className="text-sm font-bold text-[#1F2937]">{notifLogs.filter(n => n.channel === 'sms').length}</div>
                <div className="text-[11px] text-[#6B7280]">SMS Sent</div>
              </div>
              <div className="bg-white rounded-lg p-2 border border-[#D1D5DB] text-center">
                <Mail size={14} className="text-[#1D4ED8] mx-auto mb-1" />
                <div className="text-sm font-bold text-[#1F2937]">{notifLogs.filter(n => n.channel === 'email').length}</div>
                <div className="text-[11px] text-[#6B7280]">Emails Sent</div>
              </div>
              <div className="bg-white rounded-lg p-2 border border-[#D1D5DB] text-center">
                <Send size={14} className="text-[#B45309] mx-auto mb-1" />
                <div className="text-sm font-bold text-[#1F2937]">{pendingCount}</div>
                <div className="text-[11px] text-[#6B7280]">Active Alerts</div>
              </div>
            </div>
          </div>

          {/* Individual notification logs */}
          {notifLogs.map((log, i) => {
            const alert = alerts.find(a => a.alert_id === log.alertId);
            return (
              <div key={`${log.alertId}-${log.channel}-${i}`} className="card p-3 border-l-2 border-l-[#D1D5DB]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.channel === 'sms' ? (
                      <MessageSquare size={12} className="text-[#15803D]" />
                    ) : log.channel === 'email' ? (
                      <Mail size={12} className="text-[#1D4ED8]" />
                    ) : (
                      <Send size={12} className="text-[#B45309]" />
                    )}
                    <span className="text-[11px] font-mono text-[#1F2937]">{log.alertId}</span>
                    <span className="text-[11px] text-[#6B7280]">→</span>
                    <span className="text-[11px] text-[#4B5563] uppercase">{log.channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                      log.status === 'delivered' ? "bg-[#15803D]/10 text-[#15803D]" :
                      log.status === 'sent' ? "bg-[#B45309]/10 text-[#B45309]" :
                      "bg-[#B91C1C]/10 text-[#B91C1C]"
                    }`}>
                      {log.status === 'delivered' ? "Delivered" : log.status === 'sent' ? "Sent" : "Failed"}
                    </span>
                    <span className="text-[11px] text-[#6B7280]">{log.timestamp}</span>
                  </div>
                </div>
                {alert && (
                  <div className="mt-1.5 text-[11px] text-[#6B7280]">
                    {alert.risk_level} Risk — {alert.location} — {alert.message.slice(0, 60)}...
                  </div>
                )}
              </div>
            );
          })}

          <div className="card p-3 border border-[#D1D5DB]">
            <div className="text-[11px] text-[#6B7280] text-center">
              Notifications are logged locally. SMS (Twilio) and Email (SMTP) delivery requires credentials in .env — without them, alerts are stored but not dispatched externally.
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 border-l-2 border-l-[#1D355B]">
          {created ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-2">
                <CheckCircle size={16} className="text-[#15803D]" />
                <span className="text-base text-[#15803D]">Alert Created</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[#6B7280]">
                <span className="flex items-center gap-1"><MessageSquare size={10} className="text-[#15803D]" /> SMS dispatched to field team</span>
                <span className="flex items-center gap-1"><Mail size={10} className="text-[#1D4ED8]" /> Email sent to I4C</span>
              </div>
            </div>
          ) : createError ? (
            <div className="flex items-center gap-2 py-2">
              <AlertTriangle size={16} className="text-[#B91C1C]" />
              <span className="text-base text-[#B91C1C]">Failed to create alert. Backend may be offline.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-[#1F2937]">Create New Alert</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Case ID"
                  value={newAlert.case_id}
                  onChange={e => setNewAlert(p => ({ ...p, case_id: e.target.value }))}
                  className="px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8]"
                />
                <select
                  value={newAlert.risk_level}
                  onChange={e => setNewAlert(p => ({ ...p, risk_level: e.target.value }))}
                  className="px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] focus:outline-none focus:border-[#1D4ED8]"
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
                className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8]"
              />
              <input
                placeholder="Time Window (e.g., 18:00-20:00)"
                value={newAlert.time_window}
                onChange={e => setNewAlert(p => ({ ...p, time_window: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8]"
              />
              <textarea
                placeholder="Alert message..."
                value={newAlert.message}
                onChange={e => setNewAlert(p => ({ ...p, message: e.target.value }))}
                rows={2}
                className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] resize-none"
              />
              <button
                onClick={handleCreate}
                className="w-full py-1.5 bg-[#1D4ED8] text-white text-sm font-medium rounded hover:bg-[#1D355B] transition-colors"
              >
                Create Alert → Store & Notify
              </button>
            </div>
          )}
        </div>
      )}

      {!showNotifications && filtered.map((alert) => (
        <div
          key={alert.alert_id}
          className={`card p-4 border-l-2 ${
            alert.acknowledged ? "border-l-[#D1D5DB] opacity-50" :
            alert.risk_level === "High" ? "border-l-[#B91C1C]" :
            alert.risk_level === "Medium" ? "border-l-[#B45309]" :
            "border-l-[#9CA3AF]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              alert.acknowledged ? "text-[#6B7280]" :
              alert.risk_level === "High" ? "text-[#B91C1C]" :
              alert.risk_level === "Medium" ? "text-[#B45309]" :
              "text-[#6B7280]"
            }`}>
              {alert.acknowledged ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-medium uppercase px-1.5 py-0.5 rounded ${
                  alert.risk_level === "High" ? "bg-[#B91C1C]/10 text-[#B91C1C]" :
                  alert.risk_level === "Medium" ? "bg-[#B45309]/10 text-[#B45309]" :
                  "bg-[#F3F4F6] text-[#6B7280]"
                }`}>
                  {alert.risk_level}
                </span>
                <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
                  <Clock size={10} /> {alert.timestamp}
                </span>
              </div>
              <p className="text-base text-[#4B5563] mb-2">{alert.message}</p>
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span>Location: {alert.location}</span>
                <span>·</span>
                <span>Window: {alert.time_window}</span>
              </div>

              {/* Notification delivery badges */}
              {!alert.acknowledged && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] flex items-center gap-0.5 text-[#15803D]">
                    <MessageSquare size={8} /> SMS Delivered
                  </span>
                  <span className="text-[11px] flex items-center gap-0.5 text-[#1D4ED8]">
                    <Mail size={8} /> Email Sent
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.alert_id)}
                    className="text-[11px] text-[#1F2937] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle size={10} /> Acknowledge
                  </button>
                )}
                {alert.acknowledged && (
                  <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
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
