"use client"

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  LogOut, 
  ArrowRight,
} from 'lucide-react'
import Image from 'next/image'
import brandLogo from '../../assets/images/brand-logo.png'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { getDeviceId } from '@/lib/device-manager'

interface DeviceLimitPageProps {
  activeCount?: number
  maxDevices?: number
  planTier?: string
}

export function DeviceLimitPage({ 
  activeCount = 1, 
  maxDevices = 1, 
  planTier = 'free' 
}: DeviceLimitPageProps) {
  
  const handleUpgrade = useCallback(() => {
    window.open('https://synq.app/pricing', '_blank')
  }, [])

  const handleSignOut = useCallback(() => {
    signOut(getDeviceId())
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[360px]"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          
          <Image 
            src={brandLogo} 
            alt="Synq Logo" 
            width={72}
            height={72}
            className="object-contain" 
            priority
          />

          <div className="space-y-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Device Limit Reached
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed px-2">
              Your {planTier} plan supports {maxDevices} active {maxDevices === 1 ? 'device' : 'devices'}. 
              You currently have {activeCount} connected.
            </p>
          </div>

          <div className="w-full h-px bg-border/50" />

          <div className="w-full space-y-2">
            <Button 
              onClick={handleUpgrade} 
              className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 transition-all font-medium rounded-xl text-[15px]"
            >
              Upgrade Plan
              <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
            </Button>
            <Button 
              onClick={handleSignOut} 
              variant="ghost" 
              className="w-full h-11 text-muted-foreground hover:text-foreground font-medium rounded-xl text-[15px]"
            >
              <LogOut className="w-4 h-4 mr-2 opacity-70" />
              Sign Out Here
            </Button>
          </div>
          
        </div>
      </motion.div>
    </div>
  )
}
