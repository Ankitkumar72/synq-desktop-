import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'

import { NoteContent } from '../types'

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

export function cleanDoubleSerializedString(str: string): string {
  let cleaned = str.trim()
  
  // 1. Keep parsing as long as it is double-wrapped with quotes and parses to a string
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) || 
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(cleaned)
      if (typeof parsed === 'string') {
        cleaned = parsed.trim()
      } else {
        break
      }
    } catch {
      // Fallback: manually strip outer quotes
      cleaned = cleaned.slice(1, -1).trim()
      break
    }
  }
  
  // 2. Unescape common JSON escape characters if any literal escape patterns are left
  try {
    if (cleaned.includes('\\')) {
      const parsed = JSON.parse('"' + cleaned.replace(/"/g, '\\"') + '"')
      if (typeof parsed === 'string') {
        cleaned = parsed
      }
    }
  } catch {
    cleaned = cleaned
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
  }
  
  return cleaned
}

export function getEditorContentValue(content: NoteContent): JSONContent | string {
  if (content == null) return createEmptyNoteContent()
  if (typeof content === 'string') {
    const cleaned = cleanDoubleSerializedString(content)
    const parsed = parseStructuredContentFromString(cleaned)
    if (parsed) return parsed
    return cleaned
  }
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
  if (typeof content === 'string') {
    const cleaned = cleanDoubleSerializedString(content)
    const parsed = parseStructuredContentFromString(cleaned)
    if (parsed) return extractTextFromNode(parsed)
    return cleaned
  }
  if (!isStructuredNoteContent(content)) return ''

  return extractTextFromNode(content)
}

function parseStructuredContentFromString(value: string): JSONContent | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const tryParse = (input: string): unknown => {
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  const first = tryParse(trimmed)
  if (!first) return null

  if (isStructuredNoteContent(first)) return first
  if (typeof first === 'string') {
    const second = tryParse(first)
    if (isStructuredNoteContent(second)) return second
  }
  return null
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

export function stripMarkdown(text: string): string {
  if (!text) return ''
  return text
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic (**, __, *, _)
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough (~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove image tags
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .trim()
}
