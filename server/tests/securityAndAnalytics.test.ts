import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  detectImageSignature,
  hashPassword,
  resolveSafeFilePath,
  sanitizeNoSqlInput,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from '../utils/crypto';
import { computeAttendanceSummary, computeOverviewMetrics } from '../utils/analyticsMath';
import { isOriginAllowed, normalizeMongoUri } from '../config/env';
import { studentCreateSchema } from '../validators/schemas';
import type { AttendanceRecord, CourseRecord, DepartmentRecord, StudentRecord } from '../db/store';

test('scrypt password hashing verifies correct password and rejects wrong password', async () => {
  const hash = await hashPassword('AcadexStrong99!');
  assert.ok(hash.includes(':'));
  assert.equal(await verifyPassword('AcadexStrong99!', hash), true);
  assert.equal(await verifyPassword('WrongPass123!', hash), false);
});

test('JWT access token signs and verifies role and identity', () => {
  const token = signAccessToken({
    sub: 'admin-1',
    email: 'director@acadex.edu',
    name: 'Director Vance',
    role: 'SUPER_ADMIN',
  });
  const decoded = verifyAccessToken(token);
  assert.equal(decoded.sub, 'admin-1');
  assert.equal(decoded.role, 'SUPER_ADMIN');
  assert.equal(decoded.type, 'access');
});

test('sanitizeNoSqlInput strips $ operators, dotted keys, and prototype pollution keys', () => {
  const malicious = {
    email: 'admin@acadex.edu',
    $gt: '',
    nested: { $ne: null, safe: 'ok', 'a.b': 1 },
  };
  const cleaned = sanitizeNoSqlInput(malicious) as Record<string, unknown>;
  assert.equal('$gt' in cleaned, false);
  assert.equal(cleaned.email, 'admin@acadex.edu');
  const nested = cleaned.nested as Record<string, unknown>;
  assert.equal('$ne' in nested, false);
  assert.equal('a.b' in nested, false);
  assert.equal(nested.safe, 'ok');
});

test('detectImageSignature validates PNG/JPEG magic bytes and rejects fake scripts', () => {
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const svgFake = Buffer.from('<svg onload=alert(1)>');
  assert.deepEqual(detectImageSignature(pngBuf), { ext: '.png', mime: 'image/png' });
  assert.deepEqual(detectImageSignature(jpgBuf), { ext: '.jpg', mime: 'image/jpeg' });
  assert.equal(detectImageSignature(svgFake), null);
});

test('resolveSafeFilePath blocks path traversal attempts', () => {
  const base = path.resolve('/tmp/uploads');
  assert.equal(resolveSafeFilePath(base, '../../etc/passwd'), null);
  assert.equal(resolveSafeFilePath(base, 'avatar.svg'), null);
  assert.equal(
    resolveSafeFilePath(base, 'stu_123e4567-e89b-12d3.jpg'),
    path.join(base, 'stu_123e4567-e89b-12d3.jpg')
  );
});

test('computeOverviewMetrics and computeAttendanceSummary calculate real metrics accurately', () => {
  const depts: DepartmentRecord[] = [
    { _id: 'd1', name: 'Computer Science', code: 'CSE', description: 'CS', head: 'Dr. A', createdAt: '', updatedAt: '' },
  ];
  const courses: CourseRecord[] = [
    { _id: 'c1', name: 'B.S. CS', code: 'BS-CS', departmentId: 'd1', durationYears: 4, totalSemesters: 8, description: '', createdAt: '', updatedAt: '' },
  ];
  const students: StudentRecord[] = [
    {
      _id: 's1', studentId: 'STU-1', fullName: 'Alice', email: 'a@x.edu', phone: '1234567',
      gender: 'Female', dateOfBirth: '2004-01-01', profilePhoto: '', departmentId: 'd1',
      courseId: 'c1', semester: 3, enrollmentDate: '2026-11-10', address: '1 Main', city: 'SF',
      state: 'CA', postalCode: '94101', status: 'ACTIVE', createdAt: '', updatedAt: '',
    },
    {
      _id: 's2', studentId: 'STU-2', fullName: 'Bob', email: 'b@x.edu', phone: '1234568',
      gender: 'Male', dateOfBirth: '2004-02-01', profilePhoto: '', departmentId: 'd1',
      courseId: 'c1', semester: 3, enrollmentDate: '2025-05-10', address: '2 Main', city: 'SF',
      state: 'CA', postalCode: '94101', status: 'INACTIVE', createdAt: '', updatedAt: '',
    },
  ];
  const attendance: AttendanceRecord[] = [
    { _id: 'a1', studentId: 's1', departmentId: 'd1', courseId: 'c1', semester: 3, date: '2026-11-20', status: 'PRESENT', notes: '', markedBy: 'adm', createdAt: '', updatedAt: '' },
    { _id: 'a2', studentId: 's2', departmentId: 'd1', courseId: 'c1', semester: 3, date: '2026-11-20', status: 'LATE', notes: '', markedBy: 'adm', createdAt: '', updatedAt: '' },
  ];

  const overview = computeOverviewMetrics(students, depts, courses, new Date('2026-11-24T12:00:00Z'));
  assert.equal(overview.kpis.totalStudents, 2);
  assert.equal(overview.kpis.activeStudents, 1);
  assert.equal(overview.kpis.inactiveStudents, 1);
  assert.equal(overview.kpis.newAdmissions, 1);
  assert.equal(overview.kpis.activeRatioPct, 50);

  const att = computeAttendanceSummary(students, attendance, depts, courses);
  assert.equal(att.totalSessionsMarked, 2);
  assert.equal(att.overallRate, 75);
  assert.equal(att.studentStats[0].percentage, 100);
  assert.equal(att.studentStats[1].percentage, 50);
});

test('normalizeMongoUri handles placeholders, quotes, prefixes, and valid schemes', () => {
  assert.equal(normalizeMongoUri(undefined), '');
  assert.equal(normalizeMongoUri(''), '');
  assert.equal(normalizeMongoUri('MY_MONGODB_URI'), '');
  assert.equal(normalizeMongoUri('https://cloud.mongodb.com'), '');
  assert.equal(normalizeMongoUri('"mongodb+srv://user:pass@cluster.mongodb.net/acadex"'), 'mongodb+srv://user:pass@cluster.mongodb.net/acadex');
  assert.equal(normalizeMongoUri('MONGODB_URI=mongodb://127.0.0.1:27017/acadex'), 'mongodb://127.0.0.1:27017/acadex');
  assert.equal(normalizeMongoUri('MONGODB+SRV://host/db'), 'mongodb+srv://host/db');
});

test('isOriginAllowed permits same-host and allowlisted origins while rejecting cross-tenant run.app hosts', () => {
  const allowed = ['http://localhost:3000', 'https://ais-dev-example.asia-east1.run.app'];
  assert.equal(isOriginAllowed('https://ais-dev-example.asia-east1.run.app', 'ais-dev-example.asia-east1.run.app', allowed), true);
  assert.equal(isOriginAllowed('https://ais-pre-example.asia-east1.run.app', 'ais-pre-example.asia-east1.run.app', allowed), true);
  assert.equal(isOriginAllowed('https://attacker-123.us-central1.run.app', 'ais-dev-example.asia-east1.run.app', allowed), false);
  assert.equal(isOriginAllowed('https://evil.example', 'ais-dev-example.asia-east1.run.app', allowed), false);
});

test('studentCreateSchema rejects unsafe profilePhoto URL schemes and allows safe avatar paths', () => {
  const baseStudent = {
    studentId: 'STU-2026-500',
    fullName: 'Test Student',
    email: 'test.student@acadex.edu',
    phone: '+1 415 555 0199',
    gender: 'Female' as const,
    dateOfBirth: '2005-04-12',
    departmentId: 'dept-1',
    courseId: 'course-1',
    semester: 1,
    enrollmentDate: '2026-09-01',
    address: '100 Main St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    status: 'ACTIVE' as const,
  };
  assert.equal(studentCreateSchema.safeParse({ ...baseStudent, profilePhoto: 'javascript:alert(1)' }).success, false);
  assert.equal(studentCreateSchema.safeParse({ ...baseStudent, profilePhoto: 'data:text/html,<script>alert(1)</script>' }).success, false);
  assert.equal(studentCreateSchema.safeParse({ ...baseStudent, profilePhoto: '/api/files/avatars/stu_123.jpg' }).success, true);
  assert.equal(studentCreateSchema.safeParse({ ...baseStudent, profilePhoto: 'https://cdn.example.com/avatar.jpg' }).success, true);
});
