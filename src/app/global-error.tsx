'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0d1117]">
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#0d1117] font-sans">
          <div className="max-w-md w-full text-center space-y-8 bg-stone-900 border border-white/10 p-12 rounded-[32px] shadow-2xl">
            <h1 className="text-3xl font-black text-white">Critical Error</h1>
            <p className="text-stone-400 font-medium leading-relaxed">
              A critical error occurred in the system core. 
              Please reload the page to restart the application.
            </p>
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-left overflow-auto max-h-32">
                <p className="text-[11px] font-mono text-stone-500 break-all">
                {error.message}
                </p>
            </div>
            <Button
              onClick={() => reset()}
              className="w-full h-14 bg-white text-black hover:bg-stone-200 transition-all font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Reload App
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
