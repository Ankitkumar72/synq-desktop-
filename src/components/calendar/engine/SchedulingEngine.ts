import { CalendarItem } from '../types';
import { SchedulingIntent } from './SchedulingIntent';
import { ProposalNormalizer } from './ProposalNormalizer';
import { SnapPolicy, SnapInterval } from './SnapPolicy';
import { ConstraintEngine, ConstraintSeverity } from './ConstraintEngine';
import { RepairEngine } from './RepairEngine';
import { PreviewModel } from './PreviewModel';
import { CoordinateMapper } from './CoordinateMapper';

export class SchedulingEngine {
  private constraintEngine: ConstraintEngine;
  private snapPolicy: SnapPolicy;

  constructor(
    private mapper: CoordinateMapper,
    options: { intervalMinutes?: SnapInterval } = {}
  ) {
    this.constraintEngine = new ConstraintEngine();
    this.snapPolicy = new SnapPolicy(options.intervalMinutes || 15);
  }

  getSnapPolicy(): SnapPolicy {
    return this.snapPolicy;
  }

  getConstraintEngine(): ConstraintEngine {
    return this.constraintEngine;
  }

  /**
   * Processes a scheduling intent:
   * - Normalizes proposed times (removes milliseconds, handles inverted dates, etc.)
   * - Applies snapping using SnapPolicy
   * - Checks constraints using ConstraintEngine
   * - Calls RepairEngine to fix repairable issues
   * - Generates and returns the final times and a rich PreviewModel
   */
  process(
    intent: SchedulingIntent,
    originalItem: CalendarItem,
    allColumns: any[]
  ): { start: Date; end: Date; preview: PreviewModel } {
    const snapInterval = this.snapPolicy.getIntervalMinutes();

    // 1. Normalize and snap the proposal
    const { start: normalizedStart, end: normalizedEnd } = ProposalNormalizer.normalize(intent, {
      intervalMinutes: snapInterval,
    });

    // 2. Validate proposal using ConstraintEngine
    let constraintResults = this.constraintEngine.validate(
      normalizedStart,
      normalizedEnd,
      originalItem,
      intent
    );

    // 3. Repair if repairable problems are found
    let finalStart = normalizedStart;
    let finalEnd = normalizedEnd;

    const hasRepairable = constraintResults.some(r => r.severity === ConstraintSeverity.REPAIRABLE);
    if (hasRepairable) {
      const repaired = RepairEngine.repair(normalizedStart, normalizedEnd, originalItem, intent);
      finalStart = repaired.start;
      finalEnd = repaired.end;

      // Re-validate repaired times
      constraintResults = this.constraintEngine.validate(finalStart, finalEnd, originalItem, intent);
    }

    // 4. Categorize results: Error blocks commit, Warning warns but permits
    const isError = constraintResults.some(r => r.severity === ConstraintSeverity.ERROR);
    const warnings = constraintResults
      .filter(r => r.severity === ConstraintSeverity.WARNING)
      .map(r => r.reason || 'Scheduling warning');

    // 5. Generate PreviewModel coordinates using CoordinateMapper
    const yTop = this.mapper.timeToPixel(finalStart);
    const yBottom = this.mapper.timeToPixel(finalEnd);
    const height = Math.max(15, yBottom - yTop); // Enforce min visual height of 15px

    // Find matching column
    const targetCol = allColumns.find(col => {
      const d1 = new Date(col.date);
      return d1.getFullYear() === finalStart.getFullYear() &&
             d1.getMonth() === finalStart.getMonth() &&
             d1.getDate() === finalStart.getDate();
    });

    const ghostRect = targetCol
      ? {
          top: yTop,
          height: height,
          left: 0,
          width: 100,
        }
      : null;

    const preview: PreviewModel = {
      position: null, // Position will be supplemented by Interaction/DragController
      ghostRect,
      shadowRect: ghostRect,
      collisionRects: [],
      snapLine: yTop,
      dropTarget: targetCol ? { date: targetCol.date } : null,
      warnings,
      cursor: isError ? 'not-allowed' : (intent.type === 'resize' ? 'ns-resize' : 'grabbing'),
      opacity: isError ? 0.4 : 0.8,
      isValid: !isError,
    };

    return {
      start: finalStart,
      end: finalEnd,
      preview,
    };
  }
}
