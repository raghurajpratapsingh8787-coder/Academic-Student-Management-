import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Course, Department, PaginatedStudents, Student, StudentStatus } from '../types';
import { formatDisplayDate } from '../utils/pureFormatters';
import { AvatarImage } from '../components/ui/AvatarImage';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowsSkeleton } from '../components/ui/Skeleton';
import { StudentStatusIndicator } from '../components/ui/StatusBadge';

export function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [studentsData, setStudentsData] = useState<PaginatedStudents | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') || '');
  const [courseId, setCourseId] = useState(searchParams.get('courseId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'fullName' | 'studentId' | 'enrollmentDate' | 'semester'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<StudentStatus>('ACTIVE');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const paramSearch = searchParams.get('search') || '';
    if (paramSearch !== search) {
      setSearch(paramSearch);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (departmentId) qs.set('departmentId', departmentId);
      if (courseId) qs.set('courseId', courseId);
      if (status) qs.set('status', status);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      qs.set('sortBy', sortBy);
      qs.set('sortOrder', sortOrder);
      qs.set('page', String(page));
      qs.set('limit', String(limit));

      const data = await apiRequest<PaginatedStudents>(`/api/students?${qs.toString()}`);
      setStudentsData(data);
      setSelectedIds([]);
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to load students', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, courseId, status, dateFrom, dateTo, sortBy, sortOrder, page, limit, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const items = studentsData?.items || [];
  const allOnPageSelected = items.length > 0 && items.every((s) => selectedIds.includes(s._id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((s) => s._id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkStatusApply = async () => {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      const res = await apiRequest<{ updatedCount: number }>('/api/students/bulk-status', {
        method: 'PATCH',
        body: JSON.stringify({ studentIds: selectedIds, status: bulkStatus }),
      });
      toast({
        variant: 'success',
        title: `Updated ${res.updatedCount} student(s) to ${bulkStatus}`,
      });
      await fetchStudents();
    } catch (err) {
      toast({ variant: 'error', title: 'Bulk update failed', description: (err as Error).message });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/students/${deleteTarget._id}`, { method: 'DELETE' });
      toast({
        variant: 'success',
        title: 'Student removed',
        description: `${deleteTarget.fullName} (${deleteTarget.studentId}) was deleted safely.`,
      });
      setDeleteTarget(null);
      await fetchStudents();
    } catch (err) {
      toast({ variant: 'error', title: 'Delete failed', description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const filteredCourses = departmentId
    ? courses.filter((c) => c.departmentId === departmentId)
    : courses;

  const clearFilters = () => {
    setSearch('');
    setDepartmentId('');
    setCourseId('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setSearchParams({});
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Search, filter, update enrollment status, and manage complete student records.
          </p>
        </div>
        {canManage && (
          <Link
            to="/students/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </Link>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by student ID, name, email, or city..."
              aria-label="Search students"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setCourseId('');
                setPage(1);
              }}
              aria-label="Filter by department"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="GRADUATED">Graduated</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="filter-course" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Course
              </label>
              <select
                id="filter-course"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setPage(1);
                }}
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
              <label htmlFor="filter-date-from" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Admission From
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="filter-date-to" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Admission To
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={clearFilters}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Bulk Selection Bar */}
        {canManage && selectedIds.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 tabular-nums">
              {selectedIds.length} student(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as StudentStatus)}
                aria-label="Bulk status target"
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              >
                <option value="ACTIVE">Set Active</option>
                <option value="INACTIVE">Set Inactive</option>
                <option value="GRADUATED">Set Graduated</option>
                <option value="SUSPENDED">Set Suspended</option>
              </select>
              <button
                type="button"
                onClick={handleBulkStatusApply}
                disabled={bulkUpdating}
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 whitespace-nowrap"
              >
                {bulkUpdating ? 'Applying...' : 'Apply Bulk Status'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Data Table */}
      <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {canManage && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all students on page"
                      className="rounded border-slate-300 dark:border-slate-700"
                    />
                  </th>
                )}
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('fullName')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Student
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('studentId')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    ID
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Department / Course</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('semester')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Sem
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('enrollmentDate')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Admission
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={canManage ? 8 : 7} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Users className="w-8 h-8 text-slate-400" />
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        No matching students found
                      </p>
                      <p className="text-xs max-w-sm">
                        Adjust your search terms or filters, or enroll a new student record.
                      </p>
                      {canManage && (
                        <Link
                          to="/students/new"
                          className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                        >
                          Add First Student
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((student) => (
                  <tr
                    key={student._id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {canManage && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(student._id)}
                          onChange={() => toggleSelectOne(student._id)}
                          aria-label={`Select ${student.fullName}`}
                          className="rounded border-slate-300 dark:border-slate-700"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarImage src={student.profilePhoto} name={student.fullName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/students/${student._id}`}
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                          >
                            {student.fullName}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {student.studentId}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                        {student.departmentName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {student.courseName}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      Sem {student.semester}
                    </td>
                    <td className="px-4 py-3">
                      <StudentStatusIndicator status={student.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatDisplayDate(student.enrollmentDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${student._id}`)}
                          aria-label={`View profile for ${student.fullName}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${student._id}/edit`)}
                              aria-label={`Edit ${student.fullName}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(student)}
                              aria-label={`Delete ${student.fullName}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {items.map((student) => (
          <div
            key={student._id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarImage src={student.profilePhoto} name={student.fullName} size="md" />
                <div className="min-w-0">
                  <Link to={`/students/${student._id}`} className="font-semibold text-sm block truncate">
                    {student.fullName}
                  </Link>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {student.studentId} · Sem {student.semester}
                  </p>
                </div>
              </div>
              <StudentStatusIndicator status={student.status} />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
              <p>{student.departmentName} · {student.courseName}</p>
              <p className="truncate">{student.email}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 tabular-nums">
                Admitted {formatDisplayDate(student.enrollmentDate)}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  to={`/students/${student._id}`}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  View
                </Link>
                {canManage && (
                  <Link
                    to={`/students/${student._id}/edit`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Bar */}
      {studentsData && studentsData.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              Showing {(studentsData.page - 1) * studentsData.limit + 1}–
              {Math.min(studentsData.page * studentsData.limit, studentsData.total)} of{' '}
              {studentsData.total} students
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums px-2">
              Page {studentsData.page} of {studentsData.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= studentsData.totalPages}
              onClick={() => setPage((p) => Math.min(studentsData.totalPages, p + 1))}
              aria-label="Next page"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Student Record"
        description={`Are you sure you want to permanently remove ${deleteTarget?.fullName} (${deleteTarget?.studentId})? All associated attendance records for this student will also be removed.`}
        confirmLabel="Delete Student"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
