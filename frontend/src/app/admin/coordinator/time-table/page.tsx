"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Book, Clock, AlertCircle, GraduationCap, Plus } from "lucide-react";
import {
  getCoordinatorTeachers, getCoordinatorClasses, getSubjects, getClassTimetable,
  getTeacherTimetable, getShiftTimings, getStoredUserProfile, createClassTimetable,
  createTeacherTimetable, deleteClassTimetable, deleteTeacherTimetable, bulkCreateTeacherPeriods
} from "@/lib/api";
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton";

// Define ShiftTiming type
type ShiftTiming = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
  days?: string[];
  order?: number;
  timetable_type?: string;
};

// Define WEEK_DAYS constant
const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

// Teacher interface
interface Teacher {
  id: number;
  full_name: string;
  employee_code: string;
}

function TimetableSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 space-y-4 animate-in fade-in duration-500 py-6">
      <Card className="mb-6 shadow-xl border-t-4 border-t-[#6096ba]/50 bg-white/50">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full bg-[#6096ba]/10" />
              <Skeleton className="h-8 w-64 bg-[#274c77]/10" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full bg-[#6096ba]/5" />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24 bg-slate-100" />
                <Skeleton className="h-11 w-full rounded-xl bg-slate-50 border-2 border-slate-100" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-2xl overflow-hidden border-0">
        <div className="w-full h-14 bg-gradient-to-r from-[#274c77]/10 to-[#6096ba]/10 flex border-b border-slate-100">
          <div className="w-[130px] h-full border-r border-slate-200/50 flex items-center px-4">
            <Skeleton className="h-4 w-16 bg-[#274c77]/20" />
          </div>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-1 h-full border-r border-slate-200/50 flex items-center justify-center">
              <Skeleton className="h-4 w-14 bg-[#6096ba]/20" />
            </div>
          ))}
        </div>
        <div className="bg-white">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex border-b border-slate-50 h-28">
              <div className="w-[130px] h-full border-r border-slate-50 p-4 space-y-3 bg-slate-50/30">
                <Skeleton className="h-5 w-16 bg-[#274c77]/10" />
                <Skeleton className="h-3 w-20 bg-[#6096ba]/10" />
              </div>
              {[1, 2, 3, 4, 5, 6].map((col) => (
                <div key={col} className="flex-1 h-full border-r border-slate-50 p-3 flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-2xl bg-slate-50/50" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function Page() {
  // State declarations
  const [timetableType, setTimetableType] = useState<'class' | 'teacher'>('class');
  const [selectedShift, setSelectedShift] = useState<string>('morning');
  const [coordinatorShifts, setCoordinatorShifts] = useState<string[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  // ...existing code...
  // Teacher View States
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Timetable Data
  const [timeSlots, setTimeSlots] = useState<ShiftTiming[]>([]);
  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    day: string;
    slotId: number;
    startTime: string;
    endTime: string;
    existingId?: number;
    subjectId?: string;
    teacherId?: string;
    classroomId?: string; // For teacher view
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch time slots when shift changes
  useEffect(() => {
    if (selectedShift) {
      fetchTimeSlots();
    }
  }, [selectedShift, timetableType]);

  // Fetch timetable when selection changes
  // Update sections when grade changes
  useEffect(() => {
    if (selectedGrade && classrooms.length > 0) {
      const sections = Array.from(new Set(
        classrooms
          .filter((c: any) => c.grade === selectedGrade)
          .map((c: any) => c.section)
          .filter(Boolean)
      )).sort();

      console.log(`Sections for grade ${selectedGrade}:`, sections);
      setAvailableSections(sections);

      // Set first section as default
      if (sections.length > 0 && !sections.includes(selectedSection)) {
        setSelectedSection(sections[0]);
      }
    }
  }, [selectedGrade, classrooms]);

  useEffect(() => {
    if (timetableType === 'class' && selectedGrade && selectedSection) {
      fetchTimetable();
    } else if (timetableType === 'teacher' && selectedTeacherId) {
      fetchTimetable();
    }
  }, [timetableType, selectedGrade, selectedSection, selectedTeacherId, selectedShift]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const userProfile = getStoredUserProfile();

      console.log('=== COORDINATOR PROFILE ===');
      console.log('User Profile:', userProfile);

      // Fetch classes first to detect shifts
      const initialClassesData = (await getCoordinatorClasses()) as any[];
      console.log('Total classes:', initialClassesData.length);
      console.log('Sample class data:', initialClassesData[0]);

      // Extract unique shifts from classes
      const uniqueShifts = Array.from(new Set(
        initialClassesData.map((c: any) => c.shift).filter(Boolean)
      )) as string[];

      console.log('Unique shifts detected:', uniqueShifts);

      // Set coordinator shifts
      let shifts: string[] = [];
      if (uniqueShifts.length > 1) {
        // Both shifts available
        console.log('✅ Coordinator has BOTH shifts!');
        shifts = uniqueShifts.sort();
        setCoordinatorShifts(shifts);
        setSelectedShift(shifts.includes('morning') ? 'morning' : shifts[0]);
      } else if (uniqueShifts.length === 1) {
        // Single shift
        console.log('✅ Coordinator has single shift:', uniqueShifts[0]);
        shifts = uniqueShifts;
        setCoordinatorShifts(shifts);
        setSelectedShift(shifts[0]);
      } else {
        // Fallback
        console.log('⚠️ No shifts detected, using default');
        shifts = ['morning'];
        setCoordinatorShifts(shifts);
        setSelectedShift('morning');
      }

      // Fetch teachers and subjects (classes already fetched above)
      const coordinatorId = userProfile?.coordinator_id || 0;

      const [teachersData, subjectsData] = await Promise.all([
        getCoordinatorTeachers(coordinatorId),
        getSubjects()
      ]) as [any, any[]];

      console.log('API Responses:', { classesData: initialClassesData, teachersData, subjectsData });

      // Ensure all data is arrays
      const safeClasses = Array.isArray(initialClassesData) ? initialClassesData : [];
      // Extract teachers array from response object
      const safeTeachers = Array.isArray(teachersData)
        ? teachersData
        : ((teachersData as any)?.teachers || []);
      const safeSubjects = Array.isArray(subjectsData) ? subjectsData : [];

      console.log('Safe Arrays:', { safeClasses, safeTeachers, safeSubjects });

      setClassrooms(safeClasses);
      setTeachers(safeTeachers);
      setSubjects(safeSubjects);

      // Set available grades from classes
      console.log('Extracting grades from classes...');
      console.log('Sample class:', safeClasses[0]);

      const grades = Array.from(new Set(
        safeClasses.map((c: any) => c.grade).filter(Boolean)  // grade is string, not object
      )).sort();

      console.log('Extracted grades:', grades);
      console.log('Grades length:', grades.length);

      setAvailableGrades(grades as string[]);
      if (grades.length > 0) setSelectedGrade(grades[0] as string);

      console.log('Available grades state will be set to:', grades);


    } catch (error: any) {
      console.error('Error fetching initial data:', error);
      // Show friendly toast for access denied errors
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('403')) {
        toast.error('Access denied. You may not have coordinator permissions assigned yet. Please contact admin.');
      } else {
        toast.error('Failed to load timetable data. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSlots = async () => {
    try {
      setGridLoading(true);
      const user = getStoredUserProfile();
      let campusId: number | undefined = undefined;
      
      if (user?.campus && typeof user.campus === 'object') {
        campusId = user.campus.id;
      } else if (typeof user?.campus === 'number') {
        campusId = user.campus;
      } else {
        campusId = parseInt(localStorage.getItem('sis_campus_id') || '1');
      }

      console.log('Fetching time slots for campus:', campusId, 'shift:', selectedShift);
      const timings = await getShiftTimings(campusId || 1, selectedShift);

      // Filter by timetable type
      const filtered = (timings || []).filter((t: any) =>
        (t.timetable_type || 'class') === timetableType
      );

      // Sort by order
      filtered.sort((a: any, b: any) => a.order - b.order);
      setTimeSlots(filtered);
    } catch (error) {
      console.error('Error fetching time slots:', error);
    } finally {
      setGridLoading(false);
    }
  };

  const fetchTimetable = async () => {
    try {
      let data: any[] = [];

      if (timetableType === 'class') {
        const classroom = classrooms.find(
          c => c.grade === selectedGrade && c.section === selectedSection
        );
        if (classroom) {
          data = await getClassTimetable({ classroom: classroom.id }) as any[];
        }
      } else {
        if (selectedTeacherId) {
          data = await getTeacherTimetable({ teacher: parseInt(selectedTeacherId) }) as any[];
        }
      }

      setTimetableData(data || []);
    } catch (error) {
      console.error('Error fetching timetable:', error);
      setTimetableData([]);
    }
  };

  const getAssignment = (day: string, slotId: number) => {
    return timetableData.find(
      (t: any) => t.day.toLowerCase() === day.toLowerCase() &&
        t.start_time === timeSlots.find(s => s.id === slotId)?.start_time
    );
  };

  const isBreakTime = (slot: ShiftTiming, day: string) => {
    return slot.is_break || (slot.days && slot.days.length > 0 && !slot.days.includes(day));
  };

  const handleCellClick = (day: string, slot: ShiftTiming, assignment: any) => {
    if (isBreakTime(slot, day)) return;

    // For Class Timetable, we need subject and teacher
    // For Teacher Timetable, we need subject and classroom

    setDialogData({
      day,
      slotId: slot.id,
      startTime: slot.start_time,
      endTime: slot.end_time,
      existingId: assignment?.id,
      subjectId: assignment?.subject?.toString() || "",
      teacherId: assignment?.teacher?.toString() || "",
      classroomId: assignment?.classroom?.toString() || "",
    });

    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!dialogData) return;

    try {
      setIsSaving(true);

      const commonData = {
        // Backend DAY_CHOICES use lowercase keys like 'monday', 'tuesday', etc.
        day: (dialogData.day || '').toString().toLowerCase(),
        start_time: dialogData.startTime,
        end_time: dialogData.endTime,
        subject: parseInt(dialogData.subjectId || "0"),
      };

      if (timetableType === 'class') {
        const classroom = classrooms.find(
          c => c.grade === selectedGrade && c.section === selectedSection
        );

        if (!classroom) {
          toast.error("Classroom not found!");
          return;
        }

        const payload = {
          ...commonData,
          classroom: classroom.id,
          teacher: parseInt(dialogData.teacherId || "0"),
        };

        if (dialogData.existingId) {
          // Update logic would go here if API supports it, for now we can maybe delete and create?
          // Or just create (backend might handle upsert or error)
          // If update endpoint is different, we'd need that. Assuming create for now or if ID exists handle accordingly.
          // Actually, standard is usually PUT for update. I'll use create for now as requested "assign", but for existing maybe I should offer delete.
          toast.error("Update not fully implemented yet - try deleting first");
        } else {
          await createClassTimetable(payload);
        }
      } else {
        // Teacher Timetable
        // We need to know which classroom to assign
        // But wait, the API createTeacherTimetable might be creating a TeacherTimeTable record...
        // Actually, typically ClassTimeTable is the source of truth.
        // If we are "assigning" for a teacher, we are essentially creating a ClassTimeTable entry where this teacher teaches a subject in a classroom.

        // However, if the backend has separate TeacherTimeTable model (it does), how are they synced?
        // Is TeacherTimeTable manual?
        // The backend serializer shows TeacherTimeTable model.

        const payload = {
          ...commonData,
          teacher: parseInt(selectedTeacherId),
          classroom: parseInt(dialogData.classroomId || "0"),
        };

        await createTeacherTimetable(payload);
      }

      setIsDialogOpen(false);
      fetchTimetable(); // Refresh grid

    } catch (error) {
      console.error("Failed to save assignment:", error);
      toast.error("Failed to save assignment. Please check inputs.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!dialogData?.existingId) return;
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      setIsSaving(true);
      if (timetableType === 'class') {
        await deleteClassTimetable(dialogData.existingId);
      } else {
        await deleteTeacherTimetable(dialogData.existingId);
      }
      setIsDialogOpen(false);
      fetchTimetable();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete assignment.");
    } finally {
      setIsSaving(false);
    }
  };


  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return <TimetableSkeleton />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-6">
      {/* Header Card */}
      <Card className="mb-6 shadow-xl border-t-4 border-t-[#6096ba] bg-white/80 backdrop-blur-sm">
        <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-lg sm:text-2xl font-bold flex items-center gap-3 text-[#274c77]">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-[#6096ba]" />
              <span className="truncate tracking-tight">Timetable Management</span>
            </CardTitle>
            <div className="bg-blue-50 px-3 py-1.5 rounded-full border border-[#6096ba]/30 self-start sm:self-auto">
              <p className="text-xs text-[#274c77] font-semibold whitespace-nowrap flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {selectedShift === 'morning' ? 'Morning Shift' : 'Afternoon Shift'}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Timetable Type */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700">
                <Book className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Timetable Type
              </label>
              <Select value={timetableType} onValueChange={(v: any) => setTimetableType(v)}>
                <SelectTrigger className="h-10 sm:h-11 text-sm border-2 border-[#e7ecef] focus:border-[#6096ba] focus:ring-0 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Class Timetable
                    </span>
                  </SelectItem>
                  <SelectItem value="teacher">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Teacher Timetable
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shift Selector (only if multiple shifts) */}
            {coordinatorShifts.length > 1 && (
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700">
                  <Clock className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Shift
                </label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="h-10 sm:h-11 text-sm border-2 border-[#e7ecef] focus:border-[#6096ba] focus:ring-0 transition-all rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning Shift</SelectItem>
                    <SelectItem value="afternoon">Afternoon Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Class View Selectors */}
            {timetableType === 'class' && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700">Grade</label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="h-10 sm:h-11 text-sm border-2 border-[#e7ecef] focus:border-[#6096ba] focus:ring-0 transition-all rounded-xl">
                      <SelectValue placeholder="Select Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGrades.map((grade) => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="h-10 sm:h-11 text-sm border-2 border-[#e7ecef] focus:border-[#6096ba] focus:ring-0 transition-all rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.length > 0 ? (
                        availableSections.map((section) => (
                          <SelectItem key={section} value={section}>{section}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="disabled" disabled>No sections available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Teacher View Selector */}
            {timetableType === 'teacher' && (
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700">Teacher</label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="h-10 sm:h-11 text-sm border-2 border-[#e7ecef] focus:border-[#6096ba] focus:ring-0 transition-all rounded-xl">
                    <SelectValue placeholder="Select Teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.full_name} ({teacher.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      <Card className="shadow-xl">
        <CardContent className="p-0">
          {gridLoading ? (
            <div className="p-8 space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-[130px]" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-20 w-[130px]" />
                  <Skeleton className="h-20 flex-1" />
                  <Skeleton className="h-20 flex-1" />
                  <Skeleton className="h-20 flex-1" />
                  <Skeleton className="h-20 flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
              <thead>
                {/* No Save buttons for teacher timetable in coordinator view */}
                <tr className="bg-gradient-to-r from-[#274c77] to-[#6096ba] text-white shadow-md">
                  <th className="p-3 sm:p-4 text-left text-[11px] sm:text-xs font-bold border-r border-white/10 sticky left-0 bg-[#274c77] z-10 min-w-[100px] sm:min-w-[130px] uppercase tracking-wider">
                    Time / Day
                  </th>
                  {WEEK_DAYS.map((day) => (
                    <th key={day} className="p-3 sm:p-4 text-center text-[11px] sm:text-xs font-bold border-r border-white/10 last:border-r-0 min-w-[100px] sm:min-w-[120px] uppercase tracking-wider">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg font-medium">No time slots configured</p>
                      <p className="text-gray-400 text-sm mt-2">Please configure shift timings first</p>
                    </td>
                  </tr>
                ) : (() => {
                  // Function to normalize name (e.g. "Fri Period 1" -> "Period 1")
                  const normalizeName = (name: string) => {
                    return name.replace(/^(Fri|Friday|Mon|Tue|Wed|Thu|Sat|Sun)\s+/i, '').trim();
                  };

                  // Group slots by normalized name
                  const currentGroups: { [key: string]: ShiftTiming[] } = {};
                  timeSlots.forEach(slot => {
                    const baseName = normalizeName(slot.name);
                    if (!currentGroups[baseName]) currentGroups[baseName] = [];
                    currentGroups[baseName].push(slot);
                  });

                  // To maintain sequence, we sort groups based on the minimum order of slots within them
                  const sortedGroupKeys = Object.keys(currentGroups).sort((a, b) => {
                    const minOrderA = Math.min(...currentGroups[a].map(s => s.order || 999));
                    const minOrderB = Math.min(...currentGroups[b].map(s => s.order || 999));
                    return minOrderA - minOrderB;
                  });

                  return sortedGroupKeys.map((baseName) => {
                    const group = currentGroups[baseName];

                    // Representative name (we want "Period 1" instead of "Fri Period 1" as row label)
                    const rowLabel = baseName;

                    // Row representative for base timing
                    const rowRep = group.find(s => !s.days || s.days.length === 0) ||
                      group.find(s => s.days?.some(d => d.toLowerCase() !== 'friday')) ||
                      group[0];

                    return (
                      <tr key={baseName} className="hover:bg-[#e7ecef]/30 transition-all duration-200">
                        <td className="p-3 sm:p-4 border-b border-r font-medium text-xs bg-slate-50/50 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          <div className="flex flex-col gap-1">
                            <span className="text-[#274c77] font-bold text-xs uppercase tracking-tight">{rowLabel}</span>
                            <span className="text-[10px] text-[#6096ba] font-bold">
                              {formatTime(rowRep.start_time)} - {formatTime(rowRep.end_time)}
                            </span>
                          </div>
                        </td>
                        {WEEK_DAYS.map((day) => {
                          const isFriday = day.toLowerCase() === 'friday';

                          // 1. Find a slot that is explicitly for this day
                          let daySlot = group.find(s => s.days?.map(d => d.toLowerCase()).includes(day.toLowerCase()));

                          // 2. Fallback to a general slot if no day-specific slot exists
                          if (!daySlot) {
                            daySlot = group.find(s => !s.days || s.days.length === 0);
                          }

                          // 3. Special handling for Friday "School Off"
                          if (isFriday && !group.some(s => s.days?.map(d => d.toLowerCase()).includes('friday'))) {
                            const fridaySlots = timeSlots.filter(s => s.days?.map(d => d.toLowerCase()).includes('friday'));
                            const lastSlot = fridaySlots.length > 0 ? fridaySlots.reduce((p, c) => (p.order || 0) > (c.order || 0) ? p : c) : null;

                            // If we have some Friday slots defined, and this row is potentially after them
                            if (lastSlot) {
                              return (
                                <td key={day} className="p-1.5 border-b border-r last:border-r-0 bg-slate-50/50">
                                  <div className="flex flex-col items-center justify-center py-3 opacity-40">
                                    <div className="bg-slate-200 text-slate-600 text-[8px] font-bold px-1 py-0.5 rounded-sm mb-1">FRIDAY</div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">School Off</span>
                                    <span className="text-[9px] text-slate-400">@{formatTime(lastSlot.end_time)}</span>
                                  </div>
                                </td>
                              );
                            }
                          }

                          if (!daySlot) {
                            return <td key={day} className="p-2 border-b border-r last:border-r-0 bg-slate-50/20"></td>;
                          }

                          const assignment = getAssignment(day, daySlot.id);
                          const isBreak = isBreakTime(daySlot, day);
                          const hasDifferentTime = daySlot.start_time !== rowRep.start_time || daySlot.end_time !== rowRep.end_time;

                          return (
                            <td
                              key={day}
                              className={`p-2 border-b border-r last:border-r-0 transition-colors ${isBreak
                                ? 'bg-slate-100/40'
                                : 'bg-white hover:bg-blue-50/30 cursor-pointer'
                                }`}
                              onClick={() => handleCellClick(day, daySlot, assignment)}
                            >
                              {isBreak ? (
                                <div className="text-center py-4 sm:py-5">
                                  <span className="inline-block bg-white text-slate-400 border border-slate-200 px-3 py-1 rounded-full text-[9px] font-bold shadow-sm uppercase tracking-widest">
                                    BREAK
                                  </span>
                                </div>
                              ) : assignment ? (
                                <div className="bg-gradient-to-br from-[#274c77] to-[#6096ba] text-white p-3 rounded-xl shadow-lg h-full border border-white/10 transform transition-all hover:scale-[1.02] hover:shadow-xl">
                                  <div className="font-bold text-[12px] sm:text-[13px] mb-1 leading-tight tracking-wide">
                                    {assignment.subject_name || assignment.subject?.name || 'N/A'}
                                  </div>
                                  <div className="text-[10px] opacity-90 font-semibold tracking-tight truncate flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                    {timetableType === 'class'
                                      ? (assignment.teacher_name || assignment.teacher?.full_name)
                                      : `${assignment.grade || assignment.classroom?.grade?.name} ${assignment.section || assignment.classroom?.section}`
                                    }
                                  </div>
                                  {hasDifferentTime && (
                                    <div className="text-[8px] mt-1.5 pt-1.5 border-t border-white/20 opacity-80 font-bold flex items-center gap-1">
                                      <Clock className="h-2 w-2" />
                                      {formatTime(daySlot.start_time)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-4 sm:py-6 group flex flex-col items-center justify-center">
                                  <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#6096ba]/10 transition-all border border-transparent group-hover:border-[#6096ba]/20">
                                    <Plus className="h-4 w-4 text-slate-300 group-hover:text-[#6096ba] transition-colors" />
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all mt-1 uppercase tracking-widest">
                                    Assign
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>


      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#274c77]">
              {dialogData?.existingId ? 'Update Period' : 'Assign New Period'}
            </DialogTitle>
            <DialogDescription className="font-medium text-[#6096ba]">
              {dialogData?.day} • {formatTime(dialogData?.startTime || '')} - {formatTime(dialogData?.endTime || '')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Select
                value={dialogData?.subjectId}
                onValueChange={(val) => setDialogData(prev => prev ? ({ ...prev, subjectId: val }) : null)}
              >
                <SelectTrigger className="col-span-3 h-11 border-2 border-[#e7ecef] focus:border-[#6096ba] rounded-xl transition-all">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {timetableType === 'class' ? (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teacher" className="text-right">
                  Teacher
                </Label>
                <Select
                  value={dialogData?.teacherId}
                  onValueChange={(val) => setDialogData(prev => prev ? ({ ...prev, teacherId: val }) : null)}
                >
                  <SelectTrigger className="col-span-3 h-11 border-2 border-[#e7ecef] focus:border-[#6096ba] rounded-xl transition-all">
                    <SelectValue placeholder="Select Teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.full_name} ({t.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // For Teacher View, select Classroom
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="classroom" className="text-right">
                  Classroom
                </Label>
                <Select
                  value={dialogData?.classroomId}
                  onValueChange={(val) => setDialogData(prev => prev ? ({ ...prev, classroomId: val }) : null)}
                >
                  <SelectTrigger className="col-span-3 h-11 border-2 border-[#e7ecef] focus:border-[#6096ba] rounded-xl transition-all">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.grade} - {c.section} {c.shift ? `(${c.shift.charAt(0).toUpperCase() + c.shift.slice(1)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            {dialogData?.existingId && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving}
                type="button"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl border-2 hover:bg-slate-50 transition-all">
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-[#6096ba] hover:bg-[#274c77] text-white rounded-xl px-6 shadow-md transition-all active:scale-95"
              >
                {isSaving ? "Saving..." : "Save Assignment"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
