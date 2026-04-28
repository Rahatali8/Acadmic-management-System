"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserRole, getCurrentUser, usePermissions } from "@/lib/permissions";
import { getFilteredStudents, getAllCampuses, getLevels, getGrades, getClassrooms, getCurrentUserProfile, bulkAssignClassroom, bulkMarkAsAlumni, getStudentFormOptions } from "@/lib/api";
import { DataTable, PaginationControls, ListFilters } from "@/components/shared";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { User, Search, RefreshCcw, Mail, GraduationCap, MapPin, CheckCircle, XCircle, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calender";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiBaseUrl } from "@/lib/api";
import { StudentForm } from "@/components/admin/studentform";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  student_id: string;
  student_code: string;
  gr_no: string;
  current_grade: string;
  section: string;
  current_state: string;
  gender: string;
  campus_name: string;
  classroom_name: string;
  father_name: string;
  contact_number: string;
  email: string;
  coordinator_names: string[];
  is_active?: boolean;
}

interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  results: Student[];
}

export default function StudentListPage() {
  const router = useRouter();
  const perms = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Bulk Actions
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [targetClassroom, setTargetClassroom] = useState<number | null | 'alumni' | undefined>(undefined);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    campus: "",
    current_grade: "",
    section: "",
    current_state: "",
    gender: "",
    shift: "",
    ordering: "name"
  });

  // User role and campus info
  const [userRole, setUserRole] = useState<string>("");
  const [userCampus, setUserCampus] = useState<string>("");
  const [userCampusId, setUserCampusId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [teacherShifts, setTeacherShifts] = useState<string[]>([]);
  const [showShiftFilter, setShowShiftFilter] = useState(true);
  const [teacherSections, setTeacherSections] = useState<string[]>([]);
  const [showSectionFilter, setShowSectionFilter] = useState(true);
  const [teacherGrades, setTeacherGrades] = useState<string[]>([]);
  const [showGradeFilter, setShowGradeFilter] = useState(true);
  const [teacherGradeSectionMap, setTeacherGradeSectionMap] = useState<Record<string, string[]>>({});

  // Edit functionality
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [formOptions, setFormOptions] = useState<any>(null);

  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleBulkUpdate = async () => {
    if (selectedStudents.length === 0 || targetClassroom === undefined) return;

    setIsProcessingBulk(true);
    try {
      if (targetClassroom === 'alumni') {
        await bulkMarkAsAlumni(selectedStudents);
      } else {
        await bulkAssignClassroom(selectedStudents, targetClassroom);
      }
      setShowBulkDialog(false);
      setSelectedStudents([]);
      setTargetClassroom(undefined);
      // Refresh list
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to move students');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  useEffect(() => {
    initializeUserData();
    fetchFormOptions();
  }, []);

  const fetchFormOptions = async () => {
    try {
      const options = await getStudentFormOptions();
      if (options) setFormOptions(options);
    } catch (err) {
      console.error("Failed to fetch form options:", err);
    }
  };

  // Fetch grades when campus or shift changes
  useEffect(() => {
    fetchGrades();
  }, [filters.campus, filters.shift]);

  // When shift cleared, also clear selected grade

  useEffect(() => {
    fetchClassrooms();
  }, [filters.campus, userCampusId]);

  useEffect(() => {
    fetchStudents();
  }, [currentPage, pageSize, filters, searchQuery]);

  const fetchClassrooms = async () => {
    try {
      const campusId = filters.campus ? parseInt(filters.campus) : (userCampusId || undefined);
      const data: any = await getClassrooms(undefined, undefined, campusId);
      const rooms = Array.isArray(data) ? data : (data?.results || []);
      setClassrooms(rooms);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    }
  };

  const initializeUserData = async () => {
    const role = getCurrentUserRole();
    setUserRole(role);

    // Get user campus info
    const user = getCurrentUser() as any;
    if (user?.campus?.campus_name) {
      setUserCampus(user.campus.campus_name);
    }
    if (user?.campus?.id) {
      setUserCampusId(user.campus.id);
    }

    // For teachers, fetch their profile and classrooms to determine shifts
    if (role === 'teacher') {
      try {
        // Teachers never see the Shift filter
        setShowShiftFilter(false);

        const profile: any = await getCurrentUserProfile();
        if (profile) {
          // Get teacher's campus ID
          const teacherCampusId = profile.campus?.id || profile.campus_id || user?.campus?.id;
          if (teacherCampusId) {
            setUserCampusId(teacherCampusId);
            // Campus filter is hidden for teachers, so no need to pre-fill
          }

          // Get teacher's assigned classrooms from profile
          // Handle both assigned_classrooms (array) and assigned_classroom (single object)
          let classroomsList: any[] = [];

          if (profile.assigned_classrooms && Array.isArray(profile.assigned_classrooms) && profile.assigned_classrooms.length > 0) {
            classroomsList = profile.assigned_classrooms;
          } else if (profile.assigned_classroom) {
            // Fallback to singular assigned_classroom if assigned_classrooms is empty
            classroomsList = [profile.assigned_classroom];
          } else if (profile.classrooms && Array.isArray(profile.classrooms)) {
            classroomsList = profile.classrooms;
          }



          if (classroomsList.length > 0) {
            // Get unique shifts, sections, and grades from teacher's classrooms
            const shifts = new Set<string>();
            const sections = new Set<string>();
            const grades = new Set<string>();
            const gradeSectionMap: Record<string, Set<string>> = {};

            classroomsList.forEach((classroom: any) => {

              if (classroom.shift) {
                shifts.add(classroom.shift.toLowerCase());
              }
              if (classroom.section) {
                sections.add(classroom.section.toUpperCase());
              }
              // Backend returns grade as string in 'grade' field
              let gradeLabel: string | null = null;
              if (classroom.grade) {
                if (typeof classroom.grade === 'string') {
                  gradeLabel = classroom.grade;
                } else if (classroom.grade?.name) {
                  gradeLabel = classroom.grade.name;
                }
              } else if (classroom.grade_name) {
                gradeLabel = classroom.grade_name;
              }

              if (gradeLabel) {
                grades.add(gradeLabel);
                const key = gradeLabel.toString();
                const sectionLabel = classroom.section ? classroom.section.toUpperCase() : '';
                if (sectionLabel) {
                  if (!gradeSectionMap[key]) {
                    gradeSectionMap[key] = new Set<string>();
                  }
                  gradeSectionMap[key].add(sectionLabel);
                }
              }
            });

            const shiftsArray = Array.from(shifts);
            const sectionsArray = Array.from(sections);
            const gradesArray = Array.from(grades);



            setTeacherShifts(shiftsArray);
            setTeacherSections(sectionsArray);
            setTeacherGrades(gradesArray);
            // Convert grade→sections map to plain arrays for easier use in filters
            const mapObj: Record<string, string[]> = {};
            Object.entries(gradeSectionMap).forEach(([gradeKey, sectionSet]) => {
              mapObj[gradeKey] = Array.from(sectionSet as Set<string>);
            });
            setTeacherGradeSectionMap(mapObj);

            // Auto-fill grade filter if teacher has only one grade
            const newFilters: any = {};

            // Section filter logic - DON'T auto-filter by section
            // A classroom can have students from multiple sections, so we shouldn't auto-filter
            // This ensures teachers see all students in their assigned classrooms
            setShowSectionFilter(true);
            // Don't set section filter automatically - let teachers see all sections in their classrooms

            // Grade filter logic
            if (gradesArray.length === 1) {
              newFilters.current_grade = gradesArray[0];
              setShowGradeFilter(false);

            } else {
              setShowGradeFilter(true);
            }

            // Apply all filters at once
            if (Object.keys(newFilters).length > 0) {

              setFilters(prev => ({ ...prev, ...newFilters }));
            }
          } else {
            // Fallback: Get all classrooms from campus if teacher classrooms not in profile
            if (teacherCampusId) {
              const allClassrooms: any = await getClassrooms(undefined, undefined, teacherCampusId);
              const allClassroomsList = Array.isArray(allClassrooms)
                ? allClassrooms
                : Array.isArray(allClassrooms?.results)
                  ? allClassrooms.results
                  : [];

              // Get unique shifts from all classrooms
              const shifts = new Set<string>();
              allClassroomsList.forEach((classroom: any) => {
                if (classroom.shift) {
                  shifts.add(classroom.shift.toLowerCase());
                }
              });

              const shiftsArray = Array.from(shifts);
              setTeacherShifts(shiftsArray);

              // For teachers we don't expose shift filter; don't auto-set or show it
              setShowShiftFilter(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching teacher profile:', error);
      }
    }

    // Fetch campuses for filter dropdown
    try {
      const campusesData = await getAllCampuses();
      setCampuses(Array.isArray(campusesData) ? campusesData : []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchGrades = async () => {
    try {
      const campusId = filters.campus ? parseInt(filters.campus) : undefined;
      const gradesData: any = await getGrades(undefined, campusId);
      const gradesArray: any[] = gradesData?.results || (Array.isArray(gradesData) ? gradesData : []);

      let filtered: any[] = gradesArray;
      if (filters.shift) {
        // Use classrooms API to determine which grades are available for selected shift
        const classroomsData: any = await getClassrooms(undefined, undefined, campusId, filters.shift);
        const classrooms: any[] = Array.isArray(classroomsData)
          ? classroomsData
          : Array.isArray(classroomsData?.results)
            ? classroomsData.results
            : [];
        const gradeIds = new Set(
          classrooms.map((c: any) => c.grade || c.grade_id || c.gradeId).filter(Boolean)
        );
        const gradeNamesFromRooms = new Set(
          classrooms.map((c: any) => c.grade_name || c.gradeName).filter(Boolean)
        );
        filtered = gradesArray.filter((g: any) =>
          gradeIds.size > 0
            ? gradeIds.has(g.id)
            : gradeNamesFromRooms.size > 0
              ? gradeNamesFromRooms.has(g.name)
              : true
        );
      }

      // De-duplicate by name to avoid repeated entries
      const seen = new Set<string>();
      const deduped = filtered.filter((g: any) => {
        const key = (g.name || '').toString().trim().toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setGrades(deduped);
    } catch (error) {
      console.error('Error fetching grades:', error);
      setGrades([]);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery || undefined,
        // Only send campus filter for superadmin - backend handles role-based filtering for others
        campus: (userRole === 'superadmin' && filters.campus) ? parseInt(filters.campus) : undefined,
        // Send grade to backend - backend now handles normalization
        current_grade: filters.current_grade || undefined,
        section: filters.section || undefined,
        current_state: filters.current_state || undefined,
        gender: filters.gender || undefined,
        shift: filters.shift || undefined,
        ordering: filters.ordering
      };

      const response = await getFilteredStudents(params) as unknown as PaginationInfo;
      // Fallback: if backend ignores page_size and returns more, slice locally
      let pageResults = (response.results || []);
      if (Array.isArray(pageResults) && pageResults.length > pageSize) {
        pageResults = pageResults.slice(0, pageSize);
      }
      // Client-side normalization for grade names (Grade 1, Grade I, Grade-1 etc.)
      const normalizeGradeName = (value: string | null | undefined): string => {
        if (!value) return '';
        const s = value.toString().trim().toLowerCase();
        // extract number or roman
        // map roman numerals up to 12
        const romanMap: Record<string, string> = {
          'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10', 'xi': '11', 'xii': '12'
        };
        const cleaned = s.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        // try to find digits
        const digitMatch = cleaned.match(/\b(\d{1,2})\b/);
        let num = digitMatch ? digitMatch[1] : '';
        if (!num) {
          // try roman tokens
          const tokens = cleaned.split(' ');
          for (const t of tokens) {
            if (romanMap[t]) { num = romanMap[t]; break; }
          }
        }
        if (!num) return cleaned; // fallback
        return `grade ${num}`; // canonical form
      };

     
      // override the backend's sorting criteria.
      const results = [...pageResults];

      // Grade filtering is now done on backend, so no need for client-side filtering

      setStudents(results);
      // Use backend count since all filtering is done server-side now
      const countBase = response.count || results.length || 0;
      setTotalCount(countBase);
      const computedTotalPages = Math.ceil(countBase / pageSize) || 1;
      setTotalPages(computedTotalPages);
      if (currentPage > computedTotalPages) {
        setCurrentPage(computedTotalPages);
        return; // trigger refetch with clamped page
      }

    } catch (err: any) {
      // Handle invalid page gracefully by stepping back one page (or to 1)
      if (err?.status === 404 || /invalid page/i.test(err?.message || '')) {
        setCurrentPage(prev => Math.max(1, prev - 1));
        return;
      }
      console.error("Error fetching students:", err);
      setError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // If search is empty, fetch immediately without debounce
    if (value.trim() === '') {
      fetchStudents();
      return;
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchStudents();
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };

      // For teachers: when grade changes, auto-select a matching section (if we know one)
      if (userRole === 'teacher' && key === 'current_grade' && value) {
        const sectionsForGrade = teacherGradeSectionMap[value] || [];
        if (sectionsForGrade.length > 0) {
          next.section = sectionsForGrade[0];
        }
      }

      return next;
    });
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleQuickFilter = (type: string, value?: string) => {
    switch (type) {
      case 'all':
        setFilters(prev => ({ 
          ...prev, 
          ordering: 'name', 
          gender: '',
          shift: '',
          current_grade: '',
          section: '',
          campus: userCampusId ? String(userCampusId) : ""
        }));
        setSearchQuery("");
        break;
      case 'alphabetical':
        // Toggle: name -> -name -> name
        setFilters(prev => ({ 
          ...prev, 
          ordering: prev.ordering === 'name' ? '-name' : 'name' 
        }));
        break;
      case 'recent':
        setFilters(prev => ({ ...prev, ordering: '-id' }));
        break;
      case 'gender':
        setFilters(prev => ({ ...prev, gender: value === 'all' ? '' : value || '' }));
        break;
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      campus: userCampusId ? String(userCampusId) : "",
      current_grade: "",
      section: "",
      current_state: "",
      gender: "",
      shift: "",
      ordering: "name"
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleClearFiltersClick = () => {
    setIsClearing(true);
    try {
      clearFilters();
    } finally {
      // brief rotation cycle
      setTimeout(() => setIsClearing(false), 700);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Edit handlers
  const handleEdit = async (student: Student) => {
    try {
      setEditingStudent(student);

      // Fetch full student data
      const baseForRead = getApiBaseUrl();
      const cleanBaseForRead = baseForRead.endsWith('/') ? baseForRead.slice(0, -1) : baseForRead;
      const response = await fetch(`${cleanBaseForRead}/api/students/${student.id}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const studentData = await response.json();

        // Helper: normalize international phone to local 11-digit Pakistani format
        // +923121234133 -> 03121234133, already 03xx -> keep as is
        const normalizePhone = (phone: string | null | undefined): string => {
          if (!phone) return ''
          let p = phone.toString().trim()
          // Remove spaces/dashes
          p = p.replace(/[\s\-]/g, '')
          // +92XXXXXXXXXX -> 0XXXXXXXXXX
          if (p.startsWith('+92')) return '0' + p.slice(3)
          // 92XXXXXXXXXX (without +) -> 0XXXXXXXXXX
          if (p.startsWith('92') && p.length === 12) return '0' + p.slice(2)
          return p
        }
        // Load full data; UI will hide specific fields (grade/section/GR/shift/is_draft)
        const formData = {
          name: studentData.name || '',
          gender: studentData.gender || '',
          dob: studentData.dob || '',
          place_of_birth: studentData.place_of_birth || '',
          religion: studentData.religion || '',
          mother_tongue: studentData.mother_tongue || '',
          emergency_contact: normalizePhone(studentData.emergency_contact),
          father_name: studentData.father_name || '',
          father_cnic: studentData.father_cnic ? studentData.father_cnic.replace(/\D/g,'') : '',
          father_contact: normalizePhone(studentData.father_contact),
          father_profession: studentData.father_profession || '',
          address: studentData.address || '',
          guardian_name: studentData.guardian_name || '',
          guardian_cnic: studentData.guardian_cnic || '',
          guardian_contact: studentData.guardian_contact || '',
          guardian_relation: studentData.guardian_relation || '',
          current_grade: studentData.current_grade || '',
          section: studentData.section || '',
          last_class_passed: studentData.last_class_passed || '',
          last_school_name: studentData.last_school_name || '',
          last_class_result: studentData.last_class_result || '',
          from_year: studentData.from_year || '',
          to_year: studentData.to_year || '',
          siblings_count: studentData.siblings_count || '',
          father_status: studentData.father_status || '',
          sibling_in_alkhair: studentData.sibling_in_alkhair || '',
          gr_no: studentData.gr_no || '',
          enrollment_year: studentData.enrollment_year || '',
          shift: studentData.shift || '',
          is_draft: studentData.is_draft ? 'true' : 'false',
          is_active: studentData.is_active !== undefined ? studentData.is_active : true,
          classroom: studentData.classroom || studentData.classroom_id || '',
          photo: studentData.photo || null,
          email: studentData.email || '',
          student_cnic: studentData.student_cnic || '',
          nationality: studentData.nationality || '',
          blood_group: studentData.blood_group || '',
          phone_number: normalizePhone(studentData.phone_number),
          mother_name: studentData.mother_name || '',
          mother_contact: normalizePhone(studentData.mother_contact),
          mother_profession: studentData.mother_profession || '',
          mother_status: studentData.mother_status || '',
        };

        // Fetch classrooms for this student's campus and shift
        if (studentData.campus) {
          const campusId = typeof studentData.campus === 'object' ? studentData.campus.id : studentData.campus;
          const studentShift = studentData.shift || '';
          try {
            const classroomsData: any = await getClassrooms(undefined, undefined, campusId, studentShift);
            const classroomsList: any[] = Array.isArray(classroomsData)
              ? classroomsData
              : Array.isArray(classroomsData?.results)
                ? classroomsData.results
                : [];
            setClassrooms(classroomsList);
          } catch (error) {
            console.error('Error fetching classrooms:', error);
            setClassrooms([]);
          }
        }

        setEditFormData(formData);
        setShowEditDialog(true);
      } else {
        console.error('Error fetching student data:', response.statusText);
        toast.error('Error loading student data');
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Error loading student data');
    }
  };

  const handleDeletePhoto = async () => {
    if (!editingStudent) return;

    // If the photo in state is a File object (not uploaded yet), just clear it locally
    if (editFormData.photo && editFormData.photo instanceof File) {
      setEditFormData((prev: any) => ({ ...prev, photo: null }));
      return;
    }

    // Otherwise request backend to delete stored photo
    try {
      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith('/') ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const resp = await fetch(`${cleanBaseForUpdate}/api/students/${editingStudent.id}/delete-photo/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
        },
      });

      if (resp.ok) {
        // clear preview
        setEditFormData((prev: any) => ({ ...prev, photo: null }));
        toast.success('✅ Photo deleted');
      } else {
        const text = await resp.text();
        console.error('Failed to delete photo:', resp.status, text);
        toast.error(`Error deleting photo: ${resp.status} - ${text}`);
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast.error('Error deleting photo');
    }
  };

  const handleEditClose = () => {
    setEditingStudent(null);
    setShowEditDialog(false);
    setEditFormData({});
  };

  const handleEditSubmit = async () => {
    if (!editingStudent) return;

    setIsSubmitting(true);
    try {
      // Handle photo upload first if there's a new photo
      let photoUrl = editFormData.photo;
      if (editFormData.photo && editFormData.photo instanceof File) {
        const formData = new FormData();
        formData.append('photo', editFormData.photo);

        const baseForUpdate = getApiBaseUrl();
        const cleanBaseForUpdate = baseForUpdate.endsWith('/') ? baseForUpdate.slice(0, -1) : baseForUpdate;

        try {
          const photoResponse = await fetch(`${cleanBaseForUpdate}/api/students/${editingStudent.id}/upload-photo/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
            },
            body: formData,
          });

          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            photoUrl = photoData.photo_url; // Get the URL of the uploaded photo
            // update local form preview to use server URL (but do NOT send this URL again in the PATCH body)
            setEditFormData((prev: any) => ({ ...prev, photo: photoUrl }));
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
        }
      }

      // Prepare update data - send all provided values EXCEPT excluded fields
      // Note: classroom is NOT excluded - we want to allow classroom updates
      const excludeKeys = new Set(['current_grade', 'section', 'gr_no', 'shift', 'is_draft', 'photo', '_alumni']);
      const updateData: any = {};

      // Handle alumni flag
      if (editFormData._alumni) {
        updateData.classroom = null;
        updateData.current_grade = 'Alumni';
        updateData.section = null;
        updateData.is_active = false;
      }
      Object.keys(editFormData).forEach(key => {
        if (excludeKeys.has(key)) return;
        // Include classroom even if it's null (to allow removing assignment)
        if (key === 'classroom') {
          updateData[key] = editFormData[key] !== undefined ? (editFormData[key] || null) : undefined;
        } else if (editFormData[key] !== '' && editFormData[key] !== null && editFormData[key] !== undefined) {
          updateData[key] = editFormData[key];
        }
      });



      // Convert numeric fields
      if (updateData.from_year) updateData.from_year = parseInt(updateData.from_year);
      if (updateData.to_year) updateData.to_year = parseInt(updateData.to_year);
      if (updateData.enrollment_year) updateData.enrollment_year = parseInt(updateData.enrollment_year);
      if (updateData.siblings_count) updateData.siblings_count = parseInt(updateData.siblings_count);

      // Normalize phone fields for backend (must be international format e.g. +923xx)
      const phoneFields = ['phone_number', 'emergency_contact', 'father_contact', 'mother_contact', 'guardian_contact'];
      phoneFields.forEach(field => {
        if (editFormData[field] && typeof editFormData[field] === 'string') {
          let p = editFormData[field].trim();
          if (p.startsWith('0')) {
            updateData[field] = '+92' + p.slice(1);
          } else if (p.startsWith('+92')) {
            updateData[field] = p;
          } else if (p && !p.startsWith('+')) {
            updateData[field] = '+92' + p;
          }
        }
      });

      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith('/') ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const response = await fetch(`${cleanBaseForUpdate}/api/students/${editingStudent.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success("Student Updated", {
          description: `Student ${editFormData.name || editingStudent.name} has been updated successfully!`,
        });
        setShowEditDialog(false);
        setEditingStudent(null);
        setEditFormData({});
        // Refresh the students list
        fetchStudents();
      } else {
        const errorText = await response.text();
        let details = "";

        try {
          const errorData = JSON.parse(errorText);
          if (errorData && typeof errorData === 'object') {
            const errorMessages: string[] = [];
            Object.keys(errorData).forEach((field) => {
              const fieldErrors = errorData[field];
              const fieldLabel = field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              if (Array.isArray(fieldErrors)) {
                fieldErrors.forEach((err: string) => {
                  errorMessages.push(`${fieldLabel}: ${err}`);
                });
              } else if (typeof fieldErrors === 'string') {
                errorMessages.push(`${fieldLabel}: ${fieldErrors}`);
              }
            });
            if (errorMessages.length > 0) {
              details = errorMessages.join('\n');
            }
          }
        } catch (e) {
          details = errorText;
        }

        toast.error("Update Failed", {
          description: (
            <div className="mt-1 whitespace-pre-wrap text-xs opacity-90">
              {details || `Error updating student: ${response.status}`}
            </div>
          ),
        });
      }
    } catch (error: any) {
      toast.error("Error", {
        description: error?.message || 'Error updating student',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDobSelect = (date: Date | undefined) => {
    if (date) {
      const iso = date.toISOString().slice(0, 10);
      setEditFormData((prev: any) => ({ ...prev, dob: iso }));
    }
    setShowDobPicker(false);
  };

  const handleDelete = async (student: Student) => {
    const confirm = window.confirm(`Are you sure you want to delete ${student.name}?`);
    if (!confirm) return;
    try {
      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const response = await fetch(`${cleanBase}/api/students/${student.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
        },
      });
      if (response.ok || response.status === 204) {
        toast.success(`Student ${student.name} deleted successfully.`);
        fetchStudents();
      } else {
        const text = await response.text();
        toast.error(`Error deleting student: ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error('Delete student error:', error);
      toast.error('Failed to delete student. Please try again.');
    }
  };

  // Define table columns
  const columns = [
    {
      key: 'student_info',
      label: 'Student',
      icon: <User className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center bg-[#6096ba]">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
              {student.name}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium italic mb-1 uppercase opacity-85">
              {student.gender === 'female' ? 'd/o' : 's/o'} {student.father_name || 'N/A'}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 flex items-center space-x-1.5">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 rounded bg-gray-100 flex items-center justify-center">
                  <Mail className="h-3 w-3 text-gray-600" />
                </div>
              </div>
              <span className="font-mono text-xs sm:text-sm break-all">
                {student.student_id || student.student_code || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'grade_section',
      label: 'Grade/Section',
      icon: <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-[#6096ba] flex-shrink-0" />
            <div>
              <span className="text-xs font-semibold text-gray-600 uppercase">Grade: </span>
              <span className="text-sm sm:text-base font-medium text-gray-900">{student.current_grade || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#6096ba] flex-shrink-0" />
            <div>
              <span className="text-xs font-semibold text-gray-600 uppercase">Section: </span>
              <span className="text-sm sm:text-base font-medium text-gray-900">{student.section || 'N/A'}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'campus',
      label: 'Campus',
      icon: <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
        <div className="flex items-start space-x-2">
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-[#6096ba] flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-gray-900">
              {student.campus_name || 'N/A'}
            </div>
            {student.coordinator_names && student.coordinator_names.length > 0 && (
              <div className="text-xs text-gray-600 mt-0.5">
                Coord: {student.coordinator_names[0]}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      icon: <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
        <div className="flex items-center space-x-2">
          {student.is_active !== false ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                Active
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                Inactive
              </span>
            </div>
          )}
        </div>
      )
    }
  ];



  if (!perms.canViewStudents && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60rem] p-4 text-center">
        <div className="bg-red-50 p-8 rounded-3xl border border-red-100 max-w-md shadow-sm">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to view the students list. Please contact your administrator if you believe this is an error.
          </p>
          <Button 
            onClick={() => router.push('/admin/dashboard')}
            className="w-full bg-[#274c77] text-white hover:bg-[#1e3a5f]"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-3 md:p-4 w-full max-w-full overflow-x-hidden">
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2" style={{ color: '#274c77' }}>
            Students List
          </h1>
          {loading ? (
            <div className="h-4 w-48 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-xs sm:text-sm md:text-base text-gray-600">
              Showing {students.length} of {totalCount} students
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {perms.canAddStudent && (
            <Button 
              onClick={() => router.push('/admin/students/add')}
              className="flex items-center gap-2 font-semibold shadow-sm hover:shadow-md transition-all duration-200"
              style={{ backgroundColor: '#274c77', color: 'white' }}
            >
              <Plus className="h-4 w-4" /> Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-2.5 sm:p-3 md:p-4 mb-3 w-full overflow-x-hidden" style={{ borderColor: '#a3cef1' }}>
        <div className="mb-2 sm:mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" style={{ color: '#274c77' }}>
              <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6096ba' }}>
                <span className="text-white text-xs font-bold"><Search className="h-4 w-4" /></span>
              </div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold">Search & Filters</h3>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {perms.canEditStudent && (
                <button
                  onClick={() => setShowBulkDialog(true)}
                  disabled={selectedStudents.length === 0}
                  className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-lg transition-all duration-150 ease-in-out transform shadow-sm hover:shadow-lg active:scale-95 active:shadow-md touch-manipulation ${selectedStudents.length === 0 ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-[#e67e22] hover:bg-[#d35400]'}`}
                  style={{ minHeight: '38px' }}
                >
                  <span className="mr-1.5"><LayoutGrid className="h-4 w-4" /></span>
                  <span className="hidden xs:inline">Transfer</span>
                  <span className="ml-1">({selectedStudents.length})</span>
                </button>
              )}

              <button
                onClick={handleClearFiltersClick}
                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 transition-all duration-150 ease-in-out transform shadow-sm hover:shadow-lg active:scale-95 active:shadow-md touch-manipulation"
                style={{ backgroundColor: '#6096ba', minHeight: '38px' }}
              >
                <span className="mr-1.5"><RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isClearing ? 'rotate-[360deg]' : 'rotate-0'}`} /></span>
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole === 'superadmin' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2.5 sm:gap-3 md:gap-4 mb-3 sm:mb-4`}>
          {/* Search */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name, code, GR number..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 touch-manipulation"
              style={{ borderColor: '#a3cef1', minHeight: '44px', maxWidth: '100%' }}
            />
          </div>

          {/* Campus Filter - Only show for superadmin */}
          {userRole === 'superadmin' && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Campus
              </label>
              <select
                value={filters.campus}
                onChange={(e) => handleFilterChange('campus', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 touch-manipulation"
                style={{
                  borderColor: '#a3cef1',
                  minHeight: '44px',
                  maxWidth: '100%'
                }}
              >
                <option value="">All Campuses</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.campus_name || campus.name}
                  </option>
                ))}
              </select>
            </div>
          )}






          {/* Grade Filter */}
          {showGradeFilter && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Grade
              </label>
              <select
                value={filters.current_grade}
                onChange={(e) => handleFilterChange('current_grade', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 touch-manipulation"
                style={{ borderColor: '#a3cef1', minHeight: '44px', maxWidth: '100%' }}
              >
                <option value="">All Grades</option>
                {userRole === 'teacher' && teacherGrades.length > 0 ? (
                  teacherGrades.map((grade: string) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))
                ) : (
                  grades.map((g: any) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Section Filter */}
          {showSectionFilter && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Section
              </label>
              <select
                value={filters.section}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 touch-manipulation"
                style={{ borderColor: '#a3cef1', minHeight: '44px', maxWidth: '100%' }}
              >
                <option value="">
                  {userRole === 'teacher' && filters.current_grade && teacherGradeSectionMap[filters.current_grade]?.length === 1
                    ? teacherGradeSectionMap[filters.current_grade][0]
                    : 'All Sections'}
                </option>
                {userRole === 'teacher' && teacherSections.length > 0 ? (
                  teacherSections.map((section: string) => (
                    <option key={section} value={section}>{section}</option>
                  ))
                ) : (
                  (() => {
                    let filteredRooms = classrooms;
                    if (filters.shift) {
                      filteredRooms = filteredRooms.filter(r => (r.shift || '').toLowerCase() === filters.shift.toLowerCase());
                    }
                    if (filters.current_grade) {
                      filteredRooms = filteredRooms.filter(r => {
                        const gName = typeof r.grade === 'string' ? r.grade : r.grade?.name || r.grade_name || '';
                        return gName.toLowerCase() === filters.current_grade.toLowerCase();
                      });
                    }
                    const dynamicSections = Array.from(new Set(filteredRooms.map(r => r.section).filter(Boolean))).sort();
                    
                    if (dynamicSections.length > 0) {
                      return dynamicSections.map(s => <option key={s} value={s}>{s}</option>);
                    }
                    
                    return formOptions?.section?.map((opt: any) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    )) || (
                      <>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </>
                    );
                  })()
                )}
              </select>
            </div>
          )}
          {showShiftFilter && userRole !== 'teacher' && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Shift
              </label>
              <select
                value={filters.shift}
                onChange={(e) => handleFilterChange('shift', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 touch-manipulation"
                style={{ borderColor: '#a3cef1', minHeight: '44px', maxWidth: '100%' }}
              >
                <option value="">All Shifts</option>
                {teacherShifts.length > 0 ? (
                  teacherShifts.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift.charAt(0).toUpperCase() + shift.slice(1)}
                    </option>
                  ))
                ) : (
                  formOptions?.shift?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  )) || (
                    <>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </>
                  )
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <ListFilters 
        onFilterChange={handleQuickFilter}
        currentOrdering={filters.ordering}
        currentGender={filters.gender}
        genderOptions={formOptions?.gender}
      />

      {/* Students Table - USING REUSABLE COMPONENT */}
      <DataTable
        data={students}
        columns={columns}
        onView={(student) => router.push(`/admin/students/profile?id=${student.id}`)}
        onEdit={(student) => handleEdit(student)}
        onDelete={(student) => handleDelete(student)}
        isLoading={loading}
        emptyMessage="No students found"
        allowEdit={perms.canEditStudent}
        allowDelete={perms.canDeleteStudent}
        selectedIds={selectedStudents}
        onSelectionChange={setSelectedStudents}
      />

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />



      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6 py-6 rounded-3xl hide-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold transition-all duration-150 ease-in-out transform hover:shadow-lg active:scale-95 active:shadow-md" style={{ color: '#274c77' }}>
              Edit Student - {editingStudent?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 text-sm sm:text-base">
            {/* Personal Information */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#274c77' }}>Personal Information</h3>

              {/* Photo Upload */}
              <div className="mb-6">
                <Label htmlFor="photo">Profile Photo</Label>
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  {editFormData.photo ? (
                    <div className="relative">
                      <img
                        src={typeof editFormData.photo === 'string' ? editFormData.photo : URL.createObjectURL(editFormData.photo)}
                        alt="Student photo"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={async () => {
                          // If the photo is a File (not uploaded yet), just clear it locally.
                          if (editFormData.photo && editFormData.photo instanceof File) {
                            setEditFormData((prev: any) => ({ ...prev, photo: null }));
                            return;
                          }
                          // Otherwise ask backend to delete stored photo
                          await handleDeletePhoto();
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditFormData({ ...editFormData, photo: file });
                        }
                      }}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Upload a profile photo (JPG, PNG)</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={editFormData.gender || ''} onValueChange={(value) => setEditFormData({ ...editFormData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.gender ? (
                        formOptions.gender.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Popover open={showDobPicker} onOpenChange={setShowDobPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full h-10 justify-start text-left font-normal ${!editFormData.dob ? 'text-muted-foreground' : ''}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editFormData.dob ? new Date(editFormData.dob).toLocaleDateString() : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editFormData.dob ? new Date(editFormData.dob) : undefined}
                        onSelect={handleDobSelect}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="place_of_birth">Place of Birth</Label>
                  <Input
                    id="place_of_birth"
                    value={editFormData.place_of_birth || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, place_of_birth: e.target.value })}
                    placeholder="Enter place of birth"
                  />
                </div>
                <div>
                  <Label htmlFor="religion">Religion</Label>
                  <Select value={editFormData.religion || ''} onValueChange={(value) => setEditFormData({ ...editFormData, religion: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.religion?.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mother_tongue">Mother Tongue</Label>
                  <Select value={editFormData.mother_tongue || ''} onValueChange={(value) => setEditFormData({ ...editFormData, mother_tongue: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mother tongue" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.mother_tongue?.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="student_cnic">Student B-Form / CNIC</Label>
                  <Input
                    id="student_cnic"
                    value={editFormData.student_cnic || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, student_cnic: e.target.value })}
                    placeholder="XXXXX-XXXXXXX-X"
                  />
                </div>
                <div>
                  <Label htmlFor="nationality">Nationality</Label>
                  <Select value={editFormData.nationality || ''} onValueChange={(value) => setEditFormData({ ...editFormData, nationality: value })}>
                    <SelectTrigger aria-label="Nationality">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.nationality?.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="blood_group">Blood Group</Label>
                  <Select value={editFormData.blood_group || ''} onValueChange={(value) => setEditFormData({ ...editFormData, blood_group: value })}>
                    <SelectTrigger aria-label="Blood Group">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.blood_group?.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone_number">Student Phone</Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    maxLength={11}
                    value={editFormData.phone_number || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditFormData({ ...editFormData, phone_number: value });
                    }}
                    placeholder="Enter student phone (11 digits)"
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact">Emergency Contact</Label>
                  <Input
                    id="emergency_contact"
                    type="tel"
                    maxLength={11}
                    value={editFormData.emergency_contact || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditFormData({ ...editFormData, emergency_contact: value });
                    }}
                    placeholder="Enter emergency contact (11 digits)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 11 digits and make sure start with 03</p>
                </div>
                <div>
                  <Label htmlFor="email">Student Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="Enter student email"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional. Can be used for login.</p>
                </div>
                <div>
                  <Label htmlFor="special_needs_disability">Special Needs / Disability</Label>
                  <Select value={editFormData.special_needs_disability || 'none'} onValueChange={(value) => setEditFormData({ ...editFormData, special_needs_disability: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.special_needs ? (
                        formOptions.special_needs.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="physical">Physical Disability</SelectItem>
                          <SelectItem value="visual">Visual Impairment</SelectItem>
                          <SelectItem value="hearing">Hearing Impairment</SelectItem>
                          <SelectItem value="learning">Learning Disability</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="is_active">Student Status</Label>
                    <Select
                      value={editFormData.is_active !== undefined ? (editFormData.is_active ? 'true' : 'false') : 'true'}
                      onValueChange={(value) => setEditFormData({ ...editFormData, is_active: value === 'true' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive (Left)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Permanent Address</Label>
                  <Textarea
                    id="address"
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Enter permanent address"
                    rows={3}
                    className="resize-none"
                  />
                </div>

              </div>
            </div>

            {/* Father Information */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#274c77' }}>Father Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="father_name">Father Name</Label>
                  <Input
                    id="father_name"
                    value={editFormData.father_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, father_name: e.target.value })}
                    placeholder="Enter father name"
                  />
                </div>
                <div>
                  <Label htmlFor="father_cnic">Father CNIC</Label>
                  <Input
                    id="father_cnic"
                    type="text"
                    maxLength={13}
                    value={editFormData.father_cnic || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 13);
                      setEditFormData({ ...editFormData, father_cnic: value });
                    }}
                    placeholder="Enter father CNIC (13 digits)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 13 digits</p>
                </div>
                <div>
                  <Label htmlFor="father_contact">Father Contact</Label>
                  <Input
                    id="father_contact"
                    type="tel"
                    maxLength={11}
                    value={editFormData.father_contact || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditFormData({ ...editFormData, father_contact: value });
                    }}
                    placeholder="Enter father contact (11 digits)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 11 digits and make sure start with 03</p>
                </div>
                <div>
                  <Label htmlFor="father_profession">Father Profession</Label>
                  <Input
                    id="father_profession"
                    value={editFormData.father_profession || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, father_profession: e.target.value })}
                    placeholder="Enter father profession"
                  />
                </div>
                <div>
                  <Label htmlFor="father_status">Father Status</Label>
                  <Select value={editFormData.father_status || ''} onValueChange={(value) => setEditFormData({ ...editFormData, father_status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select father status" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.father_status ? (
                        formOptions.father_status.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="alive">Alive</SelectItem>
                          <SelectItem value="dead">Dead</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>

            {/* Mother Information */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#274c77' }}>Mother Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mother_name">Mother Name</Label>
                  <Input
                    id="mother_name"
                    value={editFormData.mother_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, mother_name: e.target.value })}
                    placeholder="Enter mother name"
                  />
                </div>
                <div>
                  <Label htmlFor="mother_contact">Mother Contact</Label>
                  <Input
                    id="mother_contact"
                    type="tel"
                    maxLength={11}
                    value={editFormData.mother_contact || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditFormData({ ...editFormData, mother_contact: value });
                    }}
                    placeholder="Enter mother contact (11 digits)"
                  />
                </div>
              </div>
            </div>

            {/* Guardian Information */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#274c77' }}>Guardian Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guardian_name">Guardian Name</Label>
                  <Input
                    id="guardian_name"
                    value={editFormData.guardian_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, guardian_name: e.target.value })}
                    placeholder="Enter guardian name"
                  />
                </div>
                <div>
                  <Label htmlFor="guardian_relation">Relation</Label>
                  <Input
                    id="guardian_relation"
                    value={editFormData.guardian_relation || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, guardian_relation: e.target.value })}
                    placeholder="e.g. Uncle"
                  />
                </div>
                <div>
                  <Label htmlFor="guardian_contact">Guardian Contact</Label>
                  <Input
                    id="guardian_contact"
                    type="tel"
                    maxLength={11}
                    value={editFormData.guardian_contact || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditFormData({ ...editFormData, guardian_contact: value });
                    }}
                    placeholder="Enter guardian contact (11 digits)"
                  />
                </div>
                <div>
                  <Label htmlFor="guardian_cnic">Guardian CNIC</Label>
                  <Input
                    id="guardian_cnic"
                    type="text"
                    maxLength={13}
                    value={editFormData.guardian_cnic || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 13);
                      setEditFormData({ ...editFormData, guardian_cnic: value });
                    }}
                    placeholder="Enter guardian CNIC (13 digits)"
                  />
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#274c77' }}>Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current_grade">Current Grade</Label>
                  <Input
                    id="current_grade"
                    value={editFormData.current_grade || ''}
                    readOnly
                    className="bg-gray-100 cursor-not-allowed"
                    placeholder="Current grade"
                  />
                </div>
                <div>
                  <Label htmlFor="section">Current Section</Label>
                  <Input
                    id="section"
                    value={editFormData.section || ''}
                    readOnly
                    className="bg-gray-100 cursor-not-allowed"
                    placeholder="Current section"
                  />
                </div>
                <div>
                  <Label htmlFor="enrollment_year">Enrollment Year</Label>
                  <Input
                    id="enrollment_year"
                    type="number"
                    value={editFormData.enrollment_year || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, enrollment_year: e.target.value })}
                    placeholder="Enter enrollment year"
                  />
                </div>
                <div>
                  <Label htmlFor="shift">Shift</Label>
                  <Select value={editFormData.shift || ''} onValueChange={(value) => setEditFormData({ ...editFormData, shift: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions?.shift ? (
                        formOptions.shift.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="classroom">Classroom</Label>
                  <Select
                    value={editFormData._alumni ? 'alumni' : (editFormData.classroom ? String(editFormData.classroom) : 'none')}
                    onValueChange={(value) => {
                      if (value === 'alumni') {
                        setEditFormData({ ...editFormData, classroom: null, _alumni: true });
                      } else {
                        setEditFormData({ ...editFormData, classroom: value === 'none' ? null : parseInt(value), _alumni: false });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select classroom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Classroom</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                      {classrooms.map((classroom: any) => (
                        <SelectItem key={classroom.id} value={String(classroom.id)}>
                          {classroom.grade?.name || classroom.grade_name || 'N/A'} - {classroom.section || 'N/A'} ({classroom.shift || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select the correct classroom for this student. This will automatically update the student's class assignment.
                  </p>
                </div>
              </div>
            </div>

            {/* System Information */}

          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 transition-all duration-150">
            <Button
              onClick={handleEditClose}
              variant="outline"
              className="px-6 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={isSubmitting}
              className="px-6 w-full sm:w-auto"
              style={{ backgroundColor: '#6096ba' }}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Student'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog - REMOVED, now uses dedicated page */}

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: '#274c77' }}>
               <div className="h-8 w-8 rounded-full flex items-center justify-center bg-[#e67e22] text-white">
                  <LayoutGrid className="h-5 w-5" />
               </div>
               Bulk Class Assignment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm text-orange-800">
               <p className="font-medium mb-1">Transferring {selectedStudents.length} Students</p>
               <p className="opacity-80">This action will update the grade, section, and shift of all selected students based on the target classroom.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulk-classroom" className="text-gray-700 font-semibold ml-1">Select Target Classroom</Label>
              <Select
                value={targetClassroom === 'alumni' ? 'alumni' : (targetClassroom ? String(targetClassroom) : (targetClassroom === null ? 'none' : ''))}
                onValueChange={(value) => setTargetClassroom(value === 'none' ? null : value === 'alumni' ? 'alumni' : parseInt(value))}
              >
                <SelectTrigger id="bulk-classroom" className="h-12 rounded-xl border-[#a3cef1] focus:ring-[#6096ba]">
                  <SelectValue placeholder="Search/Select destination classroom..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl overflow-hidden shadow-xl max-h-[300px]">
                  <SelectItem value="none" className="py-3 font-semibold text-red-600 hover:bg-red-50 transition-colors">
                    Remove Classroom (No Classroom)
                  </SelectItem>
                  <SelectItem value="alumni" className="py-3 font-semibold text-purple-700 hover:bg-purple-50 transition-colors">
                    Alumni
                  </SelectItem>
                  {classrooms.map((classroom: any) => (
                    <SelectItem key={classroom.id} value={String(classroom.id)} className="py-3 hover:bg-blue-50 transition-colors">
                      {classroom.grade?.name || classroom.grade_name || 'N/A'} - {classroom.section || 'N/A'} ({classroom.shift || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-2">
            <Button 
                variant="ghost" 
                onClick={() => {
                  setShowBulkDialog(false);
                  setTargetClassroom(undefined);
                }}
                className="rounded-xl h-11 text-gray-500 hover:bg-gray-100"
            >
                Cancel
            </Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={isProcessingBulk || (targetClassroom === undefined)}
              className="rounded-xl h-11 px-8 font-bold shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#6096ba' }}
            >
              {isProcessingBulk ? (
                  <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                  </div>
              ) : 'Start Batch Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}