
create table if not exists antibiotic_forms (
  id uuid primary key default gen_random_uuid(),
  tarikh date not null,
  patient_name text not null,
  patient_ic text not null,
  patient_weight_kg numeric,
  diagnosis text not null,
  prescription_unit text,
  drug_allergy boolean default false,
  drug_allergy_detail text,
  antibiotic_regimen text,
  fms_code text,
  health_ed_compliance boolean default false,
  health_ed_sideeffect boolean default false,
  health_ed_tca boolean default false,
  checklist_data jsonb,
  prescriber_notes text,
  status text default 'pending_specialist',
  submitted_by uuid references auth.users(id),
  specialist_id uuid references auth.users(id),
  specialist_action_at timestamptz,
  specialist_notes text,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz default now()
);

create or replace function validate_antibiotic_form_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.status not in ('pending_specialist', 'approved', 'rejected') then
    raise exception 'Invalid status: %', NEW.status;
  end if;
  return NEW;
end;
$$;

create trigger trg_validate_antibiotic_form_status
  before insert or update on antibiotic_forms
  for each row execute function validate_antibiotic_form_status();

create or replace function validate_antibiotic_form_unit()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.prescription_unit is not null and NEW.prescription_unit not in ('OPD', 'FEVER', 'MCH') then
    raise exception 'Invalid prescription_unit: %', NEW.prescription_unit;
  end if;
  return NEW;
end;
$$;

create trigger trg_validate_antibiotic_form_unit
  before insert or update on antibiotic_forms
  for each row execute function validate_antibiotic_form_unit();

create index if not exists antibiotic_forms_status_idx on antibiotic_forms(status);
create index if not exists antibiotic_forms_submitted_by_idx on antibiotic_forms(submitted_by);

alter table antibiotic_forms enable row level security;

create policy "Authenticated users can view antibiotic_forms"
  on antibiotic_forms for select to authenticated
  using (true);

create policy "Authenticated users can insert antibiotic_forms"
  on antibiotic_forms for insert to authenticated
  with check (true);

create policy "Authenticated users can update antibiotic_forms"
  on antibiotic_forms for update to authenticated
  using (true)
  with check (true);
