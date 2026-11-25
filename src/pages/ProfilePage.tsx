import React, { useState } from 'react';
import { Camera, KeyRound, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import { AvatarImage } from '../components/ui/AvatarImage';

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'error', title: 'Image exceeds 2 MB limit' });
      return;
    }
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await apiRequest('/api/files/admin-avatar', { method: 'POST', body: fd });
      await refreshUser();
      toast({ variant: 'success', title: 'Profile photo updated' });
    } catch (err) {
      toast({ variant: 'error', title: 'Upload failed', description: (err as Error).message });
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await apiRequest('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await refreshUser();
      toast({ variant: 'success', title: 'Profile updated' });
    } catch (err) {
      toast({ variant: 'error', title: 'Update failed', description: (err as Error).message });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast({
        variant: 'success',
        title: 'Password updated',
        description: 'All other sessions were revoked. Please sign in again.',
      });
      await logout();
    } catch (err) {
      toast({ variant: 'error', title: 'Password change failed', description: (err as Error).message });
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Manage your administrator identity, avatar photograph, and account security credentials.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <AvatarImage src={user?.avatarUrl} name={user?.name || 'Admin'} size="xl" />
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow">
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                aria-label="Upload avatar"
                className="sr-only"
              />
            </label>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">{user?.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
              Role: {user?.role}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium mb-1.5">
                Display Name
              </label>
              <input
                id="prof-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div>
              <label htmlFor="prof-email" className="block text-xs font-medium mb-1.5">
                Account Email
              </label>
              <input
                id="prof-email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-70"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingName}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingName ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-slate-500" />
          <h2 className="font-display text-base font-semibold">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cp-curr" className="block text-xs font-medium mb-1.5">
                Current Password
              </label>
              <input
                id="cp-curr"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div>
              <label htmlFor="cp-new" className="block text-xs font-medium mb-1.5">
                New Password
              </label>
              <input
                id="cp-new"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPass}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              {savingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
