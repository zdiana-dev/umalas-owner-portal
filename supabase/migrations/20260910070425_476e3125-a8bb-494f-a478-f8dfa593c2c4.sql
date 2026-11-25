create table public.payment_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  uploader_id uuid not null,
  from_admin boolean not null default false,
  title text not null default '',
  file_path text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.payment_documents to authenticated;
grant all on public.payment_documents to service_role;

alter table public.payment_documents enable row level security;

create policy "payment_documents_select"
on public.payment_documents for select to authenticated
using (owner_id = auth.uid() or public.is_admin(auth.uid()));

create policy "payment_documents_insert"
on public.payment_documents for insert to authenticated
with check (
  uploader_id = auth.uid()
  and (
    (from_admin and public.is_admin(auth.uid()))
    or (not from_admin and owner_id = auth.uid())
  )
);

-- owners may remove only files they uploaded themselves; admins may remove any
create policy "payment_documents_delete"
on public.payment_documents for delete to authenticated
using (public.is_admin(auth.uid()) or (owner_id = auth.uid() and not from_admin));

-- private bucket "payment-details": files live under <owner_id>/<file>
create policy "payment_details_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-details'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
);

create policy "payment_details_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-details'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
);

create policy "payment_details_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-details'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
);