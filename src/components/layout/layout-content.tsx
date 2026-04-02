"use client"

import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { PanelLeft } from "lucide-react";
import { useUIStore } from "@/lib/store/use-ui-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-40">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              className="h-9 w-9 text-stone-400 hover:text-stone-900 transition-all hover:bg-stone-50 rounded-lg"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
          </div>
        )}
        <Navbar />
        <main className={cn(
          "flex-1 overflow-y-auto bg-stone-50/50",
          !isSidebarOpen && "pt-0"
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
