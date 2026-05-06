"use client"

import { useEffect, useState } from 'react'

type DiagnosticResult = {
  name: string
  value: string | boolean | undefined
  error?: boolean
}

export default function DebugPage() {
  const [results, setResults] = useState<DiagnosticResult[]>([])

  useEffect(() => {
    async function runDiagnostics() {
      const tests: DiagnosticResult[] = [
        { name: 'Environment URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
        { name: 'Environment Key Present', value: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      ]

      // Test 1: Direct fetch to health check
      try {
        const t0 = performance.now()
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`)
        const duration = Math.round(performance.now() - t0)
        tests.push({ name: 'Direct Health Check', value: `Status: ${res.status} (${duration}ms)` })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        tests.push({ name: 'Direct Health Check', value: `FAILED: ${message}`, error: true })
      }

      // Test 2: Fetch with API Key
      try {
        const t0 = performance.now()
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tasks?select=*&limit=1`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
          }
        })
        const duration = Math.round(performance.now() - t0)
        tests.push({ name: 'Rest API Check', value: `Status: ${res.status} (${duration}ms)` })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        tests.push({ name: 'Rest API Check', value: `FAILED: ${message}`, error: true })
      }

      setResults(tests)
    }

    runDiagnostics()
  }, [])

  return (
    <div className="p-8 font-mono bg-black text-green-400 min-h-screen">
      <h1 className="text-2xl mb-4 border-b border-green-400 pb-2">Supabase Connectivity Diagnostics</h1>
      <div className="space-y-2">
        {results.map((test, i) => (
          <div key={i} className="flex">
            <span className="w-64 text-gray-500">[{test.name}]</span>
            <span className={test.error ? 'text-red-500' : 'text-green-300'}>{String(test.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 text-gray-400 text-sm">
        If &apos;Direct Health Check&apos; fails with &apos;Failed to fetch&apos;, your browser is blocking the request.
        Check your ad-blocker, firewall, or VPN.
      </div>
    </div>
  )
}
