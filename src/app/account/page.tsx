"use client"

import { useMemo } from "react"
import { useUserStore } from "@/lib/store/use-user-store"
import { useProfileStore } from "@/lib/store/use-profile-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { getUserDisplayName } from "@/lib/user-utils"
import { AnimatePage } from "@/components/layout/animate-page"
import { Button } from "@/components/ui/button"
import { 
  User, 
  Settings, 
  Shield, 
  CreditCard, 
  LogOut, 
  Mail, 
  TrendingUp,
  Zap,
  ChevronRight
} from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase.client"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function AccountPage() {
  const router = useRouter()
  const { user } = useUserStore()
  const { planTier, isPro } = useProfileStore()
  const { stats } = useDashboardData()

  const handleLogout = async () => {
    // Clear all stores to prevent cross-account data leaks
    useNotesStore.getState().clearStore()
    useTaskStore.getState().clearStore()
    useEventStore.getState().clearStore()
    useProfileStore.getState().resetProfile()
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  const joinDate = useMemo(() => {
    if (!user?.created_at) return 'Recently'
    return format(new Date(user.created_at), 'MMMM yyyy')
  }, [user])

  const name = getUserDisplayName(user)
  const email = user?.email || "No email provided"

  return (
    <AnimatePage>
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#08090a]">
        <div className="max-w-[800px] mx-auto p-6 md:p-12 space-y-12">
          
          {/* Profile Section */}
          <section className="flex flex-col items-center text-center space-y-6 pt-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {user?.user_metadata?.avatar_url ? (
                  <Image 
                    src={user.user_metadata.avatar_url} 
                    alt={name} 
                    width={96} 
                    height={96} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-10 h-10 text-stone-600" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-white">{name}</h1>
              <div className="flex items-center justify-center gap-2 text-stone-500 font-mono text-[11px] uppercase tracking-widest">
                <Mail className="w-3 h-3" />
                {email}
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="h-9 px-4 bg-white/[0.03] border-white/10 hover:bg-white/10 text-[12px] font-bold rounded-xl gap-2 font-mono uppercase tracking-widest">
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="h-9 px-4 bg-red-500/5 border-red-500/10 hover:bg-red-500/10 text-red-400 text-[12px] font-bold rounded-xl gap-2 font-mono uppercase tracking-widest"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </div>
          </section>

          {/* Account Details Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Membership Card */}
            <div className="bg-[#121314] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 font-mono">Membership</span>
                  <div className={isPro ? "px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest font-mono" : "px-2 py-0.5 bg-stone-500/10 text-stone-400 border border-stone-500/20 rounded text-[9px] font-bold uppercase tracking-widest font-mono"}>
                    {planTier.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Synq {isPro ? 'Professional' : 'Starter'}</h3>
                  <p className="text-[12px] text-stone-500 font-medium">Member since {joinDate}</p>
                </div>
              </div>
              <Button className="w-full h-10 bg-white text-black hover:bg-stone-200 text-[12px] font-bold rounded-xl gap-2">
                <Zap className="w-4 h-4 fill-current" />
                {isPro ? 'Manage Subscription' : 'Upgrade to Pro'}
              </Button>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-[#121314] border border-white/[0.08] rounded-2xl p-6 space-y-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 font-mono">Activity Summary</span>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[24px] font-bold text-white tabular-nums">{stats.tasks.completed + stats.tasks.active}</span>
                  <p className="text-[9px] font-bold text-stone-600 uppercase tracking-widest font-mono text-center md:text-left">Life-time Tasks</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[24px] font-bold text-white tabular-nums">{stats.notes.total}</span>
                  <p className="text-[9px] font-bold text-stone-600 uppercase tracking-widest font-mono text-center md:text-left">Notes Created</p>
                </div>
              </div>
              <div className="pt-4 border-t border-white/[0.03]">
                 <div className="flex items-center justify-between group cursor-pointer hover:text-white transition-colors">
                    <span className="text-[11px] font-bold text-stone-500 group-hover:text-white font-mono uppercase tracking-widest">View Analytics</span>
                    <TrendingUp className="w-4 h-4 text-stone-700 group-hover:text-blue-500 transition-all" />
                 </div>
              </div>
            </div>
          </section>

          {/* Secondary Settings */}
          <section className="space-y-6">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.3em] text-stone-700 font-mono px-2">Account Security & Access</h2>
            <div className="space-y-2">
              {[
                { title: 'Security & Password', icon: Shield, description: 'Manage your authentication methods' },
                { title: 'Billing & Payments', icon: CreditCard, description: 'View invoices and payment history' },
                { title: 'Connected Apps', icon: Zap, description: 'Manage third-party integrations' },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <item.icon className="w-5 h-5 text-stone-600 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-bold text-stone-200 group-hover:text-white">{item.title}</h4>
                      <p className="text-[11px] text-stone-600">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-800 group-hover:text-white translate-x-[-10px] opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-12 pb-8 flex flex-col items-center gap-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-800 font-mono">
              Synq Version 1.0.4-stable
            </p>
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-stone-900 font-mono">
              User ID: {user?.id}
            </p>
          </footer>

        </div>
      </div>
    </AnimatePage>
  )
}
