"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown } from "lucide-react"

export interface RecurrenceConfig {
  frequency: number
  unit: 'day' | 'week' | 'month' | 'year'
  days: string[]
  endType: 'never' | 'on' | 'after'
  endDate?: string
  endCount?: number
}

interface RecurrenceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: RecurrenceConfig) => void
  initialConfig?: RecurrenceConfig
  baseDate?: Date
}

export function RecurrenceModal({ open, onOpenChange, onSave, initialConfig, baseDate = new Date() }: RecurrenceModalProps) {
  const currentDayIndex = baseDate.getDay() // 0-6
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const currentDayShort = days[currentDayIndex]
  const currentDayId = `${currentDayShort}-${currentDayIndex}`

  const [config, setConfig] = useState<RecurrenceConfig>(initialConfig || {
    frequency: 1,
    unit: 'week',
    days: [currentDayId],
    endType: 'never',
    endCount: 13
  })

  const toggleDay = (day: string, index: number) => {
    // Note: In Google Calendar, 'S' could mean Sunday or Saturday. 
    // We'll just track indices or the strings for now.
    const dayId = `${day}-${index}`
    setConfig(prev => ({
      ...prev,
      days: prev.days.includes(dayId) 
        ? prev.days.filter(d => d !== dayId)
        : [...prev.days, dayId]
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] p-6 bg-[#1f1f1f] text-[#e3e3e3] border-none rounded-[28px] shadow-2xl">
        <DialogHeader className="p-0">
          <DialogTitle className="text-xl font-normal text-[#e3e3e3]">Custom recurrence</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 mt-6">
          {/* Repeat every */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#c4c7c5]">Repeat every</span>
            <div className="flex items-center bg-[#2d2e30] rounded-lg px-3 py-1 gap-2 border border-transparent hover:border-[#444746]">
              <input 
                type="number" 
                value={config.frequency}
                onChange={(e) => setConfig(prev => ({ ...prev, frequency: parseInt(e.target.value) || 1 }))}
                className="w-8 bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex flex-col text-[#8e918f]">
                <ChevronUp className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setConfig(prev => ({ ...prev, frequency: prev.frequency + 1 }))} />
                <ChevronDown className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setConfig(prev => ({ ...prev, frequency: Math.max(1, prev.frequency - 1) }))}/>
              </div>
            </div>
            <select 
              value={config.unit}
              onChange={(e) => setConfig(prev => ({ ...prev, unit: e.target.value as 'day' | 'week' | 'month' | 'year' }))}
              className="bg-[#2d2e30] rounded-lg px-3 py-2 text-sm focus:outline-none border border-transparent hover:border-[#444746] cursor-pointer"
            >
              <option value="day">day</option>
              <option value="week">week</option>
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </div>

          {/* Repeat on */}
          <div className="space-y-3">
            <span className="text-sm text-[#c4c7c5]">Repeat on</span>
            <div className="flex justify-between">
              {days.map((day, i) => {
                const dayId = `${day}-${i}`
                const isActive = config.days.includes(dayId)
                return (
                  <button
                    key={dayId}
                    onClick={() => toggleDay(day, i)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium transition-all",
                      isActive 
                        ? "bg-[#a8c7fa] text-[#041e49]" 
                        : "bg-[#2d2e30] text-[#c4c7c5] hover:bg-[#444746]"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ends */}
          <div className="space-y-4">
            <span className="text-sm text-[#c4c7c5]">Ends</span>
            
            {/* Never */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                checked={config.endType === 'never'} 
                onChange={() => setConfig(prev => ({ ...prev, endType: 'never' }))}
                className="w-5 h-5 accent-[#a8c7fa]"
              />
              <span className="text-sm text-[#e3e3e3]">Never</span>
            </label>

            {/* On Date */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                checked={config.endType === 'on'} 
                onChange={() => setConfig(prev => ({ ...prev, endType: 'on' }))}
                className="w-5 h-5 accent-[#a8c7fa]"
              />
              <span className="text-sm text-[#e3e3e3] mr-2">On</span>
              <div className={cn(
                "flex-1 bg-[#2d2e30] rounded-lg px-4 py-2 text-sm text-[#8e918f] border border-transparent",
                config.endType === 'on' && "text-[#e3e3e3]"
              )}>
                {new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </label>

            {/* After X Occurrences */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                checked={config.endType === 'after'} 
                onChange={() => setConfig(prev => ({ ...prev, endType: 'after' }))}
                className="w-5 h-5 accent-[#a8c7fa]"
              />
              <span className="text-sm text-[#e3e3e3] mr-2">After</span>
              <div className="flex items-center bg-[#2d2e30] rounded-lg px-4 py-2 gap-4 flex-1">
                <input 
                  type="number" 
                  value={config.endCount}
                  onChange={(e) => setConfig(prev => ({ ...prev, endCount: parseInt(e.target.value) || 1 }))}
                  className="w-6 bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm text-[#8e918f]">occurrences</span>
                <div className="flex flex-col text-[#8e918f] ml-auto">
                  <ChevronUp className="w-3 h-3" onClick={() => setConfig(prev => ({ ...prev, endCount: (prev.endCount || 0) + 1 }))} />
                  <ChevronDown className="w-3 h-3" onClick={() => setConfig(prev => ({ ...prev, endCount: Math.max(1, (prev.endCount || 0) - 1) }))}/>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-8">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-[#a8c7fa] hover:bg-[#a8c7fa]/10 rounded-full font-medium"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onSave(config)
              onOpenChange(false)
            }}
            className="bg-[#a8c7fa] hover:bg-[#b0d1ff] text-[#041e49] rounded-full px-6 font-medium"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
