"use client"

import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { useUserStore } from "@/lib/store/use-user-store";
import { usePathname } from "next/navigation";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isInitialized } = useUserStore();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
