import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Basic implementations of clean logic since this script runs independently
function cleanDoubleSerializedString(str: string): string {
  let cleaned = str.trim()
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
      cleaned = cleaned.slice(1, -1).trim()
      break
    }
  }
  return cleaned
}

function extractTextFromNode(node: any): string {
  if (!node) return ''
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

function getPlainTextFromContent(content: any): string {
  if (typeof content === 'string') {
    const cleaned = cleanDoubleSerializedString(content)
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return extractTextFromNode(parsed)
      }
    } catch {
      // ignore
    }
    return cleaned
  }
  if (content && typeof content === 'object' && 'type' in content) {
    return extractTextFromNode(content)
  }
  return ''
}

function stripFormatting(text: string): string {
  if (!text) return ""
  return text
    .replace(/<[^>]*>?/gm, "") // Strip HTML
    .replace(/[#*`_~|]/g, "") // Strip basic markdown and pipes
    .replace(/\s+/g, " ") // Collapse repeated whitespace
    .trim()
}

async function run() {
  dotenv.config({ path: '.env.local' })
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // or service key
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('Fetching notes...')
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, content, body, plain_text, excerpt')

  if (error) {
    console.error('Error fetching notes:', error)
    process.exit(1)
  }

  console.log(`Found ${notes.length} notes. Processing...`)

  let updatedCount = 0

  for (const note of notes) {
    let plainText = ''

    if (note.content) {
      plainText = getPlainTextFromContent(note.content)
    } 
    
    if (!plainText.trim() && note.body) {
      plainText = stripFormatting(note.body)
    }

    if (!plainText.trim()) {
      continue
    }

    const excerpt = plainText.length > 100 ? `${plainText.slice(0, 100)}...` : plainText

    // Only update if it actually needs updating
    if (note.plain_text !== plainText || note.excerpt !== excerpt) {
      const { error: updateError } = await supabase
        .from('notes')
        .update({ plain_text: plainText, excerpt: excerpt })
        .eq('id', note.id)

      if (updateError) {
        console.error(`Error updating note ${note.id}:`, updateError)
      } else {
        updatedCount++
      }
    }
  }

  console.log(`Finished! Updated ${updatedCount} notes.`)
}

run().catch(console.error)
