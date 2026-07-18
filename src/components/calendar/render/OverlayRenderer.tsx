
import { DragSessionState } from '../types';


interface OverlayRendererProps {
  session: DragSessionState;
}

export function OverlayRenderer({ session }: OverlayRendererProps) {
  if (session.status !== 'dragging' || !session.previewEvent || !session.pointer) {
    return null;
  }

  return null;
}
