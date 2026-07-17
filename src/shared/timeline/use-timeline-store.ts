import { useMemo } from 'react';
import { useTaskStore } from '../store/use-task-store';
import { useEventStore } from '../store/use-event-store';
import { TimelineItem } from './timeline-types';

export function useTimelineStore() {
  const tasks = useTaskStore(s => s.tasks);
  const events = useEventStore(s => s.events);
  const updateTask = useTaskStore(s => s.updateTask);
  const updateEvent = useEventStore(s => s.updateEvent);

  const items = useMemo(() => {
    const timelineItems: TimelineItem[] = [];

    // Process Scheduled Tasks
    tasks.forEach(task => {
      const startString = task.start_at || task.due_date;
      if (!task.is_deleted && startString) {
        const start = new Date(startString);
        const end = task.end_at ? new Date(task.end_at) : new Date(start.getTime() + 30 * 60000);
        
        timelineItems.push({
          id: task.id,
          type: 'task',
          title: task.title,
          description: task.description,
          start,
          end,
          allDay: false,
          isCompleted: task.status === 'done',
          color: '#34A853', // Default green for tasks
          originalItem: task,
        });
      }
    });

    // Process Events
    events.forEach(event => {
      if (!event.is_deleted) {
        timelineItems.push({
          id: event.id,
          type: 'event',
          title: event.title,
          description: event.description,
          start: new Date(event.start_date),
          end: new Date(event.end_date),
          allDay: event.is_all_day || false,
          timezone: event.timezone,
          isCompleted: false,
          color: event.color || '#4285F4', // Default blue for events
          calendarId: event.parent_recurring_id,
          originalItem: event,
        });
      }
    });

    return timelineItems;
  }, [tasks, events]);

  const updateItemTime = async (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => {
    if (type === 'task') {
      await updateTask(id, {
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString()
      });
    } else if (type === 'event') {
      await updateEvent(id, {
        start_date: newStart.toISOString(),
        end_date: newEnd.toISOString()
      });
    }
  };

  return { items, updateItemTime };
}
