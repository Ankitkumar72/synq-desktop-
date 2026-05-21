import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalloutView } from './callout-view'

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /**
       * Toggle a callout box
       */
      toggleCallout: (attributes?: { emoji?: string; color?: string }) => ReturnType
    }
  }
}

export const CalloutNode = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+', // Allows paragraphs inside the callout box
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: element => element.getAttribute('data-emoji') || '💡',
        renderHTML: attributes => ({ 'data-emoji': attributes.emoji }),
      },
      color: {
        default: 'gray',
        parseHTML: element => element.getAttribute('data-color') || 'gray',
        renderHTML: attributes => ({ 'data-color': attributes.color }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'callout' }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },

  addCommands() {
    return {
      toggleCallout:
        attributes =>
        ({ commands }) => {
          return commands.toggleWrap('callout', attributes)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { $from } = selection

        // Edge Case #4: If the cursor is at the very beginning of a paragraph inside a callout,
        // and it is empty, unwrap (lift) it to turn it back to a standard top-level paragraph.
        if (
          $from.parent.type.name === 'paragraph' &&
          $from.depth > 1 &&
          $from.node($from.depth - 1)?.type.name === 'callout'
        ) {
          const grandparent = $from.node($from.depth - 1)
          if (
            $from.parentOffset === 0 &&
            grandparent.childCount === 1 &&
            $from.parent.textContent.length === 0
          ) {
            return editor.chain().lift('callout').run()
          }
        }
        return false
      },
    }
  },
})
