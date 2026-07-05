"use client"

import React from 'react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  href?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, href, headerAction, children, className }) => (
  <div className={cn("bg-[#171717] rounded-2xl p-5 flex flex-col border border-[#2E2E2E]", className)}>
    <div className="flex items-center justify-between mb-3">
      {href ? (
        <Link href={href} className="w-fit flex items-center gap-1 group">
          <h3 className="text-white text-[16px] font-semibold tracking-tight">{title}</h3>
          <ChevronRight className="w-4 h-4 text-[#808080] opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ) : (
        <h3 className="text-white text-[16px] font-semibold tracking-tight">{title}</h3>
      )}
      {headerAction && <div>{headerAction}</div>}
    </div>
    <div className="flex-grow min-h-0 overflow-hidden">{children}</div>
  </div>
);

export const QuickActionButton: React.FC<{ label: string, icon: string | React.ReactNode, onClick?: () => void }> = ({ label, icon, onClick }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-1.5 bg-[#242424] text-white rounded-full text-[13px] hover:bg-[#333] transition-all border border-white/5 active:scale-95"
  >
    <span className="flex items-center justify-center">{icon}</span> {label}
  </button>
);
