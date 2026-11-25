import mongoose, { Schema } from 'mongoose';

const adminSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'STAFF'], required: true, default: 'ADMIN' },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    departmentId: { type: String, ref: 'Department', default: null },
    isActive: { type: Boolean, default: true },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, _id: false }
);

const departmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, required: true, trim: true },
    head: { type: String, required: true, trim: true },
  },
  { timestamps: true, _id: false }
);

const courseSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    departmentId: { type: String, ref: 'Department', required: true, index: true },
    durationYears: { type: Number, required: true, min: 1, max: 8 },
    totalSemesters: { type: Number, required: true, min: 1, max: 16 },
    description: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

const studentSchema = new Schema(
  {
    _id: { type: String, required: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['Female', 'Male', 'Non-binary', 'Prefer not to say'], required: true },
    dateOfBirth: { type: String, required: true },
    profilePhoto: { type: String, default: '' },
    departmentId: { type: String, ref: 'Department', required: true, index: true },
    courseId: { type: String, ref: 'Course', required: true, index: true },
    semester: { type: Number, required: true, min: 1, max: 12, index: true },
    enrollmentDate: { type: String, required: true, index: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true, _id: false }
);

const attendanceSchema = new Schema(
  {
    _id: { type: String, required: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    departmentId: { type: String, ref: 'Department', required: true, index: true },
    courseId: { type: String, ref: 'Course', required: true, index: true },
    semester: { type: Number, required: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE'], required: true },
    notes: { type: String, default: '' },
    markedBy: { type: String, ref: 'Admin', required: true },
  },
  { timestamps: true, _id: false }
);
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS'], default: 'INFO' },
    readBy: { type: [String], default: [] },
    createdBy: { type: String, default: 'system' },
  },
  { timestamps: true, _id: false }
);

const auditLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    ip: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, ref: 'Admin', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

const settingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    institutionName: { type: String, default: 'Academic & Student Management' },
    academicYear: { type: String, default: '2026-2027' },
    attendanceThreshold: { type: Number, default: 75 },
    allowStaffAttendanceEdit: { type: Boolean, default: true },
  },
  { timestamps: true, _id: false }
);

export const AdminModel = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export const DepartmentModel = mongoose.models.Department || mongoose.model('Department', departmentSchema);
export const CourseModel = mongoose.models.Course || mongoose.model('Course', courseSchema);
export const StudentModel = mongoose.models.Student || mongoose.model('Student', studentSchema);
export const AttendanceModel = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
export const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);
export const SettingsModel = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
