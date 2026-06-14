"use client"

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
} from 'react'
import { Extension, Editor, Range } from '@tiptap/core'
import Suggestion, { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Code,
  Info,
  Table as TableIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 1. Definition of available slash command items
export interface CommandItem {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  command: (props: { editor: Editor; range: Range }) => void
}

const getSuggestionItems = ({ query }: { query: string }): CommandItem[] => {
  const items: CommandItem[] = [
    {
      title: 'Text',
      description: 'Start writing with plain text.',
      icon: Type,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run()
      },
    },
    {
      title: 'Heading 1',
      description: 'Big section heading.',
      icon: Heading1,
      shortcut: '#',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      icon: Heading2,
      shortcut: '##',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      icon: Heading3,
      shortcut: '###',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bulleted list.',
      icon: List,
      shortcut: '-',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Numbered List',
      description: 'Create a list with numbering.',
      icon: ListOrdered,
      shortcut: '1.',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Checklist',
      description: 'Create checkboxes for tasks.',
      icon: CheckSquare,
      shortcut: '[]',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      },
    },
    {
      title: 'Blockquote',
      description: 'Capture a quote or highlight text.',
      icon: Quote,
      shortcut: '>',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Divider',
      description: 'Insert a thin horizontal line.',
      icon: Minus,
      shortcut: '---',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      title: 'Code Block',
      description: 'Write code with syntax styling.',
      icon: Code,
      shortcut: '```',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
    },
    {
      title: 'Callout Box',
      description: 'Make text pop in a styled box.',
      icon: Info,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCallout().run()
      },
    },
    {
      title: 'Table',
      description: 'Insert a 3x3 table.',
      icon: TableIcon,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      },
    },
  ]

  return items.filter(
    item =>
      item.title.toLowerCase().startsWith(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  )
}

type SlashCommandListProps = SuggestionProps<CommandItem>

const SlashCommandList = forwardRef<{ onKeyDown: (props: SuggestionKeyDownProps) => boolean }, SlashCommandListProps>(
  (props, ref) => {
    const [prevItems, setPrevItems] = useState(props.items)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)

    if (props.items !== prevItems) {
      setPrevItems(props.items)
      setSelectedIndex(0)
    }

    const selectItem = (index: number) => {
      const item = props.items[index]
      if (item) {
        props.command(item)
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(prev => (prev + props.items.length - 1) % props.items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex(prev => (prev + 1) % props.items.length)
          return true
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }

        return false
      },
    }))

    // Scroll active item into view inside the list
    useEffect(() => {
      const activeEl = listRef.current?.children[selectedIndex] as HTMLElement
      if (activeEl && listRef.current) {
        const list = listRef.current
        const activeTop = activeEl.offsetTop
        const activeHeight = activeEl.offsetHeight
        const listScrollTop = list.scrollTop
        const listHeight = list.clientHeight

        if (activeTop < listScrollTop) {
          list.scrollTop = activeTop
        } else if (activeTop + activeHeight > listScrollTop + listHeight) {
          list.scrollTop = activeTop + activeHeight - listHeight
        }
      }
    }, [selectedIndex])

    if (props.items.length === 0) {
      return (
        <div className="w-64 p-3 text-xs text-neutral-500 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md italic">
          No matching block types found
        </div>
      )
    }

    return (
      <div
        ref={listRef}
        className="w-64 max-h-[320px] overflow-y-auto p-1.5 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md flex flex-col gap-0.5"
      >
        <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-2.5 py-1 select-none">
          Basic Blocks
        </div>
        {props.items.map((item, index) => {
          const Icon = item.icon
          const isSelected = index === selectedIndex

          return (
            <button
              key={item.title}
              onClick={() => selectItem(index)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left transition-all duration-150 select-none",
                isSelected
                  ? "bg-white/5 text-white"
                  : "text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center shrink-0 w-7 h-7 rounded-md border transition-colors",
                  isSelected
                    ? "bg-white/5 border-white/10 text-white"
                    : "bg-white/[0.01] border-white/[0.03] text-neutral-500"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold tracking-tight">{item.title}</div>
                <div className="text-[10px] text-neutral-500 line-clamp-1">{item.description}</div>
              </div>
              {item.shortcut && (
                <span className="text-[10px] font-mono font-medium text-neutral-600 bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded shrink-0 select-none">
                  {item.shortcut}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }
)

SlashCommandList.displayName = 'SlashCommandList'

// 3. Tiptap SlashCommand Extension
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
          // Edge Case #3: Delete query and insert node in a single atomic transaction
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

// 4. Configure the Suggestion plugin rendering flow using Tippy.js
export const suggestionConfig = {
  items: getSuggestionItems,
  
  // Edge Case #2: Prevent triggering slash menu inside inline code or code blocks
  allow: ({ editor }: { editor: Editor }) => {
    return !editor.isActive('code') && !editor.isActive('codeBlock')
  },

  render: () => {
    let component: ReactRenderer
    let popup: ReturnType<typeof tippy>

    return {
      onStart: (props: SuggestionProps<CommandItem>) => {
        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        // Edge Case #5: Boundary boundaries, flipping mechanics, and placement configuration
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          animation: 'fade',
          duration: 150,
          popperOptions: {
            modifiers: [
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['top-start', 'right-start'],
                  boundary: 'viewport',
                },
              },
              {
                name: 'preventOverflow',
                options: {
                  boundary: 'viewport',
                },
              },
            ],
          },
        })
      },

      onUpdate(props: SuggestionProps<CommandItem>) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        })
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        const listRef = component.ref as { onKeyDown: (props: SuggestionKeyDownProps) => boolean } | null
        return listRef?.onKeyDown(props) ?? false
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}
