alter table public.jogos
add column if not exists notas_liberadas boolean not null default false;

create or replace function public.obter_resumo_avaliacoes(p_jogo_id uuid)
returns table (
  avaliadores_distintos bigint,
  total_elegiveis bigint,
  avaliado_id uuid,
  media_parcial numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_allowed boolean;
  v_avaliadores_distintos bigint;
  v_total_elegiveis bigint;
begin
  select exists (
    select 1
    from public.jogos j
    join public.salas s on s.id = j.sala_id
    where j.id = p_jogo_id
      and auth.uid() is not null
      and (s.admin_id = auth.uid() or s.cohost_id = auth.uid())
  )
  into v_is_allowed;

  if not v_is_allowed then
    raise exception 'Acesso negado';
  end if;

  select count(distinct a.avaliador_id)
  into v_avaliadores_distintos
  from public.avaliacoes a
  where a.jogo_id = p_jogo_id;

  select count(distinct p.user_id)
  into v_total_elegiveis
  from public.presencas p
  where p.jogo_id = p_jogo_id
    and p.user_id is not null
    and p.nome_convidado is null;

  return query
  with elegiveis as (
    select distinct p.user_id as avaliado_id
    from public.presencas p
    where p.jogo_id = p_jogo_id
      and p.user_id is not null
      and p.nome_convidado is null
  ),
  medias as (
    select a.avaliado_id, avg(a.nota) as media_parcial
    from public.avaliacoes a
    where a.jogo_id = p_jogo_id
    group by a.avaliado_id
  )
  select
    v_avaliadores_distintos,
    v_total_elegiveis,
    e.avaliado_id,
    m.media_parcial
  from elegiveis e
  left join medias m on m.avaliado_id = e.avaliado_id

  union all

  select
    v_avaliadores_distintos,
    v_total_elegiveis,
    null::uuid,
    null::numeric
  where not exists (
    select 1
    from public.presencas p
    where p.jogo_id = p_jogo_id
      and p.user_id is not null
      and p.nome_convidado is null
  );
end;
$$;

create or replace function public.liberar_notas_jogo(p_jogo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_allowed boolean;
begin
  select exists (
    select 1
    from public.jogos j
    join public.salas s on s.id = j.sala_id
    where j.id = p_jogo_id
      and auth.uid() is not null
      and (s.admin_id = auth.uid() or s.cohost_id = auth.uid())
  )
  into v_is_allowed;

  if not v_is_allowed then
    raise exception 'Acesso negado';
  end if;

  update public.jogos
  set notas_liberadas = true
  where id = p_jogo_id;
end;
$$;

create or replace function public.obter_medias_publicas(p_jogo_id uuid)
returns table (avaliado_id uuid, media numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.jogos j
    where j.id = p_jogo_id
      and j.notas_liberadas = true
  ) then
    return;
  end if;

  return query
  select
    a.avaliado_id,
    avg(a.nota) as media
  from public.avaliacoes a
  where a.jogo_id = p_jogo_id
  group by a.avaliado_id;
end;
$$;

revoke all on function public.obter_resumo_avaliacoes(uuid) from public;
revoke all on function public.liberar_notas_jogo(uuid) from public;
grant execute on function public.obter_resumo_avaliacoes(uuid) to authenticated;
grant execute on function public.liberar_notas_jogo(uuid) to authenticated;
grant execute on function public.obter_medias_publicas(uuid) to authenticated;
