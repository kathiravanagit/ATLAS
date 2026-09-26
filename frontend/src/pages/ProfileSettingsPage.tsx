import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Shield, Lock, Save, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, Building2, Hash } from 'lucide-react';
import { getUser, setTokens, getAccessToken, getRefreshToken, fetchProfile, updateProfile, changePassword, authFetch } from '@/lib/auth';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const storedUser = getUser() as Record<string, string> | null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [badge, setBadge] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [lastLogin, setLastLogin] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    inspector: 'Inspector',
    analyst: 'Analyst',
    bank_officer: 'Bank Officer',
  };

  useEffect(() => {
    if (storedUser) {
      setName(storedUser.name || '');
      setEmail(storedUser.email || '');
      setBadge(storedUser.badge || '');
      setDepartment(storedUser.department || '');
      setRole(storedUser.role || '');
    }
    fetchProfile().then(profile => {
      if (profile) {
        setName((profile.name as string) || '');
        setEmail((profile.email as string) || '');
        setBadge((profile.badge as string) || '');
        setDepartment((profile.department as string) || '');
        setRole((profile.role as string) || '');
        setCreatedAt(profile.created_at as string || '');
        setLastLogin(profile.last_login as string || '');
        // Update stored user
        const current = getUser() || {};
        const expires = parseInt(localStorage.getItem('atlas_token_expires') || '0') - Date.now();
        setTokens(getAccessToken() || '', getRefreshToken() || '', expires, { ...current, ...profile });
      }
    });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    const ok = await updateProfile({ name, badge, department });
    setProfileMsg(ok
      ? { type: 'success', text: 'Profile updated successfully.' }
      : { type: 'error', text: 'Failed to update profile. Please try again.' }
    );
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setChangingPw(true);
    const result = await changePassword(currentPassword, newPassword);
    setPasswordMsg(result.ok
      ? { type: 'success', text: 'Password changed successfully.' }
      : { type: 'error', text: result.error || 'Failed to change password.' }
    );
    if (result.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPw(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-white border border-[#D1D5DB] hover:border-[#9CA3AF] transition-colors"
        >
          <ArrowLeft size={16} className="text-[#6B7280]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">Profile Settings</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage your account details and security credentials</p>
        </div>
      </div>

      {/* Government Notice */}
      <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-[#3b82f6] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#3b82f6]">Government System Notice</p>
            <p className="text-xs text-[#6B7280] mt-1">
              This is a restricted government system. All actions are logged and audited.
              Unauthorized access or misuse is punishable under the IT Act, 2000.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white border border-[#D1D5DB] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D1D5DB]">
          <div className="flex items-center gap-2">
            <User size={16} className="text-[#3b82f6]" />
            <h2 className="text-sm font-semibold text-[#1F2937] uppercase tracking-wider">Personal Information</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#9CA3AF] cursor-not-allowed"
              />
              <p className="text-[10px] text-[#9CA3AF] mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Badge ID</label>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={badge}
                  onChange={e => setBadge(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="IPB-2026-XXXX"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Department</label>
              <div className="relative">
                <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Cybercrime Division"
                />
              </div>
            </div>
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3 border-t border-[#D1D5DB]">
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Role</label>
              <div className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#3b82f6] font-mono">
                {ROLE_LABELS[role] || role}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Account Created</label>
              <div className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#9CA3AF]">
                {createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Last Login</label>
              <div className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#9CA3AF]">
                {lastLogin ? new Date(lastLogin).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
          </div>

          {profileMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${profileMsg.type === 'success' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
              {profileMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-[#D1D5DB] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D1D5DB]">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#f59e0b]" />
            <h2 className="text-sm font-semibold text-[#1F2937] uppercase tracking-wider">Change Password</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 pr-10 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 pr-10 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#3b82f6] transition-colors"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          {passwordMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${passwordMsg.type === 'success' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
              {passwordMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {passwordMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={changingPw}
              className="flex items-center gap-2 px-5 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-[#1F2937] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Lock size={14} />
              {changingPw ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-[#9CA3AF] pb-8">
        <p>ATLAS — Advanced Threat Location & Alert System</p>
        <p className="mt-1">For Evaluation Use Only | SIH 2026 Prototype</p>
      </div>
    </motion.div>
  );
}
