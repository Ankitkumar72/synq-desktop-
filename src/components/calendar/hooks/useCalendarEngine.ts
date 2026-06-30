import { useState, useMemo, useEffect } from 'react';
import { DragController } from '../engine/DragController';
import { SnapEngine } from '../engine/SnapEngine';
import { CoordinateMapper } from '../engine/CoordinateMapper';
import { LayoutEngine } from '../engine/LayoutEngine';
import { DragSessionState } from '../types';

export function useCalendarEngine(options: { hourHeight?: number; columnWidth?: number } = {}) {
  const { hourHeight, columnWidth } = options;
  const mapper = useMemo(
    () => new CoordinateMapper({ hourHeight, columnWidth }), 
    [hourHeight, columnWidth]
  );
  const snapEngine = useMemo(() => new SnapEngine(15), []);
  const dragController = useMemo(() => new DragController(snapEngine, mapper), [snapEngine, mapper]);
  const layoutEngine = useMemo(() => new LayoutEngine(mapper), [mapper]);

  return { mapper, snapEngine, dragController, layoutEngine };
}

export function useDragSession(dragController: DragController) {
  const [session, setSession] = useState<DragSessionState>(dragController.getState());

  useEffect(() => {
    return dragController.subscribe(setSession);
  }, [dragController]);

  return session;
}
