-- =====================================================================
-- Our Little World — V2 migration
-- Run once in the Supabase SQL Editor. It is written to be re-runnable.
--
-- ASSUMPTIONS (taken from the V1 app code, since the V1 SQL wasn't in the zip):
--   * get_my_relationship_ids() returns SETOF uuid (usable as `x in (select get_my_relationship_ids())`)
--   * relationships(id, name, start_date, invite_code)  -- invite_code is what join_relationship() matches
--   * relationship_members(relationship_id, user_id)
--   * profiles(id = auth user id, display_name, status)
--   * memories, love_notes, important_dates, bucket_list_items all have id uuid + relationship_id + created_by
-- If any statement errors, paste the error back and it can be adjusted.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ---------------------------------------------------------------------
-- 1. Joining a space (invite codes, 2-person limit, regenerate)
-- ---------------------------------------------------------------------
alter table public.relationships add column if not exists invite_code text;

create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I to avoid typos
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.relationships r where r.invite_code = code);
  end loop;
  return code;
end $$;

-- give any existing space without a code one
update public.relationships set invite_code = public.generate_invite_code() where invite_code is null;
create unique index if not exists relationships_invite_code_key on public.relationships (invite_code);

-- one space per user
create unique index if not exists relationship_members_one_space_per_user on public.relationship_members (user_id);

-- hard limit: exactly two people per space, enforced by the database itself
create or replace function public.enforce_two_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.relationship_members where relationship_id = new.relationship_id) >= 2 then
    raise exception 'space_full';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_two_members on public.relationship_members;
create trigger trg_enforce_two_members
  before insert on public.relationship_members
  for each row execute function public.enforce_two_members();

-- members can see each other's membership rows (needed to know if the partner has joined)
drop policy if exists "v2 members see members of own space" on public.relationship_members;
create policy "v2 members see members of own space" on public.relationship_members
  for select to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()));

-- join with a code
drop function if exists public.join_relationship(text);
create function public.join_relationship(invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := upper(trim(join_relationship.invite_code));
  rid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.relationship_members m where m.user_id = uid) then
    raise exception 'already_member';
  end if;

  select r.id into rid from public.relationships r where upper(r.invite_code) = code for update;
  if rid is null then raise exception 'invalid_code'; end if;

  -- (the trigger also enforces this; checking here gives a clean error first)
  if (select count(*) from public.relationship_members m where m.relationship_id = rid) >= 2 then
    raise exception 'space_full';
  end if;

  insert into public.relationship_members (relationship_id, user_id) values (rid, uid);

  -- make sure the joiner has a profile row (ignored if a signup trigger already made one)
  begin
    insert into public.profiles (id, display_name)
    select uid, split_part(coalesce(u.email, 'Partner'), '@', 1) from auth.users u where u.id = uid
    on conflict (id) do nothing;
  exception when others then null;
  end;

  return rid;
end $$;
grant execute on function public.join_relationship(text) to authenticated;

-- new code (e.g. if it was shared with the wrong person)
create or replace function public.regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  new_code text;
begin
  select m.relationship_id into rid from public.relationship_members m where m.user_id = auth.uid();
  if rid is null then raise exception 'not_a_member'; end if;
  new_code := public.generate_invite_code();
  update public.relationships set invite_code = new_code where id = rid;
  return new_code;
end $$;
grant execute on function public.regenerate_invite_code() to authenticated;

-- members can rename their space
drop policy if exists "v2 members update relationship" on public.relationships;
create policy "v2 members update relationship" on public.relationships
  for update to authenticated
  using (id in (select public.get_my_relationship_ids()))
  with check (id in (select public.get_my_relationship_ids()));


-- ---------------------------------------------------------------------
-- 2. Profiles: custom partner name + free-text mood timestamp
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists partner_nickname text;   -- what *I* call my partner
alter table public.profiles add column if not exists status_updated_at timestamptz;


-- ---------------------------------------------------------------------
-- 3. Memories: videos, Cloudflare R2 flag, edit/delete, replies
-- ---------------------------------------------------------------------
alter table public.memories add column if not exists media_type text check (media_type in ('image','video'));
alter table public.memories add column if not exists media_mime text;
-- 'supabase' = old photos still in Supabase Storage, 'r2' = Cloudflare R2. Old rows keep working.
alter table public.memories add column if not exists storage text not null default 'supabase';
alter table public.memories add column if not exists updated_at timestamptz not null default now();
update public.memories set media_type = 'image' where image_path is not null and media_type is null;

drop trigger if exists trg_memories_updated on public.memories;
create trigger trg_memories_updated before update on public.memories
  for each row execute function public.set_updated_at();

create unique index if not exists memories_id_rel_key on public.memories (id, relationship_id);

drop policy if exists "v2 author updates memory" on public.memories;
create policy "v2 author updates memory" on public.memories for update to authenticated
  using (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()))
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));

drop policy if exists "v2 author deletes memory" on public.memories;
create policy "v2 author deletes memory" on public.memories for delete to authenticated
  using (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));

create table if not exists public.memory_replies (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null,
  memory_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a reply must belong to the same space as the memory it's under
  foreign key (memory_id, relationship_id) references public.memories (id, relationship_id) on delete cascade
);
create index if not exists memory_replies_memory_idx on public.memory_replies (memory_id, created_at);
alter table public.memory_replies enable row level security;

drop trigger if exists trg_memory_replies_updated on public.memory_replies;
create trigger trg_memory_replies_updated before update on public.memory_replies
  for each row execute function public.set_updated_at();

drop policy if exists "v2 read memory replies" on public.memory_replies;
create policy "v2 read memory replies" on public.memory_replies for select to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 add memory replies" on public.memory_replies;
create policy "v2 add memory replies" on public.memory_replies for insert to authenticated
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 edit own memory replies" on public.memory_replies;
create policy "v2 edit own memory replies" on public.memory_replies for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "v2 delete own memory replies" on public.memory_replies;
create policy "v2 delete own memory replies" on public.memory_replies for delete to authenticated
  using (created_by = auth.uid());


-- ---------------------------------------------------------------------
-- 4. Love notes: edit/delete (author only) + replies
-- ---------------------------------------------------------------------
alter table public.love_notes add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_love_notes_updated on public.love_notes;
create trigger trg_love_notes_updated before update on public.love_notes
  for each row execute function public.set_updated_at();

create unique index if not exists love_notes_id_rel_key on public.love_notes (id, relationship_id);

drop policy if exists "v2 author updates note" on public.love_notes;
create policy "v2 author updates note" on public.love_notes for update to authenticated
  using (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()))
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));

drop policy if exists "v2 author deletes note" on public.love_notes;
create policy "v2 author deletes note" on public.love_notes for delete to authenticated
  using (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));

create table if not exists public.note_replies (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null,
  note_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (note_id, relationship_id) references public.love_notes (id, relationship_id) on delete cascade
);
create index if not exists note_replies_note_idx on public.note_replies (note_id, created_at);
alter table public.note_replies enable row level security;

drop trigger if exists trg_note_replies_updated on public.note_replies;
create trigger trg_note_replies_updated before update on public.note_replies
  for each row execute function public.set_updated_at();

drop policy if exists "v2 read note replies" on public.note_replies;
create policy "v2 read note replies" on public.note_replies for select to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 add note replies" on public.note_replies;
create policy "v2 add note replies" on public.note_replies for insert to authenticated
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 edit own note replies" on public.note_replies;
create policy "v2 edit own note replies" on public.note_replies for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "v2 delete own note replies" on public.note_replies;
create policy "v2 delete own note replies" on public.note_replies for delete to authenticated
  using (created_by = auth.uid());


-- ---------------------------------------------------------------------
-- 5. Important dates: edit/delete (either partner), category, notes
-- ---------------------------------------------------------------------
alter table public.important_dates add column if not exists category text not null default 'other';
alter table public.important_dates add column if not exists description text;
alter table public.important_dates add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_important_dates_updated on public.important_dates;
create trigger trg_important_dates_updated before update on public.important_dates
  for each row execute function public.set_updated_at();

drop policy if exists "v2 members update dates" on public.important_dates;
create policy "v2 members update dates" on public.important_dates for update to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()))
  with check (relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 members delete dates" on public.important_dates;
create policy "v2 members delete dates" on public.important_dates for delete to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()));


-- ---------------------------------------------------------------------
-- 6. Plans (bucket list): edit/delete (either partner), target date
-- ---------------------------------------------------------------------
alter table public.bucket_list_items add column if not exists target_date date;
alter table public.bucket_list_items add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_bucket_updated on public.bucket_list_items;
create trigger trg_bucket_updated before update on public.bucket_list_items
  for each row execute function public.set_updated_at();

drop policy if exists "v2 members update plans" on public.bucket_list_items;
create policy "v2 members update plans" on public.bucket_list_items for update to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()))
  with check (relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 members delete plans" on public.bucket_list_items;
create policy "v2 members delete plans" on public.bucket_list_items for delete to authenticated
  using (relationship_id in (select public.get_my_relationship_ids()));


-- ---------------------------------------------------------------------
-- 7. Q&A: custom questions + edit/delete own answers
-- ---------------------------------------------------------------------
-- relationship_id NULL  = built-in question everyone sees
-- relationship_id = X   = custom question only space X sees
alter table public.daily_questions add column if not exists relationship_id uuid references public.relationships(id) on delete cascade;
alter table public.daily_questions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.daily_questions add column if not exists created_at timestamptz not null default now();
alter table public.daily_questions add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_daily_questions_updated on public.daily_questions;
create trigger trg_daily_questions_updated before update on public.daily_questions
  for each row execute function public.set_updated_at();

-- IMPORTANT: V1 almost certainly had a "read everything" policy on daily_questions.
-- Left in place it would leak custom questions to every couple (policies are OR-ed),
-- so drop every existing policy on this table and replace them with scoped ones.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'daily_questions' loop
    execute format('drop policy %I on public.daily_questions', r.policyname);
  end loop;
end $$;
alter table public.daily_questions enable row level security;

create policy "v2 read built-in or own-space questions" on public.daily_questions for select to authenticated
  using (relationship_id is null or relationship_id in (select public.get_my_relationship_ids()));
create policy "v2 create custom questions" on public.daily_questions for insert to authenticated
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));
create policy "v2 creator edits custom question" on public.daily_questions for update to authenticated
  using (created_by = auth.uid() and relationship_id is not null)
  with check (created_by = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));
-- no direct DELETE policy: deletion goes through delete_custom_question() below, which also removes answers

create or replace function public.delete_custom_question(qid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.daily_questions q
    where q.id = qid and q.created_by = auth.uid() and q.relationship_id is not null
  ) then
    raise exception 'not_allowed';
  end if;
  delete from public.question_answers where question_id = qid;
  delete from public.daily_questions where id = qid;
end $$;
grant execute on function public.delete_custom_question(uuid) to authenticated;

-- answers: author can edit / delete their own. (Blind-answer SELECT policy from V1 is untouched.)
alter table public.question_answers add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_question_answers_updated on public.question_answers;
create trigger trg_question_answers_updated before update on public.question_answers
  for each row execute function public.set_updated_at();

drop policy if exists "v2 edit own answer" on public.question_answers;
create policy "v2 edit own answer" on public.question_answers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and relationship_id in (select public.get_my_relationship_ids()));
drop policy if exists "v2 delete own answer" on public.question_answers;
create policy "v2 delete own answer" on public.question_answers for delete to authenticated
  using (user_id = auth.uid());
