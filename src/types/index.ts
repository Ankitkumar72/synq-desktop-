export type Priority = 'low' | 'medium' | 'high'
export type Status = 'todo' | 'in-progress' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: Status
  priority: Priority
  due_date?: string
  project_id?: string
  assignee_id?: string
  created_at: string
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
  title: string
  content: string // JSON for Tiptap or HTML string
  excerpt?: string
  tags: string[]
  pinned: boolean
  date?: string
  updated_at: string
  created_at: string
  deleted_at?: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  location?: string
  color: string
  created_at: string
  updated_at: string
  deleted_at?: string
}
