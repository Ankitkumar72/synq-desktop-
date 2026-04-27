"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { getOnlineStatus, onQueueDepthChange } from "@/lib/crdt/sync-manager"

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(() => getOnlineStatus())
  const [queueDepth, setQueueDepth] = useState(0)

  useEffect(() => {

    // Listen for online/offline events
    const handleStatusChange = () => setIsOnline(navigator.onLine)
    window.addEventListener("online", handleStatusChange)
    window.addEventListener("offline", handleStatusChange)

    // Listen for queue changes
    const unsubscribe = onQueueDepthChange((depth) => {
      setQueueDepth(depth)
      // depth === 0 means all pending syncs have completed
    })

    return () => {
      window.removeEventListener("online", handleStatusChange)
      window.removeEventListener("offline", handleStatusChange)
      unsubscribe()
    }
  }, [])

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-orange-500/5 border border-orange-500/10 transition-all duration-300">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)] animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500/80">Offline</span>
      </div>
    )
  }

  if (queueDepth > 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-blue-500/5 border border-blue-500/10 transition-all duration-300">
        <RefreshCw className="w-2.5 h-2.5 text-blue-500 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/80">Syncing</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 opacity-40 hover:opacity-100 transition-all duration-300 group">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">Cloud Sync</span>
    </div>
  )
}
