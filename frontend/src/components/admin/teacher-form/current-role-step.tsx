"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useEffect, useMemo, useState, useCallback } from "react"
import { getLevels, getGrades, getClassrooms, getAllCoordinators, getAllCampuses, getUserCampusId, getStoredUserProfile } from "@/lib/api"
import { toast as sonnerToast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CurrentRoleStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  formOptions?: any
}

export function CurrentRoleStep({ formData, invalidFields, onInputChange, formOptions }: CurrentRoleStepProps) {
  const [levels, setLevels] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [coordinators, setCoordinators] = useState<any[]>([])
  const [campuses, setCampuses] = useState<any[]>([])

  const [loadingLevels, setLoadingLevels] = useState(false)
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [loadingCoordinators, setLoadingCoordinators] = useState(false)
  const [loadingCampuses, setLoadingCampuses] = useState(false)

  // Updated Picker state for multi-select checkboxes
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<number[]>([])

  const [availablePickerGrades, setAvailablePickerGrades] = useState<any[]>([])
  const [availablePickerClassrooms, setAvailablePickerClassrooms] = useState<any[]>([])
  
  const [loadingPickerGrades, setLoadingPickerGrades] = useState(false)
  const [loadingPickerClassrooms, setLoadingPickerClassrooms] = useState(false)

  // Fetch campuses on mount
  useEffect(() => {
    let cancelled = false
    const initCampuses = async () => {
      try {
        setLoadingCampuses(true)
        const all = await getAllCampuses()
        const profile = getStoredUserProfile() as any
        const userRole = (profile?.role || '').toLowerCase()

        // Org admin / superuser can see and select ANY campus
        const isOrgAdmin = userRole === 'org_admin' || userRole === 'superuser' || userRole === 'admin'

        const userCampusId =
          getUserCampusId() ??
          profile?.campus_id ??
          (profile?.campus !== null && typeof profile?.campus === 'object' ? profile.campus.id : profile?.campus) ??
          null

        let filtered = all
        // Only filter campuses for campus-scoped roles (principal, coordinator, teacher)
        if (!isOrgAdmin && userCampusId) {
          filtered = (all || []).filter((c: any) => Number(c.id ?? c.campus_id) === Number(userCampusId))
        }

        if (!cancelled) {
          setCampuses(filtered)
          // Auto-select campus only for campus-scoped roles with a single campus
          if (!formData.current_campus && !isOrgAdmin && userCampusId) {
            onInputChange("current_campus", String(userCampusId))
          }
        }
      } catch {
        if (!cancelled) setCampuses([])
      } finally {
        if (!cancelled) setLoadingCampuses(false)
      }
    }
    initCampuses()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch all levels when campus changes
  useEffect(() => {
    if (!formData.current_campus) return
    setLoadingLevels(true)
    getLevels(formData.current_campus)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        setLevels(list)
      })
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false))
  }, [formData.current_campus])

  // Fetch coordinators when campus changes (for non-class-teachers)
  useEffect(() => {
    if (!formData.current_campus || formData.is_class_teacher) { setCoordinators([]); return }
    setLoadingCoordinators(true)
    getAllCoordinators()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        const teacherShift = (formData.shift || '').toLowerCase()
        const campusFiltered = list.filter((coord: any) => {
          const coordCampusId = coord.campus?.id || coord.campus_id || (typeof coord.campus === 'number' ? coord.campus : null)
          return String(coordCampusId) === String(formData.current_campus)
        })
        const shiftFiltered = campusFiltered.filter((coord: any) => {
          const cs = (coord.shift || '').toLowerCase()
          if (!teacherShift || teacherShift === 'both') return true
          return cs === teacherShift || cs === 'both'
        })
        setCoordinators(shiftFiltered)
      })
      .catch(() => setCoordinators([]))
      .finally(() => setLoadingCoordinators(false))
  }, [formData.current_campus, formData.is_class_teacher, formData.shift])

  // Filter levels for picker based on teacher shift
  const filteredLevels = useMemo(() => {
    const shift = (formData.shift || '').toLowerCase()
    if (!shift || !levels.length) return levels
    if (shift === 'both') return levels // show all
    return levels.filter((l: any) => (l.shift || '').toLowerCase() === shift)
  }, [levels, formData.shift])

  // When selectedLevels change → fetch grades for all selected levels
  useEffect(() => {
    if (selectedLevels.length === 0) {
      setAvailablePickerGrades([]);
      setSelectedGrades([]);
      return;
    }
    
    setLoadingPickerGrades(true);
    Promise.all(selectedLevels.map(id => getGrades(parseInt(id))))
      .then((results) => {
        const allGrades = results.flatMap((data: any) => 
          Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        );
        // Remove duplicates if any
        const unique = Array.from(new Map(allGrades.map(g => [g.id, g])).values());
        setAvailablePickerGrades(unique);
      })
      .catch(() => setAvailablePickerGrades([]))
      .finally(() => setLoadingPickerGrades(false));
  }, [selectedLevels]);

  // When selectedGrades change → fetch classrooms for all selected grades
  useEffect(() => {
    if (selectedGrades.length === 0) {
      setAvailablePickerClassrooms([]);
      setSelectedClassroomIds([]);
      return;
    }

    setLoadingPickerClassrooms(true);
    const shift = (formData.shift || '').toLowerCase();
    
    Promise.all(selectedGrades.map(id => getClassrooms(parseInt(id))))
      .then((results) => {
        let allClassrooms = results.flatMap((data: any) => 
          Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        );
        
        // Filter by shift compatibility
        if (shift && shift !== 'both') {
          allClassrooms = allClassrooms.filter((c: any) => (c.shift || '').toLowerCase() === shift);
        }
        
        // Remove duplicates
        const unique = Array.from(new Map(allClassrooms.map(c => [c.id, c])).values());
        setAvailablePickerClassrooms(unique);
      })
      .catch(() => setAvailablePickerClassrooms([]))
      .finally(() => setLoadingPickerClassrooms(false));
  }, [selectedGrades, formData.shift]);

  const assignedIds: number[] = useMemo(
    () => (Array.isArray(formData.assigned_classrooms) ? formData.assigned_classrooms.map(Number) : []),
    [formData.assigned_classrooms]
  )

  const handleRemoveClassroom = useCallback((id: number) => {
    onInputChange("assigned_classrooms", assignedIds.filter(x => x !== id))
  }, [assignedIds, onInputChange])

  const handleAddClassroom = useCallback(() => {
    // This is now handled automatically by checkboxes
  }, [])
  // Update classroom detail map whenever new classrooms are fetched
  const [classroomDetailMap, setClassroomDetailMap] = useState<Record<number, any>>({})
  useEffect(() => {
    if (availablePickerClassrooms.length > 0) {
      setClassroomDetailMap(prev => {
        const next = { ...prev }
        availablePickerClassrooms.forEach((c: any) => { next[c.id] = c })
        return next
      })
    }
  }, [availablePickerClassrooms])

  const getClassroomLabel = (id: number) => {
    const c = classroomDetailMap[id]
    if (!c) return `Classroom #${id}`
    const gradeName = c.grade_name || c.grade?.name || `Grade`
    return `${gradeName} – ${c.section} (${(c.shift || '').charAt(0).toUpperCase() + (c.shift || '').slice(1)})`
  }

  const teacherShift = (formData.shift || '').toLowerCase()

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Current Role</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── 1. Campus (Required) */}
          <div>
            <Label htmlFor="current_campus">Campus *</Label>
            <Select value={formData.current_campus || ""} onValueChange={(v) => onInputChange("current_campus", v)}>
              <SelectTrigger className={`mt-2 border-2 rounded-xl h-11 focus:border-blue-400 ${invalidFields.includes("current_campus") ? "border-red-500" : ""}`}>
                <SelectValue placeholder={loadingCampuses ? "Loading campuses..." : "Select campus"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {campuses.map((campus) => (
                  <SelectItem key={campus.id ?? campus.campus_id} value={String(campus.id ?? campus.campus_id)} className="py-2.5">
                    {campus.campus_name || campus.name || `Campus ${campus.campus_code || campus.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidFields.includes("current_campus") && <p className="text-sm text-red-600 mt-1">Campus is required</p>}
          </div>

          {/* ── 2. Joining Date (Required) */}
          <div>
            <DatePicker
              id="joining_date"
              label="Joining Date"
              required
              date={formData.joining_date}
              onChange={(v: string) => onInputChange("joining_date", v)}
              error={invalidFields.includes("joining_date")}
              disabled={(date: Date) => date > new Date()}
            />
            {invalidFields.includes("joining_date") && <p className="text-sm text-red-600 mt-1">Joining date is required</p>}
          </div>

          {/* ── 3. Shift (Required) */}
          <div>
            <Label htmlFor="shift">Shift *</Label>
            <Select value={formData.shift || ""} onValueChange={(v) => {
              onInputChange("shift", v)
              onInputChange("assigned_classrooms", [])
              setSelectedLevels([]); setSelectedGrades([]); setSelectedClassroomIds([]);
            }}>
              <SelectTrigger className={`mt-2 border-2 rounded-xl h-11 focus:border-blue-400 ${invalidFields.includes("shift") ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {/* Teacher shifts — always fixed options, NOT from student formOptions */}
                <SelectItem value="morning" className="py-2.5">Morning</SelectItem>
                <SelectItem value="afternoon" className="py-2.5">Afternoon</SelectItem>
                <SelectItem value="both" className="py-2.5">Both Shifts</SelectItem>
              </SelectContent>
            </Select>
            {invalidFields.includes("shift") && <p className="text-sm text-red-600 mt-1">Shift is required</p>}
          </div>

          {/* ── 4. Active Status */}
          <div>
            <Label htmlFor="is_currently_active">Employment Status</Label>
            <Select value={String(Boolean(formData.is_currently_active))} onValueChange={(v) => onInputChange("is_currently_active", v === "true")}>
              <SelectTrigger className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="true" className="py-2.5">✅ Currently Active</SelectItem>
                <SelectItem value="false" className="py-2.5">❌ Inactive / On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="is_class_teacher">Is Class Teacher</Label>
              <Select
                value={String(Boolean(formData.is_class_teacher))}
                onValueChange={(v) => {
                  onInputChange("is_class_teacher", v === "true")
                  if (v === "false") {
                    onInputChange("assigned_classrooms", [])
                    setSelectedLevels([]); setSelectedGrades([]); setSelectedClassroomIds([]);
                  }
                }}
                disabled={!!formData.is_teacher_assistant}
              >
                <SelectTrigger className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {/* Assistant Teachers cannot be Class Teachers */}
                  {!formData.is_teacher_assistant && (
                    <SelectItem value="true" className="py-2.5">Yes, Class Teacher</SelectItem>
                  )}
                  <SelectItem value="false" className="py-2.5">No, Subject Teacher Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Teacher Assistant — right of Is Class Teacher (Hide if Yes, Class Teacher is selected) */}
            {!formData.is_class_teacher && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Teacher Assistant</Label>
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 h-11 flex items-center">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="is_teacher_assistant"
                      checked={!!formData.is_teacher_assistant}
                      onCheckedChange={(checked) => {
                        onInputChange("is_teacher_assistant", !!checked)
                        // Assistant teachers cannot be class teachers
                        if (checked) {
                          onInputChange("is_class_teacher", false)
                          onInputChange("assigned_classrooms", [])
                          setSelectedLevels([]); setSelectedGrades([]); setSelectedClassroomIds([]);
                        }
                      }}
                    />
                    <Label htmlFor="is_teacher_assistant" className="text-sm font-semibold text-amber-900 cursor-pointer mb-0">
                      Is Assistant Teacher?
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Multi-classroom picker (shown when is_class_teacher = true) ─────── */}
          {formData.is_class_teacher && (
            <div className="md:col-span-2 space-y-4">
              {/* Info banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                {teacherShift === 'both'
                  ? "This teacher works both shifts. You can assign classrooms from morning and/or afternoon."
                  : teacherShift
                    ? `This teacher works the ${teacherShift} shift. Only ${teacherShift} classrooms are available for assignment.`
                    : "Please select a shift first to assign classrooms."}
              </div>

              {/* Already-assigned classrooms list */}
              {assignedIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Assigned Classrooms ({assignedIds.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {assignedIds.map((id) => (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1 px-3 py-1.5 text-sm">
                        {getClassroomLabel(id)}
                        <button type="button" onClick={() => handleRemoveClassroom(id)} className="ml-1 text-gray-500 hover:text-red-600">
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Picker row */}
              {formData.shift && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-5 space-y-4 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold text-[#274C77]">Bulk Add Classrooms</Label>
                    <span className="text-xs text-gray-400 font-medium">Step-by-step selection</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Level Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">1. Select Level(s)</Label>
                      <div className="border border-gray-200 rounded-xl bg-white p-3 h-40 overflow-y-auto space-y-2 shadow-inner">
                        {loadingLevels ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading...</div>
                        ) : filteredLevels.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">No levels found</div>
                        ) : (
                          filteredLevels.map((l: any) => (
                            <div key={l.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded italic">
                              {/* Always Checkbox if shift is both, else single-like behavior but user specifically asked for checkbox if shift is both */}
                              {(formData.shift || '').toLowerCase() === 'both' ? (
                                <Checkbox 
                                  id={`level-${l.id}`}
                                  checked={selectedLevels.includes(String(l.id))}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedLevels(prev => [...prev, String(l.id)])
                                    else setSelectedLevels(prev => prev.filter(x => x !== String(l.id)))
                                  }}
                                />
                              ) : (
                                <Checkbox 
                                  id={`level-${l.id}`}
                                  checked={selectedLevels.includes(String(l.id))}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedLevels([String(l.id)]) // exclusive if not both
                                    else setSelectedLevels([])
                                  }}
                                />
                              )}
                              <label htmlFor={`level-${l.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                {l.name} <span className="text-[10px] text-gray-400 not-italic">({l.shift})</span>
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Grade Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">2. Select Grade(s)</Label>
                      <div className="border border-gray-200 rounded-xl bg-white p-3 h-40 overflow-y-auto space-y-2 shadow-inner">
                        {loadingPickerGrades ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading...</div>
                        ) : selectedLevels.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Select level first</div>
                        ) : availablePickerGrades.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">No grades found</div>
                        ) : (
                          availablePickerGrades.map((g: any) => (
                            <div key={g.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded">
                              <Checkbox 
                                id={`grade-${g.id}`}
                                checked={selectedGrades.includes(String(g.id))}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedGrades(prev => [...prev, String(g.id)])
                                  else setSelectedGrades(prev => prev.filter(x => x !== String(g.id)))
                                }}
                              />
                              <label htmlFor={`grade-${g.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                {g.name}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Section/Classroom Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">3. Select Section(s)</Label>
                      <div className="border border-gray-200 rounded-xl bg-white p-3 h-40 overflow-y-auto space-y-2 shadow-inner">
                        {loadingPickerClassrooms ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading...</div>
                        ) : selectedGrades.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Select grade first</div>
                        ) : availablePickerClassrooms.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">No classrooms found</div>
                        ) : (
                          availablePickerClassrooms.map((c: any) => {
                            const isAssigned = assignedIds.includes(c.id);
                            return (
                              <div key={c.id} className={`flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded transition-colors ${c.class_teacher && !isAssigned ? 'opacity-50' : ''}`}>
                                <Checkbox 
                                  id={`section-${c.id}`}
                                  disabled={!!c.class_teacher && !isAssigned}
                                  checked={isAssigned}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      if (!assignedIds.includes(c.id)) {
                                        onInputChange("assigned_classrooms", [...assignedIds, Number(c.id)])
                                      }
                                    } else {
                                      onInputChange("assigned_classrooms", assignedIds.filter(x => Number(x) !== Number(c.id)))
                                    }
                                  }}
                                />
                                <label htmlFor={`section-${c.id}`} className="text-sm font-medium leading-none cursor-pointer flex flex-col flex-1">
                                  <div className="flex justify-between items-center">
                                    <span>Section {c.section}</span>
                                    {isAssigned && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">Selected</span>}
                                  </div>
                                  <span className="text-[10px] text-gray-400 italic">
                                    {c.grade_name || c.grade} 
                                    {c.class_teacher && !isAssigned ? ` (Occupied by ${c.class_teacher_name || 'Another'})` : ""}
                                  </span>
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                    <p className="text-[11px] text-gray-500 italic">
                      Checkboxes tick karne se classrooms khud-ba-khud add ho jayengi.
                    </p>
                    <div className="text-sm font-bold text-blue-600">
                      Total Added: {assignedIds.length}
                    </div>
                  </div>
                </div>
              )}

              {invalidFields.includes("assigned_classrooms") && (
                <p className="text-sm text-red-600">At least one classroom is required for class teachers</p>
              )}
            </div>
          )}

          {/* Coordinator Assignment – only when NOT a class teacher */}
          {!formData.is_class_teacher && (
            <div className="md:col-span-2">
              <Label htmlFor="assigned_coordinators">Assign Coordinators</Label>
              <Select
                value=""
                onValueChange={(coordinatorId) => {
                  const current = Array.isArray(formData.assigned_coordinators) ? formData.assigned_coordinators : []
                  if (!current.includes(parseInt(coordinatorId))) {
                    onInputChange("assigned_coordinators", [...current, parseInt(coordinatorId)])
                  }
                }}
                disabled={loadingCoordinators || !formData.current_campus}
              >
                <SelectTrigger className="mt-2 border-2 focus:border-primary">
                  <SelectValue placeholder={loadingCoordinators ? "Loading coordinators..." : coordinators.length === 0 ? "No coordinators available" : "Select coordinator to assign"} />
                </SelectTrigger>
                <SelectContent>
                  {coordinators.map((coordinator: any) => {
                    const isAssigned = Array.isArray(formData.assigned_coordinators) && formData.assigned_coordinators.includes(coordinator.id)
                    return (
                      <SelectItem key={coordinator.id} value={coordinator.id.toString()} disabled={isAssigned}>
                        {coordinator.full_name || `${coordinator.first_name || ''} ${coordinator.last_name || ''}`.trim() || coordinator.email}
                        {coordinator.level?.name && ` - ${coordinator.level.name}`}
                        {coordinator.shift && ` (${coordinator.shift})`}
                        {isAssigned && ' (Already assigned)'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {!formData.current_campus
                  ? "Please select a campus first"
                  : coordinators.length === 0
                    ? `No coordinators available for this campus.`
                    : "Select coordinators to assign to this teacher"}
              </p>

              {Array.isArray(formData.assigned_coordinators) && formData.assigned_coordinators.length > 0 && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm font-medium">Assigned Coordinators:</Label>
                  {formData.assigned_coordinators.map((coordinatorId: number) => {
                    const coordinator = coordinators.find((c: any) => c.id === coordinatorId)
                    return coordinator ? (
                      <div key={coordinatorId} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                        <span className="text-sm">
                          {coordinator.full_name || `${coordinator.first_name || ''} ${coordinator.last_name || ''}`.trim() || coordinator.email}
                          {coordinator.level?.name && ` - ${coordinator.level.name}`}
                          {coordinator.shift && ` (${coordinator.shift})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.assigned_coordinators.filter((id: number) => id !== coordinatorId)
                            onInputChange("assigned_coordinators", updated)
                          }}
                          className="text-red-500 hover:text-red-700 text-lg font-bold"
                          title="Remove coordinator"
                        >
                          ×
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Optional Info Fields (bottom) ──────────────────────────────── */}
          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 border-t pt-4">
              Additional Info (Optional)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current_subjects">Subjects Taught</Label>
                <Input
                  id="current_subjects"
                  value={formData.current_subjects || ""}
                  onChange={(e) => onInputChange("current_subjects", e.target.value)}
                  placeholder="e.g., Mathematics, Physics, Chemistry"
                  className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400"
                />
              </div>

              <div>
                <Label htmlFor="current_classes_taught">Classes Taught</Label>
                <Input
                  id="current_classes_taught"
                  value={formData.current_classes_taught || ""}
                  onChange={(e) => onInputChange("current_classes_taught", e.target.value)}
                  placeholder="e.g., Grade 6-8, Grade 9-10"
                  className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400"
                />
              </div>

              <div>
                <Label htmlFor="current_extra_responsibilities">Extra Responsibilities</Label>
                <Input
                  id="current_extra_responsibilities"
                  value={formData.current_extra_responsibilities || ""}
                  onChange={(e) => onInputChange("current_extra_responsibilities", e.target.value)}
                  placeholder="e.g., Sports Coordinator, Library In-charge"
                  className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400"
                />
              </div>

              <div>
                <Label htmlFor="current_role_title">Role / Designation</Label>
                <Input
                  id="current_role_title"
                  value={formData.current_role_title || ""}
                  onChange={(e) => onInputChange("current_role_title", e.target.value)}
                  placeholder="e.g., Senior Teacher, Subject Head"
                  className="mt-2 border-2 rounded-xl h-11 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}

export default CurrentRoleStep
