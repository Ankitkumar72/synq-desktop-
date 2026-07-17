import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { TimelineItem } from '@/shared/timeline/timeline-types';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/shared/store/use-task-store';

interface TimelineItemCardProps {
  item: TimelineItem;
  style?: React.CSSProperties;
  onDragEnd?: (id: string, offsetPixels: number) => void;
  onClick?: () => void;
}

export function TimelineItemCard({ item, style, onDragEnd, onClick }: TimelineItemCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const updateTask = useTaskStore(s => s.updateTask);

  const isTask = item.type === 'task';
  
  // For Morgen style, backgrounds are very soft, borders are strong
  const bgColor = item.color || (isTask ? '#34A853' : '#4285F4');
  
  const handleCompleteTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTask) {
       updateTask(item.id, { status: item.isCompleted ? 'todo' : 'done' });
    }
  };

  return (
    <motion.div
      style={{
        ...style,
        backgroundColor: `${bgColor}20`,
        borderColor: bgColor,
        color: bgColor,
      }}
      className={cn(
        "absolute rounded-md border-l-[3px] p-1.5 text-[11px] overflow-hidden cursor-pointer flex flex-col gap-0.5 transition-colors",
        isDragging ? "shadow-lg z-50 saturate-150" : "hover:brightness-110 z-10",
        item.isCompleted && isTask ? "opacity-50" : ""
      )}
      drag="y"
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, info: PanInfo) => {
        setIsDragging(false);
        if (onDragEnd) {
          onDragEnd(item.id, info.offset.y);
        }
      }}
      onClick={onClick}
      whileDrag={{ scale: 1.02, zIndex: 50 }}
    >
      <div className="flex items-start gap-1.5 font-semibold leading-tight">
        {isTask && (
          <div onClick={handleCompleteTask} className="cursor-pointer shrink-0 mt-[1px]">
            {item.isCompleted ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </div>
        )}
        <span className={cn("truncate", item.isCompleted && isTask ? "line-through" : "")}>{item.title}</span>
      </div>
      
      <div className="flex items-center gap-2 opacity-80 text-[10px] pl-5">
        <span>
          {item.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          {' - '}
          {item.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
