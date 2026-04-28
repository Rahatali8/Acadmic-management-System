"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getFilteredPrincipals, getAllCampuses, deletePrincipal, updatePrincipal } from '@/lib/api'
import { DataTable, PaginationControls } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, User, Mail, MapPin, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast as sonnerToast } from 'sonner'
import { usePermissions } from '@/lib/permissions'

interface Principal {
  biometric_id: string
  id: number
  full_name: string
  employee_code: string
  email: string
  contact_number: string
  campus_name: string
  campus: number
  shift: string
  is_currently_active: boolean
  joining_date: string
  dob: string
  gender: string
  cnic: string
  permanent_address: string
  education_level: string
  institution_name: string
  year_of_passing: number
  total_experience_years: number
}

export default function PrincipalListPage() {
  const router = useRouter()
  const [principals, setPrincipals] = useState<Principal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("")
  const permissions = usePermissions()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    campus: '',
    shift: '',
    is_currently_active: '',
    ordering: '-created_at'
  })

  const [campuses, setCampuses] = useState<any[]>([])
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Edit functionality
  const [editingPrincipal, setEditingPrincipal] = useState<Principal | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Get user role
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role") || ""
      setUserRole(role)
      console.log("User Role:", role) // Debug log
    }
    initializeData()
  }, [])

  useEffect(() => {
    fetchPrincipals()
  }, [currentPage, pageSize, filters, searchQuery])

  const initializeData = async () => {
    try {
      const campusesData = await getAllCampuses()
      setCampuses(Array.isArray(campusesData) ? campusesData : [])
    } catch (error) {
      console.error('Error fetching campuses:', error)
    }
  }

  const fetchPrincipals = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery || undefined,
        campus: filters.campus ? parseInt(filters.campus) : undefined,
        shift: filters.shift || undefined,
        is_currently_active: filters.is_currently_active ? filters.is_currently_active === 'true' : undefined,
        ordering: filters.ordering
      }

      const response = await getFilteredPrincipals(params)

      setPrincipals(response.results || [])
      setTotalCount(response.count || 0)
      setTotalPages(Math.ceil((response.count || 0) / pageSize))
    } catch (err: any) {
      console.error('Error fetching principals:', err)
      setError(err.message || 'Failed to load principals')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    const timeout = setTimeout(() => {
      setCurrentPage(1)
      fetchPrincipals()
    }, 500)

    setSearchTimeout(timeout)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleEdit = (principal: Principal) => {
    setEditingPrincipal(principal)
    setEditFormData({
      full_name: principal.full_name,
      email: principal.email,
      contact_number: principal.contact_number,
      is_currently_active: principal.is_currently_active,
      dob: principal.dob,
      gender: principal.gender,
      cnic: principal.cnic,
      permanent_address: principal.permanent_address,
      education_level: principal.education_level,
      institution_name: principal.institution_name,
      year_of_passing: principal.year_of_passing,
      total_experience_years: principal.total_experience_years,
      campus: principal.campus,
      shift: principal.shift,
      joining_date: principal.joining_date,
      biometric_id: principal.biometric_id || ''
    })
    setShowEditDialog(true)
  }

  const handleUpdate = async () => {
    if (!editingPrincipal) return

    setIsSubmitting(true)
    try {
      await updatePrincipal(editingPrincipal.id, editFormData)
      sonnerToast.success('✅ Principal Updated Successfully!', {
        description: 'Changes have been saved.',
        duration: 5000,
      })
      setShowEditDialog(false)
      fetchPrincipals()
    } catch (error: any) {
      sonnerToast.error('Failed to update principal', {
        description: error.message || 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (principal: Principal) => {
    if (!confirm(`Are you sure you want to delete ${principal.full_name}?`)) return

    try {
      await deletePrincipal(principal.id)
      sonnerToast.success('✅ Principal Deleted Successfully!', {
        description: 'Principal has been removed from the system.',
        duration: 5000,
      })
      fetchPrincipals()
    } catch (error: any) {
      sonnerToast.error('Failed to delete principal', {
        description: error.message || 'Please try again'
      })
    }
  }

  // Columns definition for DataTable
  const columns = [
    {
      key: 'principal_info',
      label: 'Principal',
      icon: <User className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (principal: Principal) => (
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-[#6096ba]">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center space-x-2">
              <span className="truncate">{principal.full_name}</span>
            </div>
            <div className="text-xs text-gray-500 flex items-center space-x-1">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[100px] sm:max-w-[150px]">{principal.employee_code || 'N/A'}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      icon: <Mail className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (principal: Principal) => (
        <div className="text-xs sm:text-sm text-gray-900">{principal.email}</div>
      )
    },
    {
      key: 'campus',
      label: 'Campus',
      icon: <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (principal: Principal) => (
        <div className="flex items-center space-x-1 sm:space-x-2">
          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-[#6096ba]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">{principal.campus_name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'shift',
      label: 'Shift',
      icon: <Clock className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (principal: Principal) => (
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-[#6096ba]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-medium text-gray-900 capitalize">{principal.shift}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      icon: <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-green-500"></div>,
      render: (principal: Principal) => (
        <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${principal.is_currently_active
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
          }`}>
          {principal.is_currently_active ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ]



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#274C77]">Principals</h1>
          {loading ? (
            <Skeleton className="h-4 w-24 mt-2" />
          ) : (
            <p className="text-gray-600 mt-1">{totalCount} principals total</p>
          )}
        </div>
        {permissions.canAddPrincipal && (
          <Button
            onClick={() => router.push('/admin/principals/add')}
            className="bg-[#6096BA] hover:bg-[#274C77]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Principal
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name, email, code..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filters.campus || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, campus: value === 'all' ? '' : value }))}>
          <SelectTrigger>
            <SelectValue placeholder="All Campuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campuses</SelectItem>
            {campuses.map((campus) => (
              <SelectItem key={campus.id} value={String(campus.id)}>
                {campus.campus_name || campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.shift || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, shift: value === 'all' ? '' : value }))}>
          <SelectTrigger>
            <SelectValue placeholder="All Shifts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.is_currently_active || 'all'} onValueChange={(value) => setFilters((prev: any) => ({ ...prev, is_currently_active: value === 'all' ? '' : value }))}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Principals Table - USING REUSABLE COMPONENT */}
      <DataTable
        data={principals}
        columns={columns}
        onView={(principal) => router.push(`/admin/principals/profile?id=${principal.id}`)}
        onEdit={(principal) => handleEdit(principal)}
        onDelete={(principal) => handleDelete(principal)}
        isLoading={loading}
        emptyMessage="No principals found"
        allowEdit={permissions.canAddPrincipal} // Allow edit only if they have add permissions for now
        allowDelete={permissions.canAddPrincipal}
      />

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Principal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Employee Code - System Generated */}
            <div className="space-y-2">
              <Label>Employee Code <span className="text-xs text-gray-500">(System Generated)</span></Label>
              <Input
                value={editingPrincipal?.employee_code || 'N/A'}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Row 1: Full Name, DOB, Gender */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.full_name || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={editFormData.dob || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, dob: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Gender <span className="text-red-500">*</span></Label>
                <Select value={editFormData.gender || ''} onValueChange={(value) => setEditFormData((prev: any) => ({ ...prev, gender: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Email, Contact, CNIC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Number <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.contact_number || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, contact_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CNIC <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.cnic || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, cnic: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 3: Permanent Address */}
            <div className="space-y-2">
              <Label>Permanent Address <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                rows={2}
                value={editFormData.permanent_address || ''}
                onChange={(e) => setEditFormData((prev: any) => ({ ...prev, permanent_address: e.target.value }))}
              />
            </div>

            {/* Row 4: Education */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Education Level <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.education_level || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, education_level: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={editFormData.dob || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, dob: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Gender <span className="text-red-500">*</span></Label>
                <Select value={editFormData.gender || ''} onValueChange={(value) => setEditFormData((prev: any) => ({ ...prev, gender: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Email, Contact, CNIC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Number <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.contact_number || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, contact_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CNIC <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.cnic || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, cnic: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 3: Permanent Address */}
            <div className="space-y-2">
              <Label>Permanent Address <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6096BA]"
                rows={2}
                value={editFormData.permanent_address || ''}
                onChange={(e) => setEditFormData((prev: any) => ({ ...prev, permanent_address: e.target.value }))}
              />
            </div>

            {/* Row 4: Education */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Education Level <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.education_level || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, education_level: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Institution Name <span className="text-red-500">*</span></Label>
                <Input
                  value={editFormData.institution_name || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, institution_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Year of Passing <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={editFormData.year_of_passing || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, year_of_passing: parseInt(e.target.value) || '' }))}
                />
              </div>
            </div>

            {/* Row 5: Experience, Campus, Shift */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Total Experience (Years) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={editFormData.total_experience_years || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, total_experience_years: parseInt(e.target.value) || '' }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Campus <span className="text-red-500">*</span></Label>
                <Select value={String(editFormData.campus || '')} onValueChange={(value) => setEditFormData((prev: any) => ({ ...prev, campus: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((campus: any) => (
                      <SelectItem key={campus.id} value={String(campus.id)}>
                        {campus.campus_name || campus.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Shift <span className="text-red-500">*</span></Label>
                <Select value={editFormData.shift || ''} onValueChange={(value) => setEditFormData((prev: any) => ({ ...prev, shift: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 6: Joining Date, Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Joining Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={editFormData.joining_date || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, joining_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFormData.is_currently_active ? 'active' : 'inactive'}
                  onValueChange={(value: string) => setEditFormData((prev: any) => ({ ...prev, is_currently_active: value === 'active' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Biometric ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Biometric ID</Label>
                <Input
                  value={editFormData.biometric_id || ''}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, biometric_id: e.target.value }))}
                  placeholder="Device user ID (e.g. 5)"
                />
              </div>
            </div>

            {/* Info Message */}
            {editFormData.campus !== (editingPrincipal?.campus || 0) ||
              editFormData.shift !== (editingPrincipal?.shift || '') ||
              editFormData.joining_date !== (editingPrincipal?.joining_date || '') ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Employee Code will be automatically regenerated because Campus, Shift, or Joining Date has been changed.
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

