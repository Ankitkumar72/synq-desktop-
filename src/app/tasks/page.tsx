"use client"

import { useState, useEffect } from "react"
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Filter, 
  MoreHorizontal, 
  Plus, 
  Search,
  LayoutGrid,
  List,
  Loader2,
  ArrowUp,
  Minus,
  ArrowDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { useTaskStore } from "@/lib/store/use-task-store"
import { AnimatePage } from "@/components/layout/animate-page"

export default function TasksPage() {
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const { tasks, updateTask, deleteTask, fetchTasks, isLoading, error } = useTaskStore()
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const filteredTasks = tasks.filter(t => 
    !t.deleted_at && (
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.project_id?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    )
  )

  const todoTasks = filteredTasks.filter(t => t.status === 'todo')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress')
  const doneTasks = filteredTasks.filter(t => t.status === 'done')

  const handleAddTask = async () => {
    const title = window.prompt("Enter task title:")
    if (!title) return
    
    await useTaskStore.getState().addTask({
      title,
      status: 'todo',
      priority: 'medium',
      description: ''
    })
  }

  return (
    <AnimatePage>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Tasks</h1>
          <p className="text-stone-400 text-sm font-medium">Manage and track all your team tasks in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white/5 p-1 rounded-lg flex items-center border border-white/5">
            <Button 
              variant={view === 'list' ? 'outline' : 'ghost'} 
              size="sm" 
              className={cn(
                "h-7 px-3 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all", 
                view === 'list' 
                  ? "bg-white/10 border-white/10 text-white shadow-lg" 
                  : "text-stone-500 hover:text-stone-200"
              )}
              onClick={() => setView('list')}
            >
              <List className="w-3 h-3 mr-2" />
              List
            </Button>
            <Button 
              variant={view === 'kanban' ? 'outline' : 'ghost'} 
              size="sm" 
              className={cn(
                "h-7 px-3 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all", 
                view === 'kanban' 
                  ? "bg-white/10 border-white/10 text-white shadow-lg" 
                  : "text-stone-500 hover:text-stone-200"
              )}
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="w-3 h-3 mr-2" />
              Board
            </Button>
          </div>
          <Button 
            onClick={handleAddTask}
            className="bg-blue-600 text-white hover:bg-blue-500 h-9 rounded-full px-5 gap-2 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 fill-current" strokeWidth={3} />
            Add Task
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 border-y border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-white/5 bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-blue-500/50 text-sm text-white placeholder:text-stone-600 rounded-xl transition-all"
          />
        </div>
        <Button variant="outline" size="sm" className="h-10 border-white/5 bg-white/[0.03] text-stone-400 hover:text-white hover:bg-white/5 px-4 gap-2 rounded-xl transition-all">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Filter</span>
          <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center px-0 bg-blue-500/10 border-blue-500/20 text-blue-400 text-[10px] font-black rounded-lg">{filteredTasks.length}</Badge>
        </Button>
      </div>

      <Tabs defaultValue="todo" className="w-full">
        <TabsList className="bg-transparent h-auto p-0 gap-8 border-b border-white/5 w-full justify-start rounded-none mb-6">
          <TabsTrigger value="todo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-sm font-bold text-stone-500 data-[state=active]:text-white transition-all uppercase tracking-widest text-[11px]">
            To Do <span className="ml-2 text-[10px] text-stone-400 font-black bg-white/5 px-2 py-0.5 rounded-md group-data-[state=active]:text-white">({todoTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-sm font-bold text-stone-500 data-[state=active]:text-white transition-all uppercase tracking-widest text-[11px]">
            In Progress <span className="ml-2 text-[10px] text-stone-400 font-black bg-white/5 px-2 py-0.5 rounded-md">({inProgressTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="done" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-sm font-bold text-stone-500 data-[state=active]:text-white transition-all uppercase tracking-widest text-[11px]">
            Completed <span className="ml-2 text-[10px] text-stone-400 font-black bg-white/5 px-2 py-0.5 rounded-md">({doneTasks.length})</span>
          </TabsTrigger>
        </TabsList>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold text-center">
            Error: {error}
          </div>
        )}

        {[
          { id: 'todo', data: todoTasks },
          { id: 'in-progress', data: inProgressTasks },
          { id: 'done', data: doneTasks }
        ].map((column) => (
          <TabsContent key={column.id} value={column.id} className="mt-0 focus-visible:outline-none">
            <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#141414] shadow-2xl min-h-[300px] flex flex-col">
              <div className="grid grid-cols-[1fr_140px_120px_140px_40px] gap-4 px-8 py-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
                <div>Task Title</div>
                <div>Project</div>
                <div>Priority</div>
                <div>Due Date</div>
                <div></div>
              </div>
              <div className="divide-y divide-white/5 flex-1 relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center p-20">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-widest animate-pulse">Syncing with database...</p>
                    </div>
                  </div>
                ) : column.data.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                      <Clock className="w-6 h-6 text-stone-600" />
                    </div>
                    <p className="text-sm text-stone-400 font-bold uppercase tracking-wider">No tasks found</p>
                    <p className="text-xs text-stone-600">Everything is caught up in this category.</p>
                  </div>
                ) : (
                  column.data.map((task) => (
                    <div key={task.id} className="grid grid-cols-[1fr_140px_120px_140px_40px] gap-4 px-8 py-4.5 items-center group hover:bg-white/[0.03] transition-all cursor-default">
                      <div className="flex items-center gap-4">
                        <div className="cursor-pointer group/check shrink-0" onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}>
                          {task.status === 'done' ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 transition-all hover:scale-110">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-stone-700 flex items-center justify-center group-hover/check:border-blue-500/50 transition-all hover:scale-110">
                              <Circle className="w-3.5 h-3.5 text-transparent" />
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-[15px] font-semibold transition-all", 
                          task.status === 'done' 
                            ? "text-stone-600 line-through decoration-emerald-500/30" 
                            : "text-white group-hover:text-white"
                        )}>
                          {task.title}
                        </span>
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/10 bg-white/5 text-stone-400 group-hover:text-stone-200 transition-colors py-0.5">
                          {task.project_id || 'Personal'}
                        </Badge>
                      </div>
                      <div>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border",
                          task.priority === 'high' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : 
                          task.priority === 'medium' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                          "bg-stone-500/10 text-stone-500 border-stone-500/20"
                        )}>
                          {task.priority === 'high' && <ArrowUp className="w-3 h-3" />}
                          {task.priority === 'medium' && <Minus className="w-3 h-3" />}
                          {task.priority === 'low' && <ArrowDown className="w-3 h-3" />}
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] font-bold text-stone-500 group-hover:text-stone-400 transition-colors uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-stone-600" />
                        {task.due_date || 'No date'}
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteTask(task.id)}
                          className="h-8 w-8 text-stone-700 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </AnimatePage>
  )
}
