"use client"

import { useState } from "react"
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Filter, 
  MoreHorizontal, 
  Plus, 
  Search,
  LayoutGrid,
  List
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
  const { tasks, updateTask, deleteTask } = useTaskStore()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.project_id?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const todoTasks = filteredTasks.filter(t => t.status === 'todo')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress')
  const doneTasks = filteredTasks.filter(t => t.status === 'done')

  return (
    <AnimatePage>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Tasks</h1>
          <p className="text-stone-500 text-sm">Manage and track all your team tasks in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-stone-100 p-1 rounded-md flex items-center">
            <Button 
              variant={view === 'list' ? 'outline' : 'ghost'} 
              size="sm" 
              className={cn("h-7 px-2 rounded-sm text-xs", view === 'list' && "bg-white shadow-sm font-bold text-black")}
              onClick={() => setView('list')}
            >
              <List className="w-3 h-3 mr-1.5" />
              List
            </Button>
            <Button 
              variant={view === 'kanban' ? 'outline' : 'ghost'} 
              size="sm" 
              className={cn("h-7 px-2 rounded-sm text-xs", view === 'kanban' && "bg-white shadow-sm font-bold text-black")}
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="w-3 h-3 mr-1.5" />
              Board
            </Button>
          </div>
          <Button className="bg-black text-white hover:bg-stone-800 h-9 rounded-full px-4 gap-2 font-medium">
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 border-y border-stone-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-none bg-stone-50/50 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-stone-200 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 border-stone-100 text-stone-500 gap-2">
          <Filter className="w-3.5 h-3.5" />
          Filter
          <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 bg-stone-100 border-none text-[10px]">{filteredTasks.length}</Badge>
        </Button>
      </div>

      <Tabs defaultValue="todo" className="w-full">
        <TabsList className="bg-transparent h-auto p-0 gap-6 border-b border-stone-100 w-full justify-start rounded-none mb-6">
          <TabsTrigger value="todo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 text-sm font-medium text-stone-500 data-[state=active]:text-black transition-all">
            To Do <span className="ml-2 text-[10px] text-stone-400 font-bold bg-stone-50 px-1.5 py-0.5 rounded-full">{todoTasks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 text-sm font-medium text-stone-500 data-[state=active]:text-black transition-all">
            In Progress <span className="ml-2 text-[10px] text-stone-400 font-bold bg-stone-50 px-1.5 py-0.5 rounded-full">{inProgressTasks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="done" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 text-sm font-medium text-stone-500 data-[state=active]:text-black transition-all">
            Completed <span className="ml-2 text-[10px] text-stone-400 font-bold bg-stone-50 px-1.5 py-0.5 rounded-full">{doneTasks.length}</span>
          </TabsTrigger>
        </TabsList>
        
        {[
          { id: 'todo', data: todoTasks },
          { id: 'in-progress', data: inProgressTasks },
          { id: 'done', data: doneTasks }
        ].map((column) => (
          <TabsContent key={column.id} value={column.id} className="mt-0 focus-visible:outline-none">
            <div className="border border-stone-100 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="grid grid-cols-[1fr_120px_120px_140px_40px] gap-4 px-6 py-3 bg-stone-50/50 border-b border-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                <div>Task Title</div>
                <div>Project</div>
                <div>Priority</div>
                <div>Due Date</div>
                <div></div>
              </div>
              <div className="divide-y divide-stone-50">
                {column.data.length === 0 ? (
                  <div className="p-12 text-center text-sm text-stone-400 font-medium bg-white">
                    No tasks found in this category.
                  </div>
                ) : (
                  column.data.map((task) => (
                    <div key={task.id} className="grid grid-cols-[1fr_120px_120px_140px_40px] gap-4 px-6 py-4 items-center group hover:bg-stone-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="cursor-pointer group/check" onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}>
                          {task.status === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 hover:text-emerald-600 transition-colors" />
                          ) : (
                            <Circle className="w-5 h-5 text-stone-200 group-hover/check:text-stone-400 transition-colors" />
                          )}
                        </div>
                        <span className={cn("text-sm font-medium text-stone-900", task.status === 'done' && "text-stone-300 line-through font-normal")}>
                          {task.title}
                        </span>
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-stone-100 bg-white text-stone-400">
                          {task.project_id || 'Personal'}
                        </Badge>
                      </div>
                      <div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                          task.priority === 'high' ? "bg-rose-50 text-rose-600" : 
                          task.priority === 'medium' ? "bg-amber-50 text-amber-600" : "bg-stone-50 text-stone-500"
                        )}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        <Clock className="w-3.5 h-3.5" />
                        {task.due_date || 'No date'}
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteTask(task.id)}
                          className="h-8 w-8 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-full"
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
