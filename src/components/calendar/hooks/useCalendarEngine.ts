import { useState, useMemo, useEffect } from 'react';
import { DragController } from '../engine/DragController';
import { SchedulingEngine } from '../engine/SchedulingEngine';
import { CoordinateMapper } from '../engine/CoordinateMapper';
import { LayoutEngine } from '../engine/LayoutEngine';
import { DragSessionState } from '../types';

export function useCalendarEngine(options: { hourHeight?: number; columnWidth?: number } = {}) {
  const { hourHeight, columnWidth } = options;
  const mapper = useMemo(
    () => new CoordinateMapper({ hourHeight, columnWidth }), 
    [hourHeight, columnWidth]
  );
  const schedulingEngine = useMemo(() => new SchedulingEngine(mapper, { intervalMinutes: 15 }), [mapper]);
  const dragController = useMemo(() => new DragController(schedulingEngine, mapper), [schedulingEngine, mapper]);
  const layoutEngine = useMemo(() => new LayoutEngine(mapper), [mapper]);

  return { mapper, schedulingEngine, dragController, layoutEngine, snapEngine: schedulingEngine.getSnapPolicy() };
}

export function useDragSession(dragController: DragController) {
  const [session, setSession] = useState<DragSessionState>(dragController.getState());

  useEffect(() => {
    return dragController.subscribe(setSession);
  }, [dragController]);

  return session;
}
