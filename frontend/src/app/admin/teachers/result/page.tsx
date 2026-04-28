"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Edit3,
  X,
  Plus,
  Users,
  BookOpen,
  Award,
  TrendingUp,
  FileText,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  CheckSquare,
  Square,
  ChevronsUpDown,
  Check,
  Loader2,
  Clock,
  ClipboardList,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentUserProfile,
  createResult,
  updateResult,
  getMyResults,
  checkMidTerm,
  submitResult,
  forwardResult,
  forwardClassResults,
  calculatePositions,
  getTeacherStudents,
  getStudentMonthlyAttendance,
  ResultData,
  Result,
  SubjectMark,
  Student
} from "@/lib/api";
import { authorizedFetch } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions, getCurrentUserRole } from "@/lib/permissions";
import { ReportCard } from "@/components/admin/report-card";
import ResultBulkUpload from '@/components/admin/ResultBulkUpload';
import { Printer, CheckCircle2, Download } from "lucide-react";
import {
  getSubjects,
  findCoordinatorByEmployeeCode,
  getAvailableSubjects
} from "@/lib/api";
import { generateBulkReportCardsPDF, generateSeparateReportCardsPDFs } from "@/utils/bulkPdfGenerator";

const SUBJECTS = [
  { name: 'quran_majeed', display: 'Quran Majeed', has_practical: false, exclude_monthly: true },
  { name: 'islamiat', display: 'Islamiat', has_practical: false },

  // Bulk Upload Modal (rendered with other modals)

  { name: 'urdu_written', display: 'Urdu (Written)', has_practical: false },
  { name: 'urdu_oral', display: 'Urdu (Oral)', has_practical: false, is_oral: true, exclude_monthly: true },
  { name: 'sindhi_written', display: 'Sindhi (Written)', has_practical: false },
  { name: 'english_written', display: 'English (Written)', has_practical: false },
  { name: 'english_oral', display: 'English (Oral)', has_practical: false, is_oral: true, exclude_monthly: true },
  { name: 'maths_written', display: 'Maths (Written)', has_practical: false },
  { name: 'maths_oral', display: 'Maths (Oral)', has_practical: false, is_oral: true, exclude_monthly: true },
  { name: 'social_studies_written', display: 'S. Studies (Written)', has_practical: false },
  { name: 'social_studies_oral', display: 'S. Studies (Oral)', has_practical: false, is_oral: true, exclude_monthly: true },
  { name: 'science_written', display: 'G. Science / Chemistry', has_practical: false, variants: ['G. Science', 'Chemistry'] },
  { name: 'science_oral', display: 'G. Science (Oral)', has_practical: false, is_oral: true, exclude_monthly: true },
  { name: 'drawing', display: 'Drawing', has_practical: false, is_optional: true },
  { name: 'computer_biology', display: 'Computer / Biology', has_practical: true, variants: ['Computer', 'Biology'] },
];

const MONTHS = [
  'April', 'May', 'June', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

const EXAM_TYPES = [
  { value: 'monthly', label: 'Monthly Test' },
  { value: 'midterm', label: 'Mid Term' },
  { value: 'final', label: 'Final Term' },
];

export default function TeacherResultPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const permissions = usePermissions();

  // Ensure results is always an array
  const safeResults = Array.isArray(results) ? results : [];

  // Form states
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [examType, setExamType] = useState<'midterm' | 'final' | 'monthly'>('monthly');
  const [month, setMonth] = useState<string>('');
  const [subjectMarks, setSubjectMarks] = useState<SubjectMark[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [midTermCheck, setMidTermCheck] = useState<any>(null);

  // Additional fields
  const [attendanceScore, setAttendanceScore] = useState<number>(0);
  const [totalAttendance, setTotalAttendance] = useState<number>(0);
  const [teacherRemarks, setTeacherRemarks] = useState<string>('');
  const [editingResultId, setEditingResultId] = useState<number | null>(null);
  const [fetchingAttendance, setFetchingAttendance] = useState(false);
  const [poolSubjects, setPoolSubjects] = useState<any[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [selectedPoolSubjects, setSelectedPoolSubjects] = useState<number[]>([]);

  // Bulk actions
  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkComments, setBulkComments] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [bulkEntryMode, setBulkEntryMode] = useState(false);
  const [marksheetData, setMarksheetData] = useState<Record<number, any>>({});
  // Bulk Upload flow: first select exam type, then open upload modal
  const [bulkUploadExamType, setBulkUploadExamType] = useState<'monthly' | 'midterm' | 'final' | null>(null);

  // Classroom selection
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);

  // Report Card
  const [showReportCard, setShowReportCard] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [reportCardData, setReportCardData] = useState<{ student: Student, results: Result[] } | null>(null);

  // Custom Creation Menu
  const [showCreationMenu, setShowCreationMenu] = useState(false);

  // Dynamic Months logic
  const dynamicMonths = useMemo(() => {
    const campus = teacherProfile?.current_campus;
    if (!campus?.academic_year_start_month || !campus?.academic_year_end_month) {
      return MONTHS;
    }

    const ALL_MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const startIndex = ALL_MONTHS.indexOf(campus.academic_year_start_month);
    const endIndex = ALL_MONTHS.indexOf(campus.academic_year_end_month);

    if (startIndex === -1 || endIndex === -1) return MONTHS;

    const result = [];
    let curr = startIndex;
    for (let i = 0; i < 12; i++) {
      result.push(ALL_MONTHS[curr]);
      if (curr === endIndex) break;
      curr = (curr + 1) % 12;
    }
    return result;
  }, [teacherProfile]);

  // Update activeTab when dynamicMonths changes
  useEffect(() => {
    if (dynamicMonths.length > 0 && !dynamicMonths.includes(activeTab)) {
      setActiveTab(dynamicMonths[0]);
    }
  }, [dynamicMonths]);

  // Bulk Download
  const [selectedStudentsForDownload, setSelectedStudentsForDownload] = useState<number[]>([]);
  const [downloadingBulk, setDownloadingBulk] = useState(false);

  // Debug helpers for opening modals (logs to console)
  const handleOpenCreateForm = () => {
    // eslint-disable-next-line no-console
    console.log('handleOpenCreateForm called')
    setShowCreateForm(true)
  }

  const handleOpenBulkUpload = () => {
    // eslint-disable-next-line no-console
    console.log('handleOpenBulkUpload called')
    // Directly open the upload modal (skip the type selection popup)
    setShowBulkUploadModal(true)
  }



  // Tabs state
  const [activeCategory, setActiveCategory] = useState<'monthly' | 'midterm' | 'final'>('monthly');
  const [activeTab, setActiveTab] = useState(MONTHS[0]);

  // Memoized filtered results for use across handlers and render
  const filteredResults = useMemo(() => {
    return safeResults.filter(r => {
      if (r.exam_type !== activeCategory) return false;
      if (activeCategory === 'monthly' && r.month !== activeTab) return false;
      return true;
    });
  }, [safeResults, activeCategory, activeTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Clear cache to ensure fresh data for each teacher
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cache_students');
        localStorage.removeItem('cache_teacher_profile');
      }

      // Get current user profile (works for all roles)
      try {
        const profile = await getCurrentUserProfile();
        setTeacherProfile(profile as any);
      } catch (err: any) {
        if (err?.status !== 403) console.error('Profile fetch error:', err);
      }

      // Fetch students assigned to this teacher (403 = not a teacher, skip silently)
      try {
        const studentsData = await getTeacherStudents(selectedClassroom || undefined);
        setStudents(studentsData as Student[]);
      } catch (err: any) {
        if (err?.status !== 403) console.error('Students fetch error:', err);
      }

      // Fetch existing results (403 = no permission, skip silently)
      try {
        const resultsData = await getMyResults();
        const resultsArray = Array.isArray(resultsData) ? resultsData : ((resultsData as any)?.results || []);
        
        // Filter results by classroom if one is selected
        const filteredResults = selectedClassroom 
          ? resultsArray.filter((r: any) => r.student?.classroom?.id === selectedClassroom || r.student?.classroom === selectedClassroom)
          : resultsArray;
          
        setResults(filteredResults as Result[]);
      } catch (err: any) {
        if (err?.status !== 403) console.error('Results fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch students when selectedClassroom changes
  useEffect(() => {
    if (teacherProfile) {
      fetchData();
    }
  }, [selectedClassroom]);

  // Initial classroom selection
  useEffect(() => {
    if (teacherProfile && !selectedClassroom) {
      const classrooms = teacherProfile.assigned_classrooms || [];
      if (classrooms.length > 0) {
        setSelectedClassroom(classrooms[0].id);
      } else if (teacherProfile.assigned_classroom_id) {
        setSelectedClassroom(teacherProfile.assigned_classroom_id);
      }
    }
  }, [teacherProfile]);

  const initializeSubjectMarks = () => {
    // Start with empty sheet for new results if no subjects exist
    if (!editingResultId) {
      setSubjectMarks([]);
      setSelectedPoolSubjects([]);
      return;
    }
  };

  // Re-initialize marks when exam type changes to update default total marks
  useEffect(() => {
    if (selectedStudent) {
      initializeSubjectMarks();
    }
  }, [examType]);

  // Automated attendance fetching
  useEffect(() => {
    const fetchAttendance = async () => {
      if (selectedStudent && month && examType === 'monthly') {
        try {
          setFetchingAttendance(true);
          const attendance = await getStudentMonthlyAttendance(selectedStudent.id, month) as any;
          setAttendanceScore(attendance?.days_present || 0);
          setTotalAttendance(attendance?.total_working_days || 0);
        } catch (error) {
          console.error('Error fetching attendance:', error);
          toast.error('Failed to fetch automated attendance');
        } finally {
          setFetchingAttendance(false);
        }


      }
    };

    fetchAttendance();
  }, [selectedStudent, month, examType]);

  // Fetch pool subjects when student/level changes
  useEffect(() => {
    const fetchPool = async () => {
      if (!teacherProfile) return;
      try {
        setLoadingPool(true);
        // Prefer backend-specific available-subjects when student selected
        if (selectedStudent) {
          const subjects = await getAvailableSubjects({ student_id: selectedStudent.id });
          setPoolSubjects(subjects || []);
        } else {
          // Fallback to generic subjects list for teacher's campus
          const campusId = teacherProfile.campus?.id;
          const levelId = (selectedStudent as any)?.level?.id || teacherProfile?.assigned_level?.id;
          if (campusId) {
            const subjects = await getSubjects({
              campus: campusId,
              level: levelId,
              is_active: true
            });
            setPoolSubjects(subjects);
          }
        }
      } catch (error) {
        console.error('Error fetching subject pool:', error);
      } finally {
        setLoadingPool(false);
      }
    };

    fetchPool();
  }, [selectedStudent, teacherProfile]);

  // Auto-add pool subjects when student is selected and sheet empty (only for create, not edit)
  useEffect(() => {
    if (!selectedStudent) return;
    if (editingResultId) return; // don't auto-fill when editing existing result
    if (!poolSubjects || poolSubjects.length === 0) return;
    if (subjectMarks.length > 0) return; // already populated

    // Add all pool subjects to subject marks
    poolSubjects.forEach((sub) => {
      try {
        addSubjectFromPool(sub);
      } catch (e) {
        // ignore individual failures
      }
    });
  }, [poolSubjects, selectedStudent]);

  const addSubjectFromPool = (subject: any) => {
    if (subjectMarks.some(m => m.subject_name === subject.name)) {
      toast.error('Subject already added');
      return;
    }

    const newMark: SubjectMark = {
      subject_name: subject.name,
      total_marks: examType === 'monthly' ? 25 : 75,
      obtained_marks: 0,
      has_practical: false,
      practical_total: 0,
      practical_obtained: 0,
      is_pass: false,
      is_included: true
    };

    setSubjectMarks(prev => [...prev, newMark]);
    setSelectedPoolSubjects(prev => [...prev, subject.id]);
  };

  const removeSubjectMark = (subjectName: string) => {
    setSubjectMarks(prev => prev.filter(m => m.subject_name !== subjectName));
    const poolSub = poolSubjects.find(ps => ps.name === subjectName);
    if (poolSub) {
      setSelectedPoolSubjects(prev => prev.filter(id => id !== poolSub.id));
    }
  };

  const handleStudentChange = async (studentId: string) => {
    const student = students.find(s => s.id === parseInt(studentId));
    setSelectedStudent(student || null);
    setMidTermCheck(null); // Reset check

    if (student) {
      initializeSubjectMarks();

      // Always check mid-term status to enable/disable validation
      try {
        const check = await checkMidTerm(student.id);
        setMidTermCheck(check);

        // If currently on final and check fails, switch back
        if (examType === 'final' && !check.mid_term_approved) {
          toast.error('Mid-term result must be approved before creating final-term result');
          setExamType('midterm');
        }
      } catch (error) {
        console.error('Error checking mid-term:', error);
        // Treat error (e.g. 404) as not approved
        setMidTermCheck({ mid_term_approved: false });
        if (examType === 'final') {
          toast.error('Mid-term result missing or not approved.');
          setExamType('midterm');
        }
      }
    }
  };

  const handleExamTypeChange = async (type: 'midterm' | 'final' | 'monthly') => {

    // Strict block before setting state
    if (type === 'final' && selectedStudent) {
      // If we already have the check from student selection
      if (midTermCheck && !midTermCheck.mid_term_approved) {
        toast.error('Mid-term result must be approved before creating final-term result');
        return;
      }

      // Fallback check if state missing (shouldn't happen with updated handleStudentChange, but for safety)
      try {
        const check = await checkMidTerm(selectedStudent.id);
        setMidTermCheck(check);

        if (!check.mid_term_approved) {
          toast.error('Mid-term result must be approved before creating final-term result');
          // Do not set exam type
          return;
        }
      } catch (error) {
        console.error('Error checking mid-term:', error);
        toast.error('Mid-term result missing or not verified.');
        return;
      }
    }

    setExamType(type);
  };

  const handleMarkChange = (subject_name: string, field: string, value: any) => {
    setSubjectMarks(prev => prev.map(mark => {
      if (mark.subject_name === subject_name) {
        const updated = { ...mark, [field]: value } as any;

        // If marking as absent, zero out marks and force fail
        if (field === 'is_absent') {
          if (value === true) {
            updated.obtained_marks = 0;
            updated.is_pass = false;
            return updated;
          } else {
            // Removing absent — recalculate below
          }
        }

        // Handle numeric fields
        if (['obtained_marks', 'practical_obtained', 'total_marks', 'practical_total'].includes(field)) {
          updated[field] = Number(value);
        }

        // Validation: Obtained marks cannot exceed Total marks
        if (updated.obtained_marks > updated.total_marks) {
          updated.obtained_marks = updated.total_marks;
        }
        if (updated.practical_obtained > updated.practical_total) {
          updated.practical_obtained = updated.practical_total;
        }

        // Determine passing percentage
        const passingPercentage = examType === 'midterm' ? 33 : 40;

        // Calculate pass/fail (skip if still absent)
        if (!updated.is_absent) {
          const totalTheory = Number(updated.total_marks) || 0;
          const totalPractical = Number(updated.practical_total) || 0;
          const obtTheory = Number(updated.obtained_marks) || 0;
          const obtPractical = Number(updated.practical_obtained) || 0;

          const includePractical = updated.has_practical && examType !== 'monthly';
          const total = totalTheory + (includePractical ? totalPractical : 0);
          const obtained = obtTheory + (includePractical ? obtPractical : 0);

          const percentage = total > 0 ? (obtained / total) * 100 : 0;
          updated.is_pass = percentage >= (passingPercentage - 0.01);
        }

        return updated;
      }
      return mark;
    }));
  };

  const calculateTotals = () => {
    const includedMarks = subjectMarks.filter(mark => mark.is_included !== false);

    const totalMarks = includedMarks.reduce((sum, mark) => {
      const practical = (examType !== 'monthly' && mark.has_practical) ? (Number(mark.practical_total) || 0) : 0;
      return sum + (Number(mark.total_marks) || 0) + practical;
    }, 0);

    const obtainedMarks = includedMarks.reduce((sum, mark) => {
      const practical = (examType !== 'monthly' && mark.has_practical) ? (Number(mark.practical_obtained) || 0) : 0;
      return sum + (Number(mark.obtained_marks) || 0) + practical;
    }, 0);

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    
    // Check if there are any absences
    const hasAbsent = includedMarks.some(mark => mark.is_absent);
    
    // Check if there are any failures among attempted subjects
    const hasFailedAttempt = includedMarks.some(mark => !mark.is_absent && !mark.is_pass);
    
    // Check if any subject was attempted at all
    const attemptedAny = includedMarks.some(mark => !mark.is_absent);

    const passingThreshold = examType === 'midterm' ? 33 : 40;
    const meetsPercentage = totalMarks > 0 ? percentage >= passingThreshold : true;
    
    let overallStatus = 'fail';
    
    if (hasAbsent && !hasFailedAttempt && (!attemptedAny || meetsPercentage)) {
      overallStatus = 'absent';
    } else if (!hasFailedAttempt && meetsPercentage && attemptedAny && !hasAbsent) {
      overallStatus = 'pass';
    }

    return { totalMarks, obtainedMarks, percentage, overallStatus, overallPass: overallStatus === 'pass' };
  };

  const handleCreateResult = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }

    if (examType === 'monthly' && !month) {
      toast.error('Please select a month');
      return;
    }

    // Strict Final Term Check at Submission
    if (examType === 'final') {
      if (!midTermCheck || !midTermCheck.mid_term_approved) {
        toast.error('Cannot create result: Mid Term result not approved.');
        return;
      }
    }

    try {
      setCreating(true);

      const resultData: any = {
        student: selectedStudent.id,
        exam_type: examType,
        month: examType === 'monthly' ? month : undefined,
        academic_year: '2024-25',
        semester: 'Spring',
        subject_marks: subjectMarks.filter(m => m.is_included !== false),
        attendance_score: attendanceScore,
        total_attendance: totalAttendance,
        teacher_remarks: teacherRemarks
      };

      if (editingResultId) {
        await updateResult(editingResultId, resultData);
        toast.success('Result updated successfully!');
      } else {
        await createResult(resultData);
        toast.success('Result created successfully!');
      }

      setShowCreateForm(false);
      setSelectedStudent(null);
      setEditingResultId(null);
      setSubjectMarks([]);
      setAttendanceScore(0);
      setTotalAttendance(0);
      setTeacherRemarks('');
      setMonth('');
      await fetchData();

    } catch (error: any) {
      console.error('Error saving result:', error);
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to save result';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleEditResult = (result: Result) => {
    setEditingResultId(result.id);
    setSelectedStudent({
      id: result.student.id,
      name: result.student.full_name,
      full_name: result.student.full_name,
      student_code: result.student.student_code,
    } as any);
    setExamType(result.exam_type as any);
    setMonth(result.month || '');
    setSubjectMarks(result.subject_marks);
    setAttendanceScore(result.attendance_score || 0);
    setTotalAttendance(result.total_attendance || 0);
    setTeacherRemarks(result.teacher_remarks || '');
    setShowCreateForm(true);
  };

  const handleSubmitResult = async (resultId: number) => {
    try {
      setSubmitting(true);
      await submitResult(resultId);
      toast.success('Result submitted to coordinator!');
      await fetchData();
    } catch (error: any) {
      console.error('Error submitting result:', error);
      toast.error(error?.response?.data?.error || 'Failed to submit result');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForwardResult = async (resultId: number) => {
    try {
      setSubmitting(true);
      await forwardResult(resultId);
      toast.success('Result forwarded to coordinator');
      await fetchData();
    } catch (error: any) {
      console.error('Error forwarding result:', error);
      toast.error(error?.response?.data?.error || 'Failed to forward result');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk actions
  const handleSelectResult = (resultId: number) => {
    setSelectedResults(prev =>
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const handleSelectAll = () => {
    const visibleForwardable = safeResults.filter(r =>
      (r.status === 'draft' || r.status === 'submitted') &&
      r.exam_type === activeCategory &&
      (activeCategory === 'monthly' ? r.month === activeTab : true)
    );

    if (selectedResults.length === visibleForwardable.length && visibleForwardable.length > 0) {
      setSelectedResults([]);
    } else {
      setSelectedResults(visibleForwardable.map(r => r.id));
    }
  };

  const handleBulkForward = async () => {
    if (selectedResults.length === 0) {
      toast.error('Please select results to forward');
      return;
    }

    try {
      setBulkProcessing(true);

      // Forward each selected result
      for (const resultId of selectedResults) {
        await submitResult(resultId);
      }

      toast.success(`Successfully forwarded ${selectedResults.length} results to coordinator!`);
      setShowBulkModal(false);
      setSelectedResults([]);
      setBulkComments("");
      await fetchData();

    } catch (error: any) {
      console.error('Error forwarding results:', error);
      toast.error('Failed to forward results');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleCalculatePositions = async () => {
    try {
      setBulkProcessing(true);
      const firstStudent = students[0] as any;
      const studentClassroomId = firstStudent ? (
        typeof firstStudent.classroom === 'number' ? firstStudent.classroom : 
        firstStudent.classroom?.id || firstStudent.classroom_id || firstStudent.classroom_data?.id || firstStudent.classroom
      ) : null;
      
    const classroomId = studentClassroomId || teacherProfile?.assigned_classroom?.id || teacherProfile?.assigned_classroom;
      await calculatePositions(classroomId);
      toast.success(`Positions calculated successfully!`);
      await fetchData();
    } catch (error: any) {
      console.error('Error calculating positions:', error);
      toast.error('Failed to calculate positions');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleForwardClassResults = async () => {
    // Use the classroom ID from the loaded students if available, fallback to assigned_classroom
    // The backend serializer returns the classroom ID in the 'classroom' field, or nested in classroom_data  
    const firstStudent = students[0] as any;
    const studentClassroomId = firstStudent ? (
      typeof firstStudent.classroom === 'number' ? firstStudent.classroom :
        firstStudent.classroom?.id || firstStudent.classroom_id || firstStudent.classroom_data?.id || firstStudent.classroom
    ) : null;

    const classroomId = studentClassroomId || teacherProfile?.assigned_classroom?.id || teacherProfile?.assigned_classroom;
      
    if (!classroomId) {
      toast.error('No assigned classroom found');
      return;
    }

    // Filter results for current category and tab
    const filteredResults = safeResults.filter(r =>
      r.exam_type === activeCategory &&
      (activeCategory === 'monthly' ? r.month === activeTab : true)
    );

    if (filteredResults.length < students.length) {
      toast.error(`Incomplete class results. Please create results for all ${students.length} students first.`);
      return;
    }

    try {
      setBulkProcessing(true);
      await forwardClassResults(classroomId, activeCategory, activeCategory === 'monthly' ? activeTab : undefined);
      toast.success(`Class results forwarded to coordinator successfully!`);
      await fetchData();
    } catch (error: any) {
      console.error('Error forwarding class results:', error);
      toast.error(error?.message || 'Failed to forward class results');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleViewReportCard = async (studentId: number) => {
    try {
      const studentResults = safeResults.filter(r => r.student.id === studentId);

      // Fetch complete student details to ensure all fields (father_name, etc.) are available
      const { getStudentById } = await import('@/lib/api');
      const completeStudent = await getStudentById(studentId);

      if (completeStudent) {
        setReportCardData({ student: completeStudent, results: studentResults });
        setShowReportCard(true);
      } else {
        toast.error("Student details not found");
      }
    } catch (error) {
      console.error('Error fetching student details:', error);
      toast.error("Failed to load student details");
    }
  };

  // Bulk Download Handlers
  const handleToggleStudentForDownload = (studentId: number) => {
    setSelectedStudentsForDownload(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllForDownload = () => {
    if (selectedStudentsForDownload.length === filteredResults.length) {
      setSelectedStudentsForDownload([]);
    } else {
      setSelectedStudentsForDownload(filteredResults.map((r: Result) => r.student.id));
    }
  };

  const handleBulkDownload = async (downloadType: 'combined' | 'separate') => {
    if (selectedStudentsForDownload.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    try {
      setDownloadingBulk(true);
      toast.info(`Generating ${downloadType === 'combined' ? 'combined' : 'separate'} PDF(s)...`);

      // Prepare report card data for selected students
      const reportCardsData = await Promise.all(
        selectedStudentsForDownload.map(async (studentId) => {
          const student = students.find(s => s.id === studentId);
          if (!student) return null;

          // Get all results for this student filtered by current category and tab
          const studentResults = safeResults.filter(r => {
            const matchesStudent = r.student.id === studentId;
            const matchesType = r.exam_type === activeCategory;
            const matchesMonth = activeCategory === 'monthly'
              ? r.month === activeTab
              : true;
            return matchesStudent && matchesType && matchesMonth;
          });

          return {
            student,
            results: studentResults
          };
        })
      );

      // Filter out null values
      const validReportCards = reportCardsData.filter(rc => rc !== null) as { student: Student; results: Result[] }[];

      if (validReportCards.length === 0) {
        toast.error('No valid report cards to generate');
        return;
      }

      // Generate PDFs
      if (downloadType === 'combined') {
        const fileName = `${activeCategory}_${activeCategory === 'monthly' ? activeTab + '_' : ''}report_cards_${new Date().toISOString().split('T')[0]}.pdf`;
        await generateBulkReportCardsPDF(validReportCards, fileName);
        toast.success(`✅ Downloaded combined PDF with ${validReportCards.length} report cards!`);
      } else {
        const zipFileName = `${activeCategory}_${activeCategory === 'monthly' ? activeTab + '_' : ''}report_cards_${new Date().toISOString().split('T')[0]}.zip`;
        await generateSeparateReportCardsPDFs(validReportCards, zipFileName);
        toast.success(`✅ Downloaded ${validReportCards.length} report cards as ZIP!`);
      }

      // Clear selection after successful download
      setSelectedStudentsForDownload([]);
    } catch (error) {
      console.error('Bulk download error:', error);
      toast.error('Failed to generate PDF(s). Please try again.');
    } finally {
      setDownloadingBulk(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'pending_coordinator': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'pending_principal': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-100 text-green-800';
      case 'A': return 'bg-blue-100 text-blue-800';
      case 'B': return 'bg-yellow-100 text-yellow-800';
      case 'C': return 'bg-orange-100 text-orange-800';
      case 'D': return 'bg-red-100 text-red-800';
      case 'F': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">

        {/* Title + subtitle */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-56 bg-gray-300 rounded-lg" />
          <Skeleton className="h-4 w-72 bg-gray-200 rounded" />
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-gray-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full bg-gray-200 shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-gray-200 rounded" />
                  <Skeleton className="h-7 w-12 bg-gray-300 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Result button — right aligned */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 bg-gray-300 rounded-xl" />
        </div>

        {/* Monthly Test / Mid Term / Final Term tabs */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 bg-gray-300 rounded-full" />
          <Skeleton className="h-10 w-24 bg-gray-100 rounded-full" />
          <Skeleton className="h-10 w-24 bg-gray-100 rounded-full" />
        </div>

        {/* Month tabs row */}
        <div className="flex gap-2 flex-wrap">
          {[80, 60, 65, 80, 100, 80, 90, 75, 85, 70, 75].map((w, i) => (
            <Skeleton key={i} className="h-8 bg-gray-200 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Results table card */}
        <Card className="border-gray-100 shadow-sm">
          <CardHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48 bg-gray-200 rounded" />
                <Skeleton className="h-3 w-56 bg-gray-100 rounded" />
              </div>
              <Skeleton className="h-6 w-28 bg-gray-100 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <Skeleton className="h-4 w-4 rounded bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40 bg-gray-200 rounded" />
                    <Skeleton className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                  <Skeleton className="h-6 w-20 bg-purple-50 rounded-full" />
                  <Skeleton className="h-6 w-24 bg-blue-50 rounded-full" />
                  <Skeleton className="h-9 w-20 bg-gray-100 rounded-lg" />
                  <Skeleton className="h-9 w-20 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 md:px-0">
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      <div className={cn("space-y-8", showReportCard && "print:hidden")}>
        {/* Header */}
        <div>
          <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide">Result Management</h2>
          <p className="text-gray-600 text-lg">
            Manage results for your class: {teacherProfile?.assigned_classroom?.class_name} - {teacherProfile?.assigned_classroom?.section}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-[#274c77]" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-[#274c77]">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-[#6096ba]" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Class Avg (%)</p>
                  <p className="text-2xl font-bold text-[#6096ba]">
                    {(() => {
                      const filtered = safeResults.filter(r =>
                        r.exam_type === activeCategory &&
                        (activeCategory === 'monthly' ? r.month === activeTab : true)
                      );
                      const avg = filtered.length > 0
                        ? (filtered.reduce((sum, r) => sum + (r.percentage || 0), 0) / filtered.length).toFixed(1)
                        : "0.0";
                      return avg;
                    })()}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {safeResults.filter(r =>
                      r.status === 'approved' &&
                      r.exam_type === activeCategory &&
                      (activeCategory === 'monthly' ? r.month === activeTab : true)
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {safeResults.filter(r =>
                      ['draft', 'submitted', 'under_review'].includes(r.status) &&
                      r.exam_type === activeCategory &&
                      (activeCategory === 'monthly' ? r.month === activeTab : true)
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            {activeCategory !== 'monthly' ? (
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleForwardClassResults}
                  disabled={bulkProcessing || safeResults.filter(r =>
                    r.exam_type === activeCategory &&
                    r.status === 'draft'
                  ).length < students.length || students.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg transition-all"
                >
                  {bulkProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Forward Class to Coordinator (Sheet)
                </Button>

                {/* Progress helper */}
                {(() => {
                  const completedCount = safeResults.filter(r => r.exam_type === activeCategory).length;
                  if (completedCount < students.length) {
                    return (
                      <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {students.length - completedCount} more results needed to forward
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {safeResults.filter(r => r.status === 'draft' || r.status === 'submitted').length > 0 && (
                  <>
                    <Button
                      onClick={handleSelectAll}
                      variant="outline"
                      className="flex items-center justify-center gap-2 whitespace-nowrap border-[#6096ba] text-[#274c77] hover:bg-[#6096ba]/10"
                    >
                      {selectedResults.length === safeResults.filter(r => r.status === 'draft' || r.status === 'submitted').length ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <CheckSquare className="h-4 w-4" />
                      )}
                      Select All Submissions
                    </Button>

                    <Button
                      onClick={() => setShowBulkModal(true)}
                      disabled={selectedResults.length === 0}
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                      Bulk Submit ({selectedResults.length})
                    </Button>
                  </>
                )}

                {filteredResults.length > 0 && (
                  <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block" />
                )}
              </div>
            )}
          </div>

          <div className="w-full md:w-auto flex flex-wrap items-center justify-end gap-3">
            {selectedStudentsForDownload.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <Button
                  onClick={() => handleBulkDownload('separate')}
                  disabled={downloadingBulk}
                  className="bg-[#274c77] hover:bg-[#1e3a5f] text-white flex items-center justify-center gap-2 whitespace-nowrap shadow-sm h-10 px-4 rounded-xl"
                >
                  {downloadingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Report Cards (ZIP)
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {permissions.canBulkImportResults && (
                <Button
                  type="button"
                  onClick={() => setShowCreationMenu(true)}
                  className="bg-[#274c77] hover:bg-[#1e3a5f] text-white w-full sm:w-auto flex items-center justify-center shadow-md font-bold"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Result
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Exam Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-2 bg-white/50 p-1.5 rounded-2xl border border-[#a3cef1]/30">
          {EXAM_TYPES.map((type) => (
            <Button
              key={type.value}
              variant={activeCategory === type.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(type.value as any)}
              className={cn(
                "rounded-xl transition-all font-bold px-6 py-5",
                activeCategory === type.value
                  ? "bg-[#274c77] text-white shadow-lg scale-105"
                  : "text-[#6096ba] hover:bg-[#a3cef1]/20 hover:text-[#274c77]"
              )}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Month Sub-Tabs (Only for Monthly Test) */}
        {activeCategory === 'monthly' && (
          <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-2 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-300">
            {MONTHS.map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-lg transition-all",
                  activeTab === tab
                    ? "bg-[#6096ba] text-white shadow-md"
                    : "text-gray-600 hover:bg-white hover:shadow-sm"
                )}
              >
                {tab}
              </Button>
            ))}
          </div>
        )}

        {/* Results List */}
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-[#274c77] flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {EXAM_TYPES.find(t => t.value === activeCategory)?.label}
                  {activeCategory === 'monthly' && <span className="text-[#6096ba]">({activeTab})</span>}
                </CardTitle>
                <CardDescription>Filtered results for your students</CardDescription>
              </div>
              <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {safeResults.filter(r =>
                  r.exam_type === activeCategory &&
                  (activeCategory === 'monthly' ? r.month === activeTab : true)
                ).length} results found
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const currentLabel = activeCategory === 'monthly'
                ? `${EXAM_TYPES.find(t => t.value === activeCategory)?.label} (${activeTab})`
                : EXAM_TYPES.find(t => t.value === activeCategory)?.label;

              if (filteredResults.length === 0) {
                return (
                  <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      No results found for {currentLabel}
                    </h3>
                    <p className="text-gray-500">
                      You haven't added any results for {currentLabel} yet.
                    </p>
                  </div>
                );
              }

              return (
                <>
                  <div className="relative overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-center border-separate border-spacing-0 min-w-[1000px]">
                      <thead>
                        <tr className="bg-[#a3cef1] text-[#274c77]">
                          <th className="sticky left-0 z-40 bg-[#a3cef1] py-4 px-4 font-bold whitespace-nowrap border-b border-r border-[#8ab8de] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left min-w-[180px]">
                            Student
                          </th>
                          <th className="py-4 px-4 border-b border-r font-bold whitespace-nowrap min-w-[120px]">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wider opacity-60">Bulk Downloads</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentsForDownload.length === filteredResults.length && filteredResults.length > 0}
                                  onChange={handleSelectAllForDownload}
                                  className="h-4 w-4 rounded border-gray-300 text-[#274c77] focus:ring-[#274c77]"
                                />
                                <span className="text-[11px]">Select All</span>
                              </div>
                            </div>
                          </th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Submission</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Exam Type</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Total Marks</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Obtained</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Percentage</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Grade</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Rank/Result</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Status</th>
                          <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Edits Left</th>
                          <th className="py-4 px-4 border-b font-semibold whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((result) => (
                          <tr key={result.id} className="hover:bg-gray-50/80 transition-colors group">
                            <td className="sticky left-0 z-30 bg-white group-hover:bg-gray-50 py-4 px-4 font-bold border-b border-r border-gray-100 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left text-[#274c77]">
                              <div className="flex flex-col">
                                <span>{result.student.full_name}</span>
                                <span className="text-[10px] text-gray-400 font-mono font-normal">{result.student.student_code}</span>
                              </div>
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">
                              <div className="flex justify-center" title="Select for Bulk Download">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentsForDownload.includes(result.student.id)}
                                  onChange={() => handleToggleStudentForDownload(result.student.id)}
                                  className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                                />
                              </div>
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">
                              <div className="flex justify-center" title="Select for Bulk Submission">
                                {(result.status === 'draft' || result.status === 'submitted') ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedResults.includes(result.id)}
                                    onChange={() => handleSelectResult(result.id)}
                                    className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded-md cursor-pointer shadow-sm"
                                  />
                                ) : (
                                  <CheckCircle className="h-5 w-5 text-emerald-500 opacity-40" />
                                )}
                              </div>
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">{result.exam_type_display}</td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap font-medium text-gray-600">{result.total_marks}</td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap font-bold text-gray-800">{result.obtained_marks}</td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap font-bold text-[#274c77] bg-[#f0f7ff]/30">
                              {result.result_status === 'pass' ? `${result.percentage.toFixed(2)}%` : 'N/A'}
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">
                              <Badge className={cn("shadow-none", getGradeColor(result.grade))}>
                                {result.result_status === 'pass' ? result.grade : (result.result_status === 'absent' ? 'Absent' : 'Fail')}
                              </Badge>
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">
                              {(() => {
                                const isAllCompleted = filteredResults.length === students.length && students.length > 0;
                                if (isAllCompleted) {
                                  const passingSorted = [...filteredResults]
                                    .filter(r => r.result_status === 'pass' || r.grade !== 'F')
                                    .sort((a, b) => b.percentage - a.percentage);

                                  const rankIndex = passingSorted.findIndex(r => r.id === result.id);
                                  if (result.result_status === 'pass' && rankIndex >= 0 && rankIndex < 5) {
                                    const labels = ['1st', '2nd', '3rd', '4th', '5th'];
                                    const colors = [
                                      'bg-yellow-50 text-yellow-700 border-yellow-100',
                                      'bg-slate-50 text-slate-700 border-slate-100',
                                      'bg-orange-50 text-orange-700 border-orange-100',
                                      'bg-blue-50 text-blue-600 border-blue-100',
                                      'bg-gray-50 text-gray-600 border-gray-100'
                                    ];
                                    return (
                                      <Badge className={cn("shadow-sm font-bold border", colors[rankIndex])}>
                                        {labels[rankIndex]}
                                      </Badge>
                                    );
                                  }
                                }

                                return <span className="text-gray-400 font-bold">N/A</span>;
                              })()}
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap">
                              <Badge className={cn("shadow-none border-none", getStatusColor(result.status))}>
                                {result.status.charAt(0).toUpperCase() + result.status.slice(1).replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="border-b border-r py-4 px-4 whitespace-nowrap text-xs font-mono text-gray-400">
                              {result.status === 'pending' ? '0' : Math.max(0, 2 - result.edit_count)}
                            </td>
                            <td className="border-b py-4 px-4 whitespace-nowrap">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleViewReportCard(result.student.id)}
                                  className="h-9 w-9 p-0 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-[#6096ba] hover:text-white hover:border-[#6096ba] transition-all shadow-sm"
                                  title="View Report Card"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(result.status === 'draft' || result.status === 'submitted') && (
                                  <>
                                    {permissions.canEditResults && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleEditResult(result)}
                                        disabled={result.edit_count >= 2}
                                        className="h-9 w-9 p-0 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm disabled:opacity-50"
                                        title="Edit Result"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {(result.exam_type === 'monthly' || result.exam_type === 'midterm' || result.exam_type === 'final') && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleSubmitResult(result.id)}
                                        disabled={submitting}
                                        className="bg-[#274c77] hover:bg-[#1e3a5f] text-white h-9 w-9 p-0 rounded-lg transition-all shadow-md active:scale-95"
                                        title="Submit to Coordinator"
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Automatic Summary Section */}
                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#274c77] flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          {currentLabel} Summary
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {filteredResults.length === students.length
                            ? " All student results have been created for this category."
                            : `Progress: ${filteredResults.length} out of ${students.length} students completed.`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completion</span>
                          <span className="text-lg font-black text-[#274c77]">
                            {Math.round((filteredResults.length / (students.length || 1)) * 100)}%
                          </span>
                        </div>
                        <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                          <div
                            className="h-full bg-gradient-to-r from-[#6096ba] to-[#274c77] transition-all duration-1000 ease-out"
                            style={{ width: `${(filteredResults.length / (students.length || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {filteredResults.length === students.length && students.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Position Holders Leaderboard */}
                        {(() => {
                          const sortedPassing = [...filteredResults]
                            .filter(r => r.result_status === 'pass' || r.grade !== 'F')
                            .sort((a, b) => b.percentage - a.percentage)
                            .slice(0, 5);

                          const positionLabels = ['1st', '2nd', '3rd', '4th', '5th'];
                          const medalColors = [
                            'bg-yellow-100 text-yellow-700 border-yellow-200',
                            'bg-slate-100 text-slate-700 border-slate-200',
                            'bg-orange-100 text-orange-700 border-orange-200',
                            'bg-blue-50 text-blue-600 border-blue-100',
                            'bg-gray-50 text-gray-600 border-gray-100'
                          ];

                          return sortedPassing.map((res, idx) => (
                            <motion.div
                              key={res.id}
                              initial="initial"
                              whileHover="hover"
                              className={cn(
                                "relative flex flex-col items-center p-4 rounded-2xl border transition-all hover:shadow-2xl overflow-visible group cursor-default",
                                idx === 0 ? "bg-gradient-to-br from-yellow-50 to-white border-yellow-200 shadow-md ring-2 ring-yellow-400/20" :
                                  idx === 1 ? "bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-md ring-2 ring-slate-400/10" :
                                    idx === 2 ? "bg-gradient-to-br from-orange-50 to-white border-orange-200 shadow-md ring-2 ring-orange-400/10" :
                                      "bg-white border-gray-100"
                              )}
                            >
                              {/* Firework Particles (Top 3 only) */}
                              {idx < 3 && [...Array(10)].map((_, i) => (
                                <motion.span
                                  key={i}
                                  variants={{
                                    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
                                    hover: {
                                      scale: [0, 1.2, 0],
                                      opacity: [0, 1, 0],
                                      x: (Math.random() - 0.5) * 160,
                                      y: (Math.random() - 0.5) * 160,
                                      transition: { duration: 0.8, repeat: Infinity, repeatDelay: 0.1 }
                                    }
                                  }}
                                  className="absolute w-2 h-2 rounded-full pointer-events-none z-0"
                                  style={{
                                    backgroundColor: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : '#f97316',
                                    boxShadow: `0 0 12px ${idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : '#f97316'}`
                                  }}
                                />
                              ))}

                              <div className="relative z-10 flex flex-col items-center transition-transform duration-300 group-hover:scale-110">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm mb-3 border",
                                  medalColors[idx]
                                )}>
                                  {positionLabels[idx]}
                                </div>
                                <span className="text-sm font-bold text-gray-800 text-center line-clamp-1">{res.student.full_name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs font-bold text-[#6096ba]">{res.percentage.toFixed(1)}%</span>
                                  <Badge className={cn("text-[10px] px-1.5 h-4 shadow-none border-none scale-90", getGradeColor(res.grade))}>
                                    {res.grade}
                                  </Badge>
                                </div>
                              </div>
                            </motion.div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-400 font-medium italic">
                          Positions leaderboard will appear once all {students.length} student results are completed.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card >

        {/* Creation Selection Modal */}
        {showCreationMenu && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-[#274c77]/10"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black text-[#274c77] tracking-tight">Create Results</h3>
                    <p className="text-gray-500 mt-2 font-medium">Choose your entry method</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCreationMenu(false)}
                    className="h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-6 w-6 text-gray-400" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <button
                    onClick={() => {
                      setShowCreationMenu(false);
                      handleOpenCreateForm();
                    }}
                    className="group flex items-center gap-6 p-6 bg-gradient-to-br from-white to-blue-50/30 hover:to-blue-50 border border-gray-100 hover:border-blue-200 rounded-3xl transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-[#274c77]/5 text-[#274c77] flex items-center justify-center group-hover:bg-[#274c77] group-hover:text-white transition-all duration-300 font-bold">
                      <Plus className="h-8 w-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xl text-gray-900 leading-tight">Manual Entry</h4>
                      <p className="text-[13px] text-gray-500 mt-1 font-medium italic">Perfect for adding results for a single student</p>
                    </div>
                  </button>

                  {permissions.canBulkImportResults && (
                    <button
                      onClick={() => {
                        setShowCreationMenu(false);
                        setShowBulkUploadModal(true);
                      }}
                      className="group flex items-center gap-6 p-6 bg-gradient-to-br from-white to-emerald-50/30 hover:to-emerald-50 border border-gray-100 hover:border-emerald-200 rounded-3xl transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 font-bold">
                        <FileText className="h-8 w-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xl text-gray-900 leading-tight">Bulk Import</h4>
                        <p className="text-[13px] text-gray-500 mt-1 font-medium italic">Import results via CSV / Excel for the whole class</p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em]">Select an option to proceed</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {
          showCreateForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
              <Card className="w-full max-w-[92vw] max-h-[95vh] overflow-y-auto hide-scrollbar shadow-2xl border-0 bg-white rounded-2xl">
                <CardHeader className="bg-slate-50/50 border-b border-gray-100 flex flex-row items-center justify-between px-6 py-3 sticky top-0 z-20 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#274c77] text-white rounded-xl shadow-md shadow-blue-900/10">
                      {bulkEntryMode ? <ClipboardList className="h-4 w-4" /> : (editingResultId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black text-slate-800 tracking-tight leading-tight">
                        {bulkEntryMode ? 'Class Marksheet' : (editingResultId ? 'Edit Result' : 'New Result')}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 font-medium leading-tight">
                        {bulkEntryMode ? 'Bulk data entry mode' : (editingResultId ? 'Update marks' : 'Enter detail')}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!editingResultId && (
                      <Button
                        variant={bulkEntryMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setBulkEntryMode(!bulkEntryMode);
                          setSelectedStudent(null);
                          setMarksheetData({});
                        }}
                        className={cn(
                          "rounded-lg font-bold gap-2 h-9 px-4 text-xs",
                          bulkEntryMode ? "bg-[#274c77] hover:bg-[#1e3a5f]" : "border-slate-200 text-slate-600"
                        )}
                      >
                        {bulkEntryMode ? <User className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                        {bulkEntryMode ? "Single" : "Sheet"}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowCreateForm(false);
                        setBulkEntryMode(false);
                      }}
                      className="h-8 w-8 hover:bg-slate-100 rounded-full"
                    >
                      <X className="h-5 w-5 text-slate-400" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 px-0 py-0 overflow-visible relative">
                  {bulkEntryMode ? (
                    /* Spreadsheet / Sheet View Implementation */
                    <div className="flex flex-col h-[82vh]">
                      {/* Configuration Bar */}
                      <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Class</label>
                            <Select 
                              value={selectedClassroom?.toString()} 
                              onValueChange={(val) => setSelectedClassroom(parseInt(val))}
                            >
                              <SelectTrigger className="h-9 rounded-lg bg-white border-slate-200 font-bold text-xs min-w-[150px]">
                                <SelectValue placeholder="Select Class" />
                              </SelectTrigger>
                              <SelectContent className="rounded-lg">
                                {teacherProfile?.assigned_classrooms?.map((cr: any) => (
                                  <SelectItem key={cr.id} value={cr.id.toString()} className="text-xs font-semibold">
                                    {cr.name}
                                  </SelectItem>
                                ))}
                                {(!teacherProfile?.assigned_classrooms || teacherProfile.assigned_classrooms.length === 0) && teacherProfile?.assigned_classroom_id && (
                                   <SelectItem value={teacherProfile.assigned_classroom_id.toString()} className="text-xs font-semibold">
                                     {teacherProfile.assigned_classroom_name || 'Assigned Class'}
                                   </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Exam Type</label>
                            <Select value={examType} onValueChange={(val: any) => setExamType(val)}>
                              <SelectTrigger className="h-9 rounded-lg bg-white border-slate-200 font-bold text-xs min-w-[150px]">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent className="rounded-lg">
                                {EXAM_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs font-semibold">{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {examType === 'monthly' && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Month</label>
                              <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger className="h-9 rounded-lg bg-white border-slate-200 font-bold text-xs min-w-[150px]">
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                  {dynamicMonths.map(m => <SelectItem key={m} value={m} className="text-xs font-semibold">{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-none">
                           <Badge className="bg-[#274c77] text-white hover:bg-[#274c77] text-[9px] font-bold uppercase py-1 px-3 rounded-md animate-pulse">
                             Live Sheet
                           </Badge>
                        </div>
                      </div>

                      {/* Sticky Header Table Container */}
                      <div className="flex-1 overflow-auto hide-scrollbar relative border-t border-slate-200 bg-slate-50/30">
                        <table className="min-w-full text-sm border-separate border-spacing-0 bg-white shadow-sm">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="p-4 text-left font-black text-slate-500 text-[10px] uppercase tracking-widest min-w-[220px] bg-slate-100 sticky left-0 top-0 z-[60] border-r border-b border-slate-200 whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.05)]">
                                STUDENT ID / NAME
                              </th>
                              {poolSubjects.map((sub: any) => (
                                <th key={sub.id} className="p-4 text-center font-black text-slate-500 text-[10px] uppercase tracking-widest min-w-[180px] bg-slate-100 sticky top-0 z-40 border-r border-b border-slate-200">
                                  {sub.name}
                                  <div className="text-[9px] font-bold text-slate-400 mt-1.5 px-2 py-0.5 bg-white/50 rounded-full inline-block">MAX: {examType === 'monthly' ? 25 : 75}</div>
                                </th>
                              ))}
                              <th className="p-4 text-center font-black text-slate-500 text-[10px] uppercase tracking-widest min-w-[140px] bg-slate-100 sticky top-0 z-40 border-r border-b border-slate-200">Total Marks</th>
                              <th className="p-4 text-center font-black text-slate-500 text-[10px] uppercase tracking-widest min-w-[120px] bg-slate-100 sticky top-0 z-40 border-b border-slate-200">Result Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {students.map((student) => {
                              const studentMarks = marksheetData[student.id] || {};
                              
                              let total = 0;
                              let count = 0;
                              let hasAbsent = false;
                              
                              let hasFailedAttempt = false;
                              let attemptedAny = false;
                              
                              poolSubjects.forEach((sub: any) => {
                                if (studentMarks[`_absent_${sub.name}`]) {
                                  hasAbsent = true;
                                  count++;
                                } else if (studentMarks[sub.name] !== undefined) {
                                  const val = Number(studentMarks[sub.name]) || 0;
                                  total += val;
                                  count++;
                                  attemptedAny = true;
                                  const totalForSub = examType === 'monthly' ? 25 : 75;
                                  const threshold = totalForSub * (examType === 'midterm' ? 0.33 : 0.40);
                                  if (val < threshold) hasFailedAttempt = true;
                                }
                              });
                              
                              const maxPossible = poolSubjects.length * (examType === 'monthly' ? 25 : 75);
                              const percentage = maxPossible > 0 ? (total / maxPossible) * 100 : 0;
                              const alreadyExists = results.some((r: any) => {
                                const rStudentId = r.student?.id || r.student;
                                return (rStudentId === student.id) && 
                                       r.exam_type === examType && 
                                       (examType === 'monthly' ? r.month === month : true);
                              });

                              const passingThreshold = examType === 'midterm' ? 33 : 40;
                              const meetsPercentage = percentage >= passingThreshold;

                              let status = alreadyExists ? 'already exists' : 'pending';
                              if (count > 0 && !alreadyExists) {
                                if (hasFailedAttempt || !meetsPercentage) {
                                  status = 'fail';
                                } else if (hasAbsent) {
                                  status = 'absent';
                                } else {
                                  status = 'pass';
                                }
                              }

                              
                              return (
                                <tr key={student.id} className={cn(
                                  "hover:bg-blue-50/40 transition-colors group",
                                  alreadyExists && "opacity-50 pointer-events-none bg-slate-50"
                                )}>
                                  <td className="p-4 bg-white sticky left-0 z-30 border-r border-b border-slate-100 shadow-[4px_0_8px_rgba(0,0,0,0.05)]">
                                     <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                         {student.student_code?.slice(-2) || 'ST'}
                                       </div>
                                       <div className="flex flex-col">
                                         <span className="font-bold text-slate-800 text-xs truncate max-w-[160px]">{student.name}</span>
                                         <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">{student.student_code}</span>
                                       </div>
                                     </div>
                                  </td>
                                  
                                  {poolSubjects.map((sub: any) => {
                                    const isAbsent = !!studentMarks[`_absent_${sub.name}`];
                                    return (
                                      <td key={sub.id} className="p-4 border-r border-slate-100 text-center transition-all group/cell">
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="relative group">
                                            <input 
                                              type="number"
                                              placeholder={alreadyExists ? "EXISTS" : (isAbsent ? "ABS" : "0")}
                                              disabled={isAbsent || alreadyExists}
                                              value={isAbsent ? "" : (studentMarks[sub.name] ?? "")}
                                              onChange={(e) => {
                                                const val = e.target.value === "" ? undefined : Math.min(Number(e.target.value), (examType === 'monthly' ? 25 : 75));
                                                setMarksheetData(prev => ({
                                                  ...prev,
                                                  [student.id]: {
                                                    ...prev[student.id],
                                                    [sub.name]: val
                                                  }
                                                }));
                                              }}
                                              className={cn(
                                                "w-16 h-10 text-center rounded-lg border font-mono font-black text-slate-800 focus:outline-none focus:ring-2 transition-all hover:bg-white",
                                                isAbsent 
                                                  ? "bg-rose-50 border-rose-100 text-rose-500 placeholder:text-rose-300 ring-rose-200" 
                                                  : "bg-slate-50/30 border-slate-200 focus:ring-[#274c77] focus:border-transparent"
                                              )}
                                            />
                                            <button 
                                              disabled={alreadyExists}
                                              onClick={() => {
                                                setMarksheetData(prev => ({
                                                  ...prev,
                                                  [student.id]: {
                                                    ...prev[student.id],
                                                    [`_absent_${sub.name}`]: !isAbsent,
                                                    [sub.name]: !isAbsent ? undefined : prev[student.id]?.[sub.name]
                                                  }
                                                }));
                                              }}
                                              className={cn(
                                                "absolute -top-2 -right-2 w-5 h-5 rounded-full border text-[9px] font-black flex items-center justify-center transition-all shadow-sm z-10",
                                                isAbsent 
                                                  ? "bg-rose-500 text-white border-rose-500" 
                                                  : "bg-white text-slate-300 border-slate-100 hover:border-rose-200 hover:text-rose-400 group-hover/cell:scale-110"
                                              )}
                                              title={isAbsent ? "Mark as Present" : "Mark as Absent"}
                                            >
                                              A
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}

                                  <td className="p-4 text-center border-r border-slate-100 italic font-mono font-bold text-slate-400">
                                    <div className="flex flex-col">
                                      <span className="text-[#274c77]">{total}</span>
                                      <span className="text-[9px] text-slate-300">{percentage.toFixed(0)}%</span>
                                    </div>
                                  </td>
                                  
                                  <td className="p-4 text-center">
                                     <div className={cn(
                                        "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                        status === 'pending' ? "bg-slate-100 text-slate-400" : (
                                          status === 'already exists' ? "bg-amber-100 text-amber-600" : (
                                            status === 'absent' ? "bg-rose-100 text-rose-600" : (
                                              status === 'pass' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                            )
                                          )
                                        )
                                      )}>
                                        {status}
                                      </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center shadow-inner pt-6">
                        <div className="text-sm text-slate-400 font-medium">
                          Showing <span className="text-[#274c77] font-bold">{students.length}</span> students across <span className="text-[#274c77] font-bold">{poolSubjects.length}</span> subjects.
                        </div>
                        <div className="flex gap-3">
                           <Button variant="outline" className="rounded-xl font-bold border-slate-200 text-slate-600 px-8" onClick={() => setShowCreateForm(false)}>
                             Discard Sheet
                           </Button>
                           <Button 
                             disabled={creating || !examType || (examType === 'monthly' && !month) || Object.keys(marksheetData).length === 0}
                             className="bg-[#274c77] hover:bg-[#1e3a5f] text-white rounded-xl px-12 font-black shadow-lg shadow-blue-900/20 gap-2 h-11"
                             onClick={async () => {
                                try {
                              setCreating(true);
                                  let savedCount = 0;
                                  
                                  // Iterate through marked students only
                                  const markedStudentIds = Object.keys(marksheetData).map(Number);
                                  
                                  for (const studentId of markedStudentIds) {
                                    const studentMarks = marksheetData[studentId];
                                    if (!studentMarks || Object.keys(studentMarks).length === 0) continue;
                                    
                                    // Final safety check: skip if result already exists
                                    const alreadyExists = results.some((r: any) => {
                                      const rStudentId = r.student?.id || r.student;
                                      return (rStudentId === studentId) && 
                                             r.exam_type === examType && 
                                             (examType === 'monthly' ? r.month === month : true);
                                    });
                                    if (alreadyExists) continue;
                                    
                                    const formattedMarks = poolSubjects.map((sub: any) => {
                                      const isSubAbsent = !!studentMarks[`_absent_${sub.name}`];
                                      const obtained = Number(studentMarks[sub.name]) || 0;
                                      const totalForSub = examType === 'monthly' ? 25 : 75;
                                      
                                      return {
                                        subject_name: sub.name,
                                        total_marks: totalForSub,
                                        obtained_marks: isSubAbsent ? 0 : obtained,
                                        has_practical: false,
                                        practical_total: 0,
                                        practical_obtained: 0,
                                        is_absent: isSubAbsent,
                                        is_pass: !isSubAbsent && (obtained >= (totalForSub * (examType === 'midterm' ? 0.33 : 0.40))),
                                        is_included: true
                                      };
                                    });
                                    
                                    await createResult({
                                      student: studentId,
                                      exam_type: examType,
                                      month: examType === 'monthly' ? month : undefined,
                                      academic_year: '2024-25',
                                      semester: 'Spring',
                                      subject_marks: formattedMarks,
                                      teacher_remarks: 'Bulk generated marksheet'
                                    });
                                    savedCount++;
                                  }
                                  
                                  toast.success(`Successfully saved results for ${savedCount} students!`);
                                  setShowCreateForm(false);
                                  setBulkEntryMode(false);
                                  setMarksheetData({});
                                  fetchData();
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to save marksheet");
                                } finally {
                                  setCreating(false);
                                }
                             }}
                           >
                              {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                              Post Marks to Ledger
                           </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Existing Manual Selection Flow */
                    <div className="space-y-8 px-8 py-8">
                      {/* Step 1: Student Selection */}
                      <div className="space-y-4">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Select Student <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Popover open={openCombobox} onOpenChange={setOpenCombobox} modal={true}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCombobox}
                            className="w-full justify-between px-4 py-6 h-auto text-base font-normal bg-gray-50 border-gray-200 hover:bg-white hover:border-[#274c77] hover:ring-1 hover:ring-[#274c77]/20 transition-all shadow-sm rounded-xl text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                <Users className="h-5 w-5" />
                              </div>
                              {selectedStudent ? (
                                <div className="flex flex-col text-left">
                                  <span className="font-semibold text-gray-900">{selectedStudent.name || selectedStudent.full_name}</span>
                                  <span className="text-xs text-gray-500 font-mono">{selectedStudent.student_code || selectedStudent.student_id || selectedStudent.gr_no}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">Search student by name or code...</span>
                              )}
                            </div>
                            <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-40" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl rounded-xl border-gray-100" align="start">
                          <Command className="rounded-xl">
                            <CommandInput placeholder="Search student..." className="h-12" />
                            <CommandList>
                              <CommandEmpty>No student found.</CommandEmpty>
                              <CommandGroup>
                                {students.map((student) => {
                                  const label = `${student.student_code || student.student_id || student.gr_no} - ${student.name || student.full_name}`;
                                  return (
                                    <CommandItem
                                      key={student.id}
                                      value={label}
                                      onSelect={() => {
                                        handleStudentChange(student.id.toString());
                                        setOpenCombobox(false);
                                      }}
                                      className="py-3 px-4 cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-900"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-3 h-4 w-4 text-blue-600",
                                          selectedStudent?.id === student.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{student.name || student.full_name}</span>
                                        <span className="text-xs text-gray-500 font-mono">{student.student_code || student.student_id || student.gr_no}</span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Step 2: Exam Type Selection */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Exam Details <span className="text-red-500">*</span>
                    </label>
                    <div className="p-1.5 bg-gray-100 rounded-xl flex flex-wrap gap-1">
                      {EXAM_TYPES.map(type => {
                        const isExisting = selectedStudent && safeResults.some(r =>
                          r.student.id === selectedStudent.id &&
                          r.exam_type === type.value &&
                          r.id !== editingResultId
                        );

                        const isLocked = type.value === 'final' && selectedStudent && midTermCheck && !midTermCheck.mid_term_approved;

                        return (
                          <button
                            key={type.value}
                            disabled={!!isExisting || !!isLocked}
                            onClick={() => handleExamTypeChange(type.value as any)}
                            className={cn(
                              "flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all relative overflow-hidden",
                              examType === type.value
                                ? "bg-white text-[#274c77] shadow-sm ring-1 ring-gray-200"
                                : "text-gray-500 hover:bg-gray-200/50 hover:text-gray-700",
                              (isExisting || isLocked) && "opacity-50 cursor-not-allowed bg-transparent hover:bg-transparent"
                            )}
                            title={isLocked ? "Mid Term result must be approved first" : ""}
                          >
                            {type.label}
                            {isExisting && <span className="block text-[10px] font-normal text-gray-400 mt-0.5">(Exists)</span>}
                            {isLocked && <span className="block text-[10px] font-normal text-red-400 mt-0.5">(Locked)</span>}
                            {examType === type.value && (
                              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#274c77]" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {examType === 'monthly' && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <select
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                          className="w-full md:w-1/3 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#274c77]/20 focus:border-[#274c77] transition-all font-medium text-gray-700"
                        >
                          <option value="">Select Month</option>
                          {MONTHS.map(m => {
                            const isExisting = selectedStudent && safeResults.some(r =>
                              r.student.id === selectedStudent.id &&
                              r.exam_type === 'monthly' &&
                              r.month === m &&
                              r.id !== editingResultId
                            );

                            return (
                              <option key={m} value={m} disabled={!!isExisting}>
                                {m} {isExisting ? '(Already Created)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Duplicate Result Warning */}
                    {(() => {
                      if (!selectedStudent || !examType) return null;
                      const isDuplicate = safeResults.some(r =>
                        r.student.id === selectedStudent.id &&
                        r.exam_type === examType &&
                        (examType === 'monthly' ? r.month === month : true) &&
                        r.id !== editingResultId
                      );

                      if (isDuplicate && (examType !== 'monthly' || month)) {
                        return (
                          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800 flex items-start gap-3 mt-2 animate-in slide-in-from-top-1">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Result already exists</p>
                              <p className="text-orange-700/80 mt-1">A result for this student and exam type has already been created. Please edit the existing result instead.</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {examType === 'final' && midTermCheck && !midTermCheck.mid_term_approved && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800 flex items-start gap-3 mt-2">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Prerequisites not met</p>
                          <p className="text-red-700/80 mt-1">Mid-term result must be approved by the Principal before you can create a Final Term result.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Details: Attendance & Remarks */}
                  {selectedStudent && (
                    <div className="pt-6 border-t border-gray-100 animate-in fade-in duration-500 slide-in-from-bottom-2">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <FileText className="h-4 w-4" />
                        Additional Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Teacher Remarks</label>
                          <textarea
                            value={teacherRemarks}
                            onChange={(e) => setTeacherRemarks(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#274c77]/20 focus:border-[#274c77] min-h-[100px] transition-all text-sm"
                            placeholder="Enter detailed remarks about the student's performance..."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Subject Marks Entry */}
                  {selectedStudent && (
                    <div className="pt-6 border-t border-gray-100 animate-in fade-in duration-500 slide-in-from-bottom-2">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Award className="h-4 w-4" />
                          Subject Marks
                        </h3>
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                          Passing Criteria: {examType === 'midterm' ? '33%' : '40%'}
                        </Badge>
                      </div>

                      {/* Subject Pool Selector */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 rounded text-blue-700">
                              <Plus className="h-3 w-3" />
                            </div>
                            <span className="text-sm font-bold text-blue-900">Add Subjects from Pool</span>
                          </div>
                          {loadingPool && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {poolSubjects.length > 0 ? (
                            poolSubjects.map((sub) => {
                              const isAdded = subjectMarks.some(m => m.subject_name === sub.name);

                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => isAdded ? removeSubjectMark(sub.name) : addSubjectFromPool(sub)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 border",
                                    isAdded
                                      ? "bg-blue-600 text-white border-blue-600 shadow-blue-200 hover:bg-blue-700"
                                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                                  )}
                                >
                                  {isAdded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                  {sub.name}
                                </button>
                              );
                            })
                          ) : (
                            <div className="w-full text-center py-2">
                              <p className="text-xs text-slate-500 italic">No available subjects found for this class level.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                              <th className="py-4 px-6 text-left font-bold text-gray-600 text-xs uppercase tracking-wider">Subject Name</th>
                              <th className="py-4 px-6 text-center font-bold text-gray-600 text-xs uppercase tracking-wider">Marks Entry</th>
                              <th className="py-4 px-6 text-center font-bold text-gray-600 text-xs uppercase tracking-wider">Pass/Fail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {subjectMarks.map((mark, index) => {
                              return (
                                <tr key={mark.subject_name} className="hover:bg-blue-50/30 transition-colors duration-150 group">
                                  <td className="py-4 px-6 font-semibold text-gray-800">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                          <span className={cn("text-base", mark.is_included === false ? 'text-gray-400 line-through' : 'text-gray-800')}>
                                            {mark.subject_name}
                                          </span>
                                          <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleMarkChange(mark.subject_name, 'is_included', mark.is_included === false)}>
                                              <Checkbox
                                                id={`include-${mark.subject_name}`}
                                                checked={mark.is_included !== false}
                                                onCheckedChange={(checked) => handleMarkChange(mark.subject_name, 'is_included', !!checked)}
                                                className="w-3.5 h-3.5"
                                              />
                                              <label htmlFor={`include-${mark.subject_name}`} className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer select-none">
                                                Include
                                              </label>
                                            </div>
                                            <div className="h-3 w-px bg-gray-300"></div>
                                            <button
                                              className="text-[10px] font-bold text-red-500 uppercase hover:text-red-700 flex items-center gap-1"
                                              onClick={() => removeSubjectMark(mark.subject_name)}
                                            >
                                              <X className="h-3 w-3" /> Remove
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className={`flex gap-3 justify-center items-center ${(mark.is_included === false || mark.is_absent) ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                      {/* Total Marks */}
                                      <div className="relative group/input">
                                        <div className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-400 group-focus-within/input:text-[#274c77] transition-colors">Total</div>
                                        <input
                                          type="number"
                                          value={mark.total_marks}
                                          onChange={(e) => handleMarkChange(mark.subject_name, 'total_marks', parseInt(e.target.value) || 0)}
                                          className="w-20 pl-3 pr-2 py-2 text-center border-2 border-gray-200 rounded-lg font-mono font-bold text-gray-600 focus:outline-none focus:border-[#274c77] focus:ring-0 transition-all bg-gray-50/50"
                                          min="0"
                                        />
                                      </div>

                                      <div className="text-gray-300 font-light text-2xl">/</div>

                                      {/* Obtained Marks */}
                                      <div className="relative group/input">
                                        <div className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-400 group-focus-within/input:text-[#274c77] transition-colors">Obtained</div>
                                        <input
                                          type="number"
                                          value={mark.is_absent ? 0 : mark.obtained_marks}
                                          disabled={mark.is_absent}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            handleMarkChange(mark.subject_name, 'obtained_marks', parseInt(val) || 0);
                                          }}
                                          className={cn(
                                            "w-24 pl-3 pr-2 py-2 text-center border-2 rounded-lg font-mono font-bold text-xl focus:outline-none focus:ring-0 transition-all",
                                            mark.is_absent
                                              ? "border-orange-200 text-orange-400 bg-orange-50/30 cursor-not-allowed"
                                              : mark.is_pass
                                                ? "border-green-200 focus:border-green-500 text-green-700 bg-green-50/20"
                                                : "border-red-200 focus:border-red-500 text-red-700 bg-red-50/20"
                                          )}
                                          min="0"
                                          onKeyDown={(e) => {
                                            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                          }}
                                        />
                                      </div>


                                      {mark.has_practical && examType !== 'monthly' && (
                                        <div className="flex items-center gap-2 ml-2 bg-yellow-50 p-1.5 rounded-lg border border-yellow-100">
                                          <div className="h-full w-0.5 bg-yellow-200 mx-1"></div>
                                          <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-bold text-yellow-700 uppercase mb-0.5">Prac.</span>
                                            <input
                                              type="number"
                                              value={mark.practical_obtained || 0}
                                              onChange={(e) => handleMarkChange(mark.subject_name, 'practical_obtained', parseInt(e.target.value) || 0)}
                                              className="w-14 text-center border border-yellow-200 rounded text-sm p-1 font-bold text-yellow-800 focus:border-yellow-500 outline-none"
                                              min="0"
                                              placeholder="Obt"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <div className="flex justify-center gap-1">
                                      {mark.is_included === false ? (
                                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200">Excluded</Badge>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            title="Pass"
                                            onClick={() => handleMarkChange(mark.subject_name, 'is_absent', false)}
                                            className={cn(
                                              "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                                              !mark.is_absent && mark.is_pass
                                                ? "bg-green-100 text-green-700 border-green-300 shadow-sm"
                                                : "bg-gray-50 text-gray-400 border-gray-200 hover:border-green-200 hover:text-green-600"
                                            )}
                                          >Pass</button>
                                          <button
                                            type="button"
                                            title="Fail"
                                            onClick={() => handleMarkChange(mark.subject_name, 'is_absent', false)}
                                            className={cn(
                                              "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                                              !mark.is_absent && !mark.is_pass
                                                ? "bg-red-100 text-red-700 border-red-300 shadow-sm"
                                                : "bg-gray-50 text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-600"
                                            )}
                                          >Fail</button>
                                          <button
                                            type="button"
                                            title="Absent"
                                            onClick={() => handleMarkChange(mark.subject_name, 'is_absent', !mark.is_absent)}
                                            className={cn(
                                              "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                                              mark.is_absent
                                                ? "bg-orange-100 text-orange-700 border-orange-300 shadow-sm"
                                                : "bg-gray-50 text-gray-400 border-gray-200 hover:border-orange-200 hover:text-orange-600"
                                            )}
                                          >Absent</button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Section */}
                      <div className="mt-6">
                        <div className={`rounded-xl p-6 border transition-all ${calculateTotals().overallStatus === 'pass'
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm'
                          : calculateTotals().overallStatus === 'absent'
                            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm'
                            : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 shadow-sm'
                          }`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div>
                              <h4 className={`text-lg font-bold flex items-center gap-2 ${calculateTotals().overallStatus === 'pass' ? 'text-green-800' : calculateTotals().overallStatus === 'absent' ? 'text-amber-800' : 'text-red-800'}`}>
                                {calculateTotals().overallStatus === 'pass' ? <CheckCircle className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                                {calculateTotals().overallStatus === 'pass' ? 'Overall Result: PASS' : calculateTotals().overallStatus === 'absent' ? 'Overall Result: ABSENT' : 'Overall Result: FAIL'}
                              </h4>
                              {calculateTotals().overallStatus === 'fail' && (
                                <p className="text-sm text-red-600 mt-1 max-w-md">
                                  Student has failed one or more mandatory subjects or has not met the {examType === 'midterm' ? '33%' : '40%'} aggregate criteria.
                                </p>
                              )}
                              {calculateTotals().overallStatus === 'absent' && (
                                <p className="text-sm text-amber-600 mt-1 max-w-md">
                                  Student was absent for one or more subjects resulting in an Absent status.
                                </p>
                              )}
                            </div>
                            <div className="text-right bg-white/60 p-3 rounded-xl border border-white/50 backdrop-blur-sm">
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Percentage</div>
                              <div className={`font-mono text-3xl font-black ${calculateTotals().overallStatus === 'pass' ? 'text-green-600' : calculateTotals().overallStatus === 'absent' ? 'text-amber-600' : 'text-red-600'}`}>
                                {calculateTotals().overallStatus === 'absent' ? 'N/A' : `${calculateTotals().percentage.toFixed(1)}%`}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white/80 p-3 rounded-lg border border-gray-100 text-center">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Marks</div>
                              <div className="text-xl font-bold text-gray-800">{calculateTotals().overallStatus === 'absent' ? 'N/A' : calculateTotals().totalMarks}</div>
                            </div>
                            <div className="bg-white/80 p-3 rounded-lg border border-gray-100 text-center">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Obtained</div>
                              <div className="text-xl font-bold text-[#274c77]">{calculateTotals().overallStatus === 'absent' ? 'N/A' : calculateTotals().obtainedMarks}</div>
                            </div>
                            <div className="bg-white/80 p-3 rounded-lg border border-gray-100 text-center">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Subjects Passed</div>
                              <div className="text-xl font-bold text-gray-800">{subjectMarks.filter(s => s.is_included !== false && s.is_pass).length}/{subjectMarks.filter(s => s.is_included !== false).length}</div>
                            </div>
                            <div className="bg-white/80 p-3 rounded-lg border border-gray-100 text-center">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Attendance</div>
                              <div className="text-xl font-bold text-gray-800">{fetchingAttendance ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${attendanceScore || 0}/${totalAttendance || 0}`}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-4 pt-6 mt-6 border-t border-gray-200">
                    <Button
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingResultId(null);
                        setSelectedStudent(null);
                      }}
                      variant="outline"
                      className="px-6 py-2.5 h-auto text-base font-semibold border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateResult}
                      disabled={creating || !selectedStudent || (examType === 'monthly' && !month) || safeResults.some(r =>
                        r.student.id === selectedStudent?.id &&
                        r.exam_type === examType &&
                        (examType === 'monthly' ? r.month === month : true) &&
                        r.id !== editingResultId
                      )}
                      className={cn(
                        "px-8 py-2.5 h-auto text-base font-semibold w-full sm:w-auto shadow-lg shadow-blue-900/20 transition-all active:scale-95",
                        "bg-gradient-to-r from-[#274c77] to-[#1e3a5f] hover:from-[#355f8f] hover:to-[#2a4d7a] text-white border-0"
                      )}
                    >
                      {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <div className="flex items-center gap-2">
                          {editingResultId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                          <span>{editingResultId ? 'Update Result' : 'Create Result'}</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
                )}
                </CardContent>
              </Card>
            </div>
          )
        }

        {
          showBulkModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Bulk Forward Results
                  </CardTitle>
                  <CardDescription>
                    Forward {selectedResults.length} selected results to coordinator
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">


                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleBulkForward}
                      disabled={bulkProcessing}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {bulkProcessing ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        'Forward All'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowBulkModal(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        }

      </div>

      {/* Report Card Modal */}
      {
        showBulkUploadModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <ResultBulkUpload
              initialExamType={bulkUploadExamType || activeCategory}
              initialMonth={activeTab}
              onClose={() => setShowBulkUploadModal(false)}
            />
          </div>
        )
      }


      {
        showReportCard && reportCardData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:overflow-visible print:block print:relative print:z-0 print:!bg-white print:inset-auto print:backdrop-filter-none">
            <div className="bg-white rounded-lg w-full max-w-[215mm] max-h-[95vh] overflow-y-auto shadow-2xl print:shadow-none print:max-w-full print:max-h-full print:overflow-visible print:rounded-none">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg sticky top-0 z-10 print:hidden">
                <h3 className="font-bold text-lg text-[#274c77]">Student Report Card</h3>
                <div className="flex gap-2">
                  <Button onClick={() => window.print()} variant="outline" className="flex gap-2">
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button onClick={() => setShowReportCard(false)} variant="ghost" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="p-8 print:p-0">
                <ReportCard
                  student={reportCardData.student}
                  results={reportCardData.results}
                  activeMonth={activeCategory === 'monthly' ? activeTab : undefined}
                />
              </div>
            </div>
          </div>
        )
      }
      {/* Floating Action Bar for Bulk Download */}
      <AnimatePresence>
        {selectedStudentsForDownload.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white border border-[#274c77]/20 shadow-[0_20px_50px_rgba(39,76,119,0.3)] rounded-2xl p-4 flex items-center gap-6"
          >
            <div className="flex items-center gap-3 px-2 border-r border-gray-200">
              <div className="bg-[#274c77] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {selectedStudentsForDownload.length}
              </div>
              <div className="text-sm">
                <p className="font-bold text-[#274c77]">Students Selected</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Ready for bulk download</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleBulkDownload('separate')}
                disabled={downloadingBulk}
                className="bg-[#274c77] hover:bg-[#1e3a5f] text-white gap-2 h-11 px-6 rounded-xl shadow-lg"
              >
                {downloadingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Report Cards (ZIP)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStudentsForDownload([])}
                className="text-gray-400 hover:text-red-500 h-11 px-4 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
