import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface TrailingNodeOptions {
  node: string
  notAfter: string[]
}

export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: 'customTrailingNode',

  addOptions() {
    return {
      node: 'paragraph',
      notAfter: ['paragraph'],
    }
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name)
    const disabledNodes = Object.entries(this.editor.schema.nodes)
      .map(([, value]) => value)
      .filter(node => this.options.notAfter.includes(node.name))

    return [
      new Plugin({
        key: plugin,
        appendTransaction: (transactions, oldState, newState) => {
          // 1. Only run if editable
          if (!this.editor.isEditable) return

          // 2. Prevent Yjs remote sync transactions from triggering an append (crdt-safe)
          const hasRemoteSync = transactions.some(tr => tr.getMeta('y-sync$'))
          if (hasRemoteSync) return

          const handle = this.options.node
          if (!handle) return

          const docChanges = transactions.some(transaction => transaction.docChanged) && !oldState.doc.eq(newState.doc)
          if (!docChanges) return

          const { doc } = newState
          const { lastChild } = doc

          if (!lastChild) return

          const shouldAppend = !disabledNodes.some(node => node.name === lastChild.type.name)
          if (!shouldAppend) return

          const nodeType = newState.schema.nodes[handle]
          if (!nodeType) return

          return newState.tr.insert(doc.content.size, nodeType.create())
        },
      }),
    ]
  },
})
