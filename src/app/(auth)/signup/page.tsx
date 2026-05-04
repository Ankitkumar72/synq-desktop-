"use client"

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import * as React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signup, signInWithGoogle } from '../actions'
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
            <form action={signInWithGoogle}>
              <Button
                variant="outline"
                type="submit"
                className="w-full h-13 border-stone-200 bg-white hover:bg-stone-50 transition-all text-stone-700 font-bold rounded-xl text-[15px] shadow-sm flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg className="h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="#4285F4" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
                Sign up with Google
              </Button>
            </form>

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
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-12 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
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
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-12 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
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
                    className="!bg-white text-black placeholder:text-stone-400 border-stone-200 h-12 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:border-blue-600 text-[15px] transition-all"
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
                className="w-full h-12 bg-stone-900 text-white hover:bg-stone-800 transition-all font-bold rounded-xl text-[16px] shadow-lg shadow-stone-200 active:scale-[0.98]"
              >
                Create Account
              </Button>
            </form>
          </motion.div>

          <div className="pt-6 text-center border-t border-stone-100">
            <p className="text-[11px] sm:text-[12px] text-stone-400 font-medium leading-relaxed">
              By creating an account, you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
