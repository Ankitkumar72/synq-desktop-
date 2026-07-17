export interface PreviewRect {
  top: number;
  height: number;
  left: number;
  width: number;
}

export interface PreviewModel {
  position: { x: number; y: number } | null;
  ghostRect: PreviewRect | null;
  shadowRect: PreviewRect | null;
  collisionRects: PreviewRect[];
  snapLine: number | null;
  dropTarget: { date: Date } | null;
  warnings: string[];
  cursor: string;
  opacity: number;
  isValid: boolean;
}
