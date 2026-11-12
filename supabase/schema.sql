-- =====================================================================
-- Gaceta Survival · esquema de base de datos para Supabase
-- Pega este archivo completo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar una sola vez en un proyecto nuevo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Moderadores: quien aparece aquí puede revisar y publicar.
-- ---------------------------------------------------------------------
create table public.moderators (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "cada quien ve su propio rol" on public.moderators
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_mod() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;
grant execute on function public.is_mod() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Noticias publicadas (lectura pública, escritura solo moderación)
-- ---------------------------------------------------------------------
create table public.news (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) between 1 and 160),
  summary           text not null check (char_length(summary) between 1 and 400),
  body              text not null check (char_length(body) between 1 and 10000),
  category          text not null check (category in ('eventos','construcciones','comercio','logros','novedades','historias','reportes')),
  event_date        date,
  author            text not null default 'Remitente anónimo' check (char_length(author) <= 60),
  verification      text not null default 'testimonio' check (verification in ('confirmado','testimonio')),
  verification_note text not null default '' check (char_length(verification_note) <= 300),
  image_path        text,
  video_url         text,
  links             text[] not null default '{}',
  correction        text check (char_length(correction) <= 300),
  mentions_others   boolean not null default false,
  demo              boolean not null default false,
  source_submission uuid,
  published_at      timestamptz not null default now(),
  updated_at        timestamptz
);
alter table public.news enable row level security;
create policy "lectura pública" on public.news
  for select to anon, authenticated using (true);
create policy "moderación crea" on public.news
  for insert to authenticated with check (public.is_mod());
create policy "moderación edita" on public.news
  for update to authenticated using (public.is_mod()) with check (public.is_mod());
create policy "moderación retira" on public.news
  for delete to authenticated using (public.is_mod());

-- ---------------------------------------------------------------------
-- Envíos de la comunidad (noticias y solicitudes de corrección/retiro)
-- Cada jugador ve solo los suyos; moderación ve todos.
-- ---------------------------------------------------------------------
create table public.submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('noticia','solicitud')),
  title             text not null check (char_length(title) between 1 and 200),
  description       text not null check (char_length(description) between 1 and 5000),
  approx_date       date,
  category          text check (category in ('eventos','construcciones','comercio','logros','novedades','historias','reportes')),
  ign               text not null default '' check (char_length(ign) <= 32),
  links             text[] not null default '{}' check (cardinality(links) <= 8),
  images            text[] not null default '{}' check (cardinality(images) <= 6),
  anonymous         boolean not null default false,
  contact           text not null default '' check (char_length(contact) <= 120),
  mentions_others   boolean not null default false,
  request_type      text check (request_type in ('correccion','retiro','otro')),
  news_id           uuid references public.news(id) on delete set null,
  news_title        text,
  status            text not null default 'pendiente'
                    check (status in ('pendiente','info','rechazada','publicada','resuelta','retirada')),
  thread            jsonb not null default '[]'::jsonb,
  published_news_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index submissions_user_idx on public.submissions(user_id);
create index submissions_updated_idx on public.submissions(updated_at desc);
alter table public.submissions enable row level security;

create policy "ver mis envíos o todos si modero" on public.submissions
  for select to authenticated using (user_id = auth.uid() or public.is_mod());

-- Un envío nuevo siempre entra como pendiente, sin conversación,
-- y con un límite de 10 envíos por día por persona.
create policy "enviar" on public.submissions
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pendiente'
    and thread = '[]'::jsonb
    and published_news_id is null
    and (select count(*) from public.submissions s
         where s.user_id = auth.uid() and s.created_at > now() - interval '1 day') < 10
  );

create policy "moderación actualiza" on public.submissions
  for update to authenticated using (public.is_mod()) with check (public.is_mod());
create policy "moderación borra" on public.submissions
  for delete to authenticated using (public.is_mod());

-- El remitente responde a una petición de información sin poder
-- tocar ningún otro campo de su envío.
create or replace function public.reply_submission(sub_id uuid, reply text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(reply, '')) not between 1 and 3000 then
    raise exception 'La respuesta está vacía o es demasiado larga';
  end if;
  update public.submissions
     set status = 'pendiente',
         updated_at = now(),
         thread = thread || jsonb_build_array(jsonb_build_object('from','remitente','text',reply,'at',now()))
   where id = sub_id and user_id = auth.uid() and status = 'info';
  if not found then
    raise exception 'Este envío no está esperando tu respuesta';
  end if;
end $$;
revoke all on function public.reply_submission(uuid, text) from public, anon;
grant execute on function public.reply_submission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Ajustes del sitio (texto de contacto alternativo)
-- ---------------------------------------------------------------------
create table public.site_config (
  id           int primary key default 1 check (id = 1),
  contact_text text not null default '' check (char_length(contact_text) <= 400)
);
insert into public.site_config (id) values (1);
alter table public.site_config enable row level security;
create policy "lectura pública" on public.site_config
  for select to anon, authenticated using (true);
create policy "moderación edita" on public.site_config
  for update to authenticated using (public.is_mod()) with check (public.is_mod());

-- ---------------------------------------------------------------------
-- Almacenamiento de imágenes
--   evidencias: privado. Cada jugador sube a su carpeta; solo él y
--               moderación pueden verlas.
--   portadas:   público. Solo moderación sube la imagen elegida al publicar.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidencias', 'evidencias', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('portadas',   'portadas',   true,  10485760, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "subir mis evidencias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ver evidencias propias o moderación" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidencias' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod()));
create policy "borrar mis evidencias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidencias' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod()));

create policy "moderación sube portadas" on storage.objects
  for insert to authenticated with check (bucket_id = 'portadas' and public.is_mod());
create policy "moderación borra portadas" on storage.objects
  for delete to authenticated using (bucket_id = 'portadas' and public.is_mod());

-- ---------------------------------------------------------------------
-- Contenido de DEMOSTRACIÓN (no describe hechos reales).
-- Puedes retirarlo desde el panel de moderación cuando quieras.
-- ---------------------------------------------------------------------
insert into public.news (title, summary, body, category, event_date, author, verification, verification_note, demo, published_at, correction) values
('[DEMO] Ejemplo: vecinos organizan una feria de intercambio junto al spawn',
 'Publicación de demostración que muestra cómo se ve una noticia de comercio confirmada con evidencias.',
 E'ESTE TEXTO ES UN EJEMPLO DE FORMATO. NO DESCRIBE HECHOS REALES.\n\nAsí se vería una noticia de comercio: primero los hechos confirmados (qué pasó, cuándo y dónde, en términos generales), después lo que relatan los participantes, citado como testimonio.\n\nLo confirmado: moderación revisó capturas del lugar y de los puestos.\nTestimonios: algunos asistentes contaron que el intercambio más pedido fue de bloques de construcción.',
 'comercio', '2026-11-01', 'Equipo de la gaceta (demo)', 'confirmado', 'Ejemplo: se revisaron capturas enviadas por el remitente.', true, '2026-11-03T15:00:00Z', null),
('[DEMO] Ejemplo: termina una construcción comunitaria tras varias semanas',
 'Ejemplo de noticia de construcciones basada en el testimonio de quien la envió.',
 E'ESTE TEXTO ES UN EJEMPLO DE FORMATO. NO DESCRIBE HECHOS REALES.\n\nCuando una noticia se apoya sobre todo en el relato del remitente, se marca como «Testimonio» y se dice qué no se pudo comprobar.\n\nSegún el remitente, un grupo de jugadores terminó una construcción grande en su base. Moderación no pudo verificar las fechas exactas.',
 'construcciones', '2026-10-25', 'Remitente anónimo', 'testimonio', 'Ejemplo: no se pudo confirmar la duración de la obra.', true, '2026-10-28T18:30:00Z', null),
('[DEMO] Ejemplo: cómo se publica un reporte del servidor',
 'Ejemplo de reporte: describe un comportamiento observado sin atribuir causas ni culpas.',
 E'ESTE TEXTO ES UN EJEMPLO DE FORMATO. NO DESCRIBE HECHOS REALES.\n\nUn reporte describe lo que varios jugadores observaron, con fecha aproximada y evidencias, sin especular sobre causas ni señalar a personas.\n\nSi el equipo del servidor publica información oficial, la gaceta enlaza a esa fuente en lugar de interpretarla.',
 'reportes', '2026-10-20', 'Equipo de la gaceta (demo)', 'testimonio', 'Ejemplo: relato de varios remitentes, sin confirmación oficial.', true, '2026-10-21T12:00:00Z', 'Ejemplo de nota de corrección: se ajustó la fecha aproximada.');

-- ---------------------------------------------------------------------
-- PARA AGREGAR UN MODERADOR (ejecútalo aparte, después de que esa
-- persona haya entrado al sitio al menos una vez con Discord):
--
--   insert into public.moderators (user_id) values ('PEGA-AQUÍ-SU-ID');
--
-- Cada persona ve su ID en la sección "Mis envíos" del sitio.
-- ---------------------------------------------------------------------
