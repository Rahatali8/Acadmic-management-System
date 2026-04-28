"use client"

import { useState, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface EnrollmentTrendChartProps {
  data: ChartData[]
  isLoading?: boolean
}

export function EnrollmentTrendChart({ data, isLoading }: EnrollmentTrendChartProps) {
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
      <Card className="h-full shadow-lg border-t-4 border-t-[#274c77]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#274c77]">Enrollment Trends</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6">
          <div className="h-64 sm:h-72 md:h-[300px] w-full flex items-center justify-center p-4">
            <div className="w-full h-full animate-pulse opacity-60">
              <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="50" x2="400" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="100" x2="400" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#f1f5f9" strokeWidth="1" />

                {/* Wavy Line */}
                <path d="M0 150 C 50 150, 50 100, 100 80 C 150 60, 200 120, 250 90 C 300 60, 350 20, 400 40"
                  fill="none" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" />

                {/* Area under line */}
                <path d="M0 150 C 50 150, 50 100, 100 80 C 150 60, 200 120, 250 90 C 300 60, 350 20, 400 40 V 200 H 0 Z"
                  fill="url(#skeletonGradient)" opacity="0.2" />

                <defs>
                  <linearGradient id="skeletonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bae6fd" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Dots */}
                <circle cx="100" cy="80" r="4" fill="#60a5fa" />
                <circle cx="250" cy="90" r="4" fill="#60a5fa" />
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
          <p className="font-medium text-[#274C77]">{payload[0].payload.name}</p>
          <p className="text-sm text-muted-foreground">
            Students: <span className="font-medium text-foreground">{payload[0].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  // Calculate dynamic Y-axis domain
  const maxValue = Math.max(...data.map(d => d.value), 0)
  const yMax = maxValue === 0 ? 100 : Math.ceil(maxValue * 1.2 / 100) * 100

  return (
    <Card className="h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#274c77]">Enrollment Trends</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-6">
        <div className="h-64 sm:h-72 md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: isMobile ? 10 : 30,
                left: isMobile ? 5 : 20,
                bottom: isMobile ? 40 : 5
              }}
            >
              <defs>
                <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#274C77" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#274C77" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: isMobile ? '10px' : '12px' }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: isMobile ? '10px' : '12px' }}
                domain={[0, yMax]}
                width={isMobile ? 40 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#274C77"
                strokeWidth={isMobile ? 2 : 3}
                dot={{ fill: '#274C77', r: isMobile ? 3 : 5 }}
                activeDot={{ r: isMobile ? 5 : 7 }}
                fill="url(#enrollmentGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
