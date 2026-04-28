"use client"

import * as React from "react"
import { Pie, PieChart, Cell, Label, Sector } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartData } from "@/types/dashboard"

import { Skeleton } from "@/components/ui/skeleton"

interface MotherTongueChartProps {
  data: ChartData[]
  isLoading?: boolean
}

// Custom theme palette (Blues, Teals, and sophisticated accents)
const THEME_COLORS = [
  "#274c77", // Deep Blue (Primary)
  "#6096ba", // Steel Blue
  "#2a9d8f", // Teal
  "#e9c46a", // Muted Gold (Common for premium dashboards)
  "#f4a261", // Terra Cotta
  "#a3cef1", // Light Blue
]

export function MotherTongueChart({ data, isLoading }: MotherTongueChartProps) {
  if (isLoading) {
    return (
      <Card className="flex flex-col h-full shadow-lg border-t-4 border-t-[#274c77]">
        <CardHeader className="items-center pb-0">
          <CardTitle className="text-xl font-bold text-[#274c77]">Mother Tongue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pb-0 min-h-[250px] flex items-center justify-center">
          <div className="relative flex items-center justify-center w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] animate-pulse">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {/* Donut Ring Skeleton */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="25" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#bae6fd" strokeWidth="25" strokeDasharray="60 252" strokeLinecap="butt" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="25" strokeDasharray="30 252" strokeDashoffset="-70" strokeLinecap="butt" />
            </svg>
            {/* Center Text Stub */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-6 w-12 bg-slate-200 rounded mb-1"></div>
              <div className="h-3 w-16 bg-slate-100 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  // Sort and process data
  const { chartData, totalStudents } = React.useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value)

    // Logic to separate top 5 and others
    const topItems = sorted.slice(0, 5)
    const others = sorted.slice(5)
    const othersTotal = others.reduce((sum, item) => sum + item.value, 0)

    // Combine
    const processed = [
      ...topItems,
      ...(othersTotal > 0 ? [{ name: "Others", value: othersTotal }] : [])
    ].map((item, index) => ({
      name: item.name,
      value: item.value,
      fill: THEME_COLORS[index % THEME_COLORS.length]
    }))

    const total = data.reduce((acc, curr) => acc + curr.value, 0)
    return { chartData: processed, totalStudents: total }
  }, [data])


  const chartConfig = {
    value: {
      label: "Students",
    },
    ...Object.fromEntries(
      chartData.map((item) => [
        item.name,
        { label: item.name, color: item.fill },
      ])
    ),
  } satisfies ChartConfig

  return (
    <Card className="flex flex-col h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-all duration-300">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-xl font-bold text-[#274c77]">Mother Tongue</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-10 overflow-y-auto min-h-[250px]">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px] w-full"
        >
          <PieChart>
            {/* Defs for 3D/Gradient Effect */}
            <defs>
              {chartData.map((entry, index) => (
                <linearGradient id={`gradient-${index}`} key={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={entry.fill} stopOpacity={1} />
                </linearGradient>
              ))}
              <filter id="shadow" height="130%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="2" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel indicator="dot" />}
            />

            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
              filter="url(#shadow)" // Apply 3D shadow
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-[#274c77] text-xl sm:text-3xl font-bold"
                          style={{ filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))" }}
                        >
                          {totalStudents}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs sm:text-sm font-medium uppercase tracking-wider"
                        >
                          Students
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
              {chartData.map((entry, index) => (
                // Use gradient fill for "3D" look
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#gradient-${index})`}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1}
                />
              ))}
            </Pie>


          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
