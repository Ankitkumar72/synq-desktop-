"use client"

import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/react'
import {
  Trash,
  Plus,
  Minus,
  Rows,
  Columns
} from 'lucide-react'

interface TableBubbleMenuProps {
  editor: Editor | null
}

export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  if (!editor) return null

  const shouldShow = ({ editor }: { editor: Editor }) => {
    return editor.isActive('table')
  }

  return (
    <TiptapBubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={{
        placement: 'bottom'
      }}
      pluginKey="tableBubbleMenu"
    >
      <div className="flex items-center gap-0.5 p-1 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md text-neutral-300 select-none">
        
        <div className="flex items-center gap-1 border-r border-neutral-800 pr-1 mr-1">
          <button
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150 flex items-center gap-1"
            title="Add Column Before"
          >
            <Columns className="w-3.5 h-3.5" /> <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-all duration-150 flex items-center gap-1"
            title="Delete Column"
          >
            <Columns className="w-3.5 h-3.5" /> <Minus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-r border-neutral-800 pr-1 mr-1">
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150 flex items-center gap-1"
            title="Add Row After"
          >
            <Rows className="w-3.5 h-3.5" /> <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-all duration-150 flex items-center gap-1"
            title="Delete Row"
          >
            <Rows className="w-3.5 h-3.5" /> <Minus className="w-3 h-3" />
          </button>
        </div>

        <button
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-all duration-150"
          title="Delete Table"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>

      </div>
    </TiptapBubbleMenu>
  )
}
