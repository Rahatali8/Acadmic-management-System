"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Award,
  FileText,
  TrendingUp,
  Search,
  Filter,
  CheckSquare,
  Square,
  MessageSquare,
  Send,
  Calendar,
  ChevronRight,
  Printer,
  MoreVertical,
  Loader2
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getCoordinatorResults,
  approveResult,
  rejectResult,
  bulkApproveResults,
  bulkRejectResults,
  getCurrentUserProfile,
  getSubjects,
  Result,
  Student,
  fetchStudentFullResults,
  getStudentById
} from '@/lib/api';
import ApproveWithSignature from "@/components/signature/ApproveWithSignature";
import { toast } from "sonner";
import { ReportCard } from "@/components/admin/report-card";
import { X } from "lucide-react";

interface CoordinatorProfile {
  id: number;
  full_name: string;
  employee_code: string;
  level: {
    id: number;
    name: string;
  };
  campus: {
    campus_name: string;
  };
  signature?: string | null;
}

interface ResultWithDetails extends Omit<Result, 'student' | 'teacher'> {
  student: Student;
  teacher: {
    id: number;
    full_name: string;
    employee_code: string;
  };
  pass_status?: string;
  updated_at: string;
}

const MONTHS_ORDER = [
  'April', 'May', 'June', 'August', 'September', 'October',
  'November', 'December', 'January', 'February', 'March'
];

export default function ResultApprovalPage() {
  const [coordinatorProfile, setCoordinatorProfile] = useState<CoordinatorProfile | null>(null);
  const [results, setResults] = useState<ResultWithDetails[]>([]);
  const [filteredResults, setFilteredResults] = useState<ResultWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject">("approve");
  const [bulkComments, setBulkComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedResultView, setSelectedResultView] = useState<Result | null>(null);
  const [reportCardData, setReportCardData] = useState<{ student: Student, results: Result[] } | null>(null);
  const [fetchingReportCard, setFetchingReportCard] = useState(false);
  const [activeTab, setActiveTab] = useState("monthly_test");
  const [activeMonthTab, setActiveMonthTab] = useState(MONTHS_ORDER[0]);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [resultToApprove, setResultToApprove] = useState<number | null>(null);
  const [isBulkApprove, setIsBulkApprove] = useState(false);

  useEffect(() => {
    document.title = "Result Approval - Coordinator | Newton AMS";
    fetchData();
  }, []);

  useEffect(() => {
    filterResults();
  }, [results, searchTerm, statusFilter, gradeFilter, activeTab, activeMonthTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log(' Starting fetchData...');

      // API connectivity will be tested through authenticated calls

      // Check if user is logged in
      const token = localStorage.getItem('sis_access_token');
      console.log(' Token check:', token ? 'Token exists' : 'No token');

      if (!token) {
        console.error(' No authentication token found');
        toast.error('Please log in again');
        // Clear all auth data
        localStorage.removeItem('sis_access_token');
        localStorage.removeItem('sis_refresh_token');
        // Redirect to login
        window.location.href = '/login';
        return;
      }

      // Get coordinator profile
      console.log(' Fetching coordinator profile...');
      try {
        const profile = await getCurrentUserProfile();
        console.log(' Profile received:', profile);

        // Check if user is coordinator
        if ((profile as any).role !== 'coordinator') {
          console.error(' User is not a coordinator');
          toast.error('Access denied. Coordinator access required.');
          window.location.href = '/login';
          return;
        }

        setCoordinatorProfile(profile as CoordinatorProfile);
      } catch (profileError: any) {
        console.error(' Error fetching profile:', profileError);
        if (profileError?.status === 401) {
          toast.error('Session expired. Please log in again.');
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        throw profileError;
      }

      // Fetch all results assigned to coordinator
      console.log(' Fetching coordinator results...');
      try {
        const resultsData = await getCoordinatorResults();
        console.log(' Coordinator results data from API:', resultsData);
        console.log(' Results data type:', typeof resultsData);
        console.log(' Is array?', Array.isArray(resultsData));
        console.log(' Results length:', Array.isArray(resultsData) ? resultsData.length : 0);
        console.log(' First result:', Array.isArray(resultsData) ? resultsData[0] : 'Not array');
        console.log(' All results statuses:', Array.isArray(resultsData) ? resultsData.map((r: any) => ({ id: r.id, status: r.status, student: r.student?.name })) : 'Not array');

        // Ensure results is always an array
        const safeResults = Array.isArray(resultsData) ? resultsData : [];
        console.log(' Safe results set:', safeResults.length);
        setResults(safeResults as ResultWithDetails[]);

        if (safeResults.length === 0) {
          console.log(' No results found for this coordinator');
          toast.info('No results found. Teachers need to forward results to you first.');
        } else {
          console.log(' Successfully loaded results for coordinator');
          toast.success(`Loaded ${safeResults.length} results successfully!`);
        }
      } catch (resultsError: any) {
        console.error(' Error fetching results:', resultsError);
        console.error(' Error status:', resultsError?.status);
        console.error(' Error message:', resultsError?.message);
        console.error(' Full error:', resultsError);

        if (resultsError?.status === 401) {
          console.log(' Authentication error - redirecting to login');
          toast.error('Session expired. Please log in again.');
          localStorage.clear();
          window.location.href = '/login';
          return;
        }

        // Show more specific error message
        const errorMessage = resultsError?.message || resultsError?.response?.data?.error || 'Failed to load results. Please try again.';
        toast.error(`Error: ${errorMessage}`);
        setResults([]);
      }

    } catch (error: any) {
      console.error(' Error fetching data:', error);
      console.error(' Error details:', error?.message);
      console.error(' Error stack:', error?.stack);
      toast.error('Failed to load data');
      // Set empty array on error
      setResults([]);
    } finally {
      setLoading(false);
      console.log('✅ fetchData completed');
    }
  };

  const handleViewReportCard = async (result: Result) => {
    try {
      setFetchingReportCard(true);
      setShowViewModal(true);
      setSelectedResultView(result);

      const studentId = result.student.id;
      
      // Fetch all results for this student
      const [studentResults, completeStudent] = await Promise.all([
        fetchStudentFullResults(studentId),
        getStudentById(studentId)
      ]);

      if (completeStudent) {
        setReportCardData({ student: completeStudent, results: studentResults });
      } else {
        toast.error("Student details not found");
      }
    } catch (error) {
      console.error('Error fetching student report card:', error);
      toast.error("Failed to load student details");
    } finally {
      setFetchingReportCard(false);
    }
  };

  const filterResults = () => {
    // Ensure results is always an array
    const safeResults = Array.isArray(results) ? results : [];
    let filtered = [...safeResults];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.student?.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.teacher?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }



    // Grade filter
    if (gradeFilter !== "all") {
      filtered = filtered.filter(result => {
        const className = result.student?.class_name || "";
        // Check exact match or inclusion (Grade 1 -> Grade 1 A)
        if (className.includes(gradeFilter)) return true;

        // Check Roman Numeral mapping (Grade 1 -> Grade I)
        const gradeNum = gradeFilter.replace("Grade ", "");
        const romanMap: Record<string, string> = {
          "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
          "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X"
        };

        if (romanMap[gradeNum]) {
          // Ensure we match "Grade I" but not "Grade IV" via partial match if simplistic
          // Actually includes("Grade I") is safe against "Grade IV" or "Grade II"
          return className.includes(`Grade ${romanMap[gradeNum]}`);
        }

        return false;
      });
    }

    // Exam Type Tab Filter — backend values: 'monthly', 'midterm', 'final'
    const tabToExamType: Record<string, string> = {
      monthly_test: 'monthly',
      mid_term: 'midterm',
      final_term: 'final',
    };
    const examTypeValue = tabToExamType[activeTab];
    if (examTypeValue) {
      filtered = filtered.filter(result => result.exam_type === examTypeValue);
      if (examTypeValue === 'monthly' && activeMonthTab) {
        filtered = filtered.filter(result => result.month === activeMonthTab);
      }
    }

    setFilteredResults(filtered);
  };

  const handleApprove = (resultId: number) => {
    setResultToApprove(resultId);
    setIsBulkApprove(false);
    setShowApproveModal(true);
  };

  const confirmApprove = async (signature: string) => {
    if (!resultToApprove) return;
    
    try {
      setProcessing(true);
      await approveResult(resultToApprove, { 
        status: 'approved', 
        coordinator_comments: '',
        signature: signature
      });
      toast.success('Result approved with signature!');
      await fetchData();
    } catch (error) {
      console.error('Error approving result:', error);
      toast.error('Failed to approve result');
      throw error; // Re-throw for modal error handling
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (resultId: number) => {
    try {
      setProcessing(true);
      await rejectResult(resultId, { status: 'rejected', coordinator_comments: 'Please review and resubmit' });
      toast.success('Result rejected successfully!');
      await fetchData();
    } catch (error) {
      console.error('Error rejecting result:', error);
      toast.error('Failed to reject result');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectResult = (resultId: number) => {
    setSelectedResults(prev =>
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const handleSelectAll = () => {
    // Only select items that are actionable (not approved or rejected)
    const actionableResults = filteredResults.filter(r =>
      ['pending', 'submitted', 'pending_coordinator'].includes(r.status)
    );

    if (selectedResults.length === actionableResults.length && actionableResults.length > 0) {
      setSelectedResults([]);
    } else {
      setSelectedResults(actionableResults.map(r => r.id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedResults.length === 0) {
      toast.error('Please select results to process');
      return;
    }

    if (bulkAction === "reject") {
      try {
        setProcessing(true);
        await bulkRejectResults(selectedResults, bulkComments);
        toast.success(`Rejected ${selectedResults.length} results successfully!`);
        setShowBulkModal(false);
        setSelectedResults([]);
        setBulkComments("");
        await fetchData();
      } catch (error) {
        console.error('Error processing bulk rejection:', error);
        toast.error('Failed to process bulk rejection');
      } finally {
        setProcessing(false);
      }
    } else {
      // For bulk approve, show signature modal
      setIsBulkApprove(true);
      setShowApproveModal(true);
    }
  };

  const confirmBulkApprove = async (signature: string) => {
    try {
      setProcessing(true);
      await bulkApproveResults(selectedResults, bulkComments, signature);
      toast.success(`Approved ${selectedResults.length} results with signature!`);
      
      setShowApproveModal(false);
      setShowBulkModal(false);
      setSelectedResults([]);
      setBulkComments("");
      await fetchData();
    } catch (error) {
       console.error('Error processing bulk approval:', error);
       toast.error('Failed to process bulk approval');
       throw error;
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: FileText },
      submitted: { color: 'bg-blue-100 text-blue-800', icon: Send },
      under_review: { color: 'bg-yellow-100 text-yellow-800', icon: Eye },
      pending_principal: { color: 'bg-purple-100 text-purple-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const getResultStatusBadge = (resultStatus: string, passStatus?: string) => {
    if (passStatus === 'absent' || resultStatus === 'absent') {
      return (
        <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1 border-amber-200">
          <Clock className="h-3 w-3" />
          ABSENT
        </Badge>
      );
    }
    return resultStatus === 'pass' ? (
      <Badge className="bg-green-100 text-green-800 flex items-center gap-1 border-green-200">
        <CheckCircle className="h-3 w-3" />
        PASS
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 flex items-center gap-1 border-red-200">
        <XCircle className="h-3 w-3" />
        FAIL
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-40 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-4 space-y-2 flex-1">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results Table Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-gray-50/30 min-h-screen">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#1a365d] tracking-tight">Result Approval</h1>
          <p className="text-gray-500 mt-2 text-lg">
            Manage and approve student results efficiently.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-white/50 backdrop-blur border border-blue-200 text-blue-700 px-4 py-2 text-sm shadow-sm">
            Level: {coordinatorProfile?.level?.name || 'Loading...'}
          </Badge>
          <div className="h-10 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <p className="text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Pending Review', count: filteredResults.filter(r => ['pending', 'pending_coordinator'].includes(r.status)).length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'Submitted', count: filteredResults.filter(r => r.status === 'submitted').length, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Approved', count: filteredResults.filter(r => r.status === 'approved').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
          { label: 'Total Results', count: filteredResults.length, icon: FileText, color: 'text-[#274c77]', bg: 'bg-slate-50', border: 'border-slate-100' },
        ].map((stat, idx) => (
          <Card key={idx} className={`border ${stat.border} shadow-sm hover:shadow-md transition-shadow duration-200`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                <h3 className={`text-3xl font-bold ${stat.color}`}>{stat.count}</h3>
              </div>
              <div className={`p-3 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area with Tabs */}
      <Tabs defaultValue="monthly_test" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <TabsList className="bg-white p-1 border shadow-sm rounded-lg h-12 w-full md:w-auto grid grid-cols-3 md:flex">
            <TabsTrigger value="monthly_test" className="px-6 py-2.5 data-[state=active]:bg-[#274c77] data-[state=active]:text-white transition-all">Monthly Test</TabsTrigger>
            <TabsTrigger value="mid_term" className="px-6 py-2.5 data-[state=active]:bg-[#274c77] data-[state=active]:text-white transition-all">Mid Term</TabsTrigger>
            <TabsTrigger value="final_term" className="px-6 py-2.5 data-[state=active]:bg-[#274c77] data-[state=active]:text-white transition-all">Final Term</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            {/* Grade Filter */}
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="Grade 1">Grade 1</SelectItem>
                <SelectItem value="Grade 2">Grade 2</SelectItem>
                <SelectItem value="Grade 3">Grade 3</SelectItem>
                <SelectItem value="Grade 4">Grade 4</SelectItem>
                <SelectItem value="Grade 5">Grade 5</SelectItem>
                <SelectItem value="Grade 6">Grade 6</SelectItem>
                <SelectItem value="Grade 7">Grade 7</SelectItem>
                <SelectItem value="Grade 8">Grade 8</SelectItem>
                <SelectItem value="Grade 9">Grade 9</SelectItem>
                <SelectItem value="Grade 10">Grade 10</SelectItem>
              </SelectContent>
            </Select>

            {/* Bulk Action */}
            {selectedResults.length > 0 && (
              <Button onClick={() => setShowBulkModal(true)} className="bg-[#274c77] hover:bg-[#1e3a5f] text-white animate-in fade-in slide-in-from-right-4 duration-300">
                Bulk Action ({selectedResults.length})
              </Button>
            )}
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          <Card className="border-none shadow-xl overflow-hidden rounded-2xl ring-1 ring-black/5 min-h-[600px]">
            <CardHeader className="bg-white border-b px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl text-gray-800">
                  {activeTab === 'monthly_test' ? 'Monthly Test Results' : activeTab === 'mid_term' ? 'Mid Term Results' : 'Final Term Results'}
                </CardTitle>
                <CardDescription>
                  List of all results waiting for approval or processed.
                </CardDescription>
              </div>

              {activeTab === 'monthly_test' && (
                <div className="flex-1 mx-8 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                  <div className="flex gap-2">
                    {MONTHS_ORDER.map((month) => (
                      <button
                        key={month}
                        onClick={() => setActiveMonthTab(month)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeMonthTab === month
                          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="ml-auto">
                  {(() => {
                    const actionableCount = filteredResults.filter(r => !['approved', 'rejected', 'pending_principal'].includes(r.status)).length;
                    return selectedResults.length === actionableCount && actionableCount > 0 ? "Deselect All" : "Select All";
                  })()}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80 backdrop-blur-sm border-b">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="min-w-[180px] sticky left-0 bg-slate-50 z-20 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student Info</span>
                      </TableHead>
                      <TableHead className="w-[60px] text-center sticky left-[180px] bg-slate-50 z-20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sel.</span>
                      </TableHead>

                      {/* Dynamic Subject Headers */}
                      {Array.from(new Set(filteredResults.flatMap(r => r.subject_marks?.map((sm: any) => sm.subject_name) || [])))
                        .filter(subject => !subject.toLowerCase().includes('behaviour'))
                        .sort().map(subject => (
                          <TableHead key={subject} className="text-center min-w-[110px] py-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block leading-tight">
                              {subject.replace(/_/g, ' ')}
                            </span>
                          </TableHead>
                        ))}

                      <TableHead className="text-center bg-blue-50/30 min-w-[80px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#6096ba]">Total</span>
                      </TableHead>
                      <TableHead className="text-center min-w-[70px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">%</span>
                      </TableHead>
                      <TableHead className="text-center min-w-[70px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grade</span>
                      </TableHead>
                      <TableHead className="text-center min-w-[90px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Result</span>
                      </TableHead>
                      <TableHead className="text-center min-w-[90px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
                      </TableHead>
                      <TableHead className="text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)] min-w-[110px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.length > 0 ? (
                      (() => {
                        const allSubjects = Array.from(new Set(filteredResults.flatMap(r => r.subject_marks?.map((sm: any) => sm.subject_name) || [])))
                          .filter(subject => !subject.toLowerCase().includes('behaviour'))
                          .sort();
                        return filteredResults.map((result) => {
                          const isAbsent = result.pass_status === 'absent';
                          return (
                            <TableRow
                              key={result.id}
                              className="hover:bg-blue-50/20 transition-colors border-slate-50 cursor-pointer"
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('.no-click')) return;
                                handleViewReportCard(result as any);
                              }}
                            >
                              {/* Student Name - Sticky */}
                              <TableCell className="sticky left-0 bg-white z-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] py-4 px-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-[#1e3a8a] text-sm leading-tight">{result.student.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">{result.student.student_code}</span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">{(result.student as any).class_name || ''}</span>
                                </div>
                              </TableCell>

                              {/* Checkbox */}
                              <TableCell className="text-center no-click sticky left-[180px] bg-white z-10 px-2">
                                {['approved', 'rejected', 'pending_principal'].includes(result.status) ? (
                                  <span className="block w-4 h-4" />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={selectedResults.includes(result.id)}
                                    onChange={() => handleSelectResult(result.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#274c77] focus:ring-[#274c77]"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </TableCell>

                              {/* Per-Subject Marks */}
                              {allSubjects.map(subject => {
                                const mark = result.subject_marks?.find((sm: any) => sm.subject_name === subject);
                                const isSubAbsent = mark?.is_absent;
                                const obtained = mark ? Number(mark.obtained_marks) + (Number(mark.practical_obtained) || 0) : null;
                                const total = mark ? Number(mark.total_marks) + (Number(mark.practical_total) || 0) : null;
                                return (
                                  <TableCell key={subject} className="text-center py-4 px-3">
                                    {!mark ? (
                                      <span className="text-slate-300 text-xs">—</span>
                                    ) : isSubAbsent ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-amber-600 font-black text-xs">ABS</span>
                                        <span className="text-[10px] text-slate-300">/ {total}</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className={`font-bold text-sm ${mark.is_pass ? 'text-slate-800' : 'text-rose-600'}`}>
                                          {obtained}
                                        </span>
                                        <span className="text-[10px] text-slate-400">/ {total}</span>
                                        {!mark.is_pass && (
                                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}

                              {/* Total */}
                              <TableCell className="text-center bg-blue-50/10 px-3">
                                <span className="font-black text-[#274c77] text-base">
                                  {isAbsent ? <span className="text-amber-500 text-sm font-bold">ABS</span> : result.obtained_marks}
                                </span>
                                <span className="text-slate-400 text-xs block">/ {result.total_marks}</span>
                              </TableCell>

                              {/* Percentage */}
                              <TableCell className="text-center px-3">
                                {isAbsent ? (
                                  <span className="text-slate-400 text-xs">N/A</span>
                                ) : (
                                  <span className={`font-bold text-sm ${result.percentage >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {result.percentage?.toFixed(1)}%
                                  </span>
                                )}
                              </TableCell>

                              {/* Grade */}
                              <TableCell className="text-center px-3">
                                {isAbsent ? (
                                  <span className="text-slate-400 text-xs">N/A</span>
                                ) : (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                                    result.percentage >= 80 ? 'bg-emerald-50 text-emerald-700' :
                                    result.percentage >= 60 ? 'bg-blue-50 text-blue-700' :
                                    result.percentage >= 40 ? 'bg-amber-50 text-amber-700' :
                                    'bg-rose-50 text-rose-700'
                                  }`}>
                                    {result.percentage >= 80 ? 'A+' : result.percentage >= 70 ? 'A' : result.percentage >= 60 ? 'B' : result.percentage >= 50 ? 'C' : result.percentage >= 40 ? 'D' : 'F'}
                                  </span>
                                )}
                              </TableCell>

                              {/* Pass/Fail/Absent */}
                              <TableCell className="text-center px-3">
                                {getResultStatusBadge(result.result_status, result.pass_status)}
                              </TableCell>

                              {/* Workflow Status */}
                              <TableCell className="text-center px-3">
                                {getStatusBadge(result.status)}
                              </TableCell>

                              {/* Actions - Sticky Right */}
                              <TableCell className="text-center no-click sticky right-0 bg-white z-10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)] px-3">
                                <div className="flex items-center justify-center gap-1">
                                  {(['pending', 'submitted', 'pending_coordinator'].includes(result.status)) && (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleApprove(result.id)}
                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full"
                                        title="Approve"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleReject(result.id)}
                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                                        title="Reject"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  {result.status === 'pending_principal' && (
                                    <span className="text-[10px] text-purple-600 font-bold italic">Forwarded</span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewReportCard(result as any)}
                                    className="h-8 w-8 p-0 rounded-full border-gray-200 hover:border-blue-400 hover:text-blue-600 text-slate-400"
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()
                    ) : (
                      <TableRow>
                        <TableCell colSpan={15} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <FileText className="h-10 w-10 text-slate-200" />
                            <p className="font-semibold">No results found for this period.</p>
                            <p className="text-xs">Teachers need to submit & forward results first.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* View Modal - Student Report Card */}
      {
        showViewModal && selectedResultView && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto print:p-0 print:overflow-visible print:block print:relative print:z-0 print:!bg-white print:inset-auto print:backdrop-filter-none">
            <Card className="w-full max-w-[215mm] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border-0 rounded-2xl print:shadow-none print:max-w-full print:max-h-full print:overflow-visible print:rounded-none">
              {/* Modal Header */}
              <div className="bg-white px-8 py-5 border-b flex justify-between items-center sticky top-0 z-10 print:hidden shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <FileText className="h-6 w-6 text-[#274c77]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#274c77] leading-none">Student Report Card</h2>
                    <p className="text-slate-400 text-xs mt-1.5 uppercase tracking-widest font-black">Academic Review Portal</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    className="flex items-center gap-2 h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowViewModal(false);
                      setReportCardData(null);
                    }}
                    className="rounded-xl h-10 w-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30 print:overflow-visible print:p-0">
                {fetchingReportCard ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="h-10 w-10 text-[#274c77] animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse">Fetching complete result history...</p>
                  </div>
                ) : reportCardData ? (
                  <div className="p-8 print:p-0">
                    <ReportCard
                      student={reportCardData.student}
                      results={reportCardData.results}
                      activeMonth={activeTab === 'monthly_test' ? activeMonthTab : undefined}
                      className="print:shadow-none print:border-0"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <FileText className="h-12 w-12 mb-3 opacity-20" />
                    <p>No report card data found.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer - Actions for Approval (Hidden in Print) */}
              {!fetchingReportCard && selectedResultView && (
                <div className="bg-white p-5 border-t flex justify-end gap-3 shrink-0 print:hidden shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setShowViewModal(false);
                      setReportCardData(null);
                    }}
                    className="text-slate-500 font-bold h-12 px-8 rounded-xl border-slate-200"
                  >
                    Close
                  </Button>

                  {(['pending', 'submitted', 'pending_coordinator'].includes(selectedResultView.status)) && (
                    <>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => {
                          setShowViewModal(false);
                          handleReject(selectedResultView.id);
                        }}
                        className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-rose-200"
                      >
                        <XCircle className="h-5 w-5 mr-2" /> Reject Result
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => {
                          setShowViewModal(false);
                          handleApprove(selectedResultView.id);
                        }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-12 px-8 rounded-xl font-bold shadow-lg shadow-emerald-200"
                      >
                        <CheckCircle className="h-5 w-5 mr-2" /> Approve Result
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>
        )
      }

      {/* Bulk Action Modal reused from existing ... */}
      {
        showBulkModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Bulk Action
                </CardTitle>
                <CardDescription>
                  Process {selectedResults.length} selected results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Action</label>
                  <div className="flex gap-2">
                    <Button
                      variant={bulkAction === "approve" ? "default" : "outline"}
                      onClick={() => setBulkAction("approve")}
                      className={`flex-1 ${bulkAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant={bulkAction === "reject" ? "destructive" : "outline"}
                      onClick={() => setBulkAction("reject")}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Choose Action</label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleBulkAction}
                    disabled={processing}
                    className={`flex-1 ${bulkAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                  >
                    {processing ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{bulkAction === 'approve' ? 'Approving...' : 'Rejecting...'}</span>
                      </div>
                    ) : (
                      bulkAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowBulkModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
      {/* Signature Modal */}
      <ApproveWithSignature
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={isBulkApprove ? confirmBulkApprove : confirmApprove}
        title={isBulkApprove ? `Bulk Approve ${selectedResults.length} Results` : "Approve Result Card"}
        description={isBulkApprove ? "Providing your signature will approve all selected results." : "Please sign to confirm your approval of this student's result."}
        savedSignature={(coordinatorProfile as any)?.signature || null}
      />
    </div>
  )
}
