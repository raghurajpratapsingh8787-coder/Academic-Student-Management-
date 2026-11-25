import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Edit3, FileDown, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { StudentDetailResponse } from '../types';
import { downloadStudentProfilePdf, formatDisplayDate, formatRelativeTime } from '../utils/formatters';
import { AvatarImage } from '../components/ui/AvatarImage';
import { Skeleton } from '../components/ui/Skeleton';
import { AttendanceStatusIndicator, StudentStatusIndicator } from '../components/ui/StatusBadge';

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { toast } = useToast();

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<StudentDetailResponse>(`/api/students/${id}`);
      setDetail(res);
    } catch (err) {
      toast({ variant: 'error', title: 'Unable to load profile', description: (err as Error).message });
      navigate('/students');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'error', title: 'File too large', description: 'Maximum photo size is 2 MB.' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await apiRequest(`/api/students/${id}/photo`, { method: 'POST', body: fd });
      toast({ variant: 'success', title: 'Profile photo updated' });
      await loadDetail();
    } catch (err) {
      toast({ variant: 'error', title: 'Upload failed', description: (err as Error).message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { student, attendanceSummary, activityHistory } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/students')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              downloadStudentProfilePdf(
                student,
                attendanceSummary.attendanceRate,
                settings?.institutionName || 'Academic & Student Management'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
          {canManage && (
            <Link
              to={`/students/${student._id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Header Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <AvatarImage src={student.profilePhoto} name={student.fullName} size="xl" />
              {canManage && (
                <label
                  title="Update profile photo"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    aria-label="Upload new profile photo"
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight">{student.fullName}</h1>
                <StudentStatusIndicator status={student.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-mono tabular-nums">{student.studentId}</span>
                <span aria-hidden="true"> · </span>
                <span>{student.departmentName}</span>
                <span aria-hidden="true"> · </span>
                <span>{student.courseName}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {student.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {student.phone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {student.city}, {student.state}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Attendance Rate</p>
            <p className="text-2xl font-bold font-mono tabular-nums mt-0.5">
              {attendanceSummary.attendanceRate !== null ? `${attendanceSummary.attendanceRate}%` : 'No data'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {attendanceSummary.totalDays} session(s) recorded
            </p>
          </div>
        </div>
      </section>

      {/* Academic & Personal Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="font-display text-base font-semibold pb-3 border-b border-slate-200 dark:border-slate-800">
            Personal & Contact Information
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Gender</dt>
              <dd className="font-medium text-right">{student.gender}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Date of Birth</dt>
              <dd className="font-medium tabular-nums text-right">{formatDisplayDate(student.dateOfBirth)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
              <dd className="font-medium tabular-nums text-right">{student.phone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Street Address</dt>
              <dd className="font-medium text-right">{student.address}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">City / State / Postal</dt>
              <dd className="font-medium text-right">
                {student.city}, {student.state} {student.postalCode}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="font-display text-base font-semibold pb-3 border-b border-slate-200 dark:border-slate-800">
            Academic Information
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Student ID</dt>
              <dd className="font-mono tabular-nums font-medium">{student.studentId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Department</dt>
              <dd className="font-medium text-right">
                {student.departmentName} ({student.departmentCode})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Course / Program</dt>
              <dd className="font-medium text-right">
                {student.courseName} ({student.courseCode})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Current Semester</dt>
              <dd className="font-mono tabular-nums font-medium">Semester {student.semester}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Enrollment Date</dt>
              <dd className="font-medium tabular-nums text-right">
                {formatDisplayDate(student.enrollmentDate)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Attendance & Activity History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent Attendance</h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {attendanceSummary.presentCount} P · {attendanceSummary.lateCount} L · {attendanceSummary.absentCount} A
            </span>
          </div>
          {attendanceSummary.recentRecords.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
              No attendance sessions recorded for this student yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
              {attendanceSummary.recentRecords.map((rec) => (
                <div key={rec._id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-mono text-xs tabular-nums">{rec.date}</p>
                    {rec.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rec.notes}</p>
                    )}
                  </div>
                  <AttendanceStatusIndicator status={rec.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold">Profile Activity History</h2>
          </div>
          {activityHistory.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
              No recent profile changes logged.
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
              {activityHistory.map((act) => (
                <div key={act._id} className="px-6 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{act.summary}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {act.actorEmail} · <span className="font-mono">{act.action}</span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {formatRelativeTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
