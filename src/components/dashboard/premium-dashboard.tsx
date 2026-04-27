"use client"

import React from 'react';
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, children, className }) => (
  <div className={cn("bg-[#171717] rounded-2xl p-6 flex flex-col border border-[#2E2E2E]", className)}>
    <h3 className="text-white text-[18px] font-semibold mb-4 tracking-tight">{title}</h3>
    <div className="flex-grow">{children}</div>
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
