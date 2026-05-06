import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'

export type NoteContent = JSONContent | string | null

export interface NoteEditorSnapshot {
  content: JSONContent
  body: string | null
  excerpt: string | null
}

const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' }

export function createEmptyNoteContent(): JSONContent {
  return {
    type: 'doc',
    content: [{ ...EMPTY_PARAGRAPH }],
  }
}

export function isStructuredNoteContent(content: unknown): content is JSONContent {
  return Boolean(content) && typeof content === 'object' && !Array.isArray(content) && 'type' in (content as Record<string, unknown>)
}

export function cloneNoteContent<T extends NoteContent>(content: T): T {
  if (content == null || typeof content === 'string') return content
  return JSON.parse(JSON.stringify(content)) as T
}

export function getEditorContentValue(content: NoteContent): JSONContent | string {
  if (content == null) return createEmptyNoteContent()
  return cloneNoteContent(content)
}

export function getComparableNoteContent(content: NoteContent): string {
  if (typeof content === 'string') return content
  return JSON.stringify(content ?? createEmptyNoteContent())
}

export function buildExcerpt(plainText: string) {
  if (!plainText) return null
  return plainText.length > 100 ? `${plainText.slice(0, 100)}...` : plainText
}

export function createNoteContentFromText(text: string | null | undefined): JSONContent {
  const normalized = (text || '').replace(/\r\n/g, '\n')

  if (!normalized) {
    return createEmptyNoteContent()
  }

  return {
    type: 'doc',
    content: normalized.split('\n').map((line) => (
      line
        ? {
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
          }
        : { ...EMPTY_PARAGRAPH }
    )),
  }
}

export function getPlainTextFromStoredContent(content: NoteContent): string {
  if (typeof content === 'string') return content
  if (!isStructuredNoteContent(content)) return ''

  return extractTextFromNode(content)
}

function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text') return node.text || ''

  const children = (node.content || []).map(extractTextFromNode)

  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote' || node.type === 'listItem') {
    return children.join('')
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'doc') {
    return children.join('\n\n')
  }

  return children.join('')
}

export function createNoteEditorSnapshot(editor: Editor): NoteEditorSnapshot {
  const content = editor.getJSON()
  const plainText = editor.getText({ blockSeparator: '\n\n' }).trim()

  return {
    content,
    body: plainText || null,
    excerpt: buildExcerpt(plainText),
  }
}
