import { CalendarItem } from '../types';
import { SchedulingIntent } from './SchedulingIntent';

export enum ConstraintSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  REPAIRABLE = "REPAIRABLE",
  ERROR = "ERROR"
}

export interface ConstraintResult {
  severity: ConstraintSeverity;
  reason?: string;
}

export interface SchedulingConstraint {
  name: string;
  validate(
    start: Date,
    end: Date,
    originalItem: CalendarItem,
    intent: SchedulingIntent
  ): ConstraintResult;
}

export class ConstraintEngine {
  private constraints: SchedulingConstraint[] = [];

  constructor() {
    this.registerDefaultConstraints();
  }

  register(constraint: SchedulingConstraint) {
    this.constraints.push(constraint);
  }

  validate(
    start: Date,
    end: Date,
    originalItem: CalendarItem,
    intent: SchedulingIntent
  ): ConstraintResult[] {
    return this.constraints.map(c => c.validate(start, end, originalItem, intent));
  }

  private registerDefaultConstraints() {
    // 1. Minimum Duration Constraint
    this.register({
      name: 'MinimumDuration',
      validate(start, end) {
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        if (durationMinutes < 15) {
          return {
            severity: ConstraintSeverity.REPAIRABLE,
            reason: 'Duration is below the minimum required 15 minutes'
          };
        }
        return { severity: ConstraintSeverity.INFO };
      }
    });

    // 2. Calendar Exists Constraint
    this.register({
      name: 'CalendarExists',
      validate(start, end, originalItem) {
        // If there's no calendarId, it's considered an error
        const calId = originalItem.calendarId || originalItem.originalItem?.calendar_id;
        if (!calId) {
          return {
            severity: ConstraintSeverity.ERROR,
            reason: 'Item is not associated with a valid calendar'
          };
        }
        return { severity: ConstraintSeverity.INFO };
      }
    });

    // 3. Timestamp Validity Constraint
    this.register({
      name: 'TimestampValidity',
      validate(start, end) {
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            severity: ConstraintSeverity.ERROR,
            reason: 'Invalid timestamp dates'
          };
        }
        if (start.getTime() > end.getTime()) {
          return {
            severity: ConstraintSeverity.REPAIRABLE,
            reason: 'Start date is after end date'
          };
        }
        return { severity: ConstraintSeverity.INFO };
      }
    });

    // 4. Resize Validity Constraint
    this.register({
      name: 'ResizeValidity',
      validate(start, end, originalItem, intent) {
        if (intent.type === 'resize') {
          if (intent.edge === 'top' && originalItem.end.getTime() !== end.getTime()) {
            return {
              severity: ConstraintSeverity.WARNING,
              reason: 'Top resize modified the end boundary'
            };
          }
          if (intent.edge === 'bottom' && originalItem.start.getTime() !== start.getTime()) {
            return {
              severity: ConstraintSeverity.WARNING,
              reason: 'Bottom resize modified the start boundary'
            };
          }
        }
        return { severity: ConstraintSeverity.INFO };
      }
    });
  }
}
