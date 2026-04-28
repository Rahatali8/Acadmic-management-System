"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StudentFormValidator } from "@/lib/student-validation"
import { getAllCampuses, apiGet, API_ENDPOINTS } from "@/lib/api"
import { Building2 } from "lucide-react"
import { getCurrentUser, getCurrentUserRole } from "@/lib/permissions"

interface AcademicDetailsStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: string) => void
  formOptions?: any
}

export function AcademicDetailsStep({ formData, invalidFields, onInputChange, formOptions }: AcademicDetailsStepProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [campuses, setCampuses] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classroomLoading, setClassroomLoading] = useState(false)

  useEffect(() => {
    loadCampuses()
  }, [])

  // Reload grades when shift changes
  useEffect(() => {
    if (formData.shift && formData.campus) {
      loadGrades(formData.campus, formData.shift)
      onInputChange("currentGrade", "")
      onInputChange("classroom", "")
      setClassrooms([])
    }
  }, [formData.shift])

  // Load classrooms when campus + grade + section + shift are all set
  useEffect(() => {
    if (formData.campus && formData.currentGrade && formData.section && formData.shift) {
      loadClassrooms(formData.campus, formData.currentGrade, formData.section, formData.shift)
    } else {
      setClassrooms([])
    }
  }, [formData.campus, formData.currentGrade, formData.section, formData.shift])

  const loadCampuses = async () => {
    try {
      setLoading(true)
      const user = getCurrentUser()
      const userRole = getCurrentUserRole()
      
      // Show all campuses for everyone
      const allCampuses = await getAllCampuses()
      setCampuses(allCampuses)
      // Optionally preload all grades (no campus filter)
      if (!formData.campus) {
        await loadGrades("")
      }
    } catch (error) {
      console.error('Error loading campuses:', error)
      setCampuses([])
    } finally {
      setLoading(false)
    }
  }

  const loadGrades = async (campusId: string, shift?: string) => {
    try {
      let endpoint = campusId ? `${API_ENDPOINTS.GRADES}?campus_id=${campusId}` : `${API_ENDPOINTS.GRADES}`
      if (shift) {
        endpoint += campusId ? `&shift=${shift}` : `?shift=${shift}`
      }
      const data = await apiGet(endpoint)
      const list = Array.isArray(data) ? data : (Array.isArray((data as any)?.results) ? (data as any).results : [])
      setGrades(list)
    } catch (e) {
      console.error('Failed to load grades:', e)
      setGrades([])
    }
  }

  const loadClassrooms = async (campusId: string, gradeName: string, section: string, shift: string) => {
    try {
      setClassroomLoading(true)
      const endpoint = `${API_ENDPOINTS.CLASSROOMS}?campus_id=${campusId}&shift=${shift}`
      const data = await apiGet(endpoint)
      const list: any[] = Array.isArray(data) ? data : (Array.isArray((data as any)?.results) ? (data as any).results : [])
      // Filter by grade name and section locally
      const filtered = list.filter((cr: any) => {
        const crGrade = (cr.grade_name || cr.grade?.name || '').toLowerCase()
        const crSection = (cr.section || '').toLowerCase()
        return crGrade.includes(gradeName.toLowerCase()) && crSection === section.toLowerCase()
      })
      setClassrooms(filtered.length ? filtered : list) // show all if none match grade filter
    } catch (e) {
      console.error('Failed to load classrooms:', e)
      setClassrooms([])
    } finally {
      setClassroomLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    onInputChange(field, value)
    
    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    // Reload grades when shift changes
    if (field === 'shift' && formData.campus) {
      loadGrades(formData.campus, value)
    }
    // Clear classroom when grade/section/shift changes
    if (['currentGrade', 'section', 'shift', 'campus'].includes(field)) {
      onInputChange("classroom", "")
      setClassrooms([])
    }
  }

  const handleBlur = (field: string, value: string) => {
    // Validation only triggers on blur
    let validation: any = { isValid: true }
    
    switch (field) {
      case 'admissionYear':
        validation = StudentFormValidator.validateYear(value, "Admission Year")
        break
      case 'fromYear':
        if (value) {
          validation = StudentFormValidator.validateYear(value, "From Year")
        }
        break
      case 'toYear':
        if (value) {
          validation = StudentFormValidator.validateYear(value, "To Year")
        }
        break
    }
    
    if (!validation.isValid) {
      setFieldErrors(prev => ({ ...prev, [field]: validation.message }))
    } else {
      // Clear error if validation passes
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const getFieldError = (field: string) => {
    return fieldErrors[field] || (invalidFields.includes(field) ? `${field} is required` : '')
  }

  return (
    <Card className="border-2 bg-white">
      <CardHeader>
        <CardTitle>Academic Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="campus">Select Campus *</Label>
            <Select value={formData.campus || ""} onValueChange={(v) => { onInputChange("campus", v); loadGrades(v, formData.shift) }}>
              <SelectTrigger className={`border-2 focus:border-primary ${invalidFields.includes("campus") ? "border-red-500" : ""}`}>
                <SelectValue placeholder={loading ? "Loading campuses..." : "Select campus"} />
              </SelectTrigger>
              <SelectContent>
                {(campuses || []).map((campus) => (
                  <SelectItem key={campus.id} value={campus.id.toString()}>
                    {campus.campus_name || campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getFieldError("campus") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("campus")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shift">Shift *</Label>
            <Select value={formData.shift || ""} onValueChange={(v) => onInputChange("shift", v)}>
              <SelectTrigger className={`border-2 focus:border-primary ${invalidFields.includes("shift") ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.shift && (
                  formOptions.shift.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {getFieldError("shift") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("shift")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="currentGrade">Current Grade/Class *</Label>
            <Select value={formData.currentGrade || ""} onValueChange={(v) => onInputChange("currentGrade", v)}>
              <SelectTrigger className={`border-2 focus:border-primary ${invalidFields.includes("currentGrade") ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select grade/class" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((g) => (
                  <SelectItem key={g.id} value={g.name}>
                    {g.name} • {g.level_shift ? g.level_shift.charAt(0).toUpperCase() + g.level_shift.slice(1) : 'N/A'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getFieldError("currentGrade") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("currentGrade")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="section">Section *</Label>
            <Select value={formData.section || ""} onValueChange={(v) => onInputChange("section", v)}>
              <SelectTrigger className={`border-2 focus:border-primary ${invalidFields.includes("section") ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.section && (
                  formOptions.section.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {getFieldError("section") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("section")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="admissionYear">Enrollment Year *</Label>
            <Input
              id="admissionYear"
              type="number"
              min="2000"
              max="2030"
              value={formData.admissionYear || ""}
              onChange={(e) => handleInputChange("admissionYear", e.target.value)}
              onBlur={(e) => handleBlur("admissionYear", e.target.value)}
              className={getFieldError("admissionYear") ? "border-red-500" : ""}
              placeholder="e.g., 2025"
            />
            {getFieldError("admissionYear") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("admissionYear")}</p>
            )}
          </div>

          {/* Classroom dropdown — auto-loads once campus/grade/section/shift are set */}
          <div className="md:col-span-2">
            <Label htmlFor="classroom" className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Classroom
              {classrooms.length > 0 && (
                <span className="ml-1 text-[10px] text-green-600 font-normal">({classrooms.length} available)</span>
              )}
            </Label>
            <Select
              value={formData.classroom || ""}
              onValueChange={(v) => onInputChange("classroom", v)}
              disabled={classroomLoading || classrooms.length === 0}
            >
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue
                  placeholder={
                    classroomLoading
                      ? "Loading classrooms..."
                      : !formData.campus || !formData.currentGrade || !formData.section || !formData.shift
                      ? "Select campus, grade, section & shift first"
                      : classrooms.length === 0
                      ? "No classroom found — create one first"
                      : "Select classroom"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((cr: any) => (
                  <SelectItem key={cr.id} value={cr.id.toString()}>
                    {cr.grade_name || cr.grade?.name || 'Unknown'} - {cr.section}
                    {cr.shift ? ` (${cr.shift.charAt(0).toUpperCase() + cr.shift.slice(1)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              If you skip this, the system will auto-assign the classroom based on campus / grade / section / shift.
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}