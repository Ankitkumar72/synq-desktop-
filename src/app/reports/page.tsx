"use client"

import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'
import { 
  Calendar, 
  Download, 
  MoreHorizontal, 
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  Card as UICard, 
  CardContent as UICardContent, 
  CardHeader as UICardHeader, 
  CardTitle as UICardTitle 
} from "@/components/ui/card"

const COMPLETION_DATA = [
  { name: 'Mon', completed: 12, total: 15 },
  { name: 'Tue', completed: 18, total: 20 },
  { name: 'Wed', completed: 15, total: 18 },
  { name: 'Thu', completed: 25, total: 28 },
  { name: 'Fri', completed: 22, total: 25 },
  { name: 'Sat', completed: 8, total: 10 },
  { name: 'Sun', completed: 5, total: 6 },
]

const PROJECT_DATA = [
  { name: 'On Track', value: 45, color: '#10b981' },
  { name: 'At Risk', value: 25, color: '#f59e0b' },
  { name: 'Overdue', value: 15, color: '#ef4444' },
  { name: 'Completed', value: 15, color: '#3b82f6' },
]

import { AnimatePage } from "@/components/layout/animate-page"

export default function ReportsPage() {
  return (
    <AnimatePage>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Reports</h1>
          <p className="text-stone-500 text-sm">Analyze your team&apos;s productivity and project trajectories.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9 border-stone-200 text-stone-500 gap-2">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </Button>
          <Button variant="outline" size="sm" className="h-9 border-stone-200 text-stone-500 gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="bg-black text-white hover:bg-stone-800 h-9 rounded-full px-4 font-medium">
            Generate Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Avg. Velocity", value: "84%", trend: "+5.2%", icon: Activity, color: "text-blue-500" },
          { label: "Tasks Finished", value: "152", trend: "+18", icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Focus Minutes", value: "2.4k", trend: "-12%", icon: Clock, color: "text-amber-500" },
          { label: "Active Contributors", value: "12", trend: "0", icon: TrendingUp, color: "text-stone-500" },
        ].map((stat) => (
          <UICard key={stat.label} className="border-stone-100 shadow-sm bg-white">
            <UICardContent className="p-6 flex items-center gap-4">
              <div className={cn("p-2 rounded-lg bg-stone-50 text-stone-900", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{stat.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
                  <span className={cn(
                    "text-[10px] font-bold px-1 py-0.5 rounded",
                    stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : 
                    stat.trend.startsWith('-') ? "bg-rose-50 text-rose-600" : "bg-stone-50 text-stone-400"
                  )}>
                    {stat.trend}
                  </span>
                </div>
              </div>
            </UICardContent>
          </UICard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart */}
        <UICard className="lg:col-span-2 border-stone-100 shadow-sm bg-white">
          <UICardHeader className="p-6 flex flex-row items-center justify-between space-y-0">
            <UICardTitle className="text-sm font-bold">Task Completion Trend</UICardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-300">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </UICardHeader>
          <UICardContent className="p-6 pt-0">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={COMPLETION_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid #f5f5f5', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#000" 
                    strokeWidth={2} 
                    dot={{ r: 4, fill: '#000', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#e7e5e4" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </UICardContent>
        </UICard>

        {/* Donut Chart */}
        <UICard className="border-stone-100 shadow-sm bg-white">
          <UICardHeader className="p-6 flex flex-row items-center justify-between space-y-0">
            <UICardTitle className="text-sm font-bold">Project Distribution</UICardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-300">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </UICardHeader>
          <UICardContent className="p-6 pt-0">
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PROJECT_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {PROJECT_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-2xl font-bold leading-none">12</p>
                <p className="text-[10px] font-bold text-stone-400 tracking-wider">PROJECTS</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {PROJECT_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-stone-500 font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </UICardContent>
        </UICard>
      </div>

      {/* Heatmap Section */}
      <UICard className="border-stone-100 shadow-sm bg-white overflow-hidden">
        <UICardHeader className="p-6">
          <UICardTitle className="text-sm font-bold">Contributor Activity Heatmap</UICardTitle>
        </UICardHeader>
        <UICardContent className="p-6 pt-0">
          <div className="flex gap-2 justify-between">
            {Array.from({ length: 52 }).map((_, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1.5 flex-1 max-w-[12px]">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const intensity = Math.random();
                  return (
                    <div 
                      key={dayIndex} 
                      className={cn(
                        "w-full pt-[100%] rounded-sm transition-all",
                        intensity > 0.8 ? "bg-stone-950" : 
                        intensity > 0.5 ? "bg-stone-300" : 
                        intensity > 0.2 ? "bg-stone-100" : "bg-stone-50/50"
                      )}
                      title={`Activity level: ${Math.floor(intensity * 10)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-6 text-[10px] font-bold text-stone-300 uppercase tracking-widest">
            <span>Last 52 Weeks</span>
            <div className="flex items-center gap-2">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-stone-50" />
                <div className="w-3 h-3 rounded-sm bg-stone-100" />
                <div className="w-3 h-3 rounded-sm bg-stone-300" />
                <div className="w-3 h-3 rounded-sm bg-stone-950" />
              </div>
              <span>More</span>
            </div>
          </div>
        </UICardContent>
      </UICard>
    </div>
    </AnimatePage>
  )
}
