import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, GraduationCap, Lock, Mail, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import { WORKSPACE_OWNER } from '../config/owner';

type AuthMode = 'login' | 'forgot' | 'reset';

export function AuthPage() {
  const { needsSetup, login, setupFirstAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await setupFirstAdmin({ name, email, password, seedSampleData });
      toast({
        variant: 'success',
        title: 'Administrator workspace initialized',
        description: seedSampleData
          ? 'Super Admin claimed and sample academic records loaded.'
          : 'Super Admin account claimed.',
      });
    } catch (err) {
      setError((err as Error).message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      toast({ variant: 'success', title: 'Signed in successfully' });
    } catch (err) {
      setError((err as Error).message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        skipAuthRefresh: true,
      });
      setInfoMessage(res.message);
    } catch (err) {
      setError((err as Error).message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password }),
        skipAuthRefresh: true,
      });
      setInfoMessage(res.message);
      setPassword('');
      setResetToken('');
      setMode('login');
    } catch (err) {
      setError((err as Error).message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 grid lg:grid-cols-2">
      {/* Left Architectural Visual Panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900">
        <img
          src="/src/assets/images/campus_arch_banner_1795587461939.jpg"
          alt="University academic atrium"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/30" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight leading-snug">
              Academic &amp; Student Management
            </span>
          </div>

          <div className="max-w-lg">
            <h1 className="font-display text-3xl font-semibold leading-tight text-balance">
              Academic operations, student records, and institutional analytics in one unified console.
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Built with role-based access control, validated data governance, real-time attendance tracking,
              and audit-logged administrative workflows.
            </p>
            <div className="mt-8 pt-6 border-t border-white/15 flex items-center gap-6 text-xs text-slate-300">
              <span>Role-Based Access</span>
              <span aria-hidden="true">·</span>
              <span>MongoDB Architecture</span>
              <span aria-hidden="true">·</span>
              <span>Audit Logged</span>
            </div>
            <p className="mt-3 text-xs text-slate-300/90">
              Workspace Owner: <span className="font-medium text-white">{WORKSPACE_OWNER.name}</span>
              <span aria-hidden="true"> · </span>
              <a
                href={`mailto:${WORKSPACE_OWNER.email}`}
                className="underline decoration-white/30 hover:text-white transition-colors"
              >
                {WORKSPACE_OWNER.email}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-display text-sm font-bold leading-tight">Academic &amp; Student Management</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="w-full max-w-md mx-auto my-auto py-8"
        >
          {needsSetup ? (
            <>
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>First-Run Administrator Setup</span>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Claim Super Admin Workspace
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Create the initial Super Admin account to lock public bootstrap access and enter the dashboard.
              </p>

              <form onSubmit={handleSetupSubmit} className="mt-6 space-y-4">
                {error && (
                  <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="setup-name" className="block text-sm font-medium mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="setup-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={WORKSPACE_OWNER.name}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-email" className="block text-sm font-medium mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="setup-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={WORKSPACE_OWNER.email}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-password" className="block text-sm font-medium mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedSampleData}
                    onChange={(e) => setSeedSampleData(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Include starter academic catalog (4 departments, 5 courses, and 12 student records) so charts and tables are ready to explore immediately.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Initializing Workspace...' : 'Create Super Admin & Enter'}
                </button>
              </form>
            </>
          ) : mode === 'login' ? (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Sign in to Academic &amp; Student Management
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Enter your administrator or staff credentials to access institutional records.
              </p>

              <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                {error && (
                  <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}
                {infoMessage && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                    {infoMessage}
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={WORKSPACE_OWNER.email}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-sm font-medium">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setInfoMessage(null);
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </>
          ) : mode === 'forgot' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
              <h2 className="font-display text-2xl font-bold tracking-tight">Reset Password</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Enter your administrator email or switch to token entry if your Super Admin issued a reset token.
              </p>

              <form onSubmit={handleForgotSubmit} className="mt-6 space-y-4">
                {error && (
                  <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}
                {infoMessage && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-sm text-blue-700 dark:text-blue-300">
                    {infoMessage}
                  </div>
                )}
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium mb-1.5">
                    Account Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={WORKSPACE_OWNER.email}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Request Reset Instructions'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfoMessage(null);
                    setMode('reset');
                  }}
                  className="w-full py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Already have a reset token? Enter token
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
              <h2 className="font-display text-2xl font-bold tracking-tight">Enter Reset Token</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Paste the one-time reset token and choose a new password.
              </p>

              <form onSubmit={handleResetSubmit} className="mt-6 space-y-4">
                {error && (
                  <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="reset-token" className="block text-sm font-medium mb-1.5">
                    Reset Token
                  </label>
                  <input
                    id="reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token"
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div>
                  <label htmlFor="reset-pass" className="block text-sm font-medium mb-1.5">
                    New Password
                  </label>
                  <input
                    id="reset-pass"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </motion.div>

        <div className="text-center space-y-1">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{WORKSPACE_OWNER.name}</span>
            <span aria-hidden="true"> · </span>
            <a
              href={`mailto:${WORKSPACE_OWNER.email}`}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {WORKSPACE_OWNER.email}
            </a>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Administrator accounts are provisioned internally. Public registration is disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
