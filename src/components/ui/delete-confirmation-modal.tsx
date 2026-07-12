import React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RETENTION_DAYS } from "@/lib/utils/trash-utils"

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemName: string
  itemType?: "document" | "folder"
}

export function DeleteConfirmationModal({
  isOpen,
  onOpenChange,
  onConfirm,
  itemName,
  itemType = "document"
}: DeleteConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px] p-6 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold text-white tracking-tight">
            Delete &quot;{itemName}&quot;?
          </h2>
          <p className="text-[14px] text-[#A1A1AA] leading-relaxed">
            Deleted {itemType}s are available in the &quot;Recently deleted&quot; view for {RETENTION_DAYS} days, before they are permanently deleted.
          </p>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white/10 hover:bg-white/15 text-white font-medium px-5 h-9 transition-colors"
          >
            Cancel
          </Button>
          <Button 
            variant="ghost"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="rounded-full bg-[#FF453A] hover:bg-[#FF453A]/90 text-white font-medium px-5 h-9 ring-1 ring-[#FF453A] ring-offset-1 ring-offset-[#1A1A1A] transition-all"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
