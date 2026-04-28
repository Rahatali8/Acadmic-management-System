"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchRolePermissions, toggleRolePermission, RolePermission } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
    ChevronRight,
    Users,
    LayoutDashboard,
    FileText,
    BookOpen,
    ClipboardList,
    Building2,
    Shield,
    Save,
    RotateCcw,
    CheckCircle,
    Banknote,
    CalendarDays,
    ArrowRightLeft,
    Fingerprint,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePermissions, getCurrentUserRole } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";

const MODULES = [
    {
        key: "dashboard_analytics",
        label: "Dashboard & Analytics",
        icon: LayoutDashboard,
        submodules: [
            {
                key: "access",
                label: "Dashboard Access",
                description: "Toggle landing page dashboards for different roles.",
                patterns: [/view_.*_dashboard/],
            },
            {
                key: "charts_kpi",
                label: "Charts & KPI Cards",
                description: "Detailed graphical reports and key performance indicators.",
                patterns: [/_kpi$/, /_chart$/],
            },
        ],
    },
    {
        key: "staff_management",
        label: "Staff Management",
        featureKey: "staff_management",
        icon: Users,
        submodules: [
            {
                key: "students",
                label: "Students",
                description: "View, add, and edit student profiles.",
                patterns: [/^view_students/, /^add_student/, /^edit_student/, /^delete_student/],
            },
            {
                key: "teachers",
                label: "Teachers",
                description: "View, add, and edit teacher profiles.",
                patterns: [/^view_teachers/, /^add_teacher/, /^edit_teacher/, /^delete_teacher/],
            },
            {
                key: "coordinators",
                label: "Coordinators",
                description: "View, add, and edit coordinator access.",
                patterns: [/^view_coordinators/, /^add_coordinator/, /^edit_coordinator/, /^delete_coordinator/],
            },
            {
                key: "principals",
                label: "Principals",
                description: "View, add, and edit principal permissions.",
                patterns: [/^view_principals/, /^add_principal/, /^edit_principal/, /^delete_principal/],
            },
            {
                key: "promotions",
                label: "Promotions",
                description: "Handle class promotions and student movements.",
                patterns: [/^view_promotions/],
            },
        ],
    },
    {
        key: "academic_structure",
        label: "Academic Structure",
        featureKey: "academic_structure",
        icon: Building2,
        submodules: [
            {
                key: "campus",
                label: "Campus & Infrastructure",
                description: "Campus facilities, classrooms, levels, and grades.",
                patterns: [/^view_campus/, /^add_campus/],
            },
        ],
    },
    {
        key: "fees_management",
        label: "Fees Management",
        featureKey: "fees_management",
        icon: Banknote,
        submodules: [
            {
                key: "fees",
                label: "Fee Access & Control",
                description: "View and manage fee structures, payments, and vouchers.",
                patterns: [/_fees$/],
            },
        ],
    },
    {
        key: "result_management",
        label: "Result Management",
        featureKey: "result_management",
        icon: FileText,
        submodules: [
            {
                key: "results",
                label: "Results & Exams",
                description: "View, create, edit, bulk import, and approve results.",
                patterns: [/^view_results/, /^edit_results/, /^bulk_import_results/, /^approve_results/],
            },
        ],
    },
    {
        key: "student_attendance",
        label: "Student Attendance",
        featureKey: "student_attendance",
        icon: CheckCircle,
        submodules: [
            {
                key: "attendance",
                label: "Attendance Controls",
                description: "View, mark, and approve daily student attendance.",
                patterns: [/^view_attendance/, /^mark_attendance/, /^approve_attendance/],
            },
        ],
    },
    {
        key: "timetable",
        label: "Timetable",
        featureKey: "timetable",
        icon: CalendarDays,
        submodules: [
            {
                key: "timetable_access",
                label: "Timetable Access",
                description: "View and manage timetables for classes and teachers.",
                patterns: [/^view_timetable/],
            },
        ],
    },
    {
        key: "transfers",
        label: "Transfers",
        featureKey: "transfers",
        icon: ArrowRightLeft,
        submodules: [
            {
                key: "transfers_access",
                label: "Transfer Access",
                description: "View and handle student and staff transfers.",
                patterns: [/^view_transfers/],
            },
        ],
    },
    {
        key: "support_desk",
        label: "Support Desk",
        featureKey: "support_desk",
        icon: ClipboardList,
        submodules: [
            {
                key: "requests",
                label: "Requests & Complaints",
                description: "View and manage internal requests and complaints.",
                patterns: [/^view_requests/],
            },
        ],
    },
    {
        key: "subject_assignment",
        label: "Subject Assignment",
        featureKey: "subject_assignment",
        icon: BookOpen,
        submodules: [
            {
                key: "subjects",
                label: "Subject Access",
                description: "View and assign subjects to teachers and classes.",
                patterns: [/^view_subjects/],
            },
        ],
    },
    {
        key: "system_admin",
        label: "System Admin",
        icon: Shield,
        submodules: [
            {
                key: "security",
                label: "Roles & Security",
                description: "Override and manage role-based permissions.",
                patterns: [/^manage_permissions/],
            },
            {
                key: "tooling",
                label: "Tooling & Utilities",
                description: "Form builders and internal system tools.",
                patterns: [/^manage_forms/],
            },
        ],
    },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
    principal: "Principal",
    coordinator: "Coordinator",
    teacher: "Teacher",
    donor: "Donor",
    accounts_officer: "Accountant",
    admissions_counselor: "Receptionist",
    compliance_officer: "Auditor",
};

export default function PermissionsPage() {
    const { canManagePermissions } = usePermissions();
    const [permissions, setPermissions] = useState<RolePermission[]>([]);

    const [originalPermissions, setOriginalPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedSubmodules, setExpandedSubmodules] = useState<string[]>([
        "access", "charts_kpi",
        "students", "teachers", "coordinators", "principals", "promotions",
        "campus", "fees", "results", "attendance", "timetable_access",
        "transfers_access", "requests", "subjects", "security", "tooling",
    ]);
    const { features: enabledFeatures, hasFeatureConfig } = useOrgFeatures();
    const { toast } = useToast();

    const hasAccess = canManagePermissions;

    const loadPermissions = async () => {
        if (!hasAccess) return;
        try {
            setLoading(true);
            const data = await fetchRolePermissions();
            const fetched = data || [];
            setPermissions([...fetched]);
            setOriginalPermissions(JSON.parse(JSON.stringify(fetched)));
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load permissions.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess]);

    if (!hasAccess) {
        return <AccessDenied title="Restricted Area" message="Only administrators can manage role-based permissions." />
    }

    const RBAC_HIERARCHY: Record<string, string[]> = {
        'view_teachers': ['add_teacher', 'edit_teacher', 'delete_teacher'],
        'view_students': ['add_student', 'edit_student', 'delete_student'],
        'view_coordinators': ['add_coordinator', 'edit_coordinator', 'delete_coordinator'],
        'view_principals': ['add_principal', 'edit_principal', 'delete_principal']
    };

    const getParentOf = (codename: string) => {
        return Object.keys(RBAC_HIERARCHY).find(parent => RBAC_HIERARCHY[parent].includes(codename));
    };

    const handleToggle = (role: string, codename: string, currentValue: boolean) => {
        setPermissions(prev => {
            const newPerms = [...prev];
            const newValue = !currentValue;

            // Toggle target
            const idx = newPerms.findIndex(p => p.role === role && p.permission_codename === codename);
            if (idx !== -1) {
                newPerms[idx] = { ...newPerms[idx], is_allowed: newValue };
            }

            // Rule 1: If parent is disabled, disable all children
            if (RBAC_HIERARCHY[codename] && newValue === false) {
                RBAC_HIERARCHY[codename].forEach(child => {
                    const cIdx = newPerms.findIndex(p => p.role === role && p.permission_codename === child);
                    if (cIdx !== -1) {
                        newPerms[cIdx] = { ...newPerms[cIdx], is_allowed: false };
                    }
                });
            }

            // Rule 2 & 3: If child is enabled, parent MUST be enabled
            const parentName = getParentOf(codename);
            if (parentName && newValue === true) {
                const pIdx = newPerms.findIndex(p => p.role === role && p.permission_codename === parentName);
                if (pIdx !== -1) {
                    newPerms[pIdx] = { ...newPerms[pIdx], is_allowed: true };
                }
            }

            return newPerms;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const changes = permissions.filter(p => {
                const original = originalPermissions.find(op => op.id === p.id);
                return original && original.is_allowed !== p.is_allowed;
            });

            if (changes.length === 0) return;

            await Promise.all(changes.map(p => toggleRolePermission(p.role, p.permission_codename, p.is_allowed)));

            setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
            toast({
                title: "Success",
                description: `${changes.length} permissions updated successfully.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save some permissions.",
                variant: "destructive",
            });
            loadPermissions();
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
    };

    const hasChanges = JSON.stringify(permissions) !== JSON.stringify(originalPermissions);

    const roles = useMemo(() => {
        const roleOrder = ['principal', 'coordinator', 'teacher', 'donor'];
        const r = Array.from(new Set(permissions.map(p => p.role)))
            .filter(role => role !== 'superadmin' && role !== 'org_admin'); // SuperAdmin and OrgAdmin have all permissions by default, don't show in UI
        
        return r.sort((a, b) => {
            const idxA = roleOrder.indexOf(a);
            const idxB = roleOrder.indexOf(b);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [permissions]);

    // Structure the data into the Modules -> Submodules -> Capabilities hierarchy
    const structuredModules = useMemo(() => {
        const uniqueCodenames = Array.from(new Set(permissions.map(p => p.permission_codename)));

        return MODULES.map(module => {
            const submodules = module.submodules.map(sub => {
                const codenames = uniqueCodenames
                    .filter(cn => sub.patterns.some(p => p.test(cn)))
                    .sort((a, b) => {
                        const idxA = sub.patterns.findIndex(p => p.test(a));
                        const idxB = sub.patterns.findIndex(p => p.test(b));
                        if (idxA !== idxB) return idxA - idxB;
                        // For same pattern (e.g. multiple _kpi), sort by label or name
                        return a.localeCompare(b);
                    });
                
                const capabilities = codenames.map(cn => {
                    const sample = permissions.find(p => p.permission_codename === cn);
                    const label = (sample?.permission_label || cn)
                        .replace('view_', '')
                        .replace('_dashboard', ' Dashboard')
                        .replace('_', ' ')
                        .replace(' KPI', '')
                        .replace(' Chart', '');
                    const roleStates = roles.reduce((acc, role) => {
                        const perm = permissions.find(p => p.role === role && p.permission_codename === cn);
                        acc[role] = perm?.is_allowed || false;
                        return acc;
                    }, {} as Record<string, boolean>);
                    return { codename: cn, label, roleStates };
                });
                return { ...sub, capabilities };
            }).filter(sub => sub.capabilities.length > 0);

            return { ...module, submodules };
        }).filter(m => {
            if (m.submodules.length === 0) return false;

            const userRole = getCurrentUserRole();

            // System Admin module — superadmin only
            if (m.key === "system_admin" && userRole !== "superadmin") return false;

            // Feature gating — only applies when org has new feature format
            if (hasFeatureConfig && (m as any).featureKey) {
                if (!enabledFeatures[(m as any).featureKey]) return false;
            }

            return true;
        });
    }, [permissions, roles, enabledFeatures]);

    const activeTabFallback = structuredModules.length > 0 ? structuredModules[0].key : "students";
    // We can use a local state to control tab, dropping default to structural head
    const [activeTab, setActiveTab] = useState<string>("");
    
    useEffect(() => {
        if (!activeTab && structuredModules.length > 0) {
            setActiveTab(structuredModules[0].key);
        }
    }, [structuredModules, activeTab]);

    const toggleSubmodule = (key: string) => {
        setExpandedSubmodules(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-pulse">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="h-10 w-64 bg-gray-200 rounded-lg"></div>
                        <div className="h-4 w-96 bg-gray-100 rounded-md"></div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex gap-2 border-b border-gray-100 pb-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-10 w-24 bg-gray-100 rounded-md"></div>
                        ))}
                    </div>

                    <Card className="border-none shadow-xl shadow-blue-500/5 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="h-16 bg-gray-50/50 border-b border-gray-100 flex items-center px-6 gap-8">
                                <div className="w-[450px] h-6 bg-gray-200 rounded-md"></div>
                                <div className="flex-1 flex gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex-1 h-6 bg-gray-200 rounded-md"></div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 space-y-8">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gray-100"></div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-48 bg-gray-200 rounded"></div>
                                                <div className="h-3 w-64 bg-gray-100 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="pl-12 space-y-3">
                                            {[1, 2].map(j => (
                                                <div key={j} className="h-12 w-full bg-gray-50/50 rounded-lg"></div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (structuredModules.length === 0 && !loading) {
        return (
            <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2a4e78]">Platform Setup & Permissions</h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        Configure granular feature access via dedicated capability modules.
                    </p>
                </div>
                <Card className="p-12 text-center border-dashed border-2">
                    <div className="flex flex-col items-center gap-4">
                        <Shield className="w-12 h-12 text-gray-300" />
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-gray-900">No Permissions Found</h3>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">
                                No configurable permissions were found for this organization. This might be because the system is still initializing or you don't have access to some modules.
                            </p>
                        </div>
                        <Button onClick={loadPermissions} variant="outline" className="mt-4 gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Retry Loading
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2a4e78]">Platform Setup & Permissions</h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        Configure granular feature access via dedicated capability modules.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3"
                        >
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Revert Changes
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="gap-2 bg-[#2a4e78] hover:bg-[#1e3a5a] shadow-lg shadow-blue-900/10 min-w-[140px]"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {isSaving ? "Publishing..." : "Publish Policies"}
                            </Button>
                        </motion.div>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                {/* Custom Tab Triggers */}
                <TabsList className="bg-white/80 backdrop-blur border border-gray-100 p-1 flex w-full max-w-full overflow-x-auto shadow-sm rounded-xl">
                    {structuredModules.map(module => (
                        <TabsTrigger 
                            key={module.key} 
                            value={module.key}
                            className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-[#2a4e78] data-[state=active]:text-white data-[state=active]:shadow-md transition-all rounded-lg"
                        >
                            <module.icon className="w-4 h-4" />
                            <span className="font-semibold tracking-wide uppercase text-xs">{module.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Iterate Tab Contents */}
                {structuredModules.map(module => (
                    <TabsContent key={module.key} value={module.key} className="outline-none">
                        <Card className="border-none shadow-xl overflow-hidden bg-white/50 backdrop-blur-sm">
                            <CardContent className="p-0 overflow-x-auto overflow-y-visible scrollbar-none">
                                <div className="min-w-[1100px]">
                                    {/* Flex Header for Capabilities */}
                                    <div className="flex items-center bg-gray-50/80 border-b border-gray-100 py-4 top-0 z-20">
                                        <div className="w-[450px] shrink-0 px-6 text-[11px] font-extrabold text-[#2a4e78]/60 uppercase tracking-widest">
                                            CAPABILITY GROUPS
                                        </div>
                                        <div className="flex flex-1 items-center">
                                            {roles.map(role => (
                                                <div key={role} className="flex-1 text-center text-xs font-bold text-[#2a4e78] uppercase tracking-widest px-4 border-l border-gray-200/50 first:border-l-0">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span>{ROLE_DISPLAY_NAMES[role] || role}</span>
                                                        {role === "superadmin" && <Shield className="w-3 h-3 text-yellow-500" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="max-h-[65vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                                        {module.submodules.map((sub) => (
                                            <div key={sub.key} className="flex flex-col border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                                                {/* Submodule Accordion Header */}
                                                <div 
                                                    onClick={() => toggleSubmodule(sub.key)}
                                                    className="flex items-center cursor-pointer group py-5 relative"
                                                >
                                                    <div className="w-[450px] shrink-0 px-6 z-10 flex items-start gap-4">
                                                        <motion.div
                                                            animate={{ rotate: expandedSubmodules.includes(sub.key) ? 90 : 0 }}
                                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                            className="mt-1"
                                                        >
                                                            <ChevronRight className="w-5 h-5 text-[#2a4e78]/50" />
                                                        </motion.div>
                                                        <div>
                                                            <h3 className="font-bold text-gray-800 text-base">{sub.label}</h3>
                                                            <p className="text-xs text-muted-foreground font-medium mt-0.5">{sub.description}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Master Toggle Area for Submodule (Optional enhancements) */}
                                                    <div className="flex flex-1 items-center z-10">
                                                        {roles.map(role => {
                                                            const anyEnabled = sub.capabilities.some(p => p.roleStates[role]);
                                                            return (
                                                                <div key={role} className="flex-1 px-4 text-center">
                                                                    <Switch
                                                                        checked={anyEnabled}
                                                                        className="data-[state=checked]:bg-[#5a7fcf] scale-90 opacity-60 hover:opacity-100 transition-opacity"
                                                                        onCheckedChange={(val) => {
                                                                            setPermissions(prev => {
                                                                                const newPerms = [...prev];
                                                                                sub.capabilities.forEach(cp => {
                                                                                    const idx = newPerms.findIndex(p => p.role === role && p.permission_codename === cp.codename);
                                                                                    if (idx !== -1) newPerms[idx].is_allowed = val;
                                                                                });
                                                                                return newPerms;
                                                                            });
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Submodule Content (Capabilities) */}
                                                <AnimatePresence initial={false}>
                                                    {expandedSubmodules.includes(sub.key) && (
                                                        <motion.div
                                                            key={`${sub.key}-content`}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1, transition: { duration: 0.3 } }}
                                                            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
                                                            className="overflow-hidden bg-white/40 border-t border-gray-50/50"
                                                        >
                                                            <div className="divide-y divide-gray-50">
                                                                {sub.capabilities.map((cap) => (
                                                                    <div key={cap.codename} className="flex items-center hover:bg-white transition-colors duration-200 py-3 relative">
                                                                        {/* Capability Label */}
                                                                        <div className="w-[450px] shrink-0 pl-16 pr-6 py-1">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#2a4e78]/30" />
                                                                                <div className="space-y-0.5">
                                                                                    <span className="text-[13px] font-semibold text-gray-700 capitalize">
                                                                                        {cap.label.replace('View ', '').replace('Add ', '').replace('Edit ', '').replace('Manage ', '')} 
                                                                                        <span className="ml-1.5 text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-100 rounded-sm">
                                                                                            {cap.codename.includes('view') ? 'Read' : cap.codename.includes('edit') ? 'Update' : cap.codename.includes('manage') ? 'Full' : 'Write'}
                                                                                        </span>
                                                                                    </span>
                                                                                    <p className="text-[10px] text-gray-400 font-mono tracking-tighter opacity-70 block">{cap.codename}</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Capability Toggles */}
                                                                        <div className="flex flex-1 items-center">
                                                                            {roles.map(role => (
                                                                                <div key={role} className="flex-1 px-4 text-center">
                                                                                    <Switch
                                                                                        checked={cap.roleStates[role]}
                                                                                        className="scale-[0.8] data-[state=checked]:bg-[#42bb70]"
                                                                                        onCheckedChange={() => handleToggle(role, cap.codename, cap.roleStates[role])}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
