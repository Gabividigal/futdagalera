create or replace function public.obter_historico_jogador(
  p_user_id uuid,
  p_sala_id uuid
)
returns table (
  jogo_id uuid,
  data date,
  hora time,
  media numeric
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
    j.id as jogo_id,
    j.data,
    j.hora,
    avg(a.nota) as media
  from public.jogos j
  join public.avaliacoes a on a.jogo_id = j.id and a.avaliado_id = p_user_id
  where j.sala_id = p_sala_id
    and j.notas_liberadas = true
  group by j.id, j.data, j.hora
  order by j.data desc, j.hora desc;
end;
$$;

grant execute on function public.obter_historico_jogador(uuid, uuid) to authenticated;
