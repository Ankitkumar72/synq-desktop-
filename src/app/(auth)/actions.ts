'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const headerList = await headers()
  const origin = headerList.get('origin') || headerList.get('host')
    
  const emailRedirectTo = origin 
    ? `${origin.includes('localhost') ? 'http' : 'https'}://${origin.replace(/^https?:\/\//, '')}/auth/callback`
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const fullName = formData.get('full_name') as string

  const { error, data: authData } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
      }
    }
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  // If email confirmation is needed, authData.session will be null
  if (!authData.session) {
    redirect('/login?message=' + encodeURIComponent('Check your email for a confirmation link to complete signup.'))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const headerList = await headers()
  const origin = headerList.get('origin') || headerList.get('host')
  
  // Construct the redirect URL dynamically
  const redirectTo = origin 
    ? `${origin.includes('localhost') ? 'http' : 'https'}://${origin.replace(/^https?:\/\//, '')}/auth/callback`
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut(deviceId?: string) {
  const supabase = await createClient()
  
  // Unregister the device before signing out to free the slot
  if (deviceId) {
    await supabase.rpc('unregister_device', { p_device_id: deviceId })
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
