"use client"

import { useEffect, useState } from "react"
import { supabase } from "@synq/shared"
import { useUserStore } from "@synq/shared"
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from "@/components/ui/avatar"

interface PresenceUser {
  userId: string
  name: string
  avatarUrl: string
  color: string
}

// Map user ID to a premium UI accent color
const COLORS = [
  "text-blue-400 bg-blue-500/10 ring-blue-500/30",
  "text-purple-400 bg-purple-500/10 ring-purple-500/30",
  "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
  "text-amber-400 bg-amber-500/10 ring-amber-500/30",
  "text-rose-400 bg-rose-500/10 ring-rose-500/30",
  "text-indigo-400 bg-indigo-500/10 ring-indigo-500/30",
  "text-pink-400 bg-pink-500/10 ring-pink-500/30",
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function ActivePresenceAvatars({ noteId }: { noteId: string }) {
  const { user } = useUserStore()
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!user || !supabase) return

    const channel = supabase.channel(`presence:note:${noteId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Collaborator"
    const avatarUrl = user.user_metadata?.avatar_url || ""

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState()
        const users: PresenceUser[] = []
        
        Object.keys(presenceState).forEach((key) => {
          const presenceList = presenceState[key] as unknown as Array<{
            userId: string
            name: string
            avatarUrl: string
            color: string
          }>
          if (presenceList && presenceList[0]) {
            // Only add other users (don't show our own avatar to keep clean)
            if (presenceList[0].userId !== user.id) {
              users.push(presenceList[0])
            }
          }
        })
        
        setActiveUsers(users)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            name,
            avatarUrl,
            color: getUserColor(user.id),
          })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [noteId, user])

  if (activeUsers.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <AvatarGroup className="-space-x-1.5 flex items-center justify-end">
        {activeUsers.map((activeUser) => {
          const initials = activeUser.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()

          return (
            <Avatar
              key={activeUser.userId}
              className={`w-[26px] h-[26px] ring-2 ring-[#121212] border-none text-[9px] font-bold ${activeUser.color}`}
              title={`${activeUser.name} is viewing this note`}
            >
              <AvatarImage src={activeUser.avatarUrl} alt={activeUser.name} />
              <AvatarFallback className="bg-neutral-800 text-neutral-400 font-semibold">{initials}</AvatarFallback>
            </Avatar>
          )
        })}
      </AvatarGroup>
      <span className="text-[10px] text-neutral-500 font-medium ml-1">
        editing
      </span>
    </div>
  )
}
