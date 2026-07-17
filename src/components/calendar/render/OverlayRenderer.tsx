import { createPortal } from 'react-dom';
import { DragSessionState } from '../types';
import { cn } from "@/lib/utils";

interface OverlayRendererProps {
  session: DragSessionState;
}

export function OverlayRenderer({ session }: OverlayRendererProps) {
  if (session.status !== 'dragging' || !session.previewEvent || !session.pointer) {
    return null;
  }

  return null;
}
