"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { useUserStore } from "@/lib/store/use-user-store"
import { signOut } from "@/app/(auth)/actions"
import { getDeviceId } from '@/lib/device-manager'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { User, Monitor, Bell, ShieldCheck } from "lucide-react"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = "account" | "appearance" | "notifications"

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user } = useUserStore()
  const [activeTab, setActiveTab] = React.useState<Tab>("account")

  const initials = (user?.user_metadata?.full_name || user?.email)
    ?.split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() ?? "U"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 h-[650px] flex flex-col overflow-hidden bg-[#0B0B0B] border-white/5 shadow-2xl shadow-black/50 rounded-lg">
        <div className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-[240px] border-r border-white/5 flex flex-col shrink-0 h-full bg-black/20">
            <div className="px-6 py-8">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-widest px-2 mb-4">
                User Settings
              </div>
              <nav className="space-y-0.5">
                <TabButton
                  active={activeTab === "account"}
                  onClick={() => setActiveTab("account")}
                  icon={User}
                  label="Account"
                />
                <TabButton
                  active={activeTab === "appearance"}
                  onClick={() => setActiveTab("appearance")}
                  icon={Monitor}
                  label="Appearance"
                />
                <TabButton
                  active={activeTab === "notifications"}
                  onClick={() => setActiveTab("notifications")}
                  icon={Bell}
                  label="Notifications"
                />
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <ScrollArea className="flex-1 w-full h-full [&>div>div]:p-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {activeTab === "account" && (
                    <div className="max-w-xl">
                      <header className="mb-10">
                        <h2 className="text-[18px] font-semibold text-stone-100">Account info</h2>
                        <p className="text-[13px] text-stone-500 mt-1">Manage your profile and session security.</p>
                      </header>
                      
                      <div className="space-y-12">
                        <section className="flex items-center gap-6 p-4 rounded-lg border border-white/5 bg-white/[0.01]">
                          <div className="h-14 w-14 rounded-lg bg-stone-900 border border-white/10 flex items-center justify-center text-lg font-bold text-stone-400">
                            {initials}
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-stone-100">
                              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
                            </p>
                            <p className="text-[13px] text-stone-500">{user?.email}</p>
                          </div>
                        </section>
                        
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-stone-400">
                            <ShieldCheck className="w-4 h-4" />
                            <h3 className="text-[14px] font-medium">Security</h3>
                          </div>
                          <div className="p-6 rounded-lg border border-white/5 bg-white/[0.01] space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[18px] font-medium text-stone-200">Active Sessions</p>
                                <p className="text-[16px] text-stone-500">Sign out of all other active browser sessions.</p>
                              </div>
                              <Button 
                                variant="outline"
                                onClick={() => signOut(getDeviceId())}
                                className="text-[16px] h-10 px-4 bg-black/40 border-white/5 hover:bg-white/5 transition-colors"
                              >
                                Sign out everywhere
                              </Button>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeTab === "appearance" && (
                    <div className="max-w-xl">
                      <header className="mb-10">
                        <h2 className="text-[18px] font-semibold text-stone-100">Appearance</h2>
                        <p className="text-[13px] text-stone-500 mt-1">Personalize how Synq looks on your screen.</p>
                      </header>

                      <section className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="bg-[#0D0D0D] rounded-md h-32 border border-stone-100/20 p-4 space-y-2">
                              <div className="w-3/4 h-2 bg-stone-800 rounded-full" />
                              <div className="w-full h-2 bg-stone-800 rounded-full" />
                            </div>
                            <p className="text-[13px] text-center text-stone-200">Dark mode</p>
                          </div>
                          <div className="space-y-3 opacity-30">
                            <div className="bg-stone-50 rounded-md h-32 border border-transparent p-4 space-y-2">
                              <div className="w-3/4 h-2 bg-stone-200 rounded-full" />
                              <div className="w-full h-2 bg-stone-200 rounded-full" />
                            </div>
                            <p className="text-[13px] text-center text-stone-500">Light mode (Coming soon)</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}

                  {activeTab === "notifications" && (
                    <div className="max-w-xl">
                       <header className="mb-10">
                        <h2 className="text-[18px] font-semibold text-stone-100">Notifications</h2>
                        <p className="text-[13px] text-stone-500 mt-1">Configure your system alert preferences.</p>
                      </header>

                      <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-lg">
                        <Bell className="w-6 h-6 text-stone-800 mb-2" />
                        <p className="text-[11px] font-medium text-stone-600 uppercase tracking-widest">No options available</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
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
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors relative",
        active
          ? "text-white bg-white/5"
          : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
      )}
    >
      <Icon className={cn(
        "w-4 h-4",
        active ? "text-white" : "text-stone-600"
      )} />
      <span>{label}</span>
      
      {active && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute left-0 w-[2px] h-4 bg-white rounded-full"
        />
      )}
    </button>
  )
}
