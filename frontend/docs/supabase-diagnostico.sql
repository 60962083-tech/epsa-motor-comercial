-- EPSA Motor · Diagnóstico de la conexión (SOLO LECTURA: no cambia nada)
-- Ejecutar en Supabase > SQL Editor y mandar captura del resultado.
select '1 modelo' as tipo, m.nommod as nombre, m.estmod as estado,
       (select count(*) from public.imagenmodelo i where i.codmod = m.codmod and i.estimo)::text || ' foto(s)' as extra
from public.modelo m
union all
select '2 usuario', u.corusu, r.nomrol, case when u.estusu then 'activo' else 'inactivo' end
from public.usuario u join public.rol r on r.codrol = u.codrol
union all
select '3 ubicacion', x.nomubi, x.tipubi, case when x.estubi then 'activa' else 'inactiva' end
from public.ubicacion x
union all
select '4 cuenta', a.email, coalesce(a.raw_user_meta_data ->> 'nombre', ''),
       case when a.email_confirmed_at is null then 'sin confirmar' else 'confirmada' end
from auth.users a
union all
select '5 funcion', p.proname, '', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'hu0%'
union all
select '6 bucket', b.id, case when b.public then 'publico' else 'privado' end, ''
from storage.buckets b
order by 1, 2;
