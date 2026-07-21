| schemaname | tablename         | policyname                                  | permissive | roles    | cmd    | qual                   | with_check             |
| ------------| -------------------| ---------------------------------------------| ------------| ----------| --------| ------------------------| ------------------------|
| public     | waitlist          | Allow anonymous inserts                     | PERMISSIVE | {anon}   | INSERT | null                   | true                   |
| public     | profiles          | Users can update own profile.               | PERMISSIVE | {public} | UPDATE | (auth.uid() = id)      | null                   |
| public     | profiles          | Users can insert their own profile.         | PERMISSIVE | {public} | INSERT | null                   | (auth.uid() = id)      |
| public     | rate_limits       | Users can view own rate limits              | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id) | null                   |
| public     | rate_limits       | No direct user writes                       | PERMISSIVE | {public} | INSERT | null                   | false                  |
| public     | rate_limits       | No direct user updates                      | PERMISSIVE | {public} | UPDATE | false                  | null                   |
| public     | rate_limits       | No direct user deletes                      | PERMISSIVE | {public} | DELETE | false                  | null                   |
| public     | notes             | Users can manage own notes                  | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | tasks             | Users can manage own tasks                  | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | projects          | Users can manage own projects               | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | events            | Users can manage own events                 | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | folders           | Users can manage own folders                | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | activities        | Users can view own activities               | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id) | null                   |
| public     | devices           | Users can manage own devices                | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | crdt_documents    | Users can manage own CRDT documents         | PERMISSIVE | {public} | ALL    | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public     | profiles          | Users can view own profile.                 | PERMISSIVE | {public} | SELECT | (auth.uid() = id)      | null                   |
| public     | crdt_note_updates | Users can read accessible crdt note updates | PERMISSIVE | {public} | SELECT | (EXISTS ( SELECT 1     |                        |
   FROM notes n
  WHERE (n.id = crdt_note_updates.entity_id))) | null                                                                                                           |
| public     | crdt_note_updates | Users can insert accessible crdt note updates | PERMISSIVE | {public} | INSERT | null                                                                              | ((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM notes n
  WHERE (n.id = crdt_note_updates.entity_id)))) |
| public     | crdt_note_updates | Users can read own crdt note updates          | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                            | null                                                                                                           |
| public     | crdt_note_updates | Users can insert own crdt note updates        | PERMISSIVE | {public} | INSERT | null                                                                              | (auth.uid() = user_id)                                                                                         |
| public     | search_history    | Users can view their own search history       | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                            | null                                                                                                           |
| public     | search_history    | Users can insert their own search history     | PERMISSIVE | {public} | INSERT | null                                                                              | (auth.uid() = user_id)                                                                                         |
| public     | search_history    | Users can delete their own search history     | PERMISSIVE | {public} | DELETE | (auth.uid() = user_id)                                                            | null                                                                                                           |