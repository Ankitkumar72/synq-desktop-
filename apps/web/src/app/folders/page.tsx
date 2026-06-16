"use client"

import { useState } from "react"
import { 
  FolderKanban, 
  MoreHorizontal, 
  Search,
  LayoutGrid,
  List,
  ArrowRight,
  Filter,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { 
  Card as UICard, 
  CardContent as UICardContent, 
  CardHeader as UICardHeader, 
  CardTitle as UICardTitle 
} from "@/components/ui/card"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useProjectStore } from "@synq/shared"
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { AnimatePage } from "@/components/layout/animate-page"
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger 
} from "@/components/ui/dialog"

const COLOR_OPTIONS = [
  { id: 'blue', value: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent', preview: 'bg-blue-500' },
  { id: 'emerald', value: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent', preview: 'bg-emerald-500' },
  { id: 'violet', value: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent', preview: 'bg-violet-500' },
  { id: 'rose', value: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-transparent', preview: 'bg-rose-500' },
  { id: 'amber', value: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent', preview: 'bg-amber-500' },
  { id: 'slate', value: 'bg-zinc-800 text-stone-300 border-zinc-700', preview: 'bg-zinc-800' },
]

export default function ProjectsPage() {
  const router = useRouter()
  const projects = useProjectStore(s => s.projects); const deleteProject = useProjectStore(s => s.deleteProject); const addProject = useProjectStore(s => s.addProject); const toggleFavorite = useProjectStore(s => s.toggleFavorite)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<'on-track' | 'at-risk' | 'overdue'>('on-track')
  const [color, setColor] = useState('bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent')
  const [isFavorite, setIsFavorite] = useState(false)

  const toggleStatus = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    )
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await addProject({
      name: name.trim(),
      description: description.trim(),
      status,
      color,
      is_favorite: isFavorite,
    })

    // Reset state
    setName("")
    setDescription("")
    setStatus("on-track")
    setColor("bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent")
    setIsFavorite(false)
    setIsCreateOpen(false)
  }

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(project.status)
    return matchesSearch && matchesStatus
  })

  return (
    <AnimatePage className="h-full w-full overflow-y-auto custom-scrollbar">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">Folders</h1>
            <p className="text-stone-400 text-sm font-medium">Track and manage your team folders and initiatives.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-1 rounded-xl flex items-center border border-white/5">
              <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs bg-white/10 shadow-sm font-bold text-white border border-white/10">
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                Grid
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs text-stone-500 hover:text-stone-300">
                <List className="w-3.5 h-3.5 mr-1.5" />
                List
              </Button>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={
                <Button className="bg-white text-black hover:bg-stone-200 h-10 rounded-full px-5 gap-2 font-bold shadow-lg shadow-white/5 transition-all active:scale-95">
                  <FolderKanban className="w-4 h-4" />
                  New Folder
                </Button>
              } />
              <DialogContent className="sm:max-w-[480px] p-6 border border-white/5 bg-[#101011] shadow-[0_24px_50px_rgba(0,0,0,0.5)] rounded-[28px] outline-none">
                <form onSubmit={handleCreateFolder} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white tracking-tight">Create Folder</h2>
                    <button
                      type="button"
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 font-bold text-[10px] uppercase tracking-wider",
                        isFavorite 
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                          : "bg-white/5 border-white/5 text-stone-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Star className={cn("w-3.5 h-3.5", isFavorite ? "fill-amber-400 text-amber-400" : "text-stone-400")} />
                      Favorite
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Folder Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Design System, Marketing Campaign"
                      className="w-full bg-[#1A1A1C] border border-white/5 focus:border-white/10 rounded-2xl py-3 px-4 text-white text-sm placeholder:text-stone-600 focus:outline-none transition-all font-medium"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief details about what is in this folder..."
                      className="w-full bg-[#1A1A1C] border border-white/5 focus:border-white/10 rounded-2xl py-3 px-4 text-white text-sm placeholder:text-stone-600 focus:outline-none transition-all h-20 resize-none leading-relaxed font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Status</label>
                    <div className="flex gap-2">
                      {(['on-track', 'at-risk', 'overdue'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            status === s
                              ? s === 'on-track'
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : s === 'at-risk'
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              : "bg-white/5 border-white/5 text-stone-500 hover:bg-white/10 hover:text-stone-300"
                          )}
                        >
                          {s.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Theme Color</label>
                    <div className="flex gap-2.5 items-center">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setColor(opt.value)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-all duration-300 relative",
                            opt.preview,
                            color === opt.value
                              ? "ring-2 ring-white ring-offset-2 ring-offset-[#101011] scale-110"
                              : "hover:scale-105 opacity-80 hover:opacity-100"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="h-10 px-5 rounded-full text-stone-400 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!name.trim()}
                      className={cn(
                        "h-10 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all",
                        name.trim()
                          ? "bg-white text-black hover:bg-stone-200 active:scale-95"
                          : "bg-white/5 text-stone-600 cursor-not-allowed"
                      )}
                    >
                      Create Folder
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <Input 
              placeholder="Search folders..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-white/5 bg-white/5 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-white/10 text-sm rounded-xl text-white placeholder:text-stone-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="h-11 px-4 text-stone-400 hover:text-white hover:bg-white/5 border border-white/5 rounded-xl gap-2 font-bold transition-all outline-none ring-0">
                  <Filter className="w-4 h-4" />
                  Filters
                  {selectedStatus.length > 0 && (
                    <div className="flex items-center justify-center bg-white/10 text-stone-300 text-[10px] w-4 h-4 rounded-full ml-1 font-black">
                      {selectedStatus.length}
                    </div>
                  )}
                </Button>
              } />
              <DropdownMenuContent align="end" className="bg-[#141414] border border-white/5 text-white rounded-xl shadow-2xl p-2 min-w-[180px]">
                <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-stone-600">Filters</div>
                <DropdownMenuItem 
                  onClick={() => toggleStatus('on-track')}
                  className={cn(
                    "rounded-lg px-2 py-2 flex items-center justify-between group transition-colors",
                    selectedStatus.includes('on-track') ? "bg-white/5 text-white" : "text-stone-500 hover:text-white hover:bg-white/[0.02]"
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-tight">On Track</span>
                  {selectedStatus.includes('on-track') && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => toggleStatus('at-risk')}
                  className={cn(
                    "rounded-lg px-2 py-2 flex items-center justify-between group transition-colors",
                    selectedStatus.includes('at-risk') ? "bg-white/5 text-white" : "text-stone-500 hover:text-white hover:bg-white/[0.02]"
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-tight">At Risk</span>
                  {selectedStatus.includes('at-risk') && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => toggleStatus('overdue')}
                  className={cn(
                    "rounded-lg px-2 py-2 flex items-center justify-between group transition-colors",
                    selectedStatus.includes('overdue') ? "bg-white/5 text-white" : "text-stone-500 hover:text-white hover:bg-white/[0.02]"
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-tight">Overdue</span>
                  {selectedStatus.includes('overdue') && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" />}
                </DropdownMenuItem>
                {selectedStatus.length > 0 && (
                  <>
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <DropdownMenuItem 
                      onClick={() => setSelectedStatus([])}
                      className="rounded-lg px-2 py-2 text-[10px] font-black text-stone-500 hover:text-white transition-colors text-center block w-full uppercase tracking-[0.2em]"
                    >
                      Reset filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <UICard 
              key={project.id} 
              onClick={() => router.push(`/folders/${project.id}`)}
              className="border-white/5 shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all group cursor-pointer bg-[#141414] rounded-3xl overflow-hidden border-none outline-none relative"
            >
              <UICardHeader className="p-8">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg shadow-black/10 transition-transform group-hover:scale-110",
                    project.color ? project.color : "text-stone-400 border-white/10 bg-white/5"
                  )}>
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(project.id, !project.is_favorite)
                      }}
                      className={cn(
                        "h-9 w-9 rounded-full transition-all duration-300",
                        project.is_favorite 
                          ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" 
                          : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                      )}
                    >
                      <Star className={cn("w-4 h-4", project.is_favorite ? "fill-amber-400" : "")} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteProject(project.id)
                      }}
                      className="h-9 w-9 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                <UICardTitle className="mt-8 text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                  {project.name}
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
                </UICardTitle>
                <p className="text-sm font-medium text-stone-400 mt-3 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              </UICardHeader>
              <UICardContent className="p-8 pt-0 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] text-stone-500">
                    <span>Development Progress</span>
                    <span className="text-white">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress}>
                    <ProgressTrack className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <ProgressIndicator className="h-full bg-white/20 transition-all duration-700 ease-out" />
                    </ProgressTrack>
                  </Progress>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                  <div className="flex -space-x-2.5">
                    {["AD", "SC"].map((member, i) => (
                      <Avatar key={i} className="w-8 h-8 border-2 border-[#141414] shadow-xl">
                        <AvatarFallback className="text-[10px] font-black bg-zinc-800 text-stone-500">{member}</AvatarFallback>
                      </Avatar>
                    ))}
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-[#141414] flex items-center justify-center text-[10px] font-black text-stone-600 shadow-xl">
                      +3
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      project.status === 'on-track' ? 'bg-stone-400' : project.status === 'at-risk' ? 'bg-stone-500' : 'bg-white'
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{project.status.replace('-', ' ')}</span>
                  </div>
                </div>
              </UICardContent>
            </UICard>
          ))}
          
        </div>
      </div>
    </AnimatePage>
  )
}
