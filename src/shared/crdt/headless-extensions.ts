import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

export function getHeadlessExtensions(ydoc?: Y.Doc) {
  const extensions = [
    StarterKit.configure({
      history: false,
    } as any),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Table,
    TableRow,
    TableHeader,
    TableCell,
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
  ]

  if (ydoc) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
        field: 'content',
      }) as any
    )
  }

  return extensions
}
