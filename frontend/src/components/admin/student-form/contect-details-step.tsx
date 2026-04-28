"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StudentFormValidator } from "@/lib/student-validation"

import { getCountries, getCountryCallingCode } from "libphonenumber-js"

interface ContactDetailsStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: string) => void
  formOptions?: any
}

const countryCodesList = (() => {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    
    // Helper to get flag emoji from ISO code
    const getFlagEmoji = (countryCode: string) => {
      return countryCode
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
    };

    return getCountries()
      .map(country => ({
        label: `${getFlagEmoji(country)} ${regionNames.of(country)} (+${getCountryCallingCode(country)})`,
        value: `+${getCountryCallingCode(country)}`,
        iso: country
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (e) {
    // Fallback
    return [
      { label: "🇵🇰 Pakistan (+92)", value: "+92", iso: "PK" },
      { label: "🇺🇸 United States (+1)", value: "+1", iso: "US" },
    ];
  }
})();

const PhoneInputWithCode = ({ 
  id, 
  label, 
  value, 
  required = false, 
  error,
  onChange 
}: { 
  id: string, 
  label: string, 
  value: string, 
  required?: boolean,
  error?: string,
  onChange: (val: string) => void 
}) => {
  const parts = (value || "").split(" ")
  const currentCode = parts.length > 1 ? parts[0] : "+92"
  const currentNum = parts.length > 1 ? parts[1] : (value || "").replace(/^\+\d+\s?/, "")

  const handleCodeChange = (code: string) => {
    onChange(`${code} ${currentNum}`)
  }

  const handleNumChange = (num: string) => {
    let cleanNum = num.replace(/\D/g, '')
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.substring(1)
    }
    cleanNum = cleanNum.slice(0, 11)
    onChange(`${currentCode} ${cleanNum}`)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {required && "*"}</Label>
      <div className="flex gap-2">
        <Select value={currentCode} onValueChange={handleCodeChange}>
          <SelectTrigger className="w-[100px] border-2">
            <SelectValue>{currentCode || "+92"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countryCodesList.map((c: any) => (
              <SelectItem key={`${c.iso}-${c.value}`} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          value={currentNum}
          onChange={(e) => handleNumChange(e.target.value)}
          className={`flex-1 ${error ? "border-red-500" : ""}`}
          placeholder="3XX-XXXXXXX"
          maxLength={11}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

export function ContactDetailsStep({ formData, invalidFields, onInputChange, formOptions }: ContactDetailsStepProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value;
    
    // Auto-format CNIC fields
    if (field === "fatherCNIC" || field === "guardianCNIC" || field === "motherCNIC") {
        finalValue = StudentFormValidator.formatCNIC(value);
    }

    onInputChange(field, finalValue)
    
    // Clear error only if it exists
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Effect for async validation to prevent UI lag on main thread
  useEffect(() => {
    const timer = setTimeout(() => {
      const validateField = (field: string, value: string) => {
        if (!value) return;
        
        let validation: any = { isValid: true }
        switch (field) {
          case 'fatherCNIC':
          case 'motherCNIC':
          case 'guardianCNIC':
            validation = StudentFormValidator.validateCNIC(value)
            break
          case 'phoneNumber':
          case 'emergencyContact':
          case 'fatherContact':
          case 'motherContact':
          case 'guardianContact':
            validation = StudentFormValidator.validatePhoneNumber(value)
            break
          case 'familyIncome':
            validation = StudentFormValidator.validatePositiveNumber(value, "Family Income")
            break
          case 'siblingsCount':
            validation = StudentFormValidator.validatePositiveInteger(value, "Siblings Count")
            break
        }
        
        if (!validation.isValid) {
          setFieldErrors(prev => ({ ...prev, [field]: validation.message }))
        } else {
          setFieldErrors(prev => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
          });
        }
      };

      // Validate all current relevant fields
      const fieldsToValidate = [
        'fatherCNIC', 'motherCNIC', 'guardianCNIC',
        'phoneNumber', 'emergencyContact', 'fatherContact', 
        'motherContact', 'guardianContact', 'familyIncome', 'siblingsCount'
      ];
      
      fieldsToValidate.forEach(f => {
        if (formData[f]) validateField(f, formData[f]);
      });
    }, 500); // Debounce validation for 500ms

    return () => clearTimeout(timer);
  }, [formData.fatherCNIC, formData.motherCNIC, formData.guardianCNIC, 
      formData.phoneNumber, formData.emergencyContact, formData.fatherContact,
      formData.motherContact, formData.guardianContact, formData.familyIncome, 
      formData.siblingsCount]);

  const getFieldError = (field: string) => {
    return fieldErrors[field] || (invalidFields.includes(field) ? `${field} is required` : '')
  }

  return (
    <Card className="border-2 bg-white">
      <CardHeader>
        <CardTitle>Family & Contact Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required. Pakistan numbers (+92) must be exactly 10 digits (without leading 0).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          

          <PhoneInputWithCode
            id="phoneNumber"
            label="Student's Own Phone Number"
            value={formData.phoneNumber || ""}
            error={getFieldError("phoneNumber")}
            onChange={(v: string) => handleInputChange("phoneNumber", v)}
          />

          <PhoneInputWithCode
            id="emergencyContact"
            label="Emergency Contact Number"
            required
            value={formData.emergencyContact || ""}
            error={getFieldError("emergencyContact")}
            onChange={(v: string) => handleInputChange("emergencyContact", v)}
          />

          <div>
            <Label htmlFor="emergency_relationship">Relationship to Student</Label>
            <Select value={formData.emergency_relationship || ""} onValueChange={(v: string) => onInputChange("emergency_relationship", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.emergency_relationship && (
                  formOptions.emergency_relationship.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fatherStatus">Father Status</Label>
            <Select value={formData.fatherStatus || ""} onValueChange={(v: string) => onInputChange("fatherStatus", v)}>
              <SelectTrigger className={`border-2 focus:border-primary ${invalidFields.includes("fatherStatus") ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.father_status && (
                  formOptions.father_status.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fatherName">Father Name</Label>
            <Input
              id="fatherName"
              value={formData.fatherName || ""}
              onChange={(e) => handleInputChange("fatherName", e.target.value)}
              placeholder="Enter father's full name"
            />
          </div>

          <div>
            <Label htmlFor="fatherCNIC">Father CNIC</Label>
            <Input
              id="fatherCNIC"
              value={formData.fatherCNIC || ""}
              onChange={(e) => handleInputChange("fatherCNIC", e.target.value)}
              className={getFieldError("fatherCNIC") ? "border-red-500" : ""}
              placeholder="XXXXX-XXXXXXX-X"
              maxLength={15}
            />
          </div>

          <PhoneInputWithCode
            id="fatherContact"
            label="Father Contact Number"
            value={formData.fatherContact || ""}
            error={getFieldError("fatherContact")}
            onChange={(v: string) => handleInputChange("fatherContact", v)}
          />

          <div>
            <Label htmlFor="fatherProfession">Father Profession</Label>
            <Input
              id="fatherProfession"
              value={formData.fatherProfession || ""}
              onChange={(e) => handleInputChange("fatherProfession", e.target.value)}
              placeholder="Enter father's profession"
            />
          </div>

          {formData.fatherStatus === "dead" && (
            <>
              <div className="col-span-full border-t pt-4 mt-2">
                <h3 className="text-md font-semibold text-primary">Guardian Information (Required)</h3>
              </div>
              
              <div>
                <Label htmlFor="guardianName">Guardian Name *</Label>
                <Input
                  id="guardianName"
                  value={formData.guardianName || ""}
                  onChange={(e) => handleInputChange("guardianName", e.target.value)}
                  className={getFieldError("guardianName") ? "border-red-500" : ""}
                  placeholder="Enter guardian's full name"
                />
                {getFieldError("guardianName") && (
                  <p className="text-sm text-red-600 mt-1">{getFieldError("guardianName")}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guardianRelation">Relationship to Student *</Label>
                <Input
                  id="guardianRelation"
                  value={formData.guardianRelation || ""}
                  onChange={(e) => handleInputChange("guardianRelation", e.target.value)}
                  className={getFieldError("guardianRelation") ? "border-red-500" : ""}
                  placeholder="e.g. Uncle, Grandfather"
                />
                {getFieldError("guardianRelation") && (
                  <p className="text-sm text-red-600 mt-1">{getFieldError("guardianRelation")}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guardianCNIC">Guardian CNIC *</Label>
                <Input
                  id="guardianCNIC"
                  value={formData.guardianCNIC || ""}
                  onChange={(e) => handleInputChange("guardianCNIC", e.target.value)}
                  className={getFieldError("guardianCNIC") ? "border-red-500" : ""}
                  placeholder="XXXXX-XXXXXXX-X"
                  maxLength={15}
                />
                {getFieldError("guardianCNIC") && (
                  <p className="text-sm text-red-600 mt-1">{getFieldError("guardianCNIC")}</p>
                )}
              </div>

              <PhoneInputWithCode
                id="guardianContact"
                label="Guardian Phone Number"
                required
                value={formData.guardianContact || ""}
                error={getFieldError("guardianContact")}
                onChange={(v: string) => handleInputChange("guardianContact", v)}
              />

              <div>
                <Label htmlFor="guardianProfession">Guardian Profession *</Label>
                <Input
                  id="guardianProfession"
                  value={formData.guardianProfession || ""}
                  onChange={(e) => handleInputChange("guardianProfession", e.target.value)}
                  className={getFieldError("guardianProfession") ? "border-red-500" : ""}
                  placeholder="Enter profession"
                />
                {getFieldError("guardianProfession") && (
                  <p className="text-sm text-red-600 mt-1">{getFieldError("guardianProfession")}</p>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="motherName">Mother Name</Label>
            <Input
              id="motherName"
              value={formData.motherName || ""}
              onChange={(e) => handleInputChange("motherName", e.target.value)}
              placeholder="Enter mother's full name"
            />
          </div>

          <PhoneInputWithCode
            id="motherContact"
            label="Mother Contact Number"
            value={formData.motherContact || ""}
            error={getFieldError("motherContact")}
            onChange={(v: string) => handleInputChange("motherContact", v)}
          />

          <div>
            <Label htmlFor="siblingsCount">Count of Siblings *</Label>
            <Input
              id="siblingsCount"
              type="number"
              min="0"
              value={formData.siblingsCount || ""}
              onChange={(e) => handleInputChange("siblingsCount", e.target.value)}
              className={getFieldError("siblingsCount") ? "border-red-500" : ""}
              placeholder="Enter total siblings"
            />
            {getFieldError("siblingsCount") && (
              <p className="text-sm text-red-600 mt-1">{getFieldError("siblingsCount")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="familyIncome">Monthly Family Income (PKR)</Label>
            <Input
              id="familyIncome"
              type="number"
              min="0"
              value={formData.familyIncome || ""}
              onChange={(e) => handleInputChange("familyIncome", e.target.value)}
              placeholder="Enter monthly income"
            />
          </div>

          <div>
            <Label htmlFor="houseOwned">House Owned</Label>
            <Select value={formData.houseOwned || ""} onValueChange={(v: string) => onInputChange("houseOwned", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="zakatStatus">Zakat Status</Label>
            <Select value={formData.zakatStatus || ""} onValueChange={(v: string) => onInputChange("zakatStatus", v)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="applicable">Applicable</SelectItem>
                <SelectItem value="not_applicable">Not Applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address || ""}
            onChange={(e) => handleInputChange("address", e.target.value)}
            className={getFieldError("address") ? "border-red-500" : ""}
            placeholder="Enter complete address"
            rows={3}
          />
          {getFieldError("address") && (
            <p className="text-sm text-red-600 mt-1">{getFieldError("address")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
