"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { format, isSameDay, parseISO, differenceInMinutes } from "date-fns"
import { motion } from "framer-motion"
import { AnimatePage } from "@/components/layout/animate-page"
import { useGreeting } from "@/hooks/use-greeting"
import { useUserStore } from "@/shared"
import { getUserDisplayName, getUserInitials } from "@/lib/user-utils"
import { useTaskStore } from "@/shared"
import { useNotesStore } from "@/shared"
import { useEventStore } from "@/shared"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Circle, Calendar as CalendarIcon, FilePlus, ListPlus, CalendarPlus, FileText, Code2 } from "lucide-react"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { DashboardCard, QuickActionButton } from "@/components/dashboard/premium-dashboard"
import { toNoteSlug } from "@/lib/utils/note-slug"

import { formatDistanceToNowStrict } from "date-fns"
import { cn } from "@/lib/utils"
import { Note } from "@/shared"
import { createEmptyNoteContent, getPlainTextFromStoredContent } from "@/shared"

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

function NoteCard({ note, initials }: { note: Note, initials: string }) {
  const time = note.updated_at 
    ? formatDistanceToNowStrict(new Date(note.updated_at), { addSuffix: true })
        .replace(' days', 'd').replace(' day', 'd')
        .replace(' weeks', 'w').replace(' week', 'w')
        .replace(' hours', 'h').replace(' hour', 'h')
        .replace(' minutes', 'm').replace(' minute', 'm')
    : 'recently'

  const isCode = note.title?.toLowerCase().includes('dsa') || note.category === 'code'

  const textBody = note.excerpt || 
    (note.body === '{"ops":[{"insert":"\\n"}]}' || note.body?.trim() === '' ? null : note.body) || 
    getPlainTextFromStoredContent(note.content ?? null);

  return (
    <Link 
      href={`/notes/${toNoteSlug(note.title || '', note.id)}`}
      className="bg-[#1E1E1E] rounded-[16px] flex flex-col flex-1 min-w-[240px] max-h-full shrink-0 cursor-pointer hover:bg-[#252525] transition-all duration-200 border border-white/[0.06] group relative overflow-hidden"
    >
      {/* card-header: icon area */}
      <div className="h-[40px] px-4 flex items-center shrink-0">
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          isCode ? "bg-red-500/10 text-red-400" : "bg-white/5 text-[#666] group-hover:text-[#999]"
        )}>
          {isCode ? <Code2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* card-content — overflow hidden so nothing escapes the card */}
      <div className="px-4 pb-3 flex flex-col flex-1 min-h-0 overflow-hidden">
        <h4 className="text-[#E8E8E8] text-[13px] font-semibold leading-snug group-hover:text-white transition-colors truncate mb-1">
          {note.title || "Untitled Note"}
        </h4>
        {textBody && (
          <p className="text-[#555] text-[11px] leading-relaxed line-clamp-1 break-all">
            {textBody}
          </p>
        )}
        
        <div className="flex items-center gap-1.5 mt-auto pt-2">
          <div className="w-4 h-4 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[8px] text-[#777] font-bold border border-white/5">
            {initials}
          </div>
          <span className="text-[#4A4A4A] text-[11px] font-medium whitespace-nowrap">{time}</span>
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const hasMounted = useHasMounted()
  const router = useRouter()

  const tasks = useTaskStore(s => s.tasks); const updateTask = useTaskStore(s => s.updateTask)
  const notes = useNotesStore(s => s.notes); const addNote = useNotesStore(s => s.addNote)
  const user = useUserStore(s => s.user)
  const events = useEventStore(s => s.events); const fetchEvents = useEventStore(s => s.fetchEvents)
  const [scratchContent, setScratchContent] = useState("")

  const handleCreateNote = async () => {
    const newId = await addNote({
      title: "",
      content: createEmptyNoteContent(),
      body: null,
      excerpt: null,
      tags: [],
      pinned: false
    })
    if (newId) {
      router.push(`/notes/${toNoteSlug('', newId)}`)
    }
  }

  useEffect(() => {
    if (events.length === 0) {
      fetchEvents()
    }
  }, [events.length, fetchEvents])

  const userName = getUserDisplayName(user)
  const initials = getUserInitials(user)
  const greeting = useGreeting(userName)

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
        const isTaskLike = !!n.is_task
        return !isDeleted && !isScratch && !isTaskLike
      })
      .slice(0, 15)
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

  // Timeline Constants: Full 24 Hours
  const timelineHours = Array.from({ length: 24 }, (_, i) => i)
  const HOUR_WIDTH = 90 // Compact width per hour block
  const scrollRef = useRef<HTMLDivElement>(null)

  // Current time for indicator
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scroll to current time
  useEffect(() => {
    if (scrollRef.current && hasMounted) {
      const currentHour = new Date().getHours()
      const scrollPos = (currentHour * HOUR_WIDTH) - (scrollRef.current.clientWidth / 2) + (HOUR_WIDTH / 2)
      scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' })
    }
  }, [hasMounted])

  const getEventStyle = (startDate: string, endDate: string) => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)

    const startMins = start.getHours() * 60 + start.getMinutes()
    const duration = differenceInMinutes(end, start)

    const left = (startMins / (24 * 60)) * (24 * HOUR_WIDTH)
    const width = (duration / (24 * 60)) * (24 * HOUR_WIDTH)

    return {
      left: `${left}px`,
      width: `${Math.max(60, width)}px`, // Minimum width for visibility
    }
  }

  const getCurrentTimePosition = () => {
    const mins = now.getHours() * 60 + now.getMinutes()
    return (mins / (24 * 60)) * (24 * HOUR_WIDTH)
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
    <AnimatePage className="flex-1 flex flex-col min-h-0">
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col p-8 overflow-hidden bg-transparent min-h-0"
      >

        {/* Header Area */}
        <motion.header variants={itemVariants} className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-white">{greeting}</h1>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-[#999999] text-[15px] font-medium">{format(new Date(), 'EEEE, MMMM d')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <QuickActionButton icon={<FilePlus className="w-4 h-4" />} label="New Note" onClick={handleCreateNote} />
            <QuickCreateModal defaultType="task" trigger={
              <QuickActionButton icon={<ListPlus className="w-4 h-4" />} label="New Task" />
            } />
            <QuickCreateModal defaultType="event" trigger={
              <QuickActionButton icon={<CalendarPlus className="w-4 h-4" />} label="New Event" />
            } />
          </div>
        </motion.header>

        {/* Notes Section — fixed height, content stays contained */}
        <motion.div variants={itemVariants} className="mb-6 h-[220px]">
          <DashboardCard title="Notes" href="/notes" className="h-full">
            {notesOnly.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar h-full -mx-1 px-1">
                {notesOnly.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    initials={initials}
                  />
                ))}
              </div>
            ) : (
              <div className="text-[#515151] italic text-[14px] py-4">No recent notes found.</div>
            )}
          </DashboardCard>
        </motion.div>

        {/* Calendar / Timeline Section */}
        <motion.div variants={itemVariants} className="bg-[#171717] border border-[#2E2E2E] rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#808080]" />
              <h3 className="text-[18px] font-semibold text-white">Today&apos;s Schedule</h3>
            </div>
          </div>

          {/* Timeline Implementation */}
          <div 
            ref={scrollRef}
            className="relative overflow-x-auto no-scrollbar bg-black/20 border border-white/5 rounded-xl p-4"
          >
            <div 
              style={{ width: `${24 * HOUR_WIDTH}px` }}
              className="relative min-h-[160px] pb-2"
            >
              {/* Hour Blocks */}
              <div className="flex relative z-10 h-32">
                {timelineHours.map(hour => (
                  <div 
                    key={hour} 
                    style={{ width: `${HOUR_WIDTH}px`, flexShrink: 0 }}
                    className="border-r border-white/5 bg-white/[0.01] flex flex-col p-3 group hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[#515151] text-[11px] font-mono font-bold uppercase tracking-widest group-hover:text-[#808080] transition-colors">
                      {hour === 0 ? '12am' : hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                    </span>
                    <div className="mt-auto h-1 w-4 bg-white/5 rounded-full" />
                  </div>
                ))}
              </div>

              {/* Current Time Indicator */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500/40 z-30 pointer-events-none"
                style={{ left: `${getCurrentTimePosition()}px` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
              </div>

              {/* Dynamic Events Layer */}
              <div className="absolute inset-0 pointer-events-none z-20 pt-12">
                {todaysEvents.length > 0 ? (
                  todaysEvents.map(event => {
                    const style = getEventStyle(event.start_date, event.end_date)
                    return (
                      <div
                        key={event.id}
                        style={style}
                        className="absolute top-12 bg-blue-500/10 border-l-2 border-blue-500 p-2.5 rounded-r-lg pointer-events-auto cursor-pointer hover:bg-blue-500/20 transition-all shadow-lg backdrop-blur-sm h-16 flex flex-col justify-center"
                      >
                        <p className="text-blue-400 font-bold text-[12px] truncate leading-tight">{event.title}</p>
                        <p className="text-blue-400/60 text-[10px] font-medium mt-0.5">
                          {format(parseISO(event.start_date), 'h:mm a')}
                        </p>
                      </div>
                    )
                  })
                ) : null}
              </div>
            </div>
          </div>


        </motion.div>

        {/* Bottom Grid (Tasks & Scratch Pad) */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[240px] pb-4">
        <DashboardCard 
          title="Today's Tasks"
          className="h-full min-h-0"
          headerAction={
            <QuickCreateModal defaultType="task" trigger={
              <button className="text-[#515151] hover:text-[#808080] transition-colors p-1 rounded-md hover:bg-white/5" title="Add Task">
                <Plus className="w-4 h-4" />
              </button>
            } />
          }
        >
          <div className="flex flex-col gap-3 h-full overflow-y-auto no-scrollbar">
            {scheduledTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between group py-1.5 shrink-0"
              >
                <div className="flex items-center gap-3 text-[#B4B4B4] hover:text-white transition-colors cursor-pointer" onClick={() => handleToggle(task.id)}>
                  <Circle className="w-5 h-5 text-[#4D4D4D] group-hover:text-[#2eaadc] transition-colors" />
                  <span className="text-[14px] font-medium">{task.title}</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

          <DashboardCard title="Scratch Pad" className="h-full min-h-0">
            <textarea
              value={scratchContent}
              onChange={handleScratchChange}
              className="w-full h-full bg-transparent resize-none outline-none text-[#B4B4B4] text-[14px] placeholder-[#4D4D4D] focus:text-white transition-colors leading-relaxed"
              placeholder="Jot down quick thoughts..."
            />
          </DashboardCard>
        </motion.div>

      </motion.main>
    </AnimatePage>
  )
}
