"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { GeneralInfoStep } from "./campus-form/general-info-step"
import { FacilitiesStep } from "./campus-form/facilities-step"
import { ContactStep } from "./campus-form/contact-step"
import { CampusPreview } from "./campus-form/campus-preview"
import { useToast } from "@/hooks/use-toast"
import { ProgressBar } from "@/components/ui/progress-bar"

const steps = [
  { id: 1, title: "General Information" },
  { id: 2, title: "Facilities" },
  { id: 3, title: "Contact & Info" },
]

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CampusForm() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<any>({ shift_available: "morning" })
  const [invalidFields, setInvalidFields] = useState<string[]>([])

  const totalSteps = steps.length

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    if (invalidFields.includes(field)) {
      setInvalidFields(prev => prev.filter(f => f !== field))
    }
  }

  const validateCurrentStep = (): string[] => {
    const invalid: string[] = []

    if (currentStep === 1) {
      const required = [
        "campus_name", "campus_code", "campus_id", "city", "postal_code",
        "district", "registration_number", "status",
        "address_full", "shift_available",
      ]
      for (const field of required) {
        const val = formData[field]
        if (!val || (typeof val === "string" && val.trim() === "")) {
          invalid.push(field)
        }
      }
      // Academic year end month must be after start month
      if (formData.academic_year_start_month && formData.academic_year_end_month) {
        const startIdx = MONTHS.indexOf(formData.academic_year_start_month)
        const endIdx = MONTHS.indexOf(formData.academic_year_end_month)
        if (startIdx !== -1 && endIdx !== -1 && endIdx < startIdx) {
          invalid.push("academic_year_end_month")
        }
      }
    }

    if (currentStep === 2) {
      const required = [
        "total_classrooms", "total_staff_rooms",
        "power_backup", "internet_available",
        "canteen_facility", "library_available", "student_transport",
      ]
      for (const field of required) {
        const val = formData[field]
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          invalid.push(field)
        }
      }
    }

    if (currentStep === 3) {
      if (!formData.campus_head_name?.trim()) invalid.push("campus_head_name")
      if (!formData.primary_phone?.trim()) invalid.push("primary_phone")
      if (!formData.official_email?.trim()) {
        invalid.push("official_email")
      } else if (!EMAIL_REGEX.test(formData.official_email)) {
        invalid.push("official_email")
      }
      if (formData.campus_head_email?.trim() && !EMAIL_REGEX.test(formData.campus_head_email)) {
        invalid.push("campus_head_email")
      }
    }

    setInvalidFields(invalid)
    return invalid
  }

  const handleNext = () => {
    const invalid = validateCurrentStep()
    if (invalid.length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: `${invalid.length} field(s) need attention`,
      })
      return
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      setShowPreview(true)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleStepChange = (step: number) => {
    if (step <= currentStep) {
      setInvalidFields([])
      setCurrentStep(step)
    }
  }

  const renderCurrentStep = () => {
    if (showPreview) {
      return (
        <CampusPreview
          formData={formData}
          onBack={() => setShowPreview(false)}
          onSaved={() => {
            setShowPreview(false)
            setFormData({})
            setCurrentStep(1)
          }}
        />
      )
    }
    switch (currentStep) {
      case 1: return <GeneralInfoStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      case 2: return <FacilitiesStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      case 3: return <ContactStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {!showPreview && (
        <Card className="border-2">
          <CardHeader>
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">Add Campus</CardTitle>
              </div>
              <ProgressBar
                steps={steps}
                currentStep={currentStep}
                onStepClick={handleStepChange}
                showClickable={true}
              />
            </div>
          </CardHeader>
        </Card>
      )}

      {renderCurrentStep()}

      {!showPreview && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button onClick={handleNext}>
            {currentStep === totalSteps ? "Preview" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
