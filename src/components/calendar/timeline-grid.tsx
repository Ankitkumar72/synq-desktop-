import React, { useEffect, useState, useMemo } from 'react';
import { TimelineItem } from '@/shared/timeline/timeline-types';
import { TimelineItemCard } from './timeline-item-card';
import { calculateTimelineLayout } from './layout-engine';

interface TimelineGridProps {
  dates: Date[]; // 1 for DayView, 7 for WeekView
  items: TimelineItem[];
  onItemTimeChange: (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => void;
}

const PIXELS_PER_MINUTE = 1;
const SNAP_MINUTES = 15;

export function TimelineGrid({ dates, items, onItemTimeChange }: TimelineGridProps) {
  const [currentTimeTop, setCurrentTimeTop] = useState(-1);
  const now = new Date();

  // Current time indicator logic
  useEffect(() => {
    const updateTime = () => {
      const nowTime = new Date();
      const minutesSinceMidnight = nowTime.getHours() * 60 + nowTime.getMinutes();
      setCurrentTimeTop(minutesSinceMidnight * PIXELS_PER_MINUTE);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const handleDragEnd = (id: string, offsetPixels: number, originalDayStart: Date) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Calculate new time based on offset
    const originalStartMinutes = item.start.getHours() * 60 + item.start.getMinutes();
    const durationMinutes = (item.end.getTime() - item.start.getTime()) / 60000;
    
    const newStartMinutes = originalStartMinutes + (offsetPixels / PIXELS_PER_MINUTE);
    const snappedMinutes = Math.round(newStartMinutes / SNAP_MINUTES) * SNAP_MINUTES;

    const newStart = new Date(originalDayStart);
    newStart.setHours(Math.floor(snappedMinutes / 60));
    newStart.setMinutes(snappedMinutes % 60);

    const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

    onItemTimeChange(id, item.type as 'task' | 'event', newStart, newEnd);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="relative flex-1 flex overflow-y-auto bg-transparent text-neutral-300 font-sans scrollbar-none">
      
      {/* Time axis (left) */}
      <div className="relative w-16 shrink-0 h-[1440px] mt-4 border-r border-neutral-800/50">
        {hours.map(hour => (
          <div key={hour} className="absolute w-full flex items-start" style={{ top: hour * 60 * PIXELS_PER_MINUTE }}>
            <div className="w-full text-center pr-2 text-[11px] text-neutral-500 font-medium -mt-2">
              {hour === 0 ? '' : `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`}
            </div>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="relative flex-1 flex h-[1440px] mt-4 mr-4">
        {/* Background Grid Lines (Horizontal) */}
        {hours.map(hour => (
          <div key={`line-${hour}`} className="absolute w-full border-t border-neutral-800/50 pointer-events-none" style={{ top: hour * 60 * PIXELS_PER_MINUTE }} />
        ))}

        {dates.map((date, index) => {
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          
          const isToday = dayStart.toDateString() === now.toDateString();

          const dayItems = items.filter(item => item.start <= dayEnd && item.end >= dayStart && !item.allDay);
          const layoutNodes = calculateTimelineLayout(dayItems, PIXELS_PER_MINUTE);

          return (
            <div key={index} className="relative flex-1 border-r border-neutral-800/30 last:border-r-0">
              
              {/* Current Time Indicator for this column */}
              {isToday && currentTimeTop >= 0 && (
                <div 
                  className="absolute left-0 w-full z-20 pointer-events-none flex items-center"
                  style={{ top: currentTimeTop }}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <div className="w-full border-t border-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                </div>
              )}

              {/* Items in this column */}
              {layoutNodes.map((node) => (
                <TimelineItemCard
                  key={node.item.id}
                  item={node.item}
                  style={{
                    top: node.top,
                    height: node.height,
                    left: `calc(${node.left * 100}% + 2px)`,
                    width: `calc(${node.width * 100}% - 4px)`,
                  }}
                  onDragEnd={(id, offset) => handleDragEnd(id, offset, dayStart)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
