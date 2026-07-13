import type { JSONContent } from '@tiptap/core'

export type Priority = 'low' | 'medium' | 'high' | 'none'
export type Status = 'todo' | 'in-progress' | 'done'
export type NoteContent = JSONContent | string | null

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
  start_at?: string | null
  end_at?: string | null
  project_id?: string
  assignee_id?: string
  hlc_timestamp?: string
  field_versions?: Record<string, string>
  is_deleted?: boolean
  deleted_hlc?: string
  created_at: string
  updated_at?: string
  deleted_at?: string
  order?: number
  recurrence_rule?: string | null
  parent_recurring_id?: string | null
}

export interface Project {
  id: string
  user_id?: string
  name: string
  description?: string
  color: string
  status: 'on-track' | 'at-risk' | 'overdue'
  progress: number
  task_count: number
  completed_task_count: number
  is_favorite: boolean
  hlc_timestamp?: string
  field_versions?: Record<string, string>
  is_deleted?: boolean
  deleted_hlc?: string | null
  created_at: string
  updated_at?: string
  deleted_at?: string | null
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
  content?: NoteContent
  body?: string | null // Markdown for Flutter (Mobile)
  content_markdown?: string | null
  plain_text?: string | null // Unbounded clean plain-text for search
  excerpt?: string | null // Bounded plain-text for cards
  tags: string[]
  category?: string
  priority?: Priority
  folder_id?: string
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

export interface Folder {
  id: string
  user_id?: string
  name: string
  description?: string
  color?: string
  is_favorite?: boolean
  parent_id?: string
  order?: number
  is_deleted?: boolean
  hlc_timestamp?: string
  deleted_hlc?: string
  field_versions?: Record<string, string>
  created_at: string
  updated_at: string
  deleted_at?: string
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
  field_versions?: Record<string, string>
  is_deleted?: boolean
  deleted_hlc?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}
