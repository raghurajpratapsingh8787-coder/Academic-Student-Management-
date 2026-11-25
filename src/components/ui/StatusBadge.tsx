import { CheckCircle2, Clock, GraduationCap, MinusCircle, ShieldAlert } from 'lucide-react';
import type { AttendanceStatus, StudentStatus } from '../../types';

export function StudentStatusIndicator({ status }: { status: StudentStatus }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Active
        </span>
      );
    case 'INACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
          Inactive
        </span>
      );
    case 'GRADUATED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">
          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
          Graduated
        </span>
      );
    case 'SUSPENDED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          Suspended
        </span>
      );
  }
}

export function AttendanceStatusIndicator({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case 'PRESENT':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Present
        </span>
      );
    case 'LATE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Late
        </span>
      );
    case 'ABSENT':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
          Absent
        </span>
      );
  }
}
