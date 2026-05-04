"use client"

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import * as React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signup, signInWithGoogle, signInWithGithub, signInWithLinkedin, signInWithFacebook } from '../actions'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

export default function SignupPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SignupContent />
    </React.Suspense>
  )
}

function SignupContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Pane - Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0d1117] p-10 lg:p-14 flex-col justify-between relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <div className="h-10 w-10 relative mb-8">
            <Image
              src="/brand-logo.png"
              alt="Synq Logo"
              fill
              className="object-contain opacity-80"
              quality={100}
              unoptimized
            />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1] max-w-sm">
              Build your workspace in seconds.
            </h1>
            <p className="text-lg lg:text-xl text-stone-400 font-medium max-w-md">
              Join thousands of teams distilled for pure focus and minimalist productivity.
            </p>
          </div>
        </motion.div>

        {/* Central Space */}
        <div className="flex-1">
          {/* Currently Empty */}
        </div>

        <div className="relative z-10 pt-6 border-t border-white/5">
          <div className="flex gap-8 text-[12px] font-medium text-stone-500 uppercase tracking-widest">
            <span>© 2026 Synq </span>
            <Link href="https://synqweb-five.vercel.app/security" className="cursor-pointer hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Security</Link>
            <Link href="https://synqweb-five.vercel.app/privacy" className="cursor-pointer hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Privacy</Link>
          </div>
        </div>
      </div>

      {/* Right Pane - Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 md:p-10 lg:p-12 bg-white">
        <div className="w-full max-w-[440px] space-y-8">
          {/* Logo above the form */}
          <div className="flex justify-center">
            <div className="h-12 w-12 relative">
              <Image
                src="/brand-logo.png"
                alt="Synq Logo"
                fill
                className="object-contain"
                quality={100}
                unoptimized
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-2 text-center"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">Create your account</h2>
            <p className="text-[14px] sm:text-[15px] text-stone-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Sign in to your team
              </Link>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-5"
          >
            {/* Social Signups */}
            <div className="flex justify-center gap-4">
              <form action={signInWithGoogle}>
                <Button
                  variant="outline"
                  type="submit"
                  className="h-14 w-14 rounded-xl border-stone-200 bg-white text-stone-900 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all p-0 flex items-center justify-center shadow-sm active:scale-[0.95] group"
                  title="Continue with Google"
                >
                   <svg className="h-7 w-7 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                </Button>
              </form>
              <form action={signInWithGithub}>
                <Button
                  variant="outline"
                  type="submit"
                  className="h-14 w-14 rounded-xl border-stone-200 bg-white text-stone-900 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all p-0 flex items-center justify-center shadow-sm active:scale-[0.95] group"
                  title="Continue with Github"
                >
                  <svg className="h-7 w-7 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                </Button>
              </form>
              <form action={signInWithLinkedin}>
                <Button
                  variant="outline"
                  type="submit"
                  className="h-14 w-14 rounded-xl border-stone-200 bg-white text-stone-900 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all p-0 flex items-center justify-center shadow-sm active:scale-[0.95] group"
                  title="Continue with LinkedIn"
                >
                  <svg className="h-7 w-7 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </Button>
              </form>
              <form action={signInWithFacebook}>
                <Button
                  variant="outline"
                  type="submit"
                  className="h-14 w-14 rounded-xl border-stone-200 bg-white text-stone-900 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all p-0 flex items-center justify-center shadow-sm active:scale-[0.95] group"
                  title="Continue with Facebook"
                >
                  <svg className="h-7 w-7 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </Button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-stone-100" />
              </div>
              <div className="relative flex justify-center text-[12px] uppercase tracking-widest text-stone-400 font-bold">
                <span className="bg-white px-6">or email signup</span>
              </div>
            </div>

            {/* Email Form */}
            <form action={signup} className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="full_name" className="text-sm font-bold text-stone-700 ml-1">Full Name</label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    placeholder="John Doe"
                    required
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-14 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-bold text-stone-700 ml-1">Email address</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-14 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-bold text-stone-700 ml-1">Password</label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                    required
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-14 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
                  />
                  <p className="text-[12px] text-stone-400 ml-1 italic">Minimum 8 characters with a mix of letters and numbers.</p>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-red-600 text-[13px] bg-red-50 border border-red-100 p-4 rounded-xl text-center font-medium shadow-sm"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full h-14 bg-stone-900 text-white hover:bg-stone-800 transition-all font-bold rounded-xl text-[16px] shadow-lg shadow-stone-200 active:scale-[0.98]"
              >
                Create Account
              </Button>
            </form>
          </motion.div>

          <div className="pt-6 text-center border-t border-stone-100">
            <p className="text-[11px] sm:text-[12px] text-stone-400 font-medium leading-relaxed">
              By creating an account, you agree to our <Link href="https://synqweb-five.vercel.app/terms" className="underline cursor-pointer" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and <Link href="https://synqweb-five.vercel.app/privacy" className="underline cursor-pointer" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
