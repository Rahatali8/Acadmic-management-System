"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home } from "lucide-react"
import type { ChartData } from "@/types/dashboard"

import { Skeleton } from "@/components/ui/skeleton"

interface HouseOwnershipChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const HOUSE_COLORS: Record<string, string> = {
  owned: '#274C77',
  rented: '#6096BA',
}

export function HouseOwnershipChart({ data, isLoading }: HouseOwnershipChartProps) {
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
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-[#274c77] opacity-50" />
            <CardTitle className="text-xl font-bold text-[#274c77]">House Ownership</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6">
          <div className="h-64 sm:h-72 md:h-80 w-full flex items-center justify-center">
            <div className="relative w-[200px] h-[200px] animate-pulse">
              {/* SVG Pie Skeleton */}
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#bae6fd" strokeWidth="10" strokeDasharray="70 200" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#60a5fa" strokeWidth="10" strokeDasharray="100 200" strokeDashoffset="-80" opacity="0.3" />
              </svg>
              {/* Inner fake text lines */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-2 w-12 bg-slate-200 rounded"></div>
                <div className="h-2 w-8 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium capitalize">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Families: <span className="font-medium text-foreground">{data.value}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Percentage:{" "}
            <span className="font-medium text-foreground">{((data.value / data.total) * 100).toFixed(1)}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  // Calculate total for percentage calculation
  const dataWithTotal = data.map((item) => ({
    ...item,
    total: data.reduce((sum, d) => sum + d.value, 0),
  }))

  return (
    <Card className="h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-[#274c77]" />
          <CardTitle className="text-xl font-bold text-[#274c77]">House Ownership</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4 sm:pt-6 min-h-0">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataWithTotal}
                cx="50%"
                cy="50%"
                outerRadius="70%"
                innerRadius={0}
                dataKey="value"
                label={(props: any) => {
                  if (isMobile) return null
                  const { x, y, cx, name, percent, fill } = props
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={fill}
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={500}
                    >
                      {`${name}: ${(percent * 100).toFixed(0)}%`}
                    </text>
                  )
                }}
                labelLine={!isMobile}
              >
                {dataWithTotal.map((entry: any, index: number) => {
                  const key = (entry?.name ?? '').toString().trim().toLowerCase()
                  const fill = HOUSE_COLORS[key] || '#8B8C89'
                  return <Cell key={`cell-${index}`} fill={fill} />
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: '12px', paddingTop: '40px', paddingBottom: '20px' }}
                formatter={(value, entry) => <span style={{ color: entry.color, fontWeight: 500, fontSize: '12px', textTransform: 'capitalize' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
