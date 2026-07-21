| table_name        | column_name             | data_type                | is_nullable | column_default                                 |
| -------------------| -------------------------| --------------------------| -------------| ------------------------------------------------|
| active_folders    | id                      | uuid                     | YES         | null                                           |
| active_folders    | user_id                 | uuid                     | YES         | null                                           |
| active_folders    | name                    | text                     | YES         | null                                           |
| active_folders    | color                   | integer                  | YES         | null                                           |
| active_folders    | parent_id               | uuid                     | YES         | null                                           |
| active_folders    | order                   | integer                  | YES         | null                                           |
| active_folders    | is_deleted              | boolean                  | YES         | null                                           |
| active_folders    | hlc_timestamp           | text                     | YES         | null                                           |
| active_folders    | field_versions          | jsonb                    | YES         | null                                           |
| active_folders    | created_at              | timestamp with time zone | YES         | null                                           |
| active_folders    | updated_at              | timestamp with time zone | YES         | null                                           |
| active_folders    | deleted_at              | timestamp with time zone | YES         | null                                           |
| active_folders    | deleted_hlc             | text                     | YES         | null                                           |
| active_notes      | id                      | uuid                     | YES         | null                                           |
| active_notes      | title                   | text                     | YES         | null                                           |
| active_notes      | content                 | jsonb                    | YES         | null                                           |
| active_notes      | tags                    | ARRAY                    | YES         | null                                           |
| active_notes      | pinned                  | boolean                  | YES         | null                                           |
| active_notes      | updated_at              | timestamp with time zone | YES         | null                                           |
| active_notes      | created_at              | timestamp with time zone | YES         | null                                           |
| active_notes      | deleted_at              | timestamp with time zone | YES         | null                                           |
| active_notes      | excerpt                 | text                     | YES         | null                                           |
| active_notes      | user_id                 | uuid                     | YES         | null                                           |
| active_notes      | body                    | text                     | YES         | null                                           |
| active_notes      | category                | text                     | YES         | null                                           |
| active_notes      | priority                | text                     | YES         | null                                           |
| active_notes      | is_task                 | boolean                  | YES         | null                                           |
| active_notes      | is_all_day              | boolean                  | YES         | null                                           |
| active_notes      | is_completed            | boolean                  | YES         | null                                           |
| active_notes      | is_recurring_instance   | boolean                  | YES         | null                                           |
| active_notes      | is_deleted              | boolean                  | YES         | null                                           |
| active_notes      | attachments             | ARRAY                    | YES         | null                                           |
| active_notes      | links                   | ARRAY                    | YES         | null                                           |
| active_notes      | subtasks                | jsonb                    | YES         | null                                           |
| active_notes      | color                   | integer                  | YES         | null                                           |
| active_notes      | order                   | integer                  | YES         | null                                           |
| active_notes      | folder_id               | uuid                     | YES         | null                                           |
| active_notes      | parent_recurring_id     | text                     | YES         | null                                           |
| active_notes      | scheduled_time          | timestamp with time zone | YES         | null                                           |
| active_notes      | end_time                | timestamp with time zone | YES         | null                                           |
| active_notes      | reminder_time           | timestamp with time zone | YES         | null                                           |
| active_notes      | original_scheduled_time | timestamp with time zone | YES         | null                                           |
| active_notes      | completed_at            | timestamp with time zone | YES         | null                                           |
| active_notes      | recurrence_rule         | jsonb                    | YES         | null                                           |
| active_notes      | device_last_edited      | text                     | YES         | null                                           |
| active_notes      | hlc_timestamp           | text                     | YES         | null                                           |
| active_notes      | field_versions          | jsonb                    | YES         | null                                           |
| active_notes      | deleted_hlc             | text                     | YES         | null                                           |
| activities        | id                      | uuid                     | NO          | uuid_generate_v4()                             |
| activities        | user_id                 | uuid                     | YES         | null                                           |
| activities        | user_name               | text                     | YES         | null                                           |
| activities        | action                  | text                     | NO          | null                                           |
| activities        | target_id               | uuid                     | YES         | null                                           |
| activities        | target_type             | text                     | YES         | null                                           |
| activities        | created_at              | timestamp with time zone | YES         | timezone('utc'::text, now())                   |
| crdt_documents    | entity_type             | text                     | NO          | null                                           |
| crdt_documents    | entity_id               | uuid                     | NO          | null                                           |
| crdt_documents    | user_id                 | uuid                     | NO          | null                                           |
| mutations_log     | mutation_id             | uuid                     | NO          | null (PRIMARY KEY)                             |
| mutations_log     | user_id                 | uuid                     | NO          | null (REFERENCES auth.users)                   |
| mutations_log     | device_id               | text                     | YES         | null                                           |
| mutations_log     | client_id               | text                     | YES         | null                                           |
| mutations_log     | operation_type          | text                     | NO          | null                                           |
| mutations_log     | server_sequence         | bigint                   | NO          | BIGSERIAL                                      |
| mutations_log     | created_at              | timestamp with time zone | YES         | now()                                          |
| crdt_documents    | state                   | ARRAY                    | NO          | '{}'::bigint[]                                 |
| crdt_documents    | updated_at              | timestamp with time zone | YES         | timezone('utc'::text, now())                   |
| crdt_documents    | last_seq                | bigint                   | YES         | null                                           |
| crdt_note_updates | seq                     | bigint                   | NO          | nextval('crdt_note_updates_seq_seq'::regclass) |
| crdt_note_updates | entity_type             | text                     | NO          | 'note'::text                                   |
| crdt_note_updates | entity_id               | uuid                     | NO          | null                                           |
| crdt_note_updates | user_id                 | uuid                     | NO          | null                                           |
| crdt_note_updates | client_id               | text                     | NO          | null                                           |
| crdt_note_updates | op_id                   | text                     | NO          | null                                           |
| crdt_note_updates | update_data             | ARRAY                    | NO          | '{}'::bigint[]                                 |
| crdt_note_updates | created_at              | timestamp with time zone | NO          | timezone('utc'::text, now())                   |
| devices           | id                      | uuid                     | NO          | uuid_generate_v4()                             |
| devices           | user_id                 | uuid                     | YES         | null                                           |
| devices           | device_name             | text                     | YES         | null                                           |
| devices           | platform                | text                     | YES         | null                                           |
| devices           | push_token              | text                     | YES         | null                                           |
| devices           | last_active_at          | timestamp with time zone | YES         | now()                                          |
| devices           | created_at              | timestamp with time zone | YES         | now()                                          |
| events            | id                      | uuid                     | NO          | uuid_generate_v4()                             |
| events            | title                   | text                     | NO          | null                                           |
| events            | description             | text                     | YES         | null                                           |
| events            | start_date              | timestamp with time zone | NO          | null                                           |
| events            | end_date                | timestamp with time zone | NO          | null                                           |
| events            | location                | text                     | YES         | null                                           |
| events            | color                   | text                     | NO          | 'bg-blue-500'::text                            |
| events            | user_id                 | uuid                     | YES         | auth.uid()                                     |
| events            | created_at              | timestamp with time zone | YES         | now()                                          |
| events            | updated_at              | timestamp with time zone | YES         | now()                                          |
| events            | deleted_at              | timestamp with time zone | YES         | null                                           |
| events            | hlc_timestamp           | text                     | YES         | null                                           |
| events            | deleted_hlc             | text                     | YES         | null                                           |
| events            | is_deleted              | boolean                  | YES         | false                                          |
| events            | field_versions          | jsonb                    | YES         | '{}'::jsonb                                    |
| folders           | id                      | uuid                     | NO          | uuid_generate_v4()                             |
| folders           | user_id                 | uuid                     | YES         | null                                           |
| folders           | name                    | text                     | NO          | null                                           |
| folders           | color                   | integer                  | YES         | null                                           |
| folders           | parent_id               | uuid                     | YES         | null                                           |
| folders           | order                   | integer                  | YES         | 0                                              |
| folders           | is_deleted              | boolean                  | YES         | false                                          |
| folders           | hlc_timestamp           | text                     | YES         | null                                           |
| folders           | field_versions          | jsonb                    | YES         | '{}'::jsonb                                    |