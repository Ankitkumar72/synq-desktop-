"use client"

import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] p-4">
      <div className="flex flex-col items-center text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
          <WifiOff className="w-10 h-10 text-stone-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">You&apos;re Offline</h1>
          <p className="text-stone-400">
            It looks like you&apos;ve lost your internet connection, and the page you are trying to view isn&apos;t available offline.
          </p>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <Link href="/" passHref>
            <Button 
              variant="outline" 
              className="border-white/10 bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white"
            >
              Go to Home
            </Button>
          </Link>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-white text-black hover:bg-stone-200"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
