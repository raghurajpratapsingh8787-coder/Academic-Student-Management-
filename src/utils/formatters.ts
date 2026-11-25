import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';
import type { Student, StudentAttendanceStat } from '../types';
import { buildCsvContent, formatDisplayDate } from './pureFormatters';

export * from './pureFormatters';

export function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  const csv = buildCsvContent(headers, rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExcelStudents(filename: string, students: Student[]): Promise<void> {
  const headerRow = [
    { value: 'Student ID', fontWeight: 'bold' as const },
    { value: 'Full Name', fontWeight: 'bold' as const },
    { value: 'Email', fontWeight: 'bold' as const },
    { value: 'Phone', fontWeight: 'bold' as const },
    { value: 'Department', fontWeight: 'bold' as const },
    { value: 'Course', fontWeight: 'bold' as const },
    { value: 'Semester', fontWeight: 'bold' as const },
    { value: 'Status', fontWeight: 'bold' as const },
    { value: 'Enrollment Date', fontWeight: 'bold' as const },
    { value: 'City', fontWeight: 'bold' as const },
  ];
  const dataRows: SheetData = students.map((s) => [
    { type: String, value: s.studentId },
    { type: String, value: s.fullName },
    { type: String, value: s.email },
    { type: String, value: s.phone },
    { type: String, value: s.departmentName || '' },
    { type: String, value: s.courseName || '' },
    { type: Number, value: s.semester },
    { type: String, value: s.status },
    { type: String, value: s.enrollmentDate },
    { type: String, value: s.city },
  ]);
  const sheetData: SheetData = [headerRow, ...dataRows];
  await writeXlsxFile([{ sheet: 'Students', data: sheetData }]).toFile(filename);
}

export function downloadStudentProfilePdf(
  student: Student,
  attendanceRate: number | null,
  institutionName: string
): void {
  const doc = new jsPDF();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(institutionName || 'Academic & Student Management', 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Student Profile Record  ·  Generated ${formatDisplayDate(new Date().toISOString())}`, 14, 24);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.text(student.fullName, 14, 48);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Student ID: ${student.studentId}   ·   Status: ${student.status}`, 14, 55);

  autoTable(doc, {
    startY: 63,
    head: [['Academic & Personal Attribute', 'Recorded Value']],
    body: [
      ['Email Address', student.email],
      ['Phone Number', student.phone],
      ['Gender', student.gender],
      ['Date of Birth', formatDisplayDate(student.dateOfBirth)],
      ['Department', `${student.departmentName || ''} (${student.departmentCode || ''})`],
      ['Course / Program', `${student.courseName || ''} (${student.courseCode || ''})`],
      ['Current Semester', `Semester ${student.semester}`],
      ['Enrollment Date', formatDisplayDate(student.enrollmentDate)],
      ['Attendance Rate', attendanceRate !== null ? `${attendanceRate}%` : 'No sessions recorded'],
      ['Residential Address', `${student.address}, ${student.city}, ${student.state} ${student.postalCode}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9.5, cellPadding: 4 },
  });

  doc.save(`${student.studentId}_Profile.pdf`);
}

export function downloadSummaryReportPdf(options: {
  institutionName: string;
  students: Student[];
  attendanceStats: StudentAttendanceStat[];
}): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`${options.institutionName} — Student & Attendance Summary Report`, 14, 14);
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${formatDisplayDate(new Date().toISOString())} · Total Records: ${options.students.length}`, 14, 22);

  const attMap = new Map(options.attendanceStats.map((a) => [a.studentId, a]));

  autoTable(doc, {
    startY: 34,
    head: [['Student ID', 'Full Name', 'Department', 'Course', 'Sem', 'Status', 'Enrollment', 'Attendance %']],
    body: options.students.map((s) => {
      const att = attMap.get(s._id);
      return [
        s.studentId,
        s.fullName,
        s.departmentName || '',
        s.courseName || '',
        String(s.semester),
        s.status,
        s.enrollmentDate,
        att && att.percentage !== null ? `${att.percentage}%` : '—',
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  doc.save(`Academic_Student_Management_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
