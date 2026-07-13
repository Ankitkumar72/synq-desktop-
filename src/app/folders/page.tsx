"use client"

import { useState } from "react"
import {
  FolderKanban,
  MoreHorizontal,
  Search,
  Pin,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Folder,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useFolderStore, useNotesStore } from "@/shared"
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


import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal"

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
  const folders = useFolderStore(s => s.folders); const deleteFolder = useFolderStore(s => s.deleteFolder); const addFolder = useFolderStore(s => s.addFolder); const updateFolder = useFolderStore(s => s.updateFolder);
  const notes = useNotesStore(s => s.notes)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  type SortField = 'name' | 'date' | 'type' | 'size' | 'tags' | 'date_created' | 'date_modified' | 'date_taken' | 'dimensions' | 'rating'
  const [sortColumn, setSortColumn] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)

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
        const folder = folders.find(p => p.id === folderId)
        if (folder) updateFolder(folder.id, { is_favorite: !folder.is_favorite })
        break;
      }
      case 'delete':
        setDeleteFolderId(folderId)
        break;
      case 'open':
        toggleFolder(folderId)
        break;
      case 'rename':
        const p = folders.find(p => p.id === folderId)
        if (p) {
          setRenameFolderId(folderId)
          setRenameValue(p.name)
          setIsRenameOpen(true)
        }
        break;
      case 'edit-description':
        const descFolder = folders.find(p => p.id === folderId)
        if (descFolder) {
          setEditDescFolderId(folderId)
          setEditDescValue(descFolder.description || "")
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
      await updateFolder(renameFolderId, { name: renameValue.trim() })
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
      await updateFolder(editDescFolderId, { description: editDescValue.trim() })
      setIsEditDescOpen(false)
      setEditDescFolderId(null)
    }
  }

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")


  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await addFolder({
      name: name.trim(),
      description: "",
      color: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent",
      is_favorite: false,
    })

    // Reset state
    setName("")
    setIsCreateOpen(false)
  }

  const filteredFolders = folders.filter((folder) => {
    return folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      folder.description?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const sortedFolders = [...filteredFolders].sort((a, b) => {
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
      const aSize = notes.filter(n => n.folder_id === a.id && !n.is_deleted).length
      const bSize = notes.filter(n => n.folder_id === b.id && !n.is_deleted).length
      comparison = aSize - bSize
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

  const hasHydrated = useFolderStore(s => s._hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const deleteFolderItem = deleteFolderId ? folders.find(f => f.id === deleteFolderId) : null

  return (
    <AnimatePage className="h-full w-full overflow-y-auto custom-scrollbar">
      <DeleteConfirmationModal 
        isOpen={!!deleteFolderId}
        onOpenChange={(open) => !open && setDeleteFolderId(null)}
        onConfirm={() => deleteFolderId && deleteFolder(deleteFolderId)}
        itemName={deleteFolderItem?.name || "Untitled Folder"}
        itemType="folder"
      />
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
              <DialogContent className="sm:max-w-[640px] p-0 border border-white/5 bg-[#121212] shadow-2xl rounded-[24px] outline-none [&>button]:hidden overflow-hidden">
                <form onSubmit={handleCreateFolder} className="flex h-[320px] relative w-full">
                  
                  {/* Left Pane */}
                  <div className="w-[240px] h-full bg-gradient-to-br from-[#8b2ff5] via-[#d9368d] to-[#f5822a] flex flex-col items-center justify-center relative p-8">
                    <div className="w-16 h-16 rounded-[16px] bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl relative z-10">
                      <Folder className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* Right Pane */}
                  <div className="flex-1 flex flex-col p-8 relative">
                    <button type="button" onClick={() => setIsCreateOpen(false)} className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors">
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.5571 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.5571 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </button>
                    
                    <div className="mt-2">
                      <h2 className="text-[20px] font-semibold text-white tracking-tight mb-1">Create Folder</h2>
                      <p className="text-[14px] text-stone-400">Give your new folder a name.</p>
                    </div>

                    <div className="mt-10">
                      <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase block mb-3">Folder Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Q3 Roadmap"
                        className="w-full bg-transparent border-b-2 border-stone-800 focus:border-[#d9368d] py-2 text-white text-[15px] placeholder:text-stone-700 focus:outline-none transition-colors caret-[#d9368d]"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="mt-auto flex items-center justify-end gap-5">
                      <button type="button" onClick={() => setIsCreateOpen(false)} className="text-[13px] font-semibold text-stone-300 hover:text-white transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={!name.trim()} className="bg-white/10 hover:bg-white/20 border border-white/5 text-white rounded-full px-6 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-30">
                        Create Folder
                      </button>
                    </div>
                  </div>

                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-background border-border shadow-lg rounded-xl font-sans" style={{ fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                <form onSubmit={handleRenameSubmit} className="flex flex-col">
                  <div className="p-4 border-b border-border/50">
                    <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Rename Folder</h2>
                  </div>
                  <div className="p-4 py-6">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Folder name"
                      className="w-full bg-transparent border-0 border-b border-border focus:border-foreground py-2 text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none transition-colors focus:ring-0 px-0"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsRenameOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 px-4 text-xs font-medium transition-colors">Cancel</Button>
                    <Button type="submit" disabled={!renameValue.trim()} className="bg-foreground text-background hover:bg-foreground/90 rounded-md h-8 px-4 text-xs font-medium transition-colors disabled:opacity-50">Save</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDescOpen} onOpenChange={setIsEditDescOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-background border-border shadow-lg rounded-xl font-sans" style={{ fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                <form onSubmit={handleEditDescSubmit} className="flex flex-col">
                  <div className="p-4 border-b border-border/50">
                    <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Edit Description</h2>
                  </div>
                  <div className="p-4 py-5">
                    <input
                      type="text"
                      value={editDescValue}
                      onChange={(e) => setEditDescValue(e.target.value)}
                      placeholder="Add a brief description..."
                      className="w-full bg-transparent border-0 border-b border-border focus:border-foreground py-2 text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none transition-colors focus:ring-0 px-0"
                      autoFocus
                    />
                  </div>
                  <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsEditDescOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 px-4 text-xs font-medium transition-colors">Cancel</Button>
                    <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90 rounded-md h-8 px-4 text-xs font-medium transition-colors">Save</Button>
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
            {sortedFolders.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm font-medium">No folders found</div>
            ) : (
              sortedFolders.map((folder) => (
                <FolderContextMenu 
                  key={folder.id} 
                  folder={folder} 
                  onAction={handleFolderAction}
                >
                  <div className="flex flex-col border-b border-white/[0.02]">
                    <div
                      onClick={() => toggleFolder(folder.id)}
                      className="grid grid-cols-12 gap-4 px-2 py-3.5 items-center hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <div className="col-span-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-7 h-7 flex-shrink-0 transition-transform group-hover:scale-105">
                          <Folder className={cn("w-5 h-5", getIconColorClass(folder.color))} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2.5">
                          <span className="font-semibold text-stone-200 text-[15px] tracking-tight truncate">
                            {folder.name}
                          </span>
                          {folder.is_favorite && <Pin className="w-3.5 h-3.5 fill-white text-white flex-shrink-0" />}
                        </div>
                      </div>
                      <div className="col-span-4 flex items-center pr-4 min-w-0">
                        <span className="text-[15px] text-stone-300 truncate w-full">
                          {folder.description || <span className="text-stone-500/80 italic">No description</span>}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center justify-between text-[15px] font-medium text-stone-500">
                        <span className="tracking-tight tabular-nums">
                          {(() => {
                            const date = new Date(folder.created_at || Date.now());
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
                              updateFolder(folder.id, { is_favorite: !folder.is_favorite })
                            }}
                            className={cn(
                              "h-7 w-7 rounded-md transition-all",
                              folder.is_favorite
                                ? "text-white hover:text-white hover:bg-white/10"
                                : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                            )}
                          >
                            <Pin className={cn("w-3.5 h-3.5", folder.is_favorite ? "fill-white" : "")} />
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
                          <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-md rounded-lg p-1 text-popover-foreground" style={{ fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                            <DropdownMenuItem onClick={() => handleFolderAction('open', folder.id)} className="text-[13px] rounded-md py-1.5 px-3 focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-default outline-none">
                              Expand / Collapse
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('pin', folder.id)} className="text-[13px] rounded-md py-1.5 px-3 focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-default outline-none">
                              {folder.is_favorite ? "Unpin Folder" : "Pin Folder"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('rename', folder.id)} className="text-[13px] rounded-md py-1.5 px-3 focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-default outline-none">
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFolderAction('edit-description', folder.id)} className="text-[13px] rounded-md py-1.5 px-3 focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-default outline-none">
                              Edit Description
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border -mx-1 my-1" />
                            <DropdownMenuItem onClick={() => handleFolderAction('delete', folder.id)} className="text-[13px] rounded-md py-1.5 px-3 text-destructive focus:text-destructive focus:bg-destructive/10 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-default outline-none">
                              Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {expandedFolders.has(folder.id) && (() => {
                      const projectNotes = notes.filter(n => n.folder_id === folder.id && !n.is_deleted)
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
                                    folder.color ? folder.color : "bg-stone-800 text-stone-400"
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
