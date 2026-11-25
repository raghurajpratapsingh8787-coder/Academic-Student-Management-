import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Shield, UserCheck, UserX, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AuditLogItem, AuthUser, Department, UserRole } from '../types';
import { formatRelativeTime } from '../utils/pureFormatters';
import { Skeleton } from '../components/ui/Skeleton';

export function SettingsPage() {
  const { user, settings, refreshSettings } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canViewAudit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [institutionName, setInstitutionName] = useState(settings?.institutionName || '');
  const [academicYear, setAcademicYear] = useState(settings?.academicYear || '');
  const [attendanceThreshold, setAttendanceThreshold] = useState(settings?.attendanceThreshold || 75);
  const [allowStaffAttendanceEdit, setAllowStaffAttendanceEdit] = useState(
    settings?.allowStaffAttendanceEdit ?? true
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('ADMIN');
  const [newDeptId, setNewDeptId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [issuedResetToken, setIssuedResetToken] = useState<{ email: string; token: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setInstitutionName(settings.institutionName);
      setAcademicYear(settings.academicYear);
      setAttendanceThreshold(settings.attendanceThreshold);
      setAllowStaffAttendanceEdit(settings.allowStaffAttendanceEdit);
    }
  }, [settings]);

  const loadGovernance = useCallback(async () => {
    setLoadingExtras(true);
    try {
      const promises: Promise<unknown>[] = [
        apiRequest<{ items: Department[] }>('/api/academic/departments').then((r) => setDepartments(r.items)),
      ];
      if (isSuperAdmin) {
        promises.push(
          apiRequest<{ items: AuthUser[] }>('/api/admins').then((r) => setAdmins(r.items))
        );
      }
      if (canViewAudit) {
        promises.push(
          apiRequest<{ items: AuditLogItem[] }>('/api/audit-logs?limit=30').then((r) =>
            setAuditLogs(r.items)
          )
        );
      }
      await Promise.all(promises);
    } catch {
      // ignore
    } finally {
      setLoadingExtras(false);
    }
  }, [isSuperAdmin, canViewAudit]);

  useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          institutionName,
          academicYear,
          attendanceThreshold: Number(attendanceThreshold),
          allowStaffAttendanceEdit,
        }),
      });
      await refreshSettings();
      toast({ variant: 'success', title: 'Institution settings saved' });
    } catch (err) {
      toast({ variant: 'error', title: 'Save failed', description: (err as Error).message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiRequest('/api/admins', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          password: newPassword,
          departmentId: newRole === 'STAFF' && newDeptId ? newDeptId : null,
        }),
      });
      toast({ variant: 'success', title: 'Account provisioned', description: `${newEmail} created as ${newRole}.` });
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      await loadGovernance();
    } catch (err) {
      toast({ variant: 'error', title: 'Provisioning failed', description: (err as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAdminActive = async (target: AuthUser) => {
    try {
      await apiRequest(`/api/admins/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      toast({
        variant: 'success',
        title: target.isActive ? 'Account suspended' : 'Account reactivated',
      });
      await loadGovernance();
    } catch (err) {
      toast({ variant: 'error', title: 'Update failed', description: (err as Error).message });
    }
  };

  const handleIssueResetToken = async (target: AuthUser) => {
    try {
      const res = await apiRequest<{ resetToken: string }>(`/api/admins/${target.id}/reset-token`, {
        method: 'POST',
      });
      setIssuedResetToken({ email: target.email, token: res.resetToken });
      toast({ variant: 'info', title: 'One-time reset token generated' });
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to generate token', description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings & Access Control</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Configure institutional parameters, administrator roles, and inspect security audit logs.
        </p>
      </div>

      {/* Institutional Settings */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold">Institutional Configuration</h2>
          {!isSuperAdmin && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Read-only (Super Admin required to modify)
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-inst" className="block text-xs font-medium mb-1.5">
              Institution Name
            </label>
            <input
              id="set-inst"
              disabled={!isSuperAdmin}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="set-year" className="block text-xs font-medium mb-1.5">
              Active Academic Year
            </label>
            <input
              id="set-year"
              disabled={!isSuperAdmin}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="set-thresh" className="block text-xs font-medium mb-1.5">
              Minimum Attendance Threshold (%)
            </label>
            <input
              id="set-thresh"
              type="number"
              min={50}
              max={100}
              disabled={!isSuperAdmin}
              value={attendanceThreshold}
              onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-60"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={allowStaffAttendanceEdit}
                onChange={(e) => setAllowStaffAttendanceEdit(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Allow Staff role to mark attendance
              </span>
            </label>
          </div>
          {isSuperAdmin && (
            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
              >
                {savingSettings ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Super Admin Team Management */}
      {isSuperAdmin && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-base font-semibold">Administrators & Staff</h2>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Provision Account
            </button>
          </div>

          {issuedResetToken && (
            <div className="m-4 p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 dark:text-blue-200">
                  One-Time Reset Token for {issuedResetToken.email}
                </span>
                <button
                  type="button"
                  onClick={() => setIssuedResetToken(null)}
                  className="text-blue-600 hover:underline"
                >
                  Dismiss
                </button>
              </div>
              <p className="font-mono break-all select-all text-blue-800 dark:text-blue-300">
                {issuedResetToken.token}
              </p>
            </div>
          )}

          {loadingExtras ? (
            <div className="p-6">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Sign-In</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                  {admins.map((adm) => (
                    <tr key={adm.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{adm.name}</p>
                        <p className="text-xs text-slate-500">{adm.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{adm.role}</td>
                      <td className="px-4 py-3 text-xs">
                        {adm.isActive ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">Suspended</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                        {adm.lastLoginAt ? formatRelativeTime(adm.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleIssueResetToken(adm)}
                            aria-label={`Issue password reset token for ${adm.email}`}
                            title="Generate one-time password reset token"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {adm.id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => handleToggleAdminActive(adm)}
                              aria-label={adm.isActive ? `Suspend ${adm.email}` : `Activate ${adm.email}`}
                              title={adm.isActive ? 'Suspend account' : 'Reactivate account'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              {adm.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Audit Logs */}
      {canViewAudit && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold">Security & Activity Audit Log</h2>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log._id} className="px-6 py-3 flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-900 dark:text-slate-100">{log.summary}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {log.actorEmail} ({log.actorRole}) · <span className="font-mono">{log.action}</span>
                  </p>
                </div>
                <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Provision Admin Modal */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">Provision Account</h2>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  aria-label="Close dialog"
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label htmlFor="adm-name" className="block text-xs font-medium mb-1">
                    Full Name *
                  </label>
                  <input
                    id="adm-name"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label htmlFor="adm-email" className="block text-xs font-medium mb-1">
                    Email *
                  </label>
                  <input
                    id="adm-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label htmlFor="adm-role" className="block text-xs font-medium mb-1">
                    Role *
                  </label>
                  <select
                    id="adm-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="ADMIN">Admin (Full Academic Management)</option>
                    <option value="STAFF">Staff (Scoped View & Attendance)</option>
                    <option value="SUPER_ADMIN">Super Admin (Full Governance)</option>
                  </select>
                </div>
                {newRole === 'STAFF' && (
                  <div>
                    <label htmlFor="adm-dept" className="block text-xs font-medium mb-1">
                      Scoped Department (Optional)
                    </label>
                    <select
                      id="adm-dept"
                      value={newDeptId}
                      onChange={(e) => setNewDeptId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="adm-pass" className="block text-xs font-medium mb-1">
                    Initial Password *
                  </label>
                  <input
                    id="adm-pass"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-60"
                  >
                    {creating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
