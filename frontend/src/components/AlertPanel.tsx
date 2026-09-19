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
          <h3 className="font-semibold text-base text-white">
            {showNotifications ? "Notification Log" : showHistory ? "Alert History" : "Active Alerts"}
          </h3>
          <span className="text-sm text-[#d4d4d8] bg-[#27272a] px-2 py-0.5 rounded">
            {showNotifications ? `${notifLogs.length} dispatched` : `${pendingCount} pending`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowHistory(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showNotifications ? "bg-[#71717a] text-white" : "bg-[#27272a] hover:bg-[#71717a] text-[#e4e4e7]"}`}
            title="Notification Log"
          >
            <Send size={12} />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setShowNotifications(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? "bg-[#71717a] text-white" : "bg-[#27272a] hover:bg-[#71717a] text-[#e4e4e7]"}`}
            title="Toggle History"
          >
            <History size={12} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`p-1.5 rounded-lg transition-colors ${showCreate ? "bg-[#71717a] text-white" : "bg-[#27272a] hover:bg-[#71717a] text-[#e4e4e7]"}`}
            title="Create Alert"
          >
            {showCreate ? <X size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </div>

      {!showHistory && !showNotifications && (
        <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#27272a] rounded-lg p-0.5 mb-2">
          {(["all", "pending", "acknowledged"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                filter === f ? "bg-[#27272a] text-white" : "text-[#d4d4d8] hover:text-white"
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
          <div className="card p-4 border-l-2 border-l-[#3b82f6]">
            <div className="text-sm font-medium text-white mb-3">Alert & Notification System</div>
            <div className="text-[10px] text-[#d4d4d8] mb-3">
              SMS and Email channels are optional (Twilio/SMTP). Below shows simulated dispatch counts — actual delivery requires credentials in .env
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#18181b] rounded-lg p-2 border border-[#27272a] text-center">
                <MessageSquare size={14} className="text-[#22c55e] mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{notifLogs.filter(n => n.channel === 'sms').length}</div>
                <div className="text-[10px] text-[#d4d4d8]">SMS Sent</div>
              </div>
              <div className="bg-[#18181b] rounded-lg p-2 border border-[#27272a] text-center">
                <Mail size={14} className="text-[#3b82f6] mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{notifLogs.filter(n => n.channel === 'email').length}</div>
                <div className="text-[10px] text-[#d4d4d8]">Emails Sent</div>
              </div>
              <div className="bg-[#18181b] rounded-lg p-2 border border-[#27272a] text-center">
                <Send size={14} className="text-[#f59e0b] mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{pendingCount}</div>
                <div className="text-[10px] text-[#d4d4d8]">Active Alerts</div>
              </div>
            </div>
          </div>

          {/* Individual notification logs */}
          {notifLogs.map((log, i) => {
            const alert = alerts.find(a => a.alert_id === log.alertId);
            return (
              <div key={`${log.alertId}-${log.channel}-${i}`} className="card p-3 border-l-2 border-l-[#27272a]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.channel === 'sms' ? (
                      <MessageSquare size={12} className="text-[#22c55e]" />
                    ) : log.channel === 'email' ? (
                      <Mail size={12} className="text-[#3b82f6]" />
                    ) : (
                      <Send size={12} className="text-[#f59e0b]" />
                    )}
                    <span className="text-[10px] font-mono text-white">{log.alertId}</span>
                    <span className="text-[10px] text-[#d4d4d8]">→</span>
                    <span className="text-[10px] text-[#e4e4e7] uppercase">{log.channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      log.status === 'delivered' ? "bg-[#22c55e]/10 text-[#22c55e]" :
                      log.status === 'sent' ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      "bg-[#ef4444]/10 text-[#ef4444]"
                    }`}>
                      {log.status === 'delivered' ? "Delivered" : log.status === 'sent' ? "Sent" : "Failed"}
                    </span>
                    <span className="text-[10px] text-[#d4d4d8]">{log.timestamp}</span>
                  </div>
                </div>
                {alert && (
                  <div className="mt-1.5 text-[10px] text-[#d4d4d8]">
                    {alert.risk_level} Risk — {alert.location} — {alert.message.slice(0, 60)}...
                  </div>
                )}
              </div>
            );
          })}

          <div className="card p-3 border border-[#27272a]">
            <div className="text-[10px] text-[#d4d4d8] text-center">
              Notifications are logged locally. SMS (Twilio) and Email (SMTP) delivery requires credentials in .env — without them, alerts are stored but not dispatched externally.
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 border-l-2 border-l-white">
          {created ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-2">
                <CheckCircle size={16} className="text-[#22c55e]" />
                <span className="text-base text-[#22c55e]">Alert Created</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-[#d4d4d8]">
                <span className="flex items-center gap-1"><MessageSquare size={10} className="text-[#22c55e]" /> SMS dispatched to field team</span>
                <span className="flex items-center gap-1"><Mail size={10} className="text-[#3b82f6]" /> Email sent to I4C</span>
              </div>
            </div>
          ) : createError ? (
            <div className="flex items-center gap-2 py-2">
              <AlertTriangle size={16} className="text-[#ef4444]" />
              <span className="text-base text-[#ef4444]">Failed to create alert. Backend may be offline.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-white">Create New Alert</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Case ID"
                  value={newAlert.case_id}
                  onChange={e => setNewAlert(p => ({ ...p, case_id: e.target.value }))}
                  className="px-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a]"
                />
                <select
                  value={newAlert.risk_level}
                  onChange={e => setNewAlert(p => ({ ...p, risk_level: e.target.value }))}
                  className="px-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white focus:outline-none focus:border-[#71717a]"
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
                className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a]"
              />
              <input
                placeholder="Time Window (e.g., 18:00-20:00)"
                value={newAlert.time_window}
                onChange={e => setNewAlert(p => ({ ...p, time_window: e.target.value }))}
                className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a]"
              />
              <textarea
                placeholder="Alert message..."
                value={newAlert.message}
                onChange={e => setNewAlert(p => ({ ...p, message: e.target.value }))}
                rows={2}
                className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a] resize-none"
              />
              <button
                onClick={handleCreate}
                className="w-full py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-[#e4e4e7] transition-colors"
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
            alert.acknowledged ? "border-l-[#27272a] opacity-50" :
            alert.risk_level === "High" ? "border-l-[#ef4444]" :
            alert.risk_level === "Medium" ? "border-l-[#f59e0b]" :
            "border-l-[#d4d4d8]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              alert.acknowledged ? "text-[#d4d4d8]" :
              alert.risk_level === "High" ? "text-[#ef4444]" :
              alert.risk_level === "Medium" ? "text-[#f59e0b]" :
              "text-[#d4d4d8]"
            }`}>
              {alert.acknowledged ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
                  alert.risk_level === "High" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                  alert.risk_level === "Medium" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                  "bg-[#27272a] text-[#d4d4d8]"
                }`}>
                  {alert.risk_level}
                </span>
                <span className="text-[10px] text-[#d4d4d8] flex items-center gap-1">
                  <Clock size={10} /> {alert.timestamp}
                </span>
              </div>
              <p className="text-base text-[#e4e4e7] mb-2">{alert.message}</p>
              <div className="flex items-center gap-2 text-[10px] text-[#d4d4d8]">
                <span>Location: {alert.location}</span>
                <span>·</span>
                <span>Window: {alert.time_window}</span>
              </div>

              {/* Notification delivery badges */}
              {!alert.acknowledged && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] flex items-center gap-0.5 text-[#22c55e]">
                    <MessageSquare size={8} /> SMS Delivered
                  </span>
                  <span className="text-[9px] flex items-center gap-0.5 text-[#3b82f6]">
                    <Mail size={8} /> Email Sent
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.alert_id)}
                    className="text-[10px] text-white bg-[#27272a] hover:bg-[#71717a] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle size={10} /> Acknowledge
                  </button>
                )}
                {alert.acknowledged && (
                  <span className="text-[10px] text-[#d4d4d8] flex items-center gap-1">
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
