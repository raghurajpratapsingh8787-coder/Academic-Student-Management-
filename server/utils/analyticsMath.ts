import type { AttendanceRecord, CourseRecord, DepartmentRecord, StudentRecord } from '../db/store';

export interface OverviewMetrics {
  kpis: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    newAdmissions: number;
    totalDepartments: number;
    totalCourses: number;
    admissionDeltaPct: number | null;
    activeRatioPct: number;
  };
  enrollmentByMonth: Array<{ month: string; enrolled: number; cumulative: number }>;
  monthlyAdmissions: Array<{ month: string; admissions: number }>;
  departmentDistribution: Array<{ name: string; code: string; count: number; percentage: number }>;
  statusBreakdown: Array<{ status: string; label: string; count: number }>;
}

export function computeOverviewMetrics(
  students: StudentRecord[],
  departments: DepartmentRecord[],
  courses: CourseRecord[],
  referenceDate: Date = new Date()
): OverviewMetrics {
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === 'ACTIVE').length;
  const inactiveStudents = students.filter((s) => s.status !== 'ACTIVE').length;

  const refTime = referenceDate.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const newAdmissions = students.filter((s) => {
    const t = new Date(s.enrollmentDate).getTime();
    return !Number.isNaN(t) && t >= refTime - thirtyDaysMs && t <= refTime + 86400_000;
  }).length;

  const prevAdmissions = students.filter((s) => {
    const t = new Date(s.enrollmentDate).getTime();
    return !Number.isNaN(t) && t >= refTime - 2 * thirtyDaysMs && t < refTime - thirtyDaysMs;
  }).length;

  const admissionDeltaPct =
    prevAdmissions > 0 ? Math.round(((newAdmissions - prevAdmissions) / prevAdmissions) * 100) : null;

  const activeRatioPct = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;

  // Build 12-month window ending in referenceDate's month
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }

  const admissionsByYm = new Map<string, number>();
  for (const ym of months) admissionsByYm.set(ym, 0);

  let baselineBeforeWindow = 0;
  const firstMonth = months[0];

  for (const s of students) {
    const ym = (s.enrollmentDate || '').slice(0, 7);
    if (ym < firstMonth) {
      baselineBeforeWindow++;
    } else if (admissionsByYm.has(ym)) {
      admissionsByYm.set(ym, (admissionsByYm.get(ym) || 0) + 1);
    }
  }

  let runningTotal = baselineBeforeWindow;
  const enrollmentByMonth = months.map((ym) => {
    const enrolled = admissionsByYm.get(ym) || 0;
    runningTotal += enrolled;
    const [yearStr, monStr] = ym.split('-');
    const label = new Date(Number(yearStr), Number(monStr) - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
    return {
      month: label,
      enrolled,
      cumulative: runningTotal,
    };
  });

  const monthlyAdmissions = enrollmentByMonth.slice(-6).map((m) => ({
    month: m.month,
    admissions: m.enrolled,
  }));

  const departmentDistribution = departments
    .map((dept) => {
      const count = students.filter((s) => s.departmentId === dept._id).length;
      return {
        name: dept.name,
        code: dept.code,
        count,
        percentage: totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    GRADUATED: 'Graduated',
    SUSPENDED: 'Suspended',
  };

  const statusBreakdown = (['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED'] as const)
    .map((status) => ({
      status,
      label: statusLabels[status],
      count: students.filter((s) => s.status === status).length,
    }))
    .filter((entry) => entry.count > 0 || entry.status === 'ACTIVE' || entry.status === 'INACTIVE');

  return {
    kpis: {
      totalStudents,
      activeStudents,
      inactiveStudents,
      newAdmissions,
      totalDepartments: departments.length,
      totalCourses: courses.length,
      admissionDeltaPct,
      activeRatioPct,
    },
    enrollmentByMonth,
    monthlyAdmissions,
    departmentDistribution,
    statusBreakdown,
  };
}

export interface StudentAttendanceStat {
  studentId: string;
  studentCode: string;
  fullName: string;
  departmentName: string;
  courseName: string;
  semester: number;
  totalMarked: number;
  present: number;
  late: number;
  absent: number;
  percentage: number | null;
}

export function computeAttendanceSummary(
  students: StudentRecord[],
  attendance: AttendanceRecord[],
  departments: DepartmentRecord[],
  courses: CourseRecord[]
): {
  overallRate: number | null;
  totalSessionsMarked: number;
  studentStats: StudentAttendanceStat[];
  byMonth: Array<{ month: string; present: number; late: number; absent: number; rate: number }>;
} {
  const deptMap = new Map(departments.map((d) => [d._id, d.name]));
  const courseMap = new Map(courses.map((c) => [c._id, c.name]));

  const attByStudent = new Map<string, AttendanceRecord[]>();
  for (const rec of attendance) {
    const list = attByStudent.get(rec.studentId) || [];
    list.push(rec);
    attByStudent.set(rec.studentId, list);
  }

  const studentStats: StudentAttendanceStat[] = students.map((s) => {
    const records = attByStudent.get(s._id) || [];
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const totalMarked = records.length;
    const percentage = totalMarked > 0 ? Math.round(((present + late * 0.5) / totalMarked) * 100) : null;
    return {
      studentId: s._id,
      studentCode: s.studentId,
      fullName: s.fullName,
      departmentName: deptMap.get(s.departmentId) || 'Unassigned',
      courseName: courseMap.get(s.courseId) || 'Unassigned',
      semester: s.semester,
      totalMarked,
      present,
      late,
      absent,
      percentage,
    };
  });

  const totalSessionsMarked = attendance.length;
  const totalPresent = attendance.filter((a) => a.status === 'PRESENT').length;
  const totalLate = attendance.filter((a) => a.status === 'LATE').length;
  const overallRate =
    totalSessionsMarked > 0
      ? Math.round(((totalPresent + totalLate * 0.5) / totalSessionsMarked) * 100)
      : null;

  const monthMap = new Map<string, { present: number; late: number; absent: number }>();
  for (const a of attendance) {
    const ym = a.date.slice(0, 7);
    const bucket = monthMap.get(ym) || { present: 0, late: 0, absent: 0 };
    if (a.status === 'PRESENT') bucket.present++;
    else if (a.status === 'LATE') bucket.late++;
    else bucket.absent++;
    monthMap.set(ym, bucket);
  }

  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => {
      const total = b.present + b.late + b.absent;
      return {
        month,
        present: b.present,
        late: b.late,
        absent: b.absent,
        rate: total > 0 ? Math.round(((b.present + b.late * 0.5) / total) * 100) : 0,
      };
    });

  return {
    overallRate,
    totalSessionsMarked,
    studentStats,
    byMonth,
  };
}
