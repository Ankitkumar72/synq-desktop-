/**
 * Database Table and Column Constants
 * Used to avoid hardcoding strings throughout the application.
 */

export const TABLES = {
  NOTES: 'notes',
  FOLDERS: 'folders',
  TASKS: 'tasks',
  EVENTS: 'events',
  DEVICES: 'devices',
  PROFILES: 'profiles',
  ACTIVITIES: 'activities',
  NOTE_CONTENT_WEB: 'note_content_web',
} as const;

export const COLUMNS = {
  ID: 'id',
  USER_ID: 'user_id',
  TITLE: 'title',
  BODY: 'body',
  CONTENT: 'content',
  UPDATED_AT: 'updated_at',
  CREATED_AT: 'created_at',
  DELETED_AT: 'deleted_at',
  IS_DELETED: 'is_deleted', // Still present for compatibility trigger
  PINNED: 'pinned',
  FOLDER_ID: 'folder_id',
} as const;
