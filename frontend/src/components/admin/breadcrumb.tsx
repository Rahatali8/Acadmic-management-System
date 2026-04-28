"use client"
import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

const routeLabels: Record<string, string> = {
    admin: "Dashboard",
    coordinator: "Coordinator Dashboard",
    students: "Students",
    "student-list": "Student List",
    add: "Add New",
    promotion: "Promotions",
    teachers: "Teachers",
    list: "List",
    result: "Results",
    "result-approval": "Result Approval",
    request: "Request / Complain",
    attendance: "Mark Attendance",
    stats: "Class Stats",
    campus: "Campus",
    principals: "Principals",
    principal: "Principal",
    "campus-management": "Campus Management",
    "shift-timings": "Shift Timings",
    permissions: "Permissions",
    "attendance-review": "Attendance Review",
    "time-table": "Time Table",
    "subject-assign": "Subjects",
    requests: "Requests",
    transfers: "Transfers",
    notifications: "Notifications",
    profile: "My Profile",
}

function toLabel(segment: string): string {
    return routeLabels[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AdminBreadcrumb() {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    const crumbs = segments.map((seg, i) => ({
        label: toLabel(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
        isLast: i === segments.length - 1,
    }))

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0 flex-wrap sm:flex-nowrap">
            <Link
                href="/admin"
                className="flex items-center gap-1 text-[#6096ba] hover:text-[#274c77] transition-colors duration-150 flex-shrink-0"
            >
                <Home className="w-3.5 h-3.5" />
            </Link>

            {crumbs.map((crumb, idx) => {
                const isMiddle = crumbs.length > 2 && idx > 0 && idx < crumbs.length - 1;

                return (
                    <React.Fragment key={crumb.href}>
                        {/* Compact Middle Items on Mobile */}
                        {isMiddle && idx === 1 && (
                            <span className="flex sm:hidden items-center gap-1">
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400 font-medium px-0.5 select-none">···</span>
                            </span>
                        )}

                        <span className={`flex items-center gap-1 ${isMiddle ? 'hidden sm:flex' : 'flex'}`}>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {crumb.isLast ? (
                                <span className="font-semibold text-[#274c77] truncate max-w-[100px] sm:max-w-[180px]">
                                    {crumb.label}
                                </span>
                            ) : (
                                <Link
                                    href={crumb.href}
                                    className="text-[#6096ba] hover:text-[#274c77] transition-colors duration-150 truncate max-w-[70px] sm:max-w-[120px]"
                                >
                                    {crumb.label}
                                </Link>
                            )}
                        </span>
                    </React.Fragment>
                )
            })}
        </nav>
    )
}
