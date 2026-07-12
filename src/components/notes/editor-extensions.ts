import StarterKit from '@tiptap/starter-kit'

import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import GapCursor from '@tiptap/extension-gapcursor'
import Dropcursor from '@tiptap/extension-dropcursor'
import { TrailingNode } from './trailing-node'

import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand, suggestionConfig } from './slash-command'
import { CalloutNode } from './callout-node'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'

const lowlight = createLowlight(common)

export function getEditorExtensions() {
  const extensions = [
    StarterKit.configure({
      undoRedo: false,
      codeBlock: false, 
      gapcursor: false,
      dropcursor: false,
      trailingNode: false,
      link: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'typescript',
      HTMLAttributes: {
        class: 'hljs',
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-[#2eaadc] underline hover:text-[#2eaadc]/80 transition-colors cursor-pointer',
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Image.configure({
      allowBase64: true,
    }),
    Table.configure({
      resizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TextAlign.configure({
      types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    Placeholder.configure({
      placeholder: ({ node, editor }: any) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        if (node.type.name === 'callout') {
          return 'Type something...'
        }
        if (node.type.name === 'paragraph') {
          // Check if the note body is essentially empty (only heading + empty paragraph(s))
          const doc = editor.state.doc
          let hasNonHeadingContent = false
          doc.forEach((child: any) => {
            if (child.type.name !== 'heading' && child.type.name !== 'paragraph') {
              hasNonHeadingContent = true
            } else if (child.type.name === 'paragraph' && child.textContent.length > 0) {
              hasNonHeadingContent = true
            }
          })
          if (!hasNonHeadingContent) {
            return 'Start writing...'
          }
          return "Type '/' for commands"
        }
        if (node.type.name === 'codeBlock') {
          return '// Write code...'
        }

        return ""
      },
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: true,
    }),
    CalloutNode,
    SlashCommand.configure({
      suggestion: suggestionConfig,
    }),


    GlobalDragHandle.configure({
      dragHandleWidth: 20,
      scrollTreshold: 100,
    }),
    GapCursor,
    Dropcursor.configure({
      color: '#2eaadc',
      width: 2,
    }),
    TrailingNode,
  ]

  const uniqueExtensions = []
  const names = new Set()
  for (const ext of extensions) {
    const name = ext?.name || ext?.config?.name
    if (name) {
      if (!names.has(name)) {
        names.add(name)
        uniqueExtensions.push(ext)
      }
    } else {
      uniqueExtensions.push(ext)
    }
  }

  return uniqueExtensions
}
