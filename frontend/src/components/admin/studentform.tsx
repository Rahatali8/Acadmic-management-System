"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { StudentPreview } from "./student-form/student-preview"
import { PersonalDetailsStep } from "./student-form/personal-details-step"
import { ContactDetailsStep } from "./student-form/contect-details-step"
import { AcademicDetailsStep } from "./student-form/acadmic-details-step"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { getStudentFormOptions } from "@/lib/api"
import { useEffect } from "react"
const steps = [
  { id: 1, title: "Personal Details" },
  { id: 2, title: "Contact Details" },
  { id: 3, title: "Academic Details" },
]

export function StudentForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<any>({
    fatherStatus: "alive",
    motherStatus: "married",
    siblingsCount: "0",
    nationality: "pakistani",
    blood_group: "",
    special_needs_disability: "none",
  })
  const [uploadedImages, setUploadedImages] = useState<{ [key: string]: string }>({})
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>
  const [formOptions, setFormOptions] = useState<any>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      const options = await getStudentFormOptions()
      if (options) {
        setFormOptions(options)
      }
    }
    fetchOptions()
  }, [])

  const totalSteps = steps.length

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    if (invalidFields.includes(field)) {
      setInvalidFields((prev) => prev.filter((f) => f !== field))
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, imageKey: string) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedImages((prev) => ({ ...prev, [imageKey]: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = (imageKey: string) => {
    setUploadedImages((prev) => {
      const newImages = { ...prev }
      delete newImages[imageKey]
      return newImages
    })
  }

  const validateCurrentStep = () => {
    const requiredFields: { [step: number]: string[] } = {
      1: ["name", "gender", "dob", "religion", "motherTongue"],
      2: ["emergencyContact", "address", "siblingsCount"],
      3: ["campus", "shift", "currentGrade", "section", "admissionYear"],
    }

    const required = requiredFields[currentStep] || []
    const invalid: string[] = []

    for (const field of required) {
      const value = formData[field]
      if (!value || (typeof value === "string" && value.trim() === "")) {
        invalid.push(field)
      }
    }


    setInvalidFields(invalid)
    return invalid
  }

  const handleNext = () => {
    const invalid = validateCurrentStep()
    const activeStepErrors = Object.values(stepErrors).filter(Boolean)
    
    if (invalid.length > 0 || activeStepErrors.length > 0) {
      const errorDescriptions = [
        ...(invalid.length > 0 ? [`Missing required fields: ${invalid.join(", ")}`] : []),
        ...activeStepErrors
      ]
      
      toast({
        title: "Please fix the errors before proceeding",
        description: errorDescriptions.join(" | "),
        variant: "destructive"
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
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepChange = (step: number) => {
    if (step > currentStep) {
      const invalid = validateCurrentStep()
      const activeStepErrors = Object.values(stepErrors).filter(Boolean)
      
      if (invalid.length > 0 || activeStepErrors.length > 0) {
        const errorDescriptions = [
          ...(invalid.length > 0 ? [`Missing required fields: ${invalid.join(", ")}`] : []),
          ...activeStepErrors
        ]
        
        toast({
          title: "Please fix the errors before proceeding",
          description: errorDescriptions.join(" | "),
          variant: "destructive"
        })
        return
      }
    }
    setInvalidFields([])
    setCurrentStep(step)
  }

  const renderCurrentStep = () => {
    if (showPreview) {
      return (
        <StudentPreview
          formData={formData}
          uploadedImages={uploadedImages}
          onBack={() => setShowPreview(false)}
          onError={(error) => setSubmitError(error)}
          onSaved={(studentData) => {
            setShowPreview(false)
            setFormData({
              fatherStatus: "alive",
              motherStatus: "married",
              siblingsCount: "0",
              nationality: "pakistani",
              blood_group: "",
              special_needs_disability: "none",
            })
            setUploadedImages({})
            setCurrentStep(1)
            setSubmitError('')

            const studentName = studentData?.name || formData.name || "Student"
            const studentId = studentData?.student_id || "N/A"
            const grade = studentData?.grade_name || formData.currentGrade || "N/A"

            sonnerToast.success("✅ Student Added Successfully!", {
              description: (
                <div className="space-y-1">
                  <p className="font-semibold">Student: {studentName}</p>
                  <p>Student ID: {studentId}</p>
                  <p>Grade: {grade}</p>
                </div>
              ),
              duration: 5000,
            })
            if (onSuccess) onSuccess()
          }}
        />
      )
    }

    switch (currentStep) {
      case 1:
        return (
          <PersonalDetailsStep
            formData={formData}
            uploadedImages={uploadedImages}
            invalidFields={invalidFields}
            stepErrors={stepErrors}
            setStepErrors={setStepErrors}
            onInputChange={handleInputChange}
            onImageUpload={handleImageUpload}
            onRemoveImage={removeImage}
            fileInputRef={fileInputRef}
            formOptions={formOptions}
          />
        )
      case 2:
        return (
          <ContactDetailsStep
            formData={formData}
            invalidFields={invalidFields}
            onInputChange={handleInputChange}
            formOptions={formOptions}
          />
        )
      case 3:
        return (
          <AcademicDetailsStep
            formData={formData}
            invalidFields={invalidFields}
            onInputChange={handleInputChange}
            formOptions={formOptions}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Only using Toast notifications for errors now to keep UI clean */}

      {!showPreview && (
        <Card className="border-2 bg-white">
          <CardHeader>
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Progress</CardTitle>
                  <CardDescription className="text-sm">
                    Step {currentStep} of {totalSteps}
                  </CardDescription>
                </div>
                <div className="text-sm text-muted-foreground">Add Student</div>
              </div>
              <div className="mt-4">
                <ProgressBar
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={handleStepChange}
                  showClickable={true}
                />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="mt-6">
        {renderCurrentStep()}
      </div>

      {!showPreview && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 mt-6 shadow-sm">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            variant="ghost"
            className={`flex items-center gap-2 px-6 h-12 font-bold rounded-xl transition-all ${
              currentStep === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:shadow-md text-gray-600"
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
            Previous Step
          </Button>

          <Button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            {currentStep === totalSteps ? (
              <>
                <Eye className="h-5 w-5" />
                Review & Preview
              </>
            ) : (
              <>
                Next Step
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

