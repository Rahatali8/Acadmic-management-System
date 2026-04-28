"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Crown, Users as UsersIcon, GraduationCap } from "lucide-react"

interface UserGreetingProps {
  className?: string
}

export function UserGreeting({ className }: UserGreetingProps) {
  const [userName, setUserName] = useState<string>("")
  const [userRole, setUserRole] = useState<string>("")
  const [userCampus, setUserCampus] = useState<string>("")
  const [greeting, setGreeting] = useState<string>("Welcome")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = window.localStorage.getItem("sis_user")
      if (userStr) {
        try {
          const user = JSON.parse(userStr)

          // Try to get full name first, then fallback to other fields
          let fullName = user.full_name || user.name || user.username || user.email || "User"

          // If we have first_name and last_name, combine them
          if (user.first_name && user.last_name) {
            fullName = `${user.first_name} ${user.last_name}`
          } else if (user.first_name) {
            fullName = user.first_name
          }

          setUserName(fullName.trim() || "User")

          const role = String(user.role || "").toLowerCase()
          if (role.includes("princ")) {
            setUserRole("Principal")
            setUserCampus(user.campus?.campus_name || user.campus || "")
          } else if (role.includes("coord")) {
            setUserRole("Coordinator")
          } else if (role.includes("teach")) {
            setUserRole("Teacher")
          } else if (role.includes("admin")) {
            setUserRole("Super Admin")
          } else {
            setUserRole("Admin")
          }
        } catch {
          setUserName("User")
          setUserRole("Admin")
        }
      }

      // Set time-based greeting
      const hour = new Date().getHours()
      if (hour < 12) {
        setGreeting("Good Morning")
      } else if (hour < 17) {
        setGreeting("Good Afternoon")
      }
    }
  }, [])

  const getRoleIcon = () => {
    switch (userRole) {
      case "Super Admin":
        return <Crown className="h-4 w-4" />
      case "Principal":
        return <GraduationCap className="h-4 w-4" />
      case "Coordinator":
        return <UsersIcon className="h-4 w-4" />
      case "Teacher":
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case "Super Admin":
        return "bg-[#274C77] text-white"
      case "Principal":
        return "bg-[#6096BA] text-white"
      case "Coordinator":
        return "bg-[#10b981] text-white"
      case "Teacher":
        return "bg-[#14b8a6] text-white"
      default:
        return "bg-[#8B8C89] text-white"
    }
  }

  return (
    <Card className={`bg-gradient-to-r from-[#274C77] to-[#6096BA] text-white shadow-lg ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              {greeting}, {userName}!
            </h1>
            <p className="text-white/80 text-sm md:text-base">
              {userRole === "Principal" 
                ? `Principal Dashboard${userCampus ? ` | ${userCampus}` : ""}`
                : userCampus 
                  ? `${userCampus} Dashboard` 
                  : `${userRole} Dashboard`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${getRoleBadgeColor()} px-4 py-2 text-sm font-medium flex items-center gap-2`}>
              {getRoleIcon()}
              {userRole}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}

