"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface GenderDistributionChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const GENDER_COLORS: Record<string, string> = {
  female: '#ec4899', // Pink
  male: '#274C77',   // Blue
  other: '#a3a3a3',
}

export function GenderDistributionChart({ data, isLoading }: GenderDistributionChartProps) {
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
          <CardTitle className="text-xl font-bold text-[#274c77]">Gender Distribution</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-2">
          <div className="h-[200px] sm:h-[250px] w-full flex flex-col items-center justify-center pb-8 animate-pulse">
            <div className="relative w-[280px] h-[140px] flex items-end justify-center">
              <svg viewBox="0 0 200 110" className="w-full h-full">
                {/* Background Track - Full Semi-Circle */}
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="25" strokeLinecap="round" />

                {/* Simulated Male Segment (Left) - Arcs from 180 to 100 degrees */}
                <path d="M 20 100 A 80 80 0 0 1 86 21" fill="none" stroke="#bfdbfe" strokeWidth="25" strokeLinecap="round" />

                {/* Simulated Female Segment (Right) - Arcs from 80 to 0 degrees */}
                <path d="M 114 21 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="25" strokeLinecap="round" />
              </svg>

              {/* Center Text Stub */}
              <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col items-center justify-end pb-1">
                <div className="h-8 w-16 bg-slate-200 rounded mb-1"></div>
                <div className="h-3 w-20 bg-slate-100 rounded"></div>
              </div>
            </div>

            {/* Legend Stubs */}
            <div className="flex gap-6 mt-6 w-full justify-center">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-300"></div>
                <div className="h-3 w-12 bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-300"></div>
                <div className="h-3 w-12 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-sm text-xs">
          <p className="font-semibold capitalize">{item.name}</p>
          <p className="text-muted-foreground">Students: <span className="text-foreground">{item.value}</span></p>
        </div>
      )
    }
    return null
  }

  // Calculate total for center label
  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <Card className="h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#274c77]">Gender Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-2 min-h-0">
        <div className="h-[200px] sm:h-[250px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data as any[]}
                cx="50%"
                cy={isMobile ? "75%" : "70%"}
                startAngle={180}
                endAngle={0}
                innerRadius={isMobile ? "100%" : "80%"}
                outerRadius={isMobile ? "140%" : "120%"}
                dataKey="value"
                paddingAngle={2}
                cornerRadius={8}
              >
                {data.map((entry, index) => {
                  const key = (entry.name || '').toLowerCase()
                  return <Cell key={`cell-${index}`} fill={GENDER_COLORS[key] || '#94a3b8'} stroke="none" />
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ bottom: 0, fontSize: isMobile ? '10px' : '12px' }}
                formatter={(value, entry: any) => {
                  const val = entry.payload?.value;
                  const percent = (total > 0 && val) ? (val / total * 100).toFixed(1) : 0;
                  return <span className="capitalize">{value} ({percent}%)</span>
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className={`font-bold text-[#274c77] ${isMobile ? "text-2xl" : "text-3xl"}`}>{total}</div>
            <div className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-xs font-semibold" : "text-[10px] sm:text-xs"}`}>Total Students</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
