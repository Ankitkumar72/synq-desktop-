"use client"

import { StatCards, MyTasksWidget, ActivityFeed, ProjectProgress } from "@/components/dashboard/sidebar-widgets"
import { PinnedNote } from "@/components/dashboard/pinned-note"
import { AnimatePage } from "@/components/layout/animate-page"
import { useUserStore } from "@/lib/store/use-user-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useGreeting } from "@/hooks/use-greeting"

export default function DashboardPage() {
  const { user } = useUserStore()
  const hasMounted = useHasMounted()
  const greeting = useGreeting(user.name)

  if (!hasMounted) {
    return (
      <AnimatePage>
        <div className="p-8 space-y-8 max-w-7xl mx-auto" />
      </AnimatePage>
    )
  }
  
  return (
    <AnimatePage>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center gap-2 py-4">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 leading-tight">
            {greeting}
          </h1>
          <p className="text-stone-400 font-medium text-[15px]">Here&apos;s what needs your attention today.</p>
        </div>

        <StatCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-full">
            <MyTasksWidget />
          </div>
          <div className="lg:col-span-1 h-full">
            <ActivityFeed />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-6">
            <ProjectProgress />
            <PinnedNote />
          </div>
        </div>
      </div>
    </AnimatePage>
  )
}
