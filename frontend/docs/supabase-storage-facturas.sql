-- Almacenamiento privado para el PDF de la factura de Crosland (compras a proveedor).
-- Lo ejecuta Michelle en el SQL Editor de Supabase. Solo gerente y administradora suben y ven archivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas-compra', 'facturas-compra', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "facturas_compra_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'facturas-compra' and public.hu026_rol_actual() in ('Gerente', 'Administradora'));

create policy "facturas_compra_subida" on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas-compra' and public.hu026_rol_actual() in ('Gerente', 'Administradora'));
