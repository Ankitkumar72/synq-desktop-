"use client"

import { useState } from "react"
import { 
  FolderKanban, 
  MoreHorizontal, 
  Plus, 
  Search,
  LayoutGrid,
  List,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Card as UICard, 
  CardContent as UICardContent, 
  CardHeader as UICardHeader, 
  CardTitle as UICardTitle 
} from "@/components/ui/card"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useProjectStore } from "@/lib/store/use-project-store"
import { AnimatePage } from "@/components/layout/animate-page"

export default function ProjectsPage() {
  const { projects, deleteProject } = useProjectStore()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )
  return (
    <AnimatePage>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Folders</h1>
          <p className="text-stone-500 text-sm">Track and manage your team folders and initiatives.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-stone-100 p-1 rounded-md flex items-center">
            <Button variant="outline" size="sm" className="h-7 px-2 rounded-sm text-xs bg-white shadow-sm font-bold text-black">
              <LayoutGrid className="w-3 h-3 mr-1.5" />
              Grid
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 rounded-sm text-xs text-stone-500">
              <List className="w-3 h-3 mr-1.5" />
              List
            </Button>
          </div>
          <Button className="bg-black text-white hover:bg-stone-800 h-9 rounded-full px-4 gap-2 font-medium">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 border-y border-stone-100 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <Input 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-none bg-stone-50/50 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-stone-200 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Status Filter:</span>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none hover:bg-emerald-100 transition-colors cursor-pointer text-[10px] font-bold tracking-widest uppercase px-2 py-1">On Track</Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-none hover:bg-amber-100 transition-colors cursor-pointer text-[10px] font-bold tracking-widest uppercase px-2 py-1">At Risk</Badge>
          <Badge variant="secondary" className="bg-rose-50 text-rose-600 border-none hover:bg-rose-100 transition-colors cursor-pointer text-[10px] font-bold tracking-widest uppercase px-2 py-1">Overdue</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <UICard key={project.id} className="border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer bg-white rounded-2xl overflow-hidden">
            <UICardHeader className="p-6">
              <div className="flex items-start justify-between">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/10 transition-transform group-hover:scale-110", project.color)}>
                  <FolderKanban className="w-6 h-6" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteProject(project.id)
                  }}
                  className="h-9 w-9 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </div>
              <UICardTitle className="mt-6 text-xl font-black text-stone-900 flex items-center gap-3">
                {project.name}
                <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-stone-400" />
              </UICardTitle>
              <p className="text-sm font-medium text-stone-400 mt-2 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            </UICardHeader>
            <UICardContent className="p-6 pt-0 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                  <span>Development Progress</span>
                  <span className="text-stone-900">{project.progress}%</span>
                </div>
                <Progress value={project.progress}>
                  <ProgressTrack className="h-2 bg-stone-50 rounded-full overflow-hidden">
                    <ProgressIndicator className={cn("h-full transition-all duration-500", project.color)} />
                  </ProgressTrack>
                </Progress>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                <div className="flex -space-x-2">
                  {["AD", "SC"].map((member, i) => (
                    <Avatar key={i} className="w-8 h-8 border-2 border-white shadow-sm ring-1 ring-stone-100">
                      <AvatarFallback className="text-[9px] font-black bg-stone-100 text-stone-500">{member}</AvatarFallback>
                    </Avatar>
                  ))}
                  <div className="w-8 h-8 rounded-full bg-stone-50 border-2 border-white flex items-center justify-center text-[9px] font-black text-stone-400 shadow-sm">
                    +3
                  </div>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black uppercase tracking-widest border-none px-3 py-1.5 rounded-full shadow-sm",
                  project.status === 'on-track' ? "bg-emerald-50 text-emerald-600" : 
                  project.status === 'at-risk' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                )}>
                  {project.status.replace('-', ' ')}
                </Badge>
              </div>
            </UICardContent>
          </UICard>
        ))}
        
        <UICard className="border-2 border-dashed border-stone-100 shadow-none hover:border-stone-300 hover:bg-stone-50/50 transition-all flex flex-col items-center justify-center p-8 cursor-pointer group min-h-[280px]">
          <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-stone-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-stone-400 group-hover:text-black transition-colors" />
          </div>
          <span className="text-sm font-bold text-stone-400 group-hover:text-black transition-colors">Create New Project</span>
          <p className="text-[10px] text-stone-400 mt-2 text-center max-w-[160px]">Launch a new initiative and start tracking your progress.</p>
        </UICard>
      </div>
    </div>
    </AnimatePage>
  )
}
