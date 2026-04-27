"use client"

import { useUserStore } from '@/lib/store/use-user-store'
import { signOut } from '@/app/(auth)/actions'
import { getDeviceId } from '@/lib/device-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LogOut, User as UserIcon, Settings } from 'lucide-react'
import { useUIStore } from '@/lib/store/use-ui-store'
import { useProfileStore } from '@/lib/store/use-profile-store'
import { getUserDisplayName, getUserInitials } from '@/lib/user-utils'
import { Badge } from '@/components/ui/badge'

export function UserNav() {
  const { user } = useUserStore()
  const { openSettings } = useUIStore()
  const { planTier, isAdmin } = useProfileStore()

  if (!user) return null


  const name = getUserDisplayName(user)
  const initials = getUserInitials(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "relative h-8 w-8 rounded-full p-0")}>
        <Avatar className="h-8 w-8 border border-white/5">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={name} loading="eager" />
          <AvatarFallback className="bg-secondary text-[10px] font-bold">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold leading-none text-white">
                {name}
              </p>
              <Badge className={cn(
                "text-[9px] h-4 px-1.5 font-bold uppercase tracking-widest border-none",
                isAdmin ? "bg-purple-500/20 text-purple-400" :
                planTier === "pro" ? "bg-blue-500/20 text-blue-400" : "bg-stone-500/20 text-stone-400"
              )}>
                {isAdmin ? 'Admin' : planTier.charAt(0).toUpperCase() + planTier.slice(1)}
              </Badge>
            </div>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={openSettings}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={openSettings}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => signOut(getDeviceId())}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
