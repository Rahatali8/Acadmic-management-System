"use client"

import { useState, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

interface WeeklyAttendanceData {
  day: string
  present: number
  absent: number
}

interface WeeklyAttendanceChartProps {
  data: WeeklyAttendanceData[]
  isLoading?: boolean
}

export function WeeklyAttendanceChart({ data, isLoading }: WeeklyAttendanceChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isLoading) {
    return (
      <Card className="shadow-lg border-t-4 border-t-[#274c77]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#274c77] opacity-50" />
            <CardTitle className="text-xl font-bold text-[#274c77]">Weekly Attendance Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6">
          <div className="h-64 sm:h-72 md:h-80 w-full flex items-center justify-center p-4">
            <div className="w-full h-full animate-pulse opacity-60">
              <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="50" x2="400" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="100" x2="400" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#f1f5f9" strokeWidth="1" />

                {/* Wavy Lines */}
                <path d="M0 150 C 50 140, 100 80, 150 100 C 200 120, 250 60, 300 80 C 350 100, 380 40, 400 60"
                  fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                <path d="M0 180 C 50 170, 100 150, 150 160 C 200 170, 250 140, 300 150 C 350 160, 380 120, 400 130"
                  fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" opacity="0.4" />

                {/* Dots */}
                <circle cx="150" cy="100" r="4" fill="#1188ceff" opacity="0.4" />
                <circle cx="300" cy="80" r="4" fill="#0e92c7ff" opacity="0.4" />

                <circle cx="150" cy="160" r="4" fill="#ef4444" opacity="0.4" />
                <circle cx="300" cy="150" r="4" fill="#ef4444" opacity="0.4" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{payload[0].payload.day}</p>
          <p className="text-sm text-green-600">
            Present: <span className="font-medium">{payload[0].value}</span>
          </p>
          <p className="text-sm text-red-600">
            Absent: <span className="font-medium">{payload[1].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  // Calculate dynamic Y-axis domain
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.present, d.absent)),
    0
  )
  const yMax = Math.ceil(maxValue * 1.2 / 10) * 10

  return (
    <Card className="h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#274c77]" />
          <CardTitle className="text-xl font-bold text-[#274c77]">Weekly Attendance Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-6 flex-1 min-h-0">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: isMobile ? 10 : 30,
                left: isMobile ? 5 : 20,
                bottom: isMobile ? 5 : 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="day"
                stroke="#6b7280"
                style={{ fontSize: isMobile ? '10px' : '12px' }}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: isMobile ? '10px' : '12px' }}
                domain={[0, yMax]}
                width={isMobile ? 40 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '40px', fontSize: isMobile ? '11px' : '12px' }}
                formatter={(value) => (
                  <span style={{
                    color: value === 'present' ? '#10b981' : '#ef4444',
                    fontWeight: 500,
                    fontSize: isMobile ? '11px' : '12px'
                  }}>
                    {value === 'present' ? 'Present' : 'Absent'}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="present"
                stroke="#10b981"
                strokeWidth={isMobile ? 2 : 3}
                dot={{ fill: '#10b981', r: isMobile ? 3 : 5 }}
                activeDot={{ r: isMobile ? 5 : 7 }}
              />
              <Line
                type="monotone"
                dataKey="absent"
                stroke="#ef4444"
                strokeWidth={isMobile ? 2 : 3}
                dot={{ fill: '#ef4444', r: isMobile ? 3 : 5 }}
                activeDot={{ r: isMobile ? 5 : 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
