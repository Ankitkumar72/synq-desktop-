'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-stone-900/40 border border-white/10 p-12 rounded-[32px] backdrop-blur-xl shadow-2xl text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-white font-display">
            Something went wrong
          </h1>
          <p className="text-stone-400 text-[16px] leading-relaxed font-medium">
            An unexpected error occurred. We've been notified and are looking into it.
          </p>
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-left">
            <p className="text-[12px] font-mono text-stone-500 break-all">
              {error.message || 'Unknown application error'}
            </p>
            {error.digest && (
              <p className="text-[10px] font-mono text-stone-600 mt-1 uppercase tracking-wider">
                ID: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="h-14 bg-white text-black hover:bg-stone-200 transition-all font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            Try Again
          </Button>
          
          <Link href="/" className="contents">
            <Button
              variant="outline"
              className="h-14 border-white/10 text-white hover:bg-white/5 transition-all font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2"
            >
              <Home className="h-5 w-5" />
              Back to Safety
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
