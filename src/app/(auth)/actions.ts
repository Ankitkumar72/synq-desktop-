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
  const origin = headerList.get('host')
    
  const protocol = origin?.includes('localhost') ? 'http' : 'https'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (origin ? `${protocol}://${origin}` : 'http://localhost:3000')
  const emailRedirectTo = `${siteUrl}/auth/callback`

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
  return signInWithOAuth('google')
}

export async function signInWithGithub() {
  return signInWithOAuth('github')
}

export async function signInWithLinkedin() {
  return signInWithOAuth('linkedin_oidc')
}

export async function signInWithFacebook() {
  return signInWithOAuth('facebook')
}

async function signInWithOAuth(provider: 'google' | 'github' | 'linkedin_oidc' | 'facebook') {
  const supabase = await createClient()
  const headerList = await headers()
  const host = headerList.get('host')
  
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000')
  const redirectTo = `${siteUrl}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
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
