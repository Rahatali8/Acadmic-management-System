"use client"

import type React from "react"
import { useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Upload, X, Pencil, Wand2 } from "lucide-react"
import { StudentFormValidator } from "@/lib/student-validation"
import { DatePicker } from "@/components/ui/date-picker"
import { checkStudentDuplicate } from "@/lib/api"

// ── Student ID Field with Auto / Manual toggle ───────────────────────────────
function StudentIdField({ formData, onInputChange }: { formData: any; onInputChange: (f: string, v: string) => void }) {
  const [manual, setManual] = useState(!!formData.student_id)

  const switchToManual = () => {
    setManual(true)
    onInputChange("student_id", "")
  }

  const switchToAuto = () => {
    setManual(false)
    onInputChange("student_id", "") // clear so backend generates
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label htmlFor="student_id">Student ID</Label>
        <button
          type="button"
          onClick={manual ? switchToAuto : switchToManual}
          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            manual
              ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              : "bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {manual ? (
            <><Wand2 className="h-3 w-3" /> Auto-generate</>
          ) : (
            <><Pencil className="h-3 w-3" /> Enter Manually</>
          )}
        </button>
      </div>

      {manual ? (
        <Input
          id="student_id"
          value={formData.student_id || ""}
          onChange={(e) => onInputChange("student_id", e.target.value)}
          placeholder="e.g. AL-M25-00042"
          className="border-2 focus:border-primary"
        />
      ) : (
        <Input
          id="student_id"
          value=""
          readOnly
          placeholder="Auto-generated on save"
          className="bg-gray-50 text-gray-400 italic cursor-not-allowed"
        />
      )}

      <p className="text-[10px] text-gray-400 mt-1">
        {manual
          ? "You are entering a custom Student ID — make sure it is unique."
          : "The system will auto-generate a unique ID based on campus & enrollment year."}
      </p>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

interface PersonalDetailsStepProps {
  formData: any
  uploadedImages: { [key: string]: string }
  invalidFields: string[]
  onInputChange: (field: string, value: string) => void
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>, imageKey: string) => void
  onRemoveImage: (imageKey: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  formOptions?: any
  stepErrors: Record<string, string>
  setStepErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function PersonalDetailsStep({
  formData,
  uploadedImages,
  invalidFields,
  onInputChange,
  onImageUpload,
  onRemoveImage,
  fileInputRef,
  formOptions,
  stepErrors,
  setStepErrors,
}: PersonalDetailsStepProps) {

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value
    
    // Auto-format CNIC
    if (field === "student_cnic") {
      finalValue = StudentFormValidator.formatCNIC(value)
    }

    onInputChange(field, finalValue)
    
    // Clear error when user starts typing
    if (stepErrors[field]) {
      setStepErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    // Real-time validation
    let validation: any = { isValid: true }
    
    switch (field) {
      case 'name':
        validation = StudentFormValidator.validateName(finalValue)
        break
      case 'dob':
        validation = StudentFormValidator.validateDateOfBirth(finalValue)
        break
      case 'placeOfBirth':
        if (finalValue && finalValue.trim().length < 2) {
          validation = { isValid: false, message: "Place of birth must be at least 2 characters" }
        }
        break
      case 'student_cnic':
        if (finalValue) {
          validation = StudentFormValidator.validateCNIC(finalValue)
        }
        break
      case 'email':
        validation = StudentFormValidator.validateEmail(finalValue)
        break
    }
    
    if (!validation.isValid) {
      setStepErrors(prev => ({ ...prev, [field]: validation.message }))
    }
  }

  const getFieldError = (field: string) => {
    return stepErrors[field] || (invalidFields.includes(field) ? `${field} is required` : '')
  }

  return (
    <Card className="border-2 bg-white">

      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student Photo Upload */}
        <div>
          <Label>Student Photo</Label>
          <div className="mt-2">
            {uploadedImages.studentPhoto ? (
              <div className="relative inline-block">
                <img
                  src={uploadedImages.studentPhoto || "/placeholder.svg"}
                  alt="Student"
                  className="w-32 h-32 object-cover rounded-lg border-2"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={() => onRemoveImage("studentPhoto")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors ${
                  invalidFields.includes("studentPhoto") ? "border-red-500" : "border-gray-300"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Click to upload student photo</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageUpload(e, "studentPhoto")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StudentIdField formData={formData} onInputChange={onInputChange} />


          <div>
            <Label htmlFor="name">Student Name *</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={getFieldError("name") ? "border-red-500" : ""}
              placeholder="Enter full name"
            />
            {getFieldError("name") && <p className="text-sm text-red-600 mt-1">{getFieldError("name")}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleInputChange("email", e.target.value)}
              onBlur={async (e) => {
                const val = e.target.value;
                if (val && StudentFormValidator.validateEmail(val).isValid) {
                  const res = await checkStudentDuplicate(undefined, val);
                  if (res.email_exists) {
                    setStepErrors(prev => ({ ...prev, email: "This email is already in use by an active student." }));
                  }
                }
              }}
              className={getFieldError("email") ? "border-red-500" : ""}
              placeholder="e.g. student@example.com"
            />
            <p className="text-[10px] text-gray-400 mt-1">Optional. Both email or Student ID can be used for login.</p>
            {getFieldError("email") && <p className="text-sm text-red-600 mt-1">{getFieldError("email")}</p>}
          </div>

          <div>
            <Label htmlFor="gender">Gender *</Label>
            <Select value={formData.gender || ""} onValueChange={(v) => onInputChange("gender", v)}>
              <SelectTrigger
                className={`border-2 focus:border-primary ${invalidFields.includes("gender") ? "border-red-500" : ""}`}
              >
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.gender && (
                  formOptions.gender.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {invalidFields.includes("gender") && <p className="text-sm text-red-600 mt-1">Gender is required</p>}
          </div>

          <div>
            <DatePicker
              id="dob"
              label="Date of Birth"
              required
              date={formData.dob}
              onChange={(v: string) => handleInputChange("dob", v)}
              error={!!getFieldError("dob")}
              disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01")}
            />
            {getFieldError("dob") && <p className="text-sm text-red-600 mt-1">{getFieldError("dob")}</p>}
          </div>

          <div>
            <Label htmlFor="placeOfBirth">Place of Birth</Label>
            <Input
              id="placeOfBirth"
              value={formData.placeOfBirth || ""}
              onChange={(e) => handleInputChange("placeOfBirth", e.target.value)}
              className={getFieldError("placeOfBirth") ? "border-red-500" : ""}
              placeholder="Enter place of birth"
            />
            {getFieldError("placeOfBirth") && <p className="text-sm text-red-600 mt-1">{getFieldError("placeOfBirth")}</p>}
          </div>

          <div>
            <Label htmlFor="religion">Religion *</Label>
            <Select value={formData.religion || ""} onValueChange={(v) => onInputChange("religion", v)}>
              <SelectTrigger
                className={`border-2 focus:border-primary ${invalidFields.includes("religion") ? "border-red-500" : ""}`}
              >
                <SelectValue placeholder="Select religion" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.religion && (
                  formOptions.religion.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {invalidFields.includes("religion") && <p className="text-sm text-red-600 mt-1">Religion is required</p>}
          </div>

          <div>
            <Label htmlFor="motherTongue">Mother Tongue *</Label>
            <Select value={formData.motherTongue || ""} onValueChange={(v) => onInputChange("motherTongue", v)}>
              <SelectTrigger
                className={`border-2 focus:border-primary ${invalidFields.includes("motherTongue") ? "border-red-500" : ""}`}
              >
                <SelectValue placeholder="Select mother tongue" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.mother_tongue && (
                  formOptions.mother_tongue.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {invalidFields.includes("motherTongue") && (
              <p className="text-sm text-red-600 mt-1">Mother tongue is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="student_cnic">Student B-Form / CNIC</Label>
            <Input
              id="student_cnic"
              value={formData.student_cnic || ""}
              onChange={(e) => handleInputChange("student_cnic", e.target.value)}
              onBlur={async (e) => {
                const val = e.target.value;
                if (val && StudentFormValidator.validateCNIC(val).isValid) {
                  const res = await checkStudentDuplicate(val, undefined);
                  if (res.cnic_exists) {
                    setStepErrors(prev => ({ ...prev, student_cnic: "This CNIC/B-Form is already in use by an active student." }));
                  }
                }
              }}
              className={getFieldError("student_cnic") ? "border-red-500" : ""}
              placeholder="XXXXX-XXXXXXX-X"
            />
            {getFieldError("student_cnic") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("student_cnic")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="nationality">Nationality</Label>
            <Select value={formData.nationality || ""} onValueChange={(v) => onInputChange("nationality", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.nationality && (
                  formOptions.nationality.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="blood_group">Blood Group</Label>
            <Select value={formData.blood_group || ""} onValueChange={(v) => onInputChange("blood_group", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select blood group" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.blood_group && (
                  formOptions.blood_group.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="special_needs_disability">Special Needs / Disability</Label>
            <Select value={formData.special_needs_disability || ""} onValueChange={(v) => onInputChange("special_needs_disability", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.special_needs && (
                  formOptions.special_needs.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}