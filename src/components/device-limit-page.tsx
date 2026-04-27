"use client"

import { motion } from 'framer-motion'
import { MonitorSmartphone, LogOut, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { getDeviceId } from '@/lib/device-manager'

interface DeviceLimitPageProps {
  activeCount?: number
  maxDevices?: number
  planTier?: string
}

export function DeviceLimitPage({ activeCount = 1, maxDevices = 1, planTier = 'free' }: DeviceLimitPageProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-md w-full mx-6"
      >
        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-2xl p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 pointer-events-none rounded-[24px] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)]" />

          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-[#1A1A1A] border border-white/[0.08] flex items-center justify-center shadow-2xl">
                <MonitorSmartphone className="w-10 h-10 text-red-400/80" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-bold text-center text-white tracking-tight mb-3">
            Device Limit Reached
          </h1>

          {/* Description */}
          <div className="space-y-4 mb-10">
            <p className="text-center text-[#808080] text-[15px] leading-relaxed px-4">
              Your <span className="font-bold text-white capitalize">{planTier}</span> plan allows{' '}
              <span className="font-bold text-white">{maxDevices}</span> active{' '}
              {maxDevices === 1 ? 'device' : 'devices'}. 
            </p>
            <div className="bg-[#1A1A1A]/50 rounded-xl p-4 border border-white/[0.04]">
              <p className="text-center text-[#606060] text-[13px]">
                You currently have <span className="text-red-400/80 font-bold">{activeCount}</span> registered devices.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-[15px] font-bold gap-3 shadow-xl shadow-indigo-500/20 transition-all duration-300 border-none"
              onClick={() => {
                window.open('https://synq.app/pricing', '_blank')
              }}
            >
              <Sparkles className="w-5 h-5" />
              Upgrade to Synq Pro
            </Button>

            <Button
              onClick={() => signOut(getDeviceId())}
              variant="outline"
              className="w-full h-14 rounded-xl border-white/[0.08] bg-transparent hover:bg-white/[0.02] text-[14px] font-bold text-[#808080] hover:text-white gap-3 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of This Device
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-[11px] font-bold text-[#404040] uppercase tracking-[0.1em]">
              Pro includes 5 devices • Unlimited notes • Priority support
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
