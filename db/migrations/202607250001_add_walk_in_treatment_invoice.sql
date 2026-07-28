alter table public.queue
  add column if not exists service_id bigint null references public.dental_services(service_id) on delete restrict,
  add column if not exists actual_price numeric null;
alter table public.treatment_record
  add column if not exists queue_id bigint null references public.queue(id) on delete restrict;
alter table public.invoice
  add column if not exists queue_id bigint null references public.queue(id) on delete restrict;

create unique index if not exists treatment_record_queue_unique
  on public.treatment_record (queue_id) where queue_id is not null;
create unique index if not exists invoice_queue_unique
  on public.invoice (queue_id) where queue_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'treatment_record_exactly_one_source' and conrelid = 'public.treatment_record'::regclass) then
    alter table public.treatment_record add constraint treatment_record_exactly_one_source
      check ((appt_id is not null) <> (queue_id is not null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoice_exactly_one_source' and conrelid = 'public.invoice'::regclass) then
    alter table public.invoice add constraint invoice_exactly_one_source
      check ((appt_id is not null) <> (queue_id is not null)) not valid;
  end if;
end $$;

create or replace function public.sync_queue_room_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from 'IN_PROGRESS' and new.status = 'IN_PROGRESS' then
    if new.room_id is null then
      raise exception using errcode = 'P0001', message = 'QUEUE_ROOM_REQUIRED';
    end if;
    update public.room_info set status = 'Occupied'
    where room_id = new.room_id and status = 'Available';
    if not found then
      raise exception using errcode = 'P0001', message = 'QUEUE_ROOM_OCCUPIED';
    end if;
  elsif old.status = 'IN_PROGRESS' and new.status in ('COMPLETED', 'CANCELLED') then
    update public.room_info room set status = 'Available'
    where room.room_id = old.room_id and room.status = 'Occupied'
      and not exists (
        select 1 from public.queue active_queue
        where active_queue.room_id = old.room_id
          and active_queue.status = 'IN_PROGRESS'
          and active_queue.id <> old.id
      );
  end if;
  return new;
end $$;

drop trigger if exists queue_sync_room_status on public.queue;
create trigger queue_sync_room_status before update of status on public.queue
for each row execute function public.sync_queue_room_status();

create or replace function public.record_walk_in_treatment(
  p_queue_id bigint, p_dentist_id bigint, p_clinical_examination text,
  p_diagnosis text, p_treatment_note text, p_post_treatment_instructions text
)
returns table (record_id bigint, invoice_id bigint, queue_status text)
language plpgsql security definer set search_path = public as $$
declare
  v_queue public.queue%rowtype;
  v_record_id bigint;
  v_invoice_id bigint;
begin
  select * into v_queue from public.queue where id = p_queue_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'QUEUE_NOT_FOUND'; end if;
  if v_queue.queue_type <> 'WALK_IN' then raise exception using errcode = 'P0001', message = 'QUEUE_NOT_WALK_IN'; end if;
  if v_queue.status <> 'IN_PROGRESS' then raise exception using errcode = 'P0001', message = 'QUEUE_NOT_IN_PROGRESS'; end if;
  if v_queue.dentist_id is distinct from p_dentist_id then raise exception using errcode = 'P0001', message = 'QUEUE_DENTIST_FORBIDDEN'; end if;
  if v_queue.service_id is null or v_queue.actual_price is null then raise exception using errcode = 'P0001', message = 'QUEUE_SERVICE_REQUIRED'; end if;
  if exists (select 1 from public.treatment_record where queue_id = p_queue_id) then raise exception using errcode = 'P0001', message = 'QUEUE_TREATMENT_EXISTS'; end if;
  if exists (select 1 from public.invoice where queue_id = p_queue_id) then raise exception using errcode = 'P0001', message = 'QUEUE_INVOICE_EXISTS'; end if;

  insert into public.treatment_record (
    appt_id, queue_id, dentist_id, clinical_examination, diagnosis,
    treatment_note, post_treatment_instructions
  ) values (
    null, p_queue_id, p_dentist_id, nullif(btrim(p_clinical_examination), ''),
    btrim(p_diagnosis), btrim(p_treatment_note),
    nullif(btrim(p_post_treatment_instructions), '')
  ) returning treatment_record.record_id into v_record_id;

  insert into public.invoice (
    appt_id, queue_id, treatment_plan_id, receptionist_id,
    total_amount, payment_time, payment_status
  ) values (
    null, p_queue_id, null, null, v_queue.actual_price, null, 'Unpaid'
  ) returning invoice.invoice_id into v_invoice_id;

  update public.queue set status = 'COMPLETED'
  where id = p_queue_id and status = 'IN_PROGRESS';
  if not found then raise exception using errcode = 'P0001', message = 'QUEUE_STATUS_CHANGED'; end if;
  return query select v_record_id, v_invoice_id, 'COMPLETED'::text;
end $$;
