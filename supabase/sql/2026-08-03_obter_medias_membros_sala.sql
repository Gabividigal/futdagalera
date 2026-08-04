create or replace function public.obter_medias_membros_sala(p_sala_id uuid)
returns table (
  user_id uuid,
  media numeric,
  total_avaliacoes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_member boolean;
begin
  select exists (
    select 1
    from public.membros_sala m
    where m.sala_id = p_sala_id
      and m.user_id = auth.uid()
  )
  into v_is_member;

  if not v_is_member then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    a.avaliado_id as user_id,
    avg(a.nota) as media,
    count(a.id) as total_avaliacoes
  from public.avaliacoes a
  join public.jogos j on j.id = a.jogo_id
  where j.sala_id = p_sala_id
    and j.notas_liberadas = true
  group by a.avaliado_id;
end;
$$;

grant execute on function public.obter_medias_membros_sala(uuid) to authenticated;
