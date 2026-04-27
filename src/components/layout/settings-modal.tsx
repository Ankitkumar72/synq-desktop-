"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUserStore } from "@/lib/store/use-user-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { useProfileStore } from "@/lib/store/use-profile-store"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { getUserDisplayName, getUserInitials } from "@/lib/user-utils"
import { signOut } from "@/app/(auth)/actions"
import { getDeviceId } from '@/lib/device-manager'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { 
  User, 
  Settings as SettingsIcon, 
  Bell, 
  ShieldCheck, 
  Users, 
  Download, 
  Link as LinkIcon,
  Monitor,
  X,
  LogOut
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

type Tab = "account" | "preferences" | "notifications" | "connections" | "people" | "import"

export function SettingsModal() {
  const { user } = useUserStore()
  const { isSettingsOpen, setSettingsOpen } = useUIStore()
  const { planTier, isPro, isAdmin } = useProfileStore()
  const { stats } = useDashboardData()
  const [activeTab, setActiveTab] = React.useState<Tab>("account")

  const name = getUserDisplayName(user)
  const initials = getUserInitials(user)
  
  const joinDate = React.useMemo(() => {
    if (!user?.created_at) return 'Recently'
    return format(new Date(user.created_at), 'MMMM yyyy')
  }, [user])

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[1000px] p-0 h-[700px] flex flex-col overflow-hidden bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] rounded-2xl outline-none transition-all duration-300">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        
        {/* Subtle Inner Glow */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)]" />

        <div className="flex h-full w-full relative z-10">
          {/* Sidebar */}
          <div className="w-[240px] border-r border-white/[0.04] flex flex-col shrink-0 h-full bg-[#111111]/50 backdrop-blur-xl">
            <div className="px-3 py-4 flex flex-col h-full">
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-bold text-[#505050] uppercase tracking-[0.15em] px-3 mb-3">
                    Account
                  </div>
                  <nav className="space-y-0.5">
                    <TabButton
                      active={activeTab === "account"}
                      onClick={() => setActiveTab("account")}
                      icon={User}
                      label="Account"
                    />
                    <TabButton
                      active={activeTab === "preferences"}
                      onClick={() => setActiveTab("preferences")}
                      icon={SettingsIcon}
                      label="Preferences"
                    />
                    <TabButton
                      active={activeTab === "notifications"}
                      onClick={() => setActiveTab("notifications")}
                      icon={Bell}
                      label="Notifications"
                    />
                    <TabButton
                      active={activeTab === "connections"}
                      onClick={() => setActiveTab("connections")}
                      icon={LinkIcon}
                      label="Connections"
                    />
                  </nav>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#505050] uppercase tracking-[0.15em] px-3 mb-3">
                    Workspace
                  </div>
                  <nav className="space-y-0.5">
                    <TabButton
                      active={activeTab === "people"}
                      onClick={() => setActiveTab("people")}
                      icon={Users}
                      label="People"
                    />
                    <TabButton
                      active={activeTab === "import"}
                      onClick={() => setActiveTab("import")}
                      icon={Download}
                      label="Import"
                    />
                  </nav>
                </div>
              </div>

              <div className="mt-auto px-3 pb-2">
                <button 
                  onClick={() => signOut(getDeviceId())}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold text-red-400/80 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 group"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col h-full bg-[#191919] overflow-hidden relative">
            <button 
              onClick={() => setSettingsOpen(false)}
              className="absolute top-6 right-6 p-2 text-[#505050] hover:text-white rounded-xl hover:bg-white/5 transition-all duration-200 z-10 group"
            >
              <X className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
            </button>

            <ScrollArea className="flex-1 w-full h-full">
              <div className="p-12 max-w-[700px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {activeTab === "preferences" && (
                      <div className="space-y-8">
                        <header className="space-y-1">
                          <h2 className="text-[28px] font-bold text-white tracking-tight">Preferences</h2>
                          <p className="text-[14px] text-[#808080]">Choose how you want Synq to look and behave</p>
                        </header>
                        
                        <div className="space-y-12">
                          <section className="space-y-4">
                            <h3 className="text-[14px] font-bold text-[#505050] uppercase tracking-[0.1em]">Appearance</h3>
                            <div className="p-6 rounded-2xl border border-white/[0.04] bg-[#111111] space-y-6 shadow-xl">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-[15px] font-bold text-white tracking-tight">Theme</p>
                                  <p className="text-[13px] text-[#606060]">Choose a theme for Synq on this device</p>
                                </div>
                                <div className="bg-[#1A1A1A] border border-white/[0.08] rounded-lg px-4 py-2 text-[13px] font-bold text-white flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
                                  Dark
                                  <Monitor className="w-4 h-4 text-[#505050]" />
                                </div>
                              </div>
                            </div>
                          </section>

                          <section className="space-y-4">
                            <h3 className="text-[16px] font-semibold text-white">Input options</h3>
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="text-[14px] font-medium text-white">Use Enter to add a new line</p>
                                <p className="text-[13px] text-[#808080]">Applies to chat, comments, and other input fields. Press Cmd/Ctrl + Enter to send.</p>
                              </div>
                              <div className="w-9 h-5 bg-[#37352f] rounded-full relative cursor-pointer">
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full" />
                              </div>
                            </div>
                          </section>

                          <section className="space-y-4">
                            <h3 className="text-[16px] font-semibold text-white">Language & time</h3>
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-[14px] font-medium text-white">Language</p>
                                  <p className="text-[13px] text-[#808080]">Choose the language you want to use Synq in</p>
                                </div>
                                <div className="bg-[#242424] border border-white/5 rounded-md px-3 py-1.5 text-[13px] text-white flex items-center gap-2">
                                  English (US)
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    )}

                    {activeTab === "account" && (
                      <div className="space-y-8">
                        <header className="space-y-1">
                          <h2 className="text-[28px] font-bold text-white tracking-tight">Account</h2>
                          <p className="text-[14px] text-[#808080]">Manage your profile and session security.</p>
                        </header>
                        
                        <div className="space-y-8">
                          <section className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#111111] p-8 shadow-2xl">
                            {/* Decorative Mesh Gradient Background */}
                            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/10 blur-[80px]" />
                            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-600/5 blur-[80px]" />

                            <div className="relative z-10 flex flex-col gap-8">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-6">
                                  <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                                    <Avatar className="h-20 w-20 rounded-2xl border border-white/10 shadow-2xl relative" size="lg">
                                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={name} loading="eager" />
                                      <AvatarFallback className="rounded-2xl text-2xl font-bold text-[#808080] bg-[#1A1A1A]">
                                        {initials}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="space-y-1">
                                    <h3 className="text-[22px] font-bold text-white tracking-tight leading-none mb-1">
                                      {name}
                                    </h3>
                                    <p className="text-[14px] text-[#808080] font-medium">{user?.email}</p>
                                    <p className="text-[12px] text-[#505050] font-medium flex items-center gap-2 mt-3">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                      Member since {joinDate}
                                    </p>
                                  </div>
                                </div>

                                <Badge className={cn(
                                  "text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 border-none shadow-lg shadow-violet-500/10",
                                  isAdmin ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white" :
                                  isPro ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white" : "bg-[#1A1A1A] text-[#808080]"
                                )}>
                                  {isAdmin ? 'Admin' : planTier.charAt(0).toUpperCase() + planTier.slice(1)}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-8 py-6 border-y border-white/[0.04]">
                                <div className="space-y-2">
                                  <p className="text-[32px] font-bold text-white tracking-tighter tabular-nums leading-none">
                                    {stats.notes.total}
                                  </p>
                                  <p className="text-[10px] font-bold text-[#505050] uppercase tracking-[0.15em]">Notes Created</p>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[32px] font-bold text-white tracking-tighter tabular-nums leading-none">
                                    {stats.tasks.completed + stats.tasks.active}
                                  </p>
                                  <p className="text-[10px] font-bold text-[#505050] uppercase tracking-[0.15em]">Total Tasks</p>
                                </div>
                              </div>
                            </div>
                          </section>
                          
                          <section className="space-y-4">
                            <div className="flex items-center gap-2 text-[#808080]">
                              <ShieldCheck className="w-4 h-4" />
                              <h3 className="text-[14px] font-medium">Security</h3>
                            </div>
                            <div className="p-6 rounded-2xl border border-white/[0.04] bg-[#111111] space-y-4 shadow-xl">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-[15px] font-bold text-white tracking-tight">Active Sessions</p>
                                  <p className="text-[13px] text-[#606060]">Sign out of all other active browser sessions.</p>
                                </div>
                                <Button 
                                  variant="outline"
                                  onClick={() => signOut(getDeviceId())}
                                  className="h-9 px-5 bg-transparent border-white/[0.08] hover:bg-white/[0.02] text-[13px] font-bold text-white transition-all rounded-lg"
                                >
                                  Sign out everywhere
                                </Button>
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    )}

                    {(activeTab === "notifications" || activeTab === "connections" || activeTab === "people" || activeTab === "import") && (
                      <div className="h-[450px] flex flex-col items-center justify-center text-center px-12">
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl" />
                          <div className="relative h-16 w-16 rounded-2xl bg-[#111111] border border-white/[0.04] flex items-center justify-center shadow-2xl">
                            {activeTab === "notifications" && <Bell className="w-7 h-7 text-[#404040]" />}
                            {activeTab === "connections" && <LinkIcon className="w-7 h-7 text-[#404040]" />}
                            {activeTab === "people" && <Users className="w-7 h-7 text-[#404040]" />}
                            {activeTab === "import" && <Download className="w-7 h-7 text-[#404040]" />}
                          </div>
                        </div>
                        <h3 className="text-[18px] font-bold text-white capitalize tracking-tight">{activeTab}</h3>
                        <p className="text-[14px] text-[#606060] mt-2 max-w-[300px] font-medium leading-relaxed">
                          This feature is currently being refined and will be available in an upcoming release.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Footer Info */}
                <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-2 opacity-30">
                  <p className="text-[10px] font-bold text-[#808080] uppercase tracking-[0.2em] font-mono">
                    Synq Desktop v1.0.4-stable
                  </p>
                  <p className="text-[9px] font-medium text-[#505050] font-mono">
                    Device ID: {getDeviceId().substring(0, 8)}...
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ElementType, 
  label: string 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all relative group",
        active
          ? "text-white bg-white/[0.03] shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"
          : "text-[#808080] hover:text-white hover:bg-white/[0.02]"
      )}
    >
      {active && (
        <motion.div
          layoutId="active-tab"
          className="absolute inset-0 bg-white/[0.03] rounded-md"
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        />
      )}
      <Icon className={cn(
        "w-4 h-4 shrink-0 relative z-10",
        active ? "text-white" : "text-[#505050]"
      )} />
      <span className="truncate relative z-10">{label}</span>
    </button>
  )
}
