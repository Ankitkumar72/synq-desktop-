"use client"

import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { useUserStore } from "@/lib/store/use-user-store";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isInitialized, setInitialized } = useUserStore();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/signup";

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
              Initialization is taking longer than expected. This could be due to a slow network or server connection.
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <Navbar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
