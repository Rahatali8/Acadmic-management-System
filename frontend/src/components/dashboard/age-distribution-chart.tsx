"use client"

import { useState, useEffect } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Info } from "lucide-react"

interface AgeDistributionChartProps {
    data: any[]
    isLoading?: boolean
}

export function AgeDistributionChart({ data, isLoading }: AgeDistributionChartProps) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640)
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    if (isLoading) {
        return (
            <Card className="flex flex-col h-[460px] shadow-lg border-t-4 border-t-[#274c77]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold text-[#274c77]">Age Distribution</CardTitle>
                    <Skeleton className="h-8 w-24 rounded-lg bg-slate-100" />
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center p-0 overflow-hidden">
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-50 px-6">
                        {/* Custom SVG Skeleton for Age Pyramid */}
                        <svg width="100%" height="100%" viewBox="0 0 400 340" preserveAspectRatio="xMidYMid meet">
                            {/* Center Axis */}
                            <line x1="200" y1="20" x2="200" y2="280" stroke="#e2e8f0" strokeWidth="2" />

                            {/* Fake Pyramid Bars */}
                            {[...Array(8)].map((_, i) => {
                                const y = 40 + i * 35;
                                // Reduced width to prevent overflow - max 60px instead of 140px
                                const w = 30 + (i * 15) % 60;
                                return (
                                    <g key={i}>
                                        {/* Male side (Left) */}
                                        <rect x={190 - w} y={y} width={w} height="12" rx="4" fill="#cbd5e1" opacity="0.5" />
                                        {/* Female side (Right) */}
                                        <rect x={210} y={y} width={w * 0.9} height="12" rx="4" fill="#93c5fd" opacity="0.5" />
                                    </g>
                                )
                            })}
                        </svg>
                    </div>
                </CardContent>
            </Card>
        )
    }

    let totalMale = 0
    let totalFemale = 0
    let maxCount = 0

    data.forEach((d) => {
        const m = Math.abs(d.male || 0)
        const f = Math.abs(d.female || 0)
        totalMale += m
        totalFemale += f
        maxCount = Math.max(maxCount, m, f)
    })

    const GAP = Math.max(Math.ceil(maxCount * 0.1), 10)

    const processedData = data
        .map((item) => {
            const m = Math.abs(item.male || 0)
            const f = Math.abs(item.female || 0)

            return {
                ...item,
                maleNeg: -m,
                maleSpacer: -GAP,
                female: f,
                femaleSpacer: GAP,
                maleCount: m,
                femaleCount: f,
                ageDisplay: item.age || item.name?.replace("Age ", ""),
            }
        })
        .sort((a, b) => (a.age || 0) - (b.age || 0))

    const domainMax = Math.ceil((maxCount + GAP) * 1.1) || 10

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null

        const d = payload[0].payload

        return (
            <div className="bg-background/95 backdrop-blur-sm border rounded-xl p-3 shadow-xl">
                <p className="font-bold text-center mb-2">Age {d.ageDisplay}</p>
                <div className="flex justify-between gap-6 text-sm">
                    <div className="text-center">
                        <div className="w-3 h-3 mx-auto rounded-full bg-[#10b981] mb-1" />
                        <div className="text-xs uppercase text-muted-foreground">Male</div>
                        <div className="font-bold text-lg">{d.maleCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="w-3 h-3 mx-auto rounded-full bg-[#ec4899] mb-1" />
                        <div className="text-xs uppercase text-muted-foreground">Female</div>
                        <div className="font-bold text-lg">{d.femaleCount}</div>
                    </div>
                </div>
                <p className="text-xs text-center mt-2 text-muted-foreground">
                    Total: {d.maleCount + d.femaleCount}
                </p>
            </div>
        )
    }

    const CustomSpineLabel = (props: any) => {
        const { x, y, width, height, value } = props
        // Center of the row
        const centerY = y + height / 2
        return (
            <g style={{ pointerEvents: 'none' }}>
                <text
                    x={x}
                    y={centerY}
                    dominantBaseline="central"
                    textAnchor="middle"
                    stroke="#fff"
                    strokeWidth={4}
                    fontSize={11}
                    fontWeight="800"
                    style={{ opacity: 0.7 }}
                >
                    {value}
                </text>
                <text
                    x={x}
                    y={centerY}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#334155"
                    fontSize={11}
                    fontWeight="800"
                >
                    {value}
                </text>
            </g>
        )
    }

    return (
        <Card className="flex flex-col h-[460px] shadow-lg border-t-4 border-t-[#274c77] hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#274c77]" />
                    <CardTitle className="text-xl font-bold text-[#274c77]">Age Distribution</CardTitle>
                </div>

                <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#057496]"></div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Male</span>
                            <span className="text-sm font-bold text-slate-700">{totalMale}</span>
                        </div>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#ec4899]"></div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Female</span>
                            <span className="text-sm font-bold text-slate-700">{totalFemale}</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div style={{ height: Math.max(380, processedData.length * 38), width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={processedData}
                            layout="vertical"
                            barCategoryGap={2}
                            margin={{ top: 10, right: 40, left: 40, bottom: 10 }}
                        >
                            <defs>
                                <linearGradient id="maleGradient" x1="1" y1="0" x2="0" y2="0">
                                    <stop offset="0%" stopColor="#057496" />
                                    <stop offset="100%" stopColor="#274c77" />
                                </linearGradient>
                                <linearGradient id="femaleGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#f472b6" />
                                    <stop offset="100%" stopColor="#db2777" />
                                </linearGradient>
                            </defs>

                            <CartesianGrid horizontal={false} stroke="#f1f5f9" strokeDasharray="3 3" />

                            <XAxis type="number" hide domain={[-domainMax, domainMax]} />

                            <YAxis
                                type="category"
                                dataKey="ageDisplay"
                                width={0}
                                tick={false}
                                tickLine={false}
                                axisLine={false}
                            />

                            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} content={<CustomTooltip />} />

                            {/* Male Side */}
                            <Bar
                                dataKey="maleSpacer"
                                stackId="male"
                                fill="transparent"
                                isAnimationActive={false}
                            />
                            <Bar
                                dataKey="maleNeg"
                                stackId="male"
                                fill="url(#maleGradient)"
                                barSize={13}
                                radius={[4, 0, 0, 4]}
                            />

                            {/* Female Side */}
                            <Bar
                                dataKey="femaleSpacer"
                                stackId="female"
                                fill="transparent"
                                isAnimationActive={false}
                            >
                                <LabelList dataKey="ageDisplay" content={<CustomSpineLabel />} />
                            </Bar>
                            <Bar
                                dataKey="female"
                                stackId="female"
                                fill="url(#femaleGradient)"
                                barSize={13}
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
