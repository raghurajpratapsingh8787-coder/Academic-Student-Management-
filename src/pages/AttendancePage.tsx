import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, Check, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummaryResponse,
  Course,
  Department,
  PaginatedStudents,
  Student,
} from '../types';
import { AvatarImage } from '../components/ui/AvatarImage';
import { Skeleton, TableRowsSkeleton } from '../components/ui/Skeleton';
import { AttendanceStatusIndicator } from '../components/ui/StatusBadge';

type AttendanceTab = 'mark' | 'history' | 'summary';

export function AttendancePage() {
  const { user, settings } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<AttendanceTab>('mark');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [departmentId, setDepartmentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const canMarkAttendance =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    (user?.role === 'STAFF' && settings?.allowStaffAttendanceEdit !== false);

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

  const loadTabData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (departmentId) qs.set('departmentId', departmentId);
      if (courseId) qs.set('courseId', courseId);
      if (semester) qs.set('semester', semester);

      if (tab === 'mark') {
        qs.set('limit', '100');
        qs.set('status', 'ACTIVE');
        const attQs = new URLSearchParams();
        attQs.set('date', date);
        if (departmentId) attQs.set('departmentId', departmentId);
        if (courseId) attQs.set('courseId', courseId);
        if (semester) attQs.set('semester', semester);

        const [sRes, aRes] = await Promise.all([
          apiRequest<PaginatedStudents>(`/api/students?${qs.toString()}`),
          apiRequest<{ items: AttendanceRecord[] }>(`/api/attendance?${attQs.toString()}`),
        ]);
        setStudents(sRes.items);

        const existingMap = new Map(aRes.items.map((r) => [r.studentId, r]));
        const nextStatuses: Record<string, AttendanceStatus> = {};
        const nextNotes: Record<string, string> = {};
        for (const st of sRes.items) {
          const rec = existingMap.get(st._id);
          nextStatuses[st._id] = rec ? rec.status : 'PRESENT';
          nextNotes[st._id] = rec?.notes || '';
        }
        setDraftStatuses(nextStatuses);
        setDraftNotes(nextNotes);
      } else if (tab === 'history') {
        if (month) qs.set('month', month);
        const res = await apiRequest<{ items: AttendanceRecord[] }>(`/api/attendance?${qs.toString()}`);
        setHistoryRecords(res.items);
      } else {
        if (month) qs.set('month', month);
        const res = await apiRequest<AttendanceSummaryResponse>(`/api/attendance/summary?${qs.toString()}`);
        setSummary(res);
      }
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to load attendance', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [tab, date, month, departmentId, courseId, semester, toast]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    for (const st of students) {
      updated[st._id] = status;
    }
    setDraftStatuses(updated);
  };

  const handleSaveAttendance = async () => {
    if (students.length === 0) return;
    setSaving(true);
    try {
      const records = students.map((st) => ({
        studentId: st._id,
        status: draftStatuses[st._id] || 'PRESENT',
        notes: draftNotes[st._id] || '',
      }));
      const res = await apiRequest<{ count: number }>('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ date, records }),
      });
      toast({
        variant: 'success',
        title: 'Attendance saved',
        description: `Recorded attendance for ${res.count} student(s) on ${date}.`,
      });
    } catch (err) {
      toast({ variant: 'error', title: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = departmentId
    ? courses.filter((c) => c.departmentId === departmentId)
    : courses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Mark daily session attendance, review historical logs, and track real student percentages.
          </p>
        </div>

        {/* Segmented Control */}
        <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 self-start">
          {(
            [
              { id: 'mark', label: 'Mark Daily' },
              { id: 'history', label: 'Records' },
              { id: 'summary', label: 'Percentages' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tab === 'mark' ? (
          <div>
            <label htmlFor="att-date" className="block text-xs font-medium text-slate-500 mb-1">
              Session Date
            </label>
            <input
              id="att-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="att-month" className="block text-xs font-medium text-slate-500 mb-1">
              Month Filter
            </label>
            <input
              id="att-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
            />
          </div>
        )}

        <div>
          <label htmlFor="att-dept" className="block text-xs font-medium text-slate-500 mb-1">
            Department
          </label>
          <select
            id="att-dept"
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
          <label htmlFor="att-course" className="block text-xs font-medium text-slate-500 mb-1">
            Course
          </label>
          <select
            id="att-course"
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
          <label htmlFor="att-sem" className="block text-xs font-medium text-slate-500 mb-1">
            Semester
          </label>
          <select
            id="att-sem"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: Mark Daily Attendance */}
      {tab === 'mark' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold tabular-nums">
              {students.length} Active Student(s) · {date}
            </span>
            {canMarkAttendance && students.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAll('PRESENT')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">ID / Semester</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                {loading ? (
                  <TableRowsSkeleton rows={5} cols={4} />
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No active students match the selected filters.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => {
                    const current = draftStatuses[st._id] || 'PRESENT';
                    return (
                      <tr key={st._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarImage src={st.profilePhoto} name={st.fullName} size="sm" />
                            <div>
                              <p className="font-medium">{st.fullName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {st.departmentCode} · {st.courseCode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums">
                          {st.studentId} · Sem {st.semester}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
                            {(['PRESENT', 'LATE', 'ABSENT'] as const).map((statusOption) => {
                              const active = current === statusOption;
                              const activeColor =
                                statusOption === 'PRESENT'
                                  ? 'bg-emerald-600 text-white'
                                  : statusOption === 'LATE'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-rose-600 text-white';
                              return (
                                <button
                                  key={statusOption}
                                  type="button"
                                  disabled={!canMarkAttendance}
                                  onClick={() =>
                                    setDraftStatuses((prev) => ({ ...prev, [st._id]: statusOption }))
                                  }
                                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                    active
                                      ? activeColor
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  {statusOption === 'PRESENT' && active && <Check className="w-3 h-3 inline mr-1" />}
                                  {statusOption.charAt(0) + statusOption.slice(1).toLowerCase()}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            disabled={!canMarkAttendance}
                            value={draftNotes[st._id] || ''}
                            onChange={(e) =>
                              setDraftNotes((prev) => ({ ...prev, [st._id]: e.target.value }))
                            }
                            placeholder="Optional remark"
                            aria-label={`Attendance note for ${st.fullName}`}
                            className="w-full max-w-xs px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: History Records */}
      {tab === 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Department / Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                {loading ? (
                  <TableRowsSkeleton rows={5} cols={5} />
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <CalendarCheck2 className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                      No attendance records logged for the selected month and filters.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((rec) => (
                    <tr key={rec._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">{rec.date}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{rec.studentName}</p>
                        <p className="text-xs font-mono text-slate-500">{rec.studentCode}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {rec.departmentName} · {rec.courseName}
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceStatusIndicator status={rec.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {rec.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Student-wise Percentages & Monthly Breakdown */}
      {tab === 'summary' && (
        <div className="space-y-6">
          {loading || !summary ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recorded Sessions</p>
                  <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums">
                    {summary.totalSessionsMarked}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Overall Attendance Rate</p>
                  <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums">
                    {summary.overallRate !== null ? `${summary.overallRate}%` : 'No records'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target Threshold</p>
                  <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums">
                    {settings?.attendanceThreshold || 75}%
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3 text-right">Marked</th>
                        <th className="px-4 py-3 text-right">Present</th>
                        <th className="px-4 py-3 text-right">Late</th>
                        <th className="px-4 py-3 text-right">Absent</th>
                        <th className="px-4 py-3 text-right">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                      {summary.studentStats.map((st) => (
                        <tr key={st.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <p className="font-medium">{st.fullName}</p>
                            <p className="text-xs font-mono text-slate-500">{st.studentCode}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            {st.departmentName}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-right">{st.totalMarked}</td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                            {st.present}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-right text-amber-600 dark:text-amber-400">
                            {st.late}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-right text-rose-600 dark:text-rose-400">
                            {st.absent}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-right font-semibold">
                            {st.percentage !== null ? `${st.percentage}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
