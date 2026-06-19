"use client"

import { useState } from "react"
import {
  FolderKanban,
  MoreHorizontal,
  Search,
  Pin,
  PinOff,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Folder,
  Check,
  Trash2,
  Edit3,
  AlignLeft
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useProjectStore, useNotesStore } from "@/shared"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { AnimatePage } from "@/components/layout/animate-page"
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog"
import { FolderContextMenu } from "@/components/folders/folder-context-menu"

const COLOR_OPTIONS = [
  { id: 'blue', value: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent', preview: 'bg-blue-500' },
  { id: 'emerald', value: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent', preview: 'bg-emerald-500' },
  { id: 'violet', value: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent', preview: 'bg-violet-500' },
  { id: 'rose', value: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-transparent', preview: 'bg-rose-500' },
  { id: 'amber', value: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent', preview: 'bg-amber-500' },
  { id: 'slate', value: 'bg-zinc-800 text-stone-300 border-zinc-700', preview: 'bg-zinc-800' },
]

function getIconColorClass(colorValue?: string) {
  if (!colorValue) return 'text-stone-500'
  if (colorValue.includes('blue')) return 'text-blue-500'
  if (colorValue.includes('emerald')) return 'text-emerald-500'
  if (colorValue.includes('violet')) return 'text-violet-500'
  if (colorValue.includes('rose')) return 'text-rose-500'
  if (colorValue.includes('amber')) return 'text-amber-500'
  if (colorValue.includes('zinc')) return 'text-stone-500'
  return 'text-stone-500'
}

export default function ProjectsPage() {
  const router = useRouter()
  const projects = useProjectStore(s => s.projects); const deleteProject = useProjectStore(s => s.deleteProject); const addProject = useProjectStore(s => s.addProject); const toggleFavorite = useProjectStore(s => s.toggleFavorite); const updateProject = useProjectStore(s => s.updateProject)
  const notes = useNotesStore(s => s.notes)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  type SortField = 'name' | 'date' | 'type' | 'size' | 'tags' | 'date_created' | 'date_modified' | 'date_taken' | 'dimensions' | 'rating'
  const [sortColumn, setSortColumn] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const handleSort = (column: SortField) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleFolderAction = (action: string, folderId: string) => {
    switch (action) {
      case 'pin': {
        const project = projects.find(p => p.id === folderId)
        if (project) toggleFavorite(project.id, !project.is_favorite)
        break;
      }
      case 'delete':
        deleteProject(folderId)
        break;
      case 'open':
        toggleFolder(folderId)
        break;
      case 'rename':
        const p = projects.find(p => p.id === folderId)
        if (p) {
          setRenameFolderId(folderId)
          setRenameValue(p.name)
          setIsRenameOpen(true)
        }
        break;
      case 'edit-description':
        const descProject = projects.find(p => p.id === folderId)
        if (descProject) {
          setEditDescFolderId(folderId)
          setEditDescValue(descProject.description || "")
          setIsEditDescOpen(true)
        }
        break;
    }
  }

  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (renameFolderId && renameValue.trim()) {
      await updateProject(renameFolderId, { name: renameValue.trim() })
      setIsRenameOpen(false)
      setRenameFolderId(null)
    }
  }

  const [isEditDescOpen, setIsEditDescOpen] = useState(false)
  const [editDescFolderId, setEditDescFolderId] = useState<string | null>(null)
  const [editDescValue, setEditDescValue] = useState("")

  const handleEditDescSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editDescFolderId) {
      await updateProject(editDescFolderId, { description: editDescValue.trim() })
      setIsEditDescOpen(false)
      setEditDescFolderId(null)
    }
  }

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<'on-track' | 'at-risk' | 'overdue'>('on-track')
  const [color, setColor] = useState('bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent')
  const [isFavorite, setIsFavorite] = useState(false)


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
    return project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    // Pin favorites to the top and prevent them from being sorted
    if (a.is_favorite && !b.is_favorite) return -1
    if (!a.is_favorite && b.is_favorite) return 1
    if (a.is_favorite && b.is_favorite) return 0

    let comparison = 0
    if (sortColumn === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else if (sortColumn === 'rating') {
      comparison = (a.is_favorite === b.is_favorite) ? 0 : a.is_favorite ? 1 : -1
    } else if (sortColumn === 'size') {
      comparison = (a.task_count || 0) - (b.task_count || 0)
    } else if (['date', 'date_created', 'date_taken'].includes(sortColumn)) {
      const timeA = new Date(a.created_at || 0).getTime()
      const timeB = new Date(b.created_at || 0).getTime()
      comparison = timeA - timeB
    } else if (sortColumn === 'date_modified') {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime()
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime()
      comparison = timeA - timeB
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const hasHydrated = useProjectStore(s => s._hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <AnimatePage className="h-full w-full overflow-y-auto custom-scrollbar">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">Folders</h1>
            <p className="text-stone-400 text-sm font-medium">Track and manage your team folders and initiatives.</p>
          </div>
          <div className="flex items-center gap-4">
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
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/5 border-white/5 text-stone-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Pin className={cn("w-3.5 h-3.5", isFavorite ? "fill-white text-white" : "text-stone-400")} />
                      {isFavorite ? "Pinned" : "Pin"}
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

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
              <DialogContent className="sm:max-w-[400px] p-6 border border-white/5 bg-[#101011] shadow-[0_24px_50px_rgba(0,0,0,0.5)] rounded-[28px] outline-none">
                <form onSubmit={handleRenameSubmit} className="space-y-6">
                  <h2 className="text-xl font-bold text-white tracking-tight">Rename Folder</h2>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Folder Name</label>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="w-full bg-[#1A1A1C] border border-white/5 focus:border-white/10 rounded-2xl py-3 px-4 text-white text-sm placeholder:text-stone-600 focus:outline-none transition-all font-medium"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setIsRenameOpen(false)} className="text-stone-400 hover:text-white hover:bg-white/5 rounded-xl h-11 px-6 font-bold transition-all">Cancel</Button>
                    <Button type="submit" disabled={!renameValue.trim()} className="bg-white text-black hover:bg-stone-200 rounded-xl h-11 px-6 font-bold shadow-lg shadow-white/5 transition-all">Save Changes</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDescOpen} onOpenChange={setIsEditDescOpen}>
              <DialogContent className="sm:max-w-[400px] p-6 border border-white/5 bg-[#101011] shadow-[0_24px_50px_rgba(0,0,0,0.5)] rounded-[28px] outline-none">
                <form onSubmit={handleEditDescSubmit} className="space-y-6">
                  <h2 className="text-xl font-bold text-white tracking-tight">Edit Description</h2>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Description</label>
                    <textarea
                      value={editDescValue}
                      onChange={(e) => setEditDescValue(e.target.value)}
                      placeholder="Add a brief description..."
                      className="w-full bg-[#1A1A1C] border border-white/5 focus:border-white/10 rounded-2xl py-3 px-4 text-white text-sm placeholder:text-stone-600 focus:outline-none transition-all font-medium resize-none min-h-[100px]"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setIsEditDescOpen(false)} className="text-stone-400 hover:text-white hover:bg-white/5 rounded-xl h-11 px-6 font-bold transition-all">Cancel</Button>
                    <Button type="submit" className="bg-white text-black hover:bg-stone-200 rounded-xl h-11 px-6 font-bold shadow-lg shadow-white/5 transition-all">Save Changes</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 pb-2 gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-white/5 bg-white/5 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-white/10 text-sm rounded-lg text-white placeholder:text-stone-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="h-11 px-6 text-stone-400 hover:text-white hover:bg-white/5 border border-white/5 bg-white/5 rounded-lg font-bold transition-all outline-none ring-0 w-44 flex items-center justify-center">
                  Sort
                </Button>
              } />
              <DropdownMenuContent
                align="end"
                className="bg-[#1e1e1e] border border-white/10 text-stone-200 rounded-md shadow-2xl py-1 w-[var(--anchor-width)]"
              >
                {[
                  { id: 'name', label: 'Name' },
                  { id: 'date', label: 'Date' },
                  { id: 'size', label: 'Size' },
                  { id: 'date_created', label: 'Date created' },
                  { id: 'date_modified', label: 'Date modified' },
                ].map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => handleSort(item.id as SortField)}
                    className="rounded-none px-2 py-1.5 flex items-center gap-2 transition-colors cursor-default text-[13px] outline-none hover:bg-white/10 hover:text-white"
                  >
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      {sortColumn === item.id && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </div>
                    {item.label}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="bg-white/10 my-1.5 mx-0" />

                <DropdownMenuItem
                  onClick={() => setSortDirection('asc')}
                  className="rounded-none px-2 py-1.5 flex items-center gap-2 transition-colors cursor-default text-[13px] outline-none hover:bg-white/10 hover:text-white"
                >
                  <div className="w-5 flex items-center justify-center flex-shrink-0">
                    {sortDirection === 'asc' && <Check className="w-4 h-4" />}
                  </div>
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortDirection('desc')}
                  className="rounded-none px-2 py-1.5 flex items-center gap-2 transition-colors cursor-default text-[13px] outline-none hover:bg-white/10 hover:text-white"
                >
                  <div className="w-5 flex items-center justify-center flex-shrink-0">
                    {sortDirection === 'desc' && <Check className="w-4 h-4" />}
                  </div>
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-8 flex flex-col w-full">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 px-2 py-3 border-b border-white/5 text-[12px] font-bold text-stone-500 uppercase tracking-widest">
            <div
              onClick={() => handleSort('name')}
              className="col-span-5 flex items-center gap-2 cursor-pointer hover:text-stone-300 transition-colors select-none"
            >
              Folder name
              {sortColumn === 'name' ? (
                sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-stone-300" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-300" />
              ) : (
                <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
              )}
            </div>
            <div
              className="col-span-4 flex items-center gap-2 select-none"
            >
              Description
            </div>
            <div
              onClick={() => handleSort('date_created')}
              className="col-span-3 flex items-center gap-2 cursor-pointer hover:text-stone-300 transition-colors select-none"
            >
              Created at
              {sortColumn === 'date_created' ? (
                sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-stone-300" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-300" />
              ) : (
                <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
              )}
            </div>
          </div>

          <div className="flex flex-col">
            {sortedProjects.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm font-medium">No folders found</div>
            ) : (
              sortedProjects.map((project) => (
                <FolderContextMenu 
                  key={project.id} 
                  project={project} 
                  onAction={handleFolderAction}
                >
                  <div className="flex flex-col border-b border-white/[0.02]">
                    <div
                      onClick={() => toggleFolder(project.id)}
                      className="grid grid-cols-12 gap-4 px-2 py-3.5 items-center hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <div className="col-span-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-7 h-7 flex-shrink-0 transition-transform group-hover:scale-105">
                          <Folder className={cn("w-5 h-5", getIconColorClass(project.color))} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2.5">
                          <span className="font-semibold text-stone-200 text-[15px] tracking-tight truncate">
                            {project.name}
                          </span>
                          {project.is_favorite && <Pin className="w-3.5 h-3.5 fill-white text-white flex-shrink-0" />}
                        </div>
                      </div>
                      <div className="col-span-4 flex items-center pr-4 min-w-0">
                        <span className="text-[15px] text-stone-300 truncate w-full">
                          {project.description || <span className="text-stone-500/80 italic">No description</span>}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center justify-between text-[15px] font-medium text-stone-500">
                        <span className="tracking-tight tabular-nums">
                          {(() => {
                            const date = new Date(project.created_at || Date.now());
                            const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            const dateString = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                            return `${timeString} ${dateString}`;
                          })()}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(project.id, !project.is_favorite)
                            }}
                            className={cn(
                              "h-7 w-7 rounded-md transition-all",
                              project.is_favorite
                                ? "text-white hover:text-white hover:bg-white/10"
                                : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                            )}
                          >
                            <Pin className={cn("w-3.5 h-3.5", project.is_favorite ? "fill-white" : "")} />
                          </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 rounded-md text-stone-500 hover:text-white hover:bg-white/5 transition-all"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end" className="w-[200px] bg-[#1e1e1e] border border-white/10 shadow-2xl rounded-md p-1 text-stone-200">
                            <DropdownMenuItem onClick={() => handleFolderAction('open', project.id)} className="text-[13px] gap-2 rounded-sm py-1.5 px-2 focus:bg-white/10 focus:text-white transition-colors cursor-default outline-none text-stone-300">
                              <Folder className="w-4 h-4 text-stone-400" />
                              Expand / Collapse
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('pin', project.id)} className="text-[13px] gap-2 rounded-sm py-1.5 px-2 focus:bg-white/10 focus:text-white transition-colors cursor-default outline-none text-stone-300">
                              {project.is_favorite ? <PinOff className="w-4 h-4 text-stone-400" /> : <Pin className="w-4 h-4 text-stone-400" />}
                              {project.is_favorite ? "Unpin Folder" : "Pin Folder"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('rename', project.id)} className="text-[13px] gap-2 rounded-sm py-1.5 px-2 focus:bg-white/10 focus:text-white transition-colors cursor-default outline-none text-stone-300">
                              <Edit3 className="w-4 h-4 text-stone-400" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('edit-description', project.id)} className="text-[13px] gap-2 rounded-sm py-1.5 px-2 focus:bg-white/10 focus:text-white transition-colors cursor-default outline-none text-stone-300">
                              <AlignLeft className="w-4 h-4 text-stone-400" />
                              Edit Description
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10 my-1 mx-0" />
                            <DropdownMenuItem onClick={() => handleFolderAction('delete', project.id)} className="text-[13px] gap-2 rounded-sm py-1.5 px-2 text-rose-400 focus:text-rose-400 focus:bg-rose-500/10 transition-colors cursor-default outline-none">
                              <Trash2 className="w-4 h-4" />
                              Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {expandedFolders.has(project.id) && (() => {
                      const projectNotes = notes.filter(n => n.folder_id === project.id && !n.is_deleted)
                      return (
                        <div className="ml-9 border-l-2 border-white/5 pl-4 mb-2">
                          {projectNotes.length === 0 ? (
                            <div className="py-3 text-[12px] text-stone-600 italic">No items found in this folder</div>
                          ) : (
                            projectNotes.map(note => (
                              <div
                                key={note.id}
                                onClick={() => router.push(`/notes/${note.id}`)}
                                className="grid grid-cols-12 gap-4 py-2.5 items-center hover:bg-white/[0.02] transition-colors cursor-pointer group"
                              >
                                <div className="col-span-9 flex items-center gap-3">
                                  <div className={cn(
                                    "w-6 h-6 rounded-[6px] flex items-center justify-center shadow-sm relative overflow-hidden",
                                    project.color ? project.color : "bg-stone-800 text-stone-400"
                                  )}>
                                    <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
                                  </div>
                                  <span className="font-medium text-stone-300 text-[13px] truncate">
                                    {note.title || 'Untitled Note'}
                                  </span>
                                </div>
                                <div className="col-span-3 flex items-center text-[12px] text-stone-500 tabular-nums tracking-tight">
                                  {(() => {
                                    const date = new Date(note.updated_at || Date.now());
                                    const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    const dateString = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                                    return `${timeString} ${dateString}`;
                                  })()}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </FolderContextMenu>
              ))
            )}
          </div>
        </div>
      </div>
    </AnimatePage>
  )
}
