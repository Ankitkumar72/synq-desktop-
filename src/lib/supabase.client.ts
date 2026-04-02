import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Only initialize if we have a valid-looking URL
const isConfigured = supabaseUrl && supabaseUrl.startsWith('http') && supabaseUrl !== 'your-project-url'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: any = null

if (isConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e)
  }
}

export const supabase = supabaseClient
