"use client"

import { LinearSidebar } from "@/components/layout/sidebar";
import { useUserStore } from "@/lib/store/use-user-store";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SettingsModal } from "@/components/layout/settings-modal";
import { SearchCommand } from "@/components/layout/search-command";
import { useUIStore } from "@/lib/store/use-ui-store";
import { QuickCreateModal } from "@/components/layout/quick-create";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isInitialized, setInitialized } = useUserStore();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const { openSearch, isCreateOpen, setCreateOpen, createType } = useUIStore();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  useEffect(() => {
    if (!isInitialized) {
      const timer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 8000); // 8 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isInitialized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center space-y-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        
        {showTimeoutMessage && (
          <div className="space-y-4 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-sm text-muted-foreground font-medium">
              Initialization is taking longer than expected.
            </p>
            <button 
              onClick={() => setInitialized(true)}
              className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Force Enter Anyway
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-sidebar overflow-hidden select-none">
      <LinearSidebar />
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <main className="flex-1 overflow-hidden bg-background flex flex-col">
          {children}
        </main>
      </div>
      <SettingsModal />
      <SearchCommand />
      <QuickCreateModal 
        open={isCreateOpen} 
        onOpenChange={setCreateOpen}
        defaultType={createType}
        trigger={null}
      />
    </div>
  )
}
