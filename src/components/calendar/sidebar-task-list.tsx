import React from 'react';
import { useTimelineStore } from '@/shared/timeline/use-timeline-store';
import { useTaskStore } from '@/shared/store/use-task-store';
import { CheckSquare, Square, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function SidebarTaskList() {
  const tasks = useTaskStore(s => s.tasks);
  const updateTask = useTaskStore(s => s.updateTask);

  // Filter only tasks that do NOT have a start_at (i.e. unscheduled)
  const unscheduledTasks = tasks.filter(t => !t.is_deleted && !t.start_at && t.status !== 'done');

  return (
    <div className="flex flex-col h-full bg-[#1A1A1A] border-l border-neutral-800 w-64 overflow-hidden">
      <div className="p-4 border-b border-neutral-800">
        <h3 className="font-semibold text-sm text-neutral-300">Unscheduled Tasks</h3>
        <p className="text-xs text-neutral-500 mt-1">Drag to calendar to schedule</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {unscheduledTasks.map(task => (
          <motion.div
            key={task.id}
            drag
            dragSnapToOrigin
            whileDrag={{ scale: 1.05, zIndex: 100, opacity: 0.8 }}
            onDragEnd={(e, info) => {
              // Basic cross-component drag simulation for Phase 1.
              // In a real app we'd use a DragDropContext or check collision with the grid bounds.
              // For now, if dragged left significantly (into the grid area), schedule it for today at noon.
              if (info.offset.x < -100) {
                const now = new Date();
                now.setHours(12, 0, 0, 0);
                const end = new Date(now.getTime() + 30 * 60000); // 30 min default duration
                updateTask(task.id, {
                  start_at: now.toISOString(),
                  end_at: end.toISOString()
                });
              }
            }}
            className="group flex items-start gap-2 p-2 rounded-md bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-grab active:cursor-grabbing"
          >
            <div className="mt-0.5 text-neutral-600 group-hover:text-neutral-400">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div 
              className="mt-0.5 cursor-pointer"
              onClick={() => updateTask(task.id, { status: 'done' })}
            >
              <Square className="w-3.5 h-3.5 text-neutral-500 hover:text-green-500" />
            </div>
            <div className="flex-1 text-xs text-neutral-300 leading-tight pr-1">
              {task.title}
            </div>
          </motion.div>
        ))}
        {unscheduledTasks.length === 0 && (
          <div className="text-xs text-neutral-600 text-center mt-10">
            No unscheduled tasks
          </div>
        )}
      </div>
    </div>
  );
}
