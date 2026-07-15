import { useState, useMemo } from 'react'
import { Bell, AlertTriangle, Check, X, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useConflictStore } from '@/shared/store/use-conflict-store'
import { Button } from '@/components/ui/button'

export function ConflictInbox() {
  const { conflicts, dismissConflict, restoreConflict } = useConflictStore()
  const [isOpen, setIsOpen] = useState(false)
  
  // Optional: Deduplicate conflicts by entity_id + field_name if multiple arrive
  const uniqueConflicts = useMemo(() => {
    const seen = new Set<string>()
    return conflicts.filter((c) => {
      const key = `${c.entity_id}-${c.field_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [conflicts])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger 
        render={
          <button className="relative flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-stone-400 hover:text-stone-200">
            <Bell className="w-4 h-4" />
            {uniqueConflicts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-lg shadow-red-500/20">
                {uniqueConflicts.length}
              </span>
            )}
          </button>
        }
      />

      <SheetContent side="right" className="w-[400px] border-l border-white/5 bg-background/95 backdrop-blur-xl p-0">
        <SheetHeader className="p-6 border-b border-white/5">
          <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Sync Conflicts
          </SheetTitle>
          <p className="text-sm text-stone-400 mt-1">
            These edits were overwritten by another device. You can restore them or dismiss.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[calc(100vh-100px)]">
          {uniqueConflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-stone-500 gap-2">
              <Check className="w-8 h-8 opacity-20" />
              <p className="text-sm">No conflicts found</p>
            </div>
          ) : (
            uniqueConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {conflict.entity_type} {conflict.field_name ? `• ${conflict.field_name}` : '• Deleted'}
                    </span>
                    <span className="text-xs text-stone-500 mt-0.5">
                      {formatDistanceToNow(new Date(conflict.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-stone-300 bg-black/40 p-3 rounded-lg border border-white/5 break-words">
                  {conflict.field_name ? (
                    <>
                      <span className="text-stone-500 text-xs block mb-1">Your rejected value:</span>
                      {typeof conflict.rejected_value === 'string' 
                        ? conflict.rejected_value 
                        : JSON.stringify(conflict.rejected_value)}
                    </>
                  ) : (
                    <span className="text-red-400 text-xs">
                      You tried to edit an item that was already deleted.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-stone-400 hover:text-white bg-white/5 hover:bg-white/10"
                    onClick={() => dismissConflict(conflict.id)}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Dismiss
                  </Button>
                  
                  {conflict.field_name && (
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => restoreConflict(conflict)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
