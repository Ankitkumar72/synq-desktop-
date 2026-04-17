export type Priority = 'low' | 'medium' | 'high' | 'none'
export type Status = 'todo' | 'in-progress' | 'done'

export interface SubTask {
  id: string
  title: string
  is_completed: boolean
}

export interface Task {
  id: string
  user_id?: string
  title: string
  description?: string
  status: Status
  priority: Priority
  due_date?: string
  project_id?: string
  assignee_id?: string
  hlc_timestamp?: string
  is_deleted?: boolean
  deleted_hlc?: string
  created_at: string
  updated_at?: string
  deleted_at?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  status: 'on-track' | 'at-risk' | 'overdue'
  progress: number
  task_count: number
  completed_task_count: number
  is_favorite: boolean
  created_at: string
}

export interface Activity {
  id: string
  user_id: string
  user_name: string
  user_avatar?: string
  action: string
  target_id?: string
  target_type?: string
  created_at: string
}

export interface Note {
  id: string
  user_id?: string
  title: string
  content?: string | null // JSON for Tiptap (Web) or Markdown
  body?: string | null // Plain text for Flutter (Mobile)
  excerpt?: string | null
  tags: string[]
  category?: string
  priority?: Priority
  is_task: boolean
  is_completed: boolean
  is_all_day?: boolean
  is_recurring_instance?: boolean
  folder_id?: string
  parent_recurring_id?: string
  scheduled_time?: string | null
  end_time?: string | null
  reminder_time?: string | null
  original_scheduled_time?: string | null
  completed_at?: string | null
  recurrence_rule?: string | null
  subtasks: SubTask[]
  color?: number
  order?: number
  hlc_timestamp: string
  field_versions?: Record<string, string>
  deleted_hlc?: string | null
  is_deleted: boolean
  pinned: boolean
  date?: string
  updated_at: string
  created_at: string
  deleted_at?: string | null
}

export interface CalendarEvent {
  id: string
  user_id?: string
  title: string
  description?: string
  start_date: string
  end_date: string
  location?: string
  color: string
  hlc_timestamp?: string
  is_deleted?: boolean
  deleted_hlc?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}
