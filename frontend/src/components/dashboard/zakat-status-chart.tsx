"use client"

import { useState, useEffect } from "react"
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface ZakatStatusChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const ZAKAT_COLORS: Record<string, string> = {
  applicable: '#10b981', // Emerald
  'not applicable': '#94a3b8', // Slate
  'not_applicable': '#94a3b8',
}

export function ZakatStatusChart({ data, isLoading }: ZakatStatusChartProps) {
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
          <CardTitle className="text-xl font-bold text-[#274c77]">Zakat Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-2 flex items-center justify-center">
          <div className="h-[350px] w-full mt-4 flex items-center justify-center">
            <div className="relative w-[250px] h-[250px] animate-pulse">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#bae6fd" strokeWidth="8" strokeDasharray="180 252" strokeLinecap="round" />

                {/* Inner Ring */}
                <circle cx="50" cy="50" r="28" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#93c5fd" strokeWidth="8" strokeDasharray="100 176" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const processedData = data.map(item => ({
    name: item.name,
    value: item.value,
    fill: ZAKAT_COLORS[item.name.toLowerCase()] || '#cbd5e1'
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-sm text-xs">
          <span className="font-semibold">{d.name}:</span> {d.value}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#274c77]">Zakat Status</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 min-h-0">
        <div className="h-full w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="40%"
              outerRadius="80%"
              barSize={isMobile ? 15 : 20}
              data={processedData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                background={{ fill: '#f1f5f9' }}
                dataKey="value"
                cornerRadius={10}
                label={{
                  position: 'insideStart',
                  fill: '#fff',
                  fontSize: '10px',
                  formatter: (val: any) => ''
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Legend
                iconSize={10}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  fontSize: '12px',
                  fontWeight: 500,
                  paddingTop: '40px'
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
