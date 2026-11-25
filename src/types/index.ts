export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  departmentId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt?: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  head: string;
  courseCount?: number;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  _id: string;
  name: string;
  code: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  durationYears: number;
  totalSemesters: number;
  description: string;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  _id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say';
  dateOfBirth: string;
  profilePhoto: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  courseId: string;
  courseName?: string;
  courseCode?: string;
  semester: number;
  enrollmentDate: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedStudents {
  items: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttendanceRecord {
  _id: string;
  studentId: string;
  studentCode?: string;
  studentName?: string;
  departmentId: string;
  departmentName?: string;
  courseId: string;
  courseName?: string;
  semester: number;
  date: string;
  status: AttendanceStatus;
  notes: string;
  markedBy: string;
  createdAt: string;
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

export interface AttendanceSummaryResponse {
  overallRate: number | null;
  totalSessionsMarked: number;
  studentStats: StudentAttendanceStat[];
  byMonth: Array<{ month: string; present: number; late: number; absent: number; rate: number }>;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  ip: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  read: boolean;
  createdAt: string;
}

export interface OverviewData {
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
  recentStudents: Array<{
    _id: string;
    studentId: string;
    fullName: string;
    status: StudentStatus;
    enrollmentDate: string;
    profilePhoto: string;
    departmentName: string;
  }>;
  recentActivities: AuditLogItem[];
}

export interface InstitutionSettings {
  _id: string;
  institutionName: string;
  academicYear: string;
  attendanceThreshold: number;
  allowStaffAttendanceEdit: boolean;
  updatedAt: string;
}

export interface StudentDetailResponse {
  student: Student;
  attendanceSummary: {
    totalDays: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number | null;
    recentRecords: AttendanceRecord[];
  };
  activityHistory: AuditLogItem[];
}
