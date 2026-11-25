import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Building2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { OverviewData } from '../types';
import { formatDisplayDate, formatRelativeTime } from '../utils/pureFormatters';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { AvatarImage } from '../components/ui/AvatarImage';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentStatusIndicator } from '../components/ui/StatusBadge';
import { WORKSPACE_OWNER } from '../config/owner';

const PIE_COLORS = ['#16A34A', '#D97706', '#2563EB', '#DC2626'];

export function OverviewPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<OverviewData>('/api/analytics/overview')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError((err as Error).message || 'Failed to load analytics');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#1E293B' : '#E2E8F0',
    borderRadius: '8px',
    fontSize: '12px',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-300">
        {error || 'Unable to display overview analytics.'}
      </div>
    );
  }

  const canAddStudent = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const kpiCards = [
    {
      label: 'Total Students',
      value: data.kpis.totalStudents,
      icon: Users,
      sub: `${data.kpis.activeRatioPct}% currently active`,
      accent: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
    },
    {
      label: 'Active Students',
      value: data.kpis.activeStudents,
      icon: UserCheck,
      sub: 'Enrolled in active term',
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      label: 'Inactive Students',
      value: data.kpis.inactiveStudents,
      icon: UserMinus,
      sub: 'Inactive, graduated, or suspended',
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      label: 'New Admissions (30d)',
      value: data.kpis.newAdmissions,
      icon: TrendingUp,
      sub:
        data.kpis.admissionDeltaPct !== null
          ? `${data.kpis.admissionDeltaPct >= 0 ? '+' : ''}${data.kpis.admissionDeltaPct}% vs prior 30 days`
          : 'Enrolled in last 30 days',
      accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      label: 'Total Departments',
      value: data.kpis.totalDepartments,
      icon: Building2,
      sub: 'Academic faculties',
      accent: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
    },
    {
      label: 'Total Courses',
      value: data.kpis.totalCourses,
      icon: BookOpen,
      sub: 'Active degree programs',
      accent: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Executive Overview
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Live institutional enrollment, departmental distribution, and recent administrative activity.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">{WORKSPACE_OWNER.name}</span>
            <span aria-hidden="true">·</span>
            <a
              href={`mailto:${WORKSPACE_OWNER.email}`}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {WORKSPACE_OWNER.email}
            </a>
          </p>
        </div>
        {canAddStudent && (
          <Link
            to="/students/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </Link>
        )}
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    <AnimatedNumber value={card.value} />
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{card.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Student Enrollment Growth</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                12-month cumulative enrolled student headcount
              </p>
            </div>
          </div>
          <div className="h-64 w-full" data-testid="chart-enrollment-growth">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.enrollmentByMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Total Enrolled"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#enrollmentFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Monthly Admissions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New enrollments recorded over the last 6 months
              </p>
            </div>
          </div>
          <div className="h-64 w-full" data-testid="chart-monthly-admissions">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyAdmissions} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                />
                <Bar dataKey="admissions" name="New Admissions" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold">Department Distribution</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Headcount across registered academic departments
            </p>
          </div>
          {data.departmentDistribution.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No departments configured yet.
            </div>
          ) : (
            <div className="h-56 w-full" data-testid="chart-department-dist">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.departmentDistribution}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="code"
                    width={52}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                  />
                  <Bar dataKey="count" name="Students" fill="#0EA5E9" radius={[0, 6, 6, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold">Student Status Breakdown</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active vs inactive student composition
            </p>
          </div>
          <div className="h-44 w-full" data-testid="chart-status-breakdown">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {data.statusBreakdown.map((entry, i) => (
                    <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {data.statusBreakdown.map((entry, i) => (
              <div key={entry.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span>{entry.label}</span>
                </div>
                <span className="font-mono tabular-nums font-medium">{entry.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Row: Recent Admissions & Administrative Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recently Enrolled Students</h2>
            <Link
              to="/students"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              View Directory
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {data.recentStudents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No students enrolled yet.
              </div>
            ) : (
              data.recentStudents.map((s) => (
                <Link
                  key={s._id}
                  to={`/students/${s._id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarImage src={s.profilePhoto} name={s.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {s.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        <span className="font-mono tabular-nums">{s.studentId}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{s.departmentName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <StudentStatusIndicator status={s.status} />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      {formatDisplayDate(s.enrollmentDate)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent Activity</h2>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
            {data.recentActivities.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No administrative activity recorded yet.
              </div>
            ) : (
              data.recentActivities.map((act) => (
                <div key={act._id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">
                      {act.summary}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {act.actorEmail}
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono">{act.action}</span>
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                    {formatRelativeTime(act.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
