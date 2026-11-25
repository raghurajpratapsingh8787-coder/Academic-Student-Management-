import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';
import {
  AdminModel,
  AttendanceModel,
  AuditLogModel,
  CourseModel,
  DepartmentModel,
  NotificationModel,
  SessionModel,
  SettingsModel,
  StudentModel,
} from '../models/mongooseModels';
import { UserRole } from '../utils/crypto';

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export interface AdminRecord {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  avatarUrl: string;
  departmentId: string | null;
  isActive: boolean;
  resetTokenHash: string | null;
  resetTokenExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRecord {
  _id: string;
  name: string;
  code: string;
  description: string;
  head: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRecord {
  _id: string;
  name: string;
  code: string;
  departmentId: string;
  durationYears: number;
  totalSemesters: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRecord {
  _id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say';
  dateOfBirth: string;
  profilePhoto: string;
  departmentId: string;
  courseId: string;
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

export interface AttendanceRecord {
  _id: string;
  studentId: string;
  departmentId: string;
  courseId: string;
  semester: number;
  date: string;
  status: AttendanceStatus;
  notes: string;
  markedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  _id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  readBy: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
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
  updatedAt: string;
}

export interface SessionRecord {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string;
  ip: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  _id: string;
  institutionName: string;
  academicYear: string;
  attendanceThreshold: number;
  allowStaffAttendanceEdit: boolean;
  updatedAt: string;
}

interface LocalDatabaseSnapshot {
  admins: AdminRecord[];
  departments: DepartmentRecord[];
  courses: CourseRecord[];
  students: StudentRecord[];
  attendance: AttendanceRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  sessions: SessionRecord[];
  settings: SettingsRecord;
}

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

let storageMode: 'mongodb' | 'local' = 'local';
const LOCAL_DB_PATH = path.join(env.dataDir, 'acadex-db.json');

const defaultSettings = (): SettingsRecord => ({
  _id: 'default',
  institutionName: 'Academic & Student Management',
  academicYear: '2026-2027',
  attendanceThreshold: 75,
  allowStaffAttendanceEdit: true,
  updatedAt: new Date().toISOString(),
});

function createEmptySnapshot(): LocalDatabaseSnapshot {
  return {
    admins: [],
    departments: [],
    courses: [],
    students: [],
    attendance: [],
    notifications: [],
    auditLogs: [],
    sessions: [],
    settings: defaultSettings(),
  };
}

function readLocal(): LocalDatabaseSnapshot {
  if (!fs.existsSync(env.dataDir)) {
    fs.mkdirSync(env.dataDir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initial = createEmptySnapshot();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseSnapshot>;
    return {
      admins: parsed.admins || [],
      departments: parsed.departments || [],
      courses: parsed.courses || [],
      students: parsed.students || [],
      attendance: parsed.attendance || [],
      notifications: parsed.notifications || [],
      auditLogs: parsed.auditLogs || [],
      sessions: parsed.sessions || [],
      settings: parsed.settings || defaultSettings(),
    };
  } catch {
    const fresh = createEmptySnapshot();
    writeLocal(fresh);
    return fresh;
  }
}

function writeLocal(data: LocalDatabaseSnapshot): void {
  if (!fs.existsSync(env.dataDir)) {
    fs.mkdirSync(env.dataDir, { recursive: true });
  }
  const tmpPath = `${LOCAL_DB_PATH}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, LOCAL_DB_PATH);
}

export async function initDatabase(): Promise<'mongodb' | 'local'> {
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
  }
  if (env.mongodbUri) {
    try {
      await mongoose.connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 5000,
      });
      storageMode = 'mongodb';
      const existingSettings = await SettingsModel.findById('default').lean();
      if (!existingSettings) {
        await SettingsModel.create(defaultSettings());
      }
      console.info('[DB] Connected to MongoDB via Mongoose');
      return storageMode;
    } catch (err) {
      console.info('[DB] MongoDB unavailable, using local persistent store:', (err as Error).message);
    }
  }
  storageMode = 'local';
  readLocal();
  console.info('[DB] Using local persistent store (.data/acadex-db.json). Set a valid MONGODB_URI to connect MongoDB.');
  return storageMode;
}

export function getStorageMode(): 'mongodb' | 'local' {
  return storageMode;
}

function toPlain<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export function newId(): string {
  return crypto.randomUUID();
}

export const db = {
  // ---------------- ADMINS ----------------
  async countAdmins(): Promise<number> {
    if (storageMode === 'mongodb') return AdminModel.countDocuments();
    return readLocal().admins.length;
  },

  async findAdminByEmail(email: string): Promise<AdminRecord | null> {
    const normalized = email.toLowerCase().trim();
    if (storageMode === 'mongodb') {
      const doc = await AdminModel.findOne({ email: normalized }).lean();
      return doc ? toPlain<AdminRecord>(doc) : null;
    }
    return readLocal().admins.find((a) => a.email === normalized) || null;
  },

  async findAdminById(id: string): Promise<AdminRecord | null> {
    if (storageMode === 'mongodb') {
      const doc = await AdminModel.findById(id).lean();
      return doc ? toPlain<AdminRecord>(doc) : null;
    }
    return readLocal().admins.find((a) => a._id === id) || null;
  },

  async findAdminByResetTokenHash(tokenHash: string): Promise<AdminRecord | null> {
    const now = Date.now();
    if (storageMode === 'mongodb') {
      const doc = await AdminModel.findOne({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { $gt: new Date(now) },
      }).lean();
      return doc ? toPlain<AdminRecord>(doc) : null;
    }
    return (
      readLocal().admins.find(
        (a) =>
          a.resetTokenHash === tokenHash &&
          a.resetTokenExpiresAt &&
          new Date(a.resetTokenExpiresAt).getTime() > now
      ) || null
    );
  },

  async listAdmins(): Promise<AdminRecord[]> {
    if (storageMode === 'mongodb') {
      const docs = await AdminModel.find().sort({ createdAt: -1 }).lean();
      return toPlain<AdminRecord[]>(docs);
    }
    return [...readLocal().admins].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createAdmin(input: Omit<AdminRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<AdminRecord> {
    const now = new Date().toISOString();
    const record: AdminRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };
    if (storageMode === 'mongodb') {
      const existing = await AdminModel.findOne({ email: input.email.toLowerCase() }).lean();
      if (existing) throw new ConflictError('An account with this email already exists');
      const created = await AdminModel.create(record);
      return toPlain<AdminRecord>(created.toObject());
    }
    const snap = readLocal();
    if (snap.admins.some((a) => a.email === record.email.toLowerCase())) {
      throw new ConflictError('An account with this email already exists');
    }
    snap.admins.push(record);
    writeLocal(snap);
    return record;
  },

  async updateAdmin(id: string, patch: Partial<AdminRecord>): Promise<AdminRecord | null> {
    if (storageMode === 'mongodb') {
      const updated = await AdminModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      return updated ? toPlain<AdminRecord>(updated) : null;
    }
    const snap = readLocal();
    const idx = snap.admins.findIndex((a) => a._id === id);
    if (idx === -1) return null;
    snap.admins[idx] = { ...snap.admins[idx], ...patch, updatedAt: new Date().toISOString() };
    writeLocal(snap);
    return snap.admins[idx];
  },

  // ---------------- SESSIONS ----------------
  async createSession(input: Omit<SessionRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const record: SessionRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };
    if (storageMode === 'mongodb') {
      const created = await SessionModel.create(record);
      return toPlain<SessionRecord>(created.toObject());
    }
    const snap = readLocal();
    snap.sessions.push(record);
    // Keep session store tidy (prune expired > 7 days old)
    const cutoff = Date.now() - 86400_000;
    snap.sessions = snap.sessions.filter((s) => new Date(s.expiresAt).getTime() > cutoff);
    writeLocal(snap);
    return record;
  },

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    if (storageMode === 'mongodb') {
      const doc = await SessionModel.findOne({ tokenHash }).lean();
      return doc ? toPlain<SessionRecord>(doc) : null;
    }
    return readLocal().sessions.find((s) => s.tokenHash === tokenHash) || null;
  },

  async revokeSession(id: string): Promise<void> {
    const revokedAt = new Date().toISOString();
    if (storageMode === 'mongodb') {
      await SessionModel.findByIdAndUpdate(id, { $set: { revokedAt } });
      return;
    }
    const snap = readLocal();
    const idx = snap.sessions.findIndex((s) => s._id === id);
    if (idx !== -1) {
      snap.sessions[idx].revokedAt = revokedAt;
      snap.sessions[idx].updatedAt = revokedAt;
      writeLocal(snap);
    }
  },

  async revokeAllUserSessions(userId: string): Promise<void> {
    const revokedAt = new Date().toISOString();
    if (storageMode === 'mongodb') {
      await SessionModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt } });
      return;
    }
    const snap = readLocal();
    for (const s of snap.sessions) {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = revokedAt;
        s.updatedAt = revokedAt;
      }
    }
    writeLocal(snap);
  },

  // ---------------- DEPARTMENTS ----------------
  async listDepartments(): Promise<DepartmentRecord[]> {
    if (storageMode === 'mongodb') {
      const docs = await DepartmentModel.find().sort({ name: 1 }).lean();
      return toPlain<DepartmentRecord[]>(docs);
    }
    return [...readLocal().departments].sort((a, b) => a.name.localeCompare(b.name));
  },

  async findDepartmentById(id: string): Promise<DepartmentRecord | null> {
    if (storageMode === 'mongodb') {
      const doc = await DepartmentModel.findById(id).lean();
      return doc ? toPlain<DepartmentRecord>(doc) : null;
    }
    return readLocal().departments.find((d) => d._id === id) || null;
  },

  async createDepartment(input: Omit<DepartmentRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<DepartmentRecord> {
    const now = new Date().toISOString();
    const record: DepartmentRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };
    if (storageMode === 'mongodb') {
      const dup = await DepartmentModel.findOne({
        $or: [{ code: input.code.toUpperCase() }, { name: input.name }],
      }).lean();
      if (dup) throw new ConflictError('Department name or code already exists');
      const created = await DepartmentModel.create(record);
      return toPlain<DepartmentRecord>(created.toObject());
    }
    const snap = readLocal();
    if (
      snap.departments.some(
        (d) =>
          d.code.toUpperCase() === input.code.toUpperCase() ||
          d.name.toLowerCase() === input.name.toLowerCase()
      )
    ) {
      throw new ConflictError('Department name or code already exists');
    }
    snap.departments.push(record);
    writeLocal(snap);
    return record;
  },

  async updateDepartment(id: string, patch: Partial<DepartmentRecord>): Promise<DepartmentRecord | null> {
    if (storageMode === 'mongodb') {
      if (patch.code || patch.name) {
        const dup = await DepartmentModel.findOne({
          _id: { $ne: id },
          $or: [
            ...(patch.code ? [{ code: patch.code.toUpperCase() }] : []),
            ...(patch.name ? [{ name: patch.name }] : []),
          ],
        }).lean();
        if (dup) throw new ConflictError('Department name or code already exists');
      }
      const updated = await DepartmentModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      return updated ? toPlain<DepartmentRecord>(updated) : null;
    }
    const snap = readLocal();
    const idx = snap.departments.findIndex((d) => d._id === id);
    if (idx === -1) return null;
    if (
      snap.departments.some(
        (d) =>
          d._id !== id &&
          ((patch.code && d.code.toUpperCase() === patch.code.toUpperCase()) ||
            (patch.name && d.name.toLowerCase() === patch.name.toLowerCase()))
      )
    ) {
      throw new ConflictError('Department name or code already exists');
    }
    snap.departments[idx] = { ...snap.departments[idx], ...patch, updatedAt: new Date().toISOString() };
    writeLocal(snap);
    return snap.departments[idx];
  },

  async deleteDepartment(id: string, reassignToDepartmentId?: string): Promise<void> {
    if (storageMode === 'mongodb') {
      const dept = await DepartmentModel.findById(id).lean();
      if (!dept) throw new NotFoundError('Department not found');
      const studentCount = await StudentModel.countDocuments({ departmentId: id });
      const courseCount = await CourseModel.countDocuments({ departmentId: id });
      if (studentCount > 0 || courseCount > 0) {
        if (!reassignToDepartmentId || reassignToDepartmentId === id) {
          throw new ConflictError(
            `Cannot delete department while ${studentCount} students and ${courseCount} courses are assigned. Select a target department to reassign them first.`
          );
        }
        const target = await DepartmentModel.findById(reassignToDepartmentId).lean();
        if (!target) throw new BadRequestError('Target reassignment department does not exist');
        await CourseModel.updateMany({ departmentId: id }, { $set: { departmentId: reassignToDepartmentId } });
        await StudentModel.updateMany({ departmentId: id }, { $set: { departmentId: reassignToDepartmentId } });
        await AttendanceModel.updateMany({ departmentId: id }, { $set: { departmentId: reassignToDepartmentId } });
      }
      await DepartmentModel.findByIdAndDelete(id);
      return;
    }

    const snap = readLocal();
    const idx = snap.departments.findIndex((d) => d._id === id);
    if (idx === -1) throw new NotFoundError('Department not found');
    const studentCount = snap.students.filter((s) => s.departmentId === id).length;
    const courseCount = snap.courses.filter((c) => c.departmentId === id).length;
    if (studentCount > 0 || courseCount > 0) {
      if (!reassignToDepartmentId || reassignToDepartmentId === id) {
        throw new ConflictError(
          `Cannot delete department while ${studentCount} students and ${courseCount} courses are assigned. Select a target department to reassign them first.`
        );
      }
      if (!snap.departments.some((d) => d._id === reassignToDepartmentId)) {
        throw new BadRequestError('Target reassignment department does not exist');
      }
      const now = new Date().toISOString();
      for (const c of snap.courses) {
        if (c.departmentId === id) {
          c.departmentId = reassignToDepartmentId;
          c.updatedAt = now;
        }
      }
      for (const s of snap.students) {
        if (s.departmentId === id) {
          s.departmentId = reassignToDepartmentId;
          s.updatedAt = now;
        }
      }
      for (const a of snap.attendance) {
        if (a.departmentId === id) {
          a.departmentId = reassignToDepartmentId;
        }
      }
    }
    snap.departments.splice(idx, 1);
    writeLocal(snap);
  },

  // ---------------- COURSES ----------------
  async listCourses(departmentId?: string): Promise<CourseRecord[]> {
    if (storageMode === 'mongodb') {
      const filter = departmentId ? { departmentId } : {};
      const docs = await CourseModel.find(filter).sort({ name: 1 }).lean();
      return toPlain<CourseRecord[]>(docs);
    }
    let items = readLocal().courses;
    if (departmentId) items = items.filter((c) => c.departmentId === departmentId);
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  },

  async findCourseById(id: string): Promise<CourseRecord | null> {
    if (storageMode === 'mongodb') {
      const doc = await CourseModel.findById(id).lean();
      return doc ? toPlain<CourseRecord>(doc) : null;
    }
    return readLocal().courses.find((c) => c._id === id) || null;
  },

  async createCourse(input: Omit<CourseRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<CourseRecord> {
    const dept = await db.findDepartmentById(input.departmentId);
    if (!dept) throw new BadRequestError('Selected department does not exist');
    const now = new Date().toISOString();
    const record: CourseRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };
    if (storageMode === 'mongodb') {
      const dup = await CourseModel.findOne({ code: input.code.toUpperCase() }).lean();
      if (dup) throw new ConflictError('Course code already exists');
      const created = await CourseModel.create(record);
      return toPlain<CourseRecord>(created.toObject());
    }
    const snap = readLocal();
    if (snap.courses.some((c) => c.code.toUpperCase() === input.code.toUpperCase())) {
      throw new ConflictError('Course code already exists');
    }
    snap.courses.push(record);
    writeLocal(snap);
    return record;
  },

  async updateCourse(id: string, patch: Partial<CourseRecord>): Promise<CourseRecord | null> {
    if (patch.departmentId) {
      const dept = await db.findDepartmentById(patch.departmentId);
      if (!dept) throw new BadRequestError('Selected department does not exist');
    }
    if (storageMode === 'mongodb') {
      if (patch.code) {
        const dup = await CourseModel.findOne({ _id: { $ne: id }, code: patch.code.toUpperCase() }).lean();
        if (dup) throw new ConflictError('Course code already exists');
      }
      const updated = await CourseModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      return updated ? toPlain<CourseRecord>(updated) : null;
    }
    const snap = readLocal();
    const idx = snap.courses.findIndex((c) => c._id === id);
    if (idx === -1) return null;
    if (patch.code && snap.courses.some((c) => c._id !== id && c.code.toUpperCase() === patch.code!.toUpperCase())) {
      throw new ConflictError('Course code already exists');
    }
    snap.courses[idx] = { ...snap.courses[idx], ...patch, updatedAt: new Date().toISOString() };
    writeLocal(snap);
    return snap.courses[idx];
  },

  async deleteCourse(id: string, reassignToCourseId?: string): Promise<void> {
    if (storageMode === 'mongodb') {
      const course = await CourseModel.findById(id).lean();
      if (!course) throw new NotFoundError('Course not found');
      const studentCount = await StudentModel.countDocuments({ courseId: id });
      if (studentCount > 0) {
        if (!reassignToCourseId || reassignToCourseId === id) {
          throw new ConflictError(
            `Cannot delete course while ${studentCount} students are enrolled. Select a replacement course to reassign them first.`
          );
        }
        const target = await CourseModel.findById(reassignToCourseId).lean();
        if (!target) throw new BadRequestError('Target replacement course does not exist');
        await StudentModel.updateMany(
          { courseId: id },
          { $set: { courseId: reassignToCourseId, departmentId: target.departmentId } }
        );
        await AttendanceModel.updateMany(
          { courseId: id },
          { $set: { courseId: reassignToCourseId, departmentId: target.departmentId } }
        );
      }
      await CourseModel.findByIdAndDelete(id);
      return;
    }

    const snap = readLocal();
    const idx = snap.courses.findIndex((c) => c._id === id);
    if (idx === -1) throw new NotFoundError('Course not found');
    const studentCount = snap.students.filter((s) => s.courseId === id).length;
    if (studentCount > 0) {
      if (!reassignToCourseId || reassignToCourseId === id) {
        throw new ConflictError(
          `Cannot delete course while ${studentCount} students are enrolled. Select a replacement course to reassign them first.`
        );
      }
      const target = snap.courses.find((c) => c._id === reassignToCourseId);
      if (!target) throw new BadRequestError('Target replacement course does not exist');
      const now = new Date().toISOString();
      for (const s of snap.students) {
        if (s.courseId === id) {
          s.courseId = reassignToCourseId;
          s.departmentId = target.departmentId;
          s.updatedAt = now;
        }
      }
      for (const a of snap.attendance) {
        if (a.courseId === id) {
          a.courseId = reassignToCourseId;
          a.departmentId = target.departmentId;
        }
      }
    }
    snap.courses.splice(idx, 1);
    writeLocal(snap);
  },

  // ---------------- STUDENTS ----------------
  async listStudents(query: {
    search?: string;
    departmentId?: string;
    courseId?: string;
    status?: string;
    semester?: number;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ items: StudentRecord[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const sortBy = ['fullName', 'studentId', 'enrollmentDate', 'semester', 'status', 'createdAt'].includes(
      query.sortBy || ''
    )
      ? (query.sortBy as keyof StudentRecord)
      : 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    if (storageMode === 'mongodb') {
      const filter: Record<string, unknown> = {};
      if (query.departmentId) filter.departmentId = query.departmentId;
      if (query.courseId) filter.courseId = query.courseId;
      if (query.status) filter.status = query.status;
      if (query.semester) filter.semester = query.semester;
      if (query.dateFrom || query.dateTo) {
        const range: Record<string, string> = {};
        if (query.dateFrom) range.$gte = query.dateFrom;
        if (query.dateTo) range.$lte = query.dateTo;
        filter.enrollmentDate = range;
      }
      if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'i');
        filter.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { city: rx }];
      }
      const total = await StudentModel.countDocuments(filter);
      const docs = await StudentModel.find(filter)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      return {
        items: toPlain<StudentRecord[]>(docs),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    let items = [...readLocal().students];
    if (query.departmentId) items = items.filter((s) => s.departmentId === query.departmentId);
    if (query.courseId) items = items.filter((s) => s.courseId === query.courseId);
    if (query.status) items = items.filter((s) => s.status === query.status);
    if (query.semester) items = items.filter((s) => s.semester === query.semester);
    if (query.dateFrom) items = items.filter((s) => s.enrollmentDate >= query.dateFrom!);
    if (query.dateTo) items = items.filter((s) => s.enrollmentDate <= query.dateTo!);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.fullName.toLowerCase().includes(needle) ||
          s.studentId.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle) ||
          s.city.toLowerCase().includes(needle)
      );
    }

    items.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });

    const total = items.length;
    const paged = items.slice((page - 1) * limit, page * limit);
    return {
      items: paged,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  async listAllStudents(): Promise<StudentRecord[]> {
    if (storageMode === 'mongodb') {
      const docs = await StudentModel.find().sort({ fullName: 1 }).lean();
      return toPlain<StudentRecord[]>(docs);
    }
    return [...readLocal().students].sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async findStudentById(id: string): Promise<StudentRecord | null> {
    if (storageMode === 'mongodb') {
      const doc = await StudentModel.findById(id).lean();
      return doc ? toPlain<StudentRecord>(doc) : null;
    }
    return readLocal().students.find((s) => s._id === id) || null;
  },

  async createStudent(input: Omit<StudentRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<StudentRecord> {
    const dept = await db.findDepartmentById(input.departmentId);
    if (!dept) throw new BadRequestError('Selected department does not exist');
    const course = await db.findCourseById(input.courseId);
    if (!course) throw new BadRequestError('Selected course does not exist');
    if (course.departmentId !== dept._id) {
      throw new BadRequestError('Selected course does not belong to the chosen department');
    }

    const now = new Date().toISOString();
    const record: StudentRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };

    if (storageMode === 'mongodb') {
      const dup = await StudentModel.findOne({
        $or: [{ studentId: input.studentId }, { email: input.email.toLowerCase() }],
      }).lean();
      if (dup) throw new ConflictError('Student ID or email address already exists');
      const created = await StudentModel.create(record);
      return toPlain<StudentRecord>(created.toObject());
    }

    const snap = readLocal();
    if (
      snap.students.some(
        (s) =>
          s.studentId.toLowerCase() === input.studentId.toLowerCase() ||
          s.email.toLowerCase() === input.email.toLowerCase()
      )
    ) {
      throw new ConflictError('Student ID or email address already exists');
    }
    snap.students.push(record);
    writeLocal(snap);
    return record;
  },

  async updateStudent(id: string, patch: Partial<StudentRecord>): Promise<StudentRecord | null> {
    const existing = await db.findStudentById(id);
    if (!existing) return null;

    const targetDeptId = patch.departmentId || existing.departmentId;
    const targetCourseId = patch.courseId || existing.courseId;
    if (patch.departmentId || patch.courseId) {
      const dept = await db.findDepartmentById(targetDeptId);
      if (!dept) throw new BadRequestError('Selected department does not exist');
      const course = await db.findCourseById(targetCourseId);
      if (!course) throw new BadRequestError('Selected course does not exist');
      if (course.departmentId !== dept._id) {
        throw new BadRequestError('Selected course does not belong to the chosen department');
      }
    }

    if (storageMode === 'mongodb') {
      if (patch.studentId || patch.email) {
        const dup = await StudentModel.findOne({
          _id: { $ne: id },
          $or: [
            ...(patch.studentId ? [{ studentId: patch.studentId }] : []),
            ...(patch.email ? [{ email: patch.email.toLowerCase() }] : []),
          ],
        }).lean();
        if (dup) throw new ConflictError('Student ID or email address already exists');
      }
      const updated = await StudentModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      return updated ? toPlain<StudentRecord>(updated) : null;
    }

    const snap = readLocal();
    const idx = snap.students.findIndex((s) => s._id === id);
    if (idx === -1) return null;
    if (
      snap.students.some(
        (s) =>
          s._id !== id &&
          ((patch.studentId && s.studentId.toLowerCase() === patch.studentId.toLowerCase()) ||
            (patch.email && s.email.toLowerCase() === patch.email.toLowerCase()))
      )
    ) {
      throw new ConflictError('Student ID or email address already exists');
    }
    snap.students[idx] = { ...snap.students[idx], ...patch, updatedAt: new Date().toISOString() };
    writeLocal(snap);
    return snap.students[idx];
  },

  async bulkUpdateStudentStatus(studentIds: string[], status: StudentStatus): Promise<number> {
    if (storageMode === 'mongodb') {
      const res = await StudentModel.updateMany({ _id: { $in: studentIds } }, { $set: { status } });
      return res.modifiedCount;
    }
    const snap = readLocal();
    const idSet = new Set(studentIds);
    const now = new Date().toISOString();
    let count = 0;
    for (const s of snap.students) {
      if (idSet.has(s._id)) {
        s.status = status;
        s.updatedAt = now;
        count++;
      }
    }
    writeLocal(snap);
    return count;
  },

  async deleteStudent(id: string): Promise<StudentRecord | null> {
    if (storageMode === 'mongodb') {
      const deleted = await StudentModel.findByIdAndDelete(id).lean();
      if (!deleted) return null;
      await AttendanceModel.deleteMany({ studentId: id });
      return toPlain<StudentRecord>(deleted);
    }
    const snap = readLocal();
    const idx = snap.students.findIndex((s) => s._id === id);
    if (idx === -1) return null;
    const [removed] = snap.students.splice(idx, 1);
    snap.attendance = snap.attendance.filter((a) => a.studentId !== id);
    writeLocal(snap);
    return removed;
  },

  // ---------------- ATTENDANCE ----------------
  async listAttendance(filters: {
    date?: string;
    month?: string;
    departmentId?: string;
    courseId?: string;
    semester?: number;
    studentId?: string;
  }): Promise<AttendanceRecord[]> {
    if (storageMode === 'mongodb') {
      const query: Record<string, unknown> = {};
      if (filters.date) query.date = filters.date;
      if (filters.month) query.date = { $regex: `^${filters.month.replace(/[^0-9-]/g, '')}` };
      if (filters.departmentId) query.departmentId = filters.departmentId;
      if (filters.courseId) query.courseId = filters.courseId;
      if (filters.semester) query.semester = filters.semester;
      if (filters.studentId) query.studentId = filters.studentId;
      const docs = await AttendanceModel.find(query).sort({ date: -1 }).lean();
      return toPlain<AttendanceRecord[]>(docs);
    }

    let items = readLocal().attendance;
    if (filters.date) items = items.filter((a) => a.date === filters.date);
    if (filters.month) items = items.filter((a) => a.date.startsWith(filters.month!));
    if (filters.departmentId) items = items.filter((a) => a.departmentId === filters.departmentId);
    if (filters.courseId) items = items.filter((a) => a.courseId === filters.courseId);
    if (filters.semester) items = items.filter((a) => a.semester === filters.semester);
    if (filters.studentId) items = items.filter((a) => a.studentId === filters.studentId);
    return [...items].sort((a, b) => b.date.localeCompare(a.date));
  },

  async upsertAttendanceBatch(
    date: string,
    markedBy: string,
    entries: Array<{ studentId: string; status: AttendanceStatus; notes: string }>
  ): Promise<number> {
    const allStudents = await db.listAllStudents();
    const studentMap = new Map(allStudents.map((s) => [s._id, s]));

    for (const entry of entries) {
      if (!studentMap.has(entry.studentId)) {
        throw new BadRequestError(`Student ${entry.studentId} does not exist`);
      }
    }

    const now = new Date().toISOString();
    if (storageMode === 'mongodb') {
      const ops = entries.map((entry) => {
        const student = studentMap.get(entry.studentId)!;
        return {
          updateOne: {
            filter: { studentId: entry.studentId, date },
            update: {
              $set: {
                departmentId: student.departmentId,
                courseId: student.courseId,
                semester: student.semester,
                status: entry.status,
                notes: entry.notes,
                markedBy,
              },
              $setOnInsert: { _id: newId() },
            },
            upsert: true,
          },
        };
      });
      await AttendanceModel.bulkWrite(ops);
      return entries.length;
    }

    const snap = readLocal();
    for (const entry of entries) {
      const student = studentMap.get(entry.studentId)!;
      const idx = snap.attendance.findIndex((a) => a.studentId === entry.studentId && a.date === date);
      if (idx !== -1) {
        snap.attendance[idx] = {
          ...snap.attendance[idx],
          departmentId: student.departmentId,
          courseId: student.courseId,
          semester: student.semester,
          status: entry.status,
          notes: entry.notes,
          markedBy,
          updatedAt: now,
        };
      } else {
        snap.attendance.push({
          _id: newId(),
          studentId: entry.studentId,
          departmentId: student.departmentId,
          courseId: student.courseId,
          semester: student.semester,
          date,
          status: entry.status,
          notes: entry.notes,
          markedBy,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    writeLocal(snap);
    return entries.length;
  },

  // ---------------- NOTIFICATIONS & AUDIT LOGS ----------------
  async listNotifications(): Promise<NotificationRecord[]> {
    if (storageMode === 'mongodb') {
      const docs = await NotificationModel.find().sort({ createdAt: -1 }).limit(30).lean();
      return toPlain<NotificationRecord[]>(docs);
    }
    return [...readLocal().notifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
  },

  async createNotification(input: {
    title: string;
    message: string;
    type?: 'INFO' | 'WARNING' | 'SUCCESS';
    createdBy?: string;
  }): Promise<NotificationRecord> {
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      _id: newId(),
      title: input.title,
      message: input.message,
      type: input.type || 'INFO',
      readBy: [],
      createdBy: input.createdBy || 'system',
      createdAt: now,
      updatedAt: now,
    };
    if (storageMode === 'mongodb') {
      const created = await NotificationModel.create(record);
      return toPlain<NotificationRecord>(created.toObject());
    }
    const snap = readLocal();
    snap.notifications.unshift(record);
    snap.notifications = snap.notifications.slice(0, 100);
    writeLocal(snap);
    return record;
  },

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    if (storageMode === 'mongodb') {
      await NotificationModel.findByIdAndUpdate(notificationId, { $addToSet: { readBy: userId } });
      return;
    }
    const snap = readLocal();
    const n = snap.notifications.find((item) => item._id === notificationId);
    if (n && !n.readBy.includes(userId)) {
      n.readBy.push(userId);
      writeLocal(snap);
    }
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (storageMode === 'mongodb') {
      await NotificationModel.updateMany({}, { $addToSet: { readBy: userId } });
      return;
    }
    const snap = readLocal();
    for (const n of snap.notifications) {
      if (!n.readBy.includes(userId)) n.readBy.push(userId);
    }
    writeLocal(snap);
  },

  async logAudit(input: Omit<AuditLogRecord, '_id' | 'createdAt' | 'updatedAt'>): Promise<AuditLogRecord> {
    const now = new Date().toISOString();
    const record: AuditLogRecord = { ...input, _id: newId(), createdAt: now, updatedAt: now };
    if (storageMode === 'mongodb') {
      const created = await AuditLogModel.create(record);
      return toPlain<AuditLogRecord>(created.toObject());
    }
    const snap = readLocal();
    snap.auditLogs.unshift(record);
    snap.auditLogs = snap.auditLogs.slice(0, 500);
    writeLocal(snap);
    return record;
  },

  async listAuditLogs(filters?: { entityId?: string; limit?: number }): Promise<AuditLogRecord[]> {
    const limit = filters?.limit || 50;
    if (storageMode === 'mongodb') {
      const query = filters?.entityId ? { entityId: filters.entityId } : {};
      const docs = await AuditLogModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      return toPlain<AuditLogRecord[]>(docs);
    }
    let items = [...readLocal().auditLogs];
    if (filters?.entityId) items = items.filter((l) => l.entityId === filters.entityId);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },

  // ---------------- SETTINGS ----------------
  async getSettings(): Promise<SettingsRecord> {
    if (storageMode === 'mongodb') {
      let doc = await SettingsModel.findById('default').lean();
      if (!doc) {
        const created = await SettingsModel.create(defaultSettings());
        doc = created.toObject();
      }
      return toPlain<SettingsRecord>(doc);
    }
    return readLocal().settings;
  },

  async updateSettings(patch: Partial<Omit<SettingsRecord, '_id' | 'updatedAt'>>): Promise<SettingsRecord> {
    const updatedAt = new Date().toISOString();
    if (storageMode === 'mongodb') {
      const doc = await SettingsModel.findByIdAndUpdate(
        'default',
        { $set: { ...patch, updatedAt } },
        { new: true, upsert: true }
      ).lean();
      return toPlain<SettingsRecord>(doc);
    }
    const snap = readLocal();
    snap.settings = { ...snap.settings, ...patch, updatedAt };
    writeLocal(snap);
    return snap.settings;
  },
};
