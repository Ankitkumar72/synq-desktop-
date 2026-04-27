"use client"

import { useEffect, useMemo, useState } from "react"
import { format, isSameDay, parseISO, differenceInMinutes } from "date-fns"
import { motion } from "framer-motion"
import { AnimatePage } from "@/components/layout/animate-page"
import { useGreeting } from "@/hooks/use-greeting"
import { useUserStore } from "@/lib/store/use-user-store"
import { getUserDisplayName } from "@/lib/user-utils"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { Plus, Circle, Calendar as CalendarIcon, FilePlus, ListPlus, CalendarPlus } from "lucide-react"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { DashboardCard, QuickActionButton } from "@/components/dashboard/premium-dashboard"
import { getPlainTextFromStoredContent } from "@/lib/notes/note-content"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } }
}

const QUOTES = [
  "The best way to predict the future is to create it.",
  "Simplicity is the ultimate sophistication.",
  "Details matter, it’s worth waiting to get them right.",
  "Focus on being productive instead of busy.",
  "Your mind is for having ideas, not holding them.",
  "The only way to do great work is to love what you do.",
  "Done is better than perfect.",
  "Strive for progress, not perfection."
]

export default function DashboardPage() {
  const hasMounted = useHasMounted()
  const router = useRouter()

  const { tasks, updateTask } = useTaskStore()
  const { notes } = useNotesStore()
  const { user } = useUserStore()
  const { events, fetchEvents } = useEventStore()
  const [scratchContent, setScratchContent] = useState("")

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const userName = getUserDisplayName(user)
  const greeting = useGreeting(userName)

  const [randomQuote] = useState(() => {
    // Stable random quote for the session
    const index = Math.floor(Math.random() * QUOTES.length)
    return QUOTES[index]
  })

  const handleScratchChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScratchContent(e.target.value)
  }

  const { scheduledTasks, notesOnly, todaysEvents } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activeTasks = tasks.filter(t => !t.deleted_at)
    const scheduled = activeTasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), today) && t.status !== 'done')

    // Ensure we filter out any notes that might match scratch pad criteria
    const onlyNotes = notes
      .filter(n => {
        const isDeleted = !!n.deleted_at || n.is_deleted
        const isScratch = n.category === 'scratchpad' || n.title?.toLowerCase() === 'scratch pad'
        return !isDeleted && !isScratch
      })
      .slice(0, 3)
    const filteredEvents = events.filter(e => !e.is_deleted && isSameDay(parseISO(e.start_date), today))

    return {
      scheduledTasks: scheduled,
      notesOnly: onlyNotes,
      todaysEvents: filteredEvents
    }
  }, [tasks, notes, events])

  const handleToggle = (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' })
    }
  }

  // Timeline Helper: 8 AM to 8 PM
  const timelineHours = [8, 10, 12, 14, 16, 18, 20]
  const startTime = 8 // 8 AM
  const totalHours = 12 // Until 8 PM

  const getEventStyle = (startDate: string, endDate: string) => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)

    const startMins = start.getHours() * 60 + start.getMinutes()
    const timelineStartMins = startTime * 60

    const left = ((startMins - timelineStartMins) / (totalHours * 60)) * 100
    const duration = differenceInMinutes(end, start)
    const width = (duration / (totalHours * 60)) * 100

    return {
      left: `${Math.max(0, Math.min(100, left))}%`,
      width: `${Math.max(5, Math.min(100 - left, width))}%`,
    }
  }

  if (!hasMounted) {
    return (
      <div className="flex-1 bg-[#101011] p-10">
        <Skeleton className="h-10 w-64 bg-white/5 mb-4" />
        <Skeleton className="h-6 w-32 bg-white/5 mb-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 bg-white/5 rounded-2xl" />
          <Skeleton className="h-64 bg-white/5 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <AnimatePage>
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col p-10 overflow-y-auto bg-[#101011]"
      >

        {/* Header Area */}
        <motion.header variants={itemVariants} className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-white">{greeting}</h1>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-[#999999] text-[15px] font-medium">{format(new Date(), 'EEEE, MMMM d')}</p>
              <p className="text-[#666666] text-[14px] italic font-medium max-w-md">&ldquo;{randomQuote}&rdquo;</p>
            </div>
          </div>

          <div className="flex gap-3">
            <QuickCreateModal defaultType="note" trigger={
              <QuickActionButton icon={<FilePlus className="w-4 h-4" />} label="New Note" />
            } />
            <QuickCreateModal defaultType="task" trigger={
              <QuickActionButton icon={<ListPlus className="w-4 h-4" />} label="New Task" />
            } />
            <QuickCreateModal defaultType="event" trigger={
              <QuickActionButton icon={<CalendarPlus className="w-4 h-4" />} label="New Event" />
            } />
          </div>
        </motion.header>

        {/* Top Grid (Notes) */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 mb-6">
          <DashboardCard title="Notes">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {notesOnly.length > 0 ? (
                notesOnly.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => router.push(`/notes?id=${note.id}`)}
                    className="bg-[#242424] p-5 rounded-xl cursor-pointer hover:bg-[#2a2a2a] transition-all border border-white/5 group"
                  >
                    <h4 className="font-bold text-white text-[15px] truncate mb-2 group-hover:text-blue-400 transition-colors">{note.title || "Untitled"}</h4>
                    <p className="text-[#808080] text-[13px] line-clamp-2 leading-relaxed">
                      {note.excerpt || getPlainTextFromStoredContent(note.content ?? null) || "No content..."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-[#515151] italic text-[14px] py-4">No recent notes found.</div>
              )}
            </div>
          </DashboardCard>
        </motion.div>

        {/* Calendar / Timeline Section */}
        <motion.div variants={itemVariants} className="bg-[#171717] border border-[#2E2E2E] rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#808080]" />
              <h3 className="text-[18px] font-semibold text-white">Today&apos;s Schedule</h3>
            </div>
            <div className="flex gap-4 text-[13px] text-[#808080] font-medium">
              <span className="text-white cursor-pointer px-2 py-1 bg-[#242424] rounded-md">Today</span>
              <span className="cursor-pointer hover:text-white transition-colors px-2 py-1">Week</span>
              <span className="cursor-pointer hover:text-white transition-colors px-2 py-1">Month</span>
            </div>
          </div>

          {/* Timeline Implementation */}
          <div className="relative border-t border-[#2E2E2E] pt-10 flex min-h-[140px] px-2">
            {/* Time Markers */}
            {timelineHours.map(hour => (
              <div key={hour} className="flex-1 text-left text-[#515151] text-[12px] font-mono border-l border-[#2E2E2E]/50 pl-2 h-4">
                {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
              </div>
            ))}

            {/* Dynamic Events */}
            {todaysEvents.length > 0 ? (
              todaysEvents.map(event => {
                const style = getEventStyle(event.start_date, event.end_date)
                return (
                  <div
                    key={event.id}
                    style={style}
                    className="absolute top-20 bg-blue-500/10 border-l-2 border-blue-500 p-3 rounded-r-lg group cursor-pointer hover:bg-blue-500/20 transition-all z-10"
                  >
                    <p className="text-blue-400 font-bold text-[13px] truncate">{event.title}</p>
                    <p className="text-blue-400/60 text-[11px]">
                      {format(parseISO(event.start_date), 'h:mm a')} - {format(parseISO(event.end_date), 'h:mm a')}
                    </p>
                  </div>
                )
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[#515151] italic text-[14px] pointer-events-none">
                No events scheduled for today
              </div>
            )}
          </div>
        </motion.div>

        {/* Bottom Grid (Tasks & Scratch Pad) */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashboardCard title="Today's Tasks">
            <div className="flex flex-col gap-3">
              {scheduledTasks.length > 0 ? (
                scheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between group py-1.5"
                  >
                    <div className="flex items-center gap-3 text-[#B4B4B4] hover:text-white transition-colors cursor-pointer" onClick={() => handleToggle(task.id)}>
                      <Circle className="w-5 h-5 text-[#4D4D4D] group-hover:text-[#2eaadc] transition-colors" />
                      <span className="text-[14px] font-medium">{task.title}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[#515151] italic text-[14px]">All caught up for today!</div>
              )}

              <QuickCreateModal defaultType="task" trigger={
                <button className="text-[#515151] mt-4 flex items-center gap-2 cursor-pointer hover:text-[#808080] transition-colors group w-fit border-none bg-transparent p-0 outline-none">
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] font-medium">Add task</span>
                </button>
              } />
            </div>
          </DashboardCard>

          <DashboardCard title="Scratch Pad">
            <textarea
              value={scratchContent}
              onChange={handleScratchChange}
              className="w-full h-[150px] bg-transparent resize-none outline-none text-[#B4B4B4] text-[14px] placeholder-[#4D4D4D] focus:text-white transition-colors leading-relaxed"
              placeholder="Jot down quick thoughts..."
            />
          </DashboardCard>
        </motion.div>

      </motion.main>
    </AnimatePage>
  )
}
