"use client"

import { StatCards, MyTasksWidget, ActivityFeed, ProjectProgress } from "@/components/dashboard/sidebar-widgets"
import { PinnedNote } from "@/components/dashboard/pinned-note"
import { AnimatePage } from "@/components/layout/animate-page"
import { useUserStore } from "@/lib/store/use-user-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useGreeting } from "@/hooks/use-greeting"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

import { useDashboardData } from "@/hooks/use-dashboard-data"

export default function DashboardPage() {
  const { user } = useUserStore()
  const { stats } = useDashboardData()
  const hasMounted = useHasMounted()
  const greeting = useGreeting(user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User")

  const highPriorityCount = stats.tasks.highPriority + stats.events.today
  const activeProjectsCount = stats.projects.active

  if (!hasMounted) {
    return (
      <AnimatePage>
        <div className="p-8 space-y-24 max-w-[1400px] mx-auto py-16">
          <div className="space-y-6 flex flex-col items-center">
            <Skeleton className="h-14 w-96 rounded-2xl bg-white/5" />
            <Skeleton className="h-6 w-64 rounded-xl bg-white/5" />
          </div>
          <div className="grid gap-8 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-[24px] bg-white/5" />)}
          </div>
        </div>
      </AnimatePage>
    )
  }
  
  return (
    <AnimatePage>
      <div className="px-6 py-20 md:px-12 space-y-24 max-w-[1500px] mx-auto overflow-x-hidden">
        {/* Editorial Greeting Header */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center text-center gap-6"
        >
          <div className="space-y-4">
            <h1 className="text-[44px] md:text-[56px] font-black tracking-tight text-white leading-[1.05] font-display max-w-2xl mx-auto">
              {greeting}
            </h1>
            <p className="text-stone-500 font-bold text-[17px] max-w-xl mx-auto tracking-tight px-4 leading-relaxed">
              {highPriorityCount > 0 
                ? `Focus on your ${highPriorityCount} high-priority actions and ${activeProjectsCount} evolutions today.`
                : `Pure focus achieved. You have ${activeProjectsCount} projects on track for completion.`}
            </p>
          </div>
        </motion.section>

        {/* Global Statistics */}
        <section>
          <StatCards />
        </section>

        {/* Dynamic Grid Sections */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12"
        >
          <div className="lg:col-span-4 h-full">
            <MyTasksWidget />
          </div>
          <div className="lg:col-span-4 h-full">
            <ActivityFeed />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-12">
            <div className="flex-1">
              <ProjectProgress />
            </div>
            <div className="flex-1">
              <PinnedNote />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePage>
  )
}
