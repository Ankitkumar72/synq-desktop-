import { createPortal } from 'react-dom';
import { DragSessionState } from '../types';
import { cn } from "@/lib/utils";

interface OverlayRendererProps {
  session: DragSessionState;
}

export function OverlayRenderer({ session }: OverlayRendererProps) {
  if (session.status === 'idle' || !session.previewEvent || !session.pointer) {
    return null;
  }

  // Very basic preview renderer following pointer
  const preview = (
    <div 
      className={cn(
        "fixed pointer-events-none z-50 rounded-lg border-l-[3px] p-2.5 shadow-2xl opacity-80 backdrop-blur-sm",
        session.previewEvent.type === 'event' 
          ? "bg-[#4285F4]/20 border-[#4285F4]" 
          : "bg-[#039BE5]/20 border-[#039BE5]"
      )}
      style={{
        left: session.pointer.x + 15,
        top: session.pointer.y + 15,
        width: 200,
        height: 60,
      }}
    >
      <span className={cn(
        "text-[11px] font-bold leading-tight line-clamp-2 uppercase tracking-tight",
        session.previewEvent.type === 'event' ? "text-[#4285F4]" : "text-[#039BE5]"
      )}>
        {session.previewEvent.title}
      </span>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(preview, document.body);
}
