import { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AttendanceSummaryResponse, Course, Department, OverviewData, Student } from '../types';
import {
  downloadCsvFile,
  downloadExcelStudents,
  downloadSummaryReportPdf,
} from '../utils/formatters';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentStatusIndicator } from '../components/ui/StatusBadge';

interface ReportsResponse {
  overview: OverviewData;
  courseBreakdown: Array<{
    courseId: string;
    courseCode: string;
    courseName: string;
    departmentName: string;
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
  }>;
  attendanceSummary: AttendanceSummaryResponse;
  students: Student[];
}

export function ReportsPage() {
  const { settings } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');

  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<{ items: Department[] }>('/api/academic/departments'),
      apiRequest<{ items: Course[] }>('/api/academic/courses'),
    ])
      .then(([dRes, cRes]) => {
        setDepartments(dRes.items);
        setCourses(cRes.items);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (departmentId) qs.set('departmentId', departmentId);
      if (courseId) qs.set('courseId', courseId);
      if (status) qs.set('status', status);
      if (month) qs.set('month', month);
      const res = await apiRequest<ReportsResponse>(`/api/analytics/reports?${qs.toString()}`);
      setReport(res);
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to load reports', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [departmentId, courseId, status, month, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportCsv = () => {
    if (!report) return;
    const attMap = new Map(report.attendanceSummary.studentStats.map((a) => [a.studentId, a]));
    downloadCsvFile(
      `Academic_Student_Management_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Student ID', 'Full Name', 'Email', 'Department', 'Course', 'Semester', 'Status', 'Enrollment Date', 'Attendance %'],
      report.students.map((s) => {
        const att = attMap.get(s._id);
        return [
          s.studentId,
          s.fullName,
          s.email,
          s.departmentName || '',
          s.courseName || '',
          s.semester,
          s.status,
          s.enrollmentDate,
          att && att.percentage !== null ? `${att.percentage}%` : 'N/A',
        ];
      })
    );
    toast({ variant: 'success', title: 'CSV report downloaded' });
  };

  const handleExportExcel = async () => {
    if (!report) return;
    try {
      await downloadExcelStudents(
        `Academic_Student_Management_Students_${new Date().toISOString().slice(0, 10)}.xlsx`,
        report.students
      );
      toast({ variant: 'success', title: 'Excel workbook (.xlsx) downloaded' });
    } catch (err) {
      toast({ variant: 'error', title: 'Excel export failed', description: (err as Error).message });
    }
  };

  const handleExportPdf = () => {
    if (!report) return;
    downloadSummaryReportPdf({
      institutionName: settings?.institutionName || 'Academic & Student Management',
      students: report.students,
      attendanceStats: report.attendanceSummary.studentStats,
    });
    toast({ variant: 'success', title: 'PDF report downloaded' });
  };

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const filteredCourses = departmentId
    ? courses.filter((c) => c.departmentId === departmentId)
    : courses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Live database aggregations across enrollments, departments, courses, and attendance with multi-format export.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap shrink-0 items-center gap-2 no-print">
          <button
            type="button"
            disabled={!report || report.students.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={!report || report.students.length === 0}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            disabled={!report || report.students.length === 0}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div>
          <label htmlFor="rep-dept" className="block text-xs font-medium text-slate-500 mb-1">
            Department
          </label>
          <select
            id="rep-dept"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setCourseId('');
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rep-course" className="block text-xs font-medium text-slate-500 mb-1">
            Course
          </label>
          <select
            id="rep-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            <option value="">All Courses</option>
            {filteredCourses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rep-status" className="block text-xs font-medium text-slate-500 mb-1">
            Student Status
          </label>
          <select
            id="rep-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="GRADUATED">Graduated</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <div>
          <label htmlFor="rep-month" className="block text-xs font-medium text-slate-500 mb-1">
            Attendance Month
          </label>
          <input
            id="rep-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          />
        </div>
      </div>

      {loading || !report ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Students</p>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {report.overview.kpis.totalStudents}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Active / Inactive</p>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {report.overview.kpis.activeStudents} / {report.overview.kpis.inactiveStudents}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Attendance Sessions</p>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {report.attendanceSummary.totalSessionsMarked}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Attendance Rate</p>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {report.attendanceSummary.overallRate !== null
                  ? `${report.attendanceSummary.overallRate}%`
                  : 'No data'}
              </p>
            </div>
          </div>

          {/* Course-wise Breakdown Chart & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <h2 className="font-display text-base font-semibold mb-4">Course-Wise Enrollment</h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.courseBreakdown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="courseCode" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                      contentStyle={{
                        backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                        borderColor: theme === 'dark' ? '#1E293B' : '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="activeStudents" name="Active" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="inactiveStudents" name="Inactive" stackId="a" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-semibold">Course Summary Matrix</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <th className="px-4 py-2.5">Course</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                      <th className="px-4 py-2.5 text-right">Active</th>
                      <th className="px-4 py-2.5 text-right">Inactive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                    {report.courseBreakdown.map((c) => (
                      <tr key={c.courseId}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs">{c.courseName}</p>
                          <p className="text-[11px] font-mono text-slate-500">{c.courseCode}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-right">
                          {c.totalStudents}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                          {c.activeStudents}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-right text-amber-600 dark:text-amber-400">
                          {c.inactiveStudents}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Printable Detailed Roster */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Student Roster Report</h2>
              <span className="text-xs text-slate-500 tabular-nums">{report.students.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-4 py-2.5">Student ID</th>
                    <th className="px-4 py-2.5">Full Name</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Course</th>
                    <th className="px-4 py-2.5">Sem</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Enrollment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                  {report.students.map((s) => (
                    <tr key={s._id}>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{s.studentId}</td>
                      <td className="px-4 py-2.5 font-medium">{s.fullName}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {s.departmentName}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {s.courseName}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{s.semester}</td>
                      <td className="px-4 py-2.5">
                        <StudentStatusIndicator status={s.status} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-right">
                        {s.enrollmentDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
