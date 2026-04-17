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
        <div className="rounded-2xl border border-white/[0.06] bg-card/80 backdrop-blur-xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <MonitorSmartphone className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            Device Limit Reached
          </h1>

          {/* Description */}
          <p className="text-center text-muted-foreground text-sm leading-relaxed mb-2">
            Your <span className="font-semibold text-foreground capitalize">{planTier}</span> plan allows{' '}
            <span className="font-semibold text-foreground">{maxDevices}</span> active{' '}
            {maxDevices === 1 ? 'device' : 'devices'}. You currently have{' '}
            <span className="font-semibold text-red-400">{activeCount}</span>{' '}
            {activeCount === 1 ? 'device' : 'devices'} registered.
          </p>

          <p className="text-center text-muted-foreground text-xs mb-8">
            Sign out from another device to free up a slot, or upgrade to Pro for up to 5 devices.
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => signOut(getDeviceId())}
              variant="outline"
              className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5 text-sm font-semibold gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of This Device
            </Button>

            <Button
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-semibold gap-2 shadow-lg shadow-violet-500/20 transition-all"
              onClick={() => {
                // TODO: Link to actual upgrade/pricing page
                window.open('https://synq.app/pricing', '_blank')
              }}
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
            Pro includes 5 devices, unlimited notes, and priority support.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
