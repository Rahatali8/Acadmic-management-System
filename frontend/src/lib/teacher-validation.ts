// teacher-validation.ts - Teacher Form Validation Utilities

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export class TeacherFormValidator {
  
  static validatePhoneNumber(phone: string): ValidationResult {
    if (!phone) {
      return { isValid: false, message: "Phone number is required" };
    }
    
    // Split into country code and number parts
    const parts = phone.trim().split(/\s+/);
    const countryCode = parts[0];
    const localPart = parts.length > 1 ? parts.slice(1).join('') : (phone.startsWith('+') ? '' : phone);
    
    // Remove all non-digit characters from the local part
    const cleanPhone = localPart.replace(/\D/g, '');
    
    if (!cleanPhone) {
      return { isValid: false, message: "Phone number digits are required" };
    }
    
    // Check digits
    const isPakistan = countryCode === "+92";
    
    if (isPakistan) {
        if (cleanPhone.length !== 10) {
            return { isValid: false, message: "Pakistan phone numbers must be exactly 10 digits (e.g., 3XXXXXXXXX)" };
        }
    } else if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        // General international range (ITU-T E.164)
        return { isValid: false, message: "International phone numbers must be between 7 and 15 digits" };
    }
    
    return { isValid: true };
  }
  
  // CNIC validation (Pakistan format: XXXXX-XXXXXXX-X)
  static validateCNIC(cnic: string): ValidationResult {
    if (!cnic) {
      return { isValid: false, message: "CNIC is required" };
    }
    
    const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
    if (!cnicRegex.test(cnic)) {
      return { isValid: false, message: "CNIC must follow format: XXXXX-XXXXXXX-X" };
    }
    
    return { isValid: true };
  }

  // Helper to format CNIC as user types
  static formatCNIC(val: string): string {
    const clean = val.replace(/\D/g, "");
    let formatted = clean;
    if (clean.length > 5 && clean.length <= 12) {
      formatted = `${clean.slice(0, 5)}-${clean.slice(5)}`;
    } else if (clean.length > 12) {
      formatted = `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
    }
    return formatted;
  }
  
  // Name validation (only letters and spaces)
  static validateName(name: string): ValidationResult {
    if (!name) {
      return { isValid: false, message: "Name is required" };
    }
    
    if (name.trim().length < 2) {
      return { isValid: false, message: "Name must be at least 2 characters" };
    }
    
    if (name.trim().length > 200) {
      return { isValid: false, message: "Name must be less than 200 characters" };
    }
    
    const nameRegex = /^[a-zA-Z\s\.\-']+$/;
    if (!nameRegex.test(name.trim())) {
      return { isValid: false, message: "Name can only contain letters, spaces, dots, hyphens, and apostrophes" };
    }
    
    return { isValid: true };
  }
  
  // Date of birth validation
  static validateDateOfBirth(dob: string): ValidationResult {
    if (!dob) {
      return { isValid: false, message: "Date of birth is required" };
    }
    
    const birthDate = new Date(dob);
    const today = new Date();
    
    if (isNaN(birthDate.getTime())) {
      return { isValid: false, message: "Please enter a valid date" };
    }
    
    if (birthDate > today) {
      return { isValid: false, message: "Date of birth cannot be in the future" };
    }
    
    // Calculate age (Teacher should be at least 18)
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 ? age - 1 : age;
    
    if (actualAge < 18) {
      return { isValid: false, message: "Teacher must be at least 18 years old" };
    }
    
    return { isValid: true };
  }
  
  static validateEmail(email: string): ValidationResult {
    if (!email) return { isValid: false, message: "Email is required" };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: "Invalid email format" };
    }
    
    return { isValid: true };
  }
}
