import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
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
import Focus from '@tiptap/extension-focus'
import { TrailingNode } from './trailing-node'
import * as Y from 'yjs'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand, suggestionConfig } from './slash-command'
import { CalloutNode } from './callout-node'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'

const lowlight = createLowlight(common)

export function getEditorExtensions(ydoc?: Y.Doc, provider?: any) {
  const extensions = [
    StarterKit.configure({
      undoRedo: false,
      codeBlock: false, 
      gapcursor: false,
      dropcursor: false,
      link: false,
      underline: false,
      trailingNode: false,
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
    Underline,
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
      resizable: true,
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
      placeholder: ({ node }: any) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        if (node.type.name === 'callout') {
          return 'Type something...'
        }
        if (node.type.name === 'paragraph') {
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
    Focus.configure({
      className: 'is-block-focused',
      mode: 'deepest',
    }),
    TrailingNode,
  ]

  if (ydoc) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
        field: 'content',
      }) as any
    )
  }

  if (provider) {
    extensions.push(
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: 'Anonymous',
          color: '#f783ac',
        },
      }) as any
    )
  }

  return extensions
}
