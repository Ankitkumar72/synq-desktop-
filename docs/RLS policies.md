| tablename         | policyname                                  | cmd    | qual                   |
| -------------------| ---------------------------------------------| --------| ------------------------|
| waitlist          | Allow anonymous inserts                     | INSERT | null                   |
| profiles          | Users can update own profile.               | UPDATE | (auth.uid() = id)      |
| profiles          | Users can insert their own profile.         | INSERT | null                   |
| rate_limits       | Users can view own rate limits              | SELECT | (auth.uid() = user_id) |
| rate_limits       | No direct user writes                       | INSERT | null                   |
| rate_limits       | No direct user updates                      | UPDATE | false                  |
| rate_limits       | No direct user deletes                      | DELETE | false                  |
| notes             | Users can manage own notes                  | ALL    | (auth.uid() = user_id) |
| tasks             | Users can manage own tasks                  | ALL    | (auth.uid() = user_id) |
| projects          | Users can manage own projects               | ALL    | (auth.uid() = user_id) |
| events            | Users can manage own events                 | ALL    | (auth.uid() = user_id) |
| folders           | Users can manage own folders                | ALL    | (auth.uid() = user_id) |
| activities        | Users can view own activities               | SELECT | (auth.uid() = user_id) |
| devices           | Users can manage own devices                | ALL    | (auth.uid() = user_id) |
| crdt_documents    | Users can manage own CRDT documents         | ALL    | (auth.uid() = user_id) |
| profiles          | Users can view own profile.                 | SELECT | (auth.uid() = id)      |
| crdt_note_updates | Users can read accessible crdt note updates | SELECT | (EXISTS ( SELECT 1     |
   FROM notes n
  WHERE (n.id = crdt_note_updates.entity_id))) |
| mutations_log     | Users can manage own mutations_log            | ALL    | (auth.uid() = user_id) |
| crdt_note_updates | Users can insert accessible crdt note updates | INSERT | null                                                                              |
| crdt_note_updates | Users can read own crdt note updates          | SELECT | (auth.uid() = user_id)                                                            |
| crdt_note_updates | Users can insert own crdt note updates        | INSERT | null                                                                              |
| search_history    | Users can view their own search history       | SELECT | (auth.uid() = user_id)                                                            |
| search_history    | Users can insert their own search history     | INSERT | null                                                                              |
| search_history    | Users can delete their own search history     | DELETE | (auth.uid() = user_id)                                                            |