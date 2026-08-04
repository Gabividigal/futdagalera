drop policy if exists "Usuarios podem inserir suas proprias avaliacoes" on public.avaliacoes;

create policy "Usuarios podem inserir suas proprias avaliacoes"
on public.avaliacoes
for insert
to authenticated
with check (
  auth.uid() = avaliador_id
  and exists (
    select 1
    from public.presencas p
    where p.jogo_id = avaliacoes.jogo_id
      and p.user_id = auth.uid()
      and p.nome_convidado is null
  )
);
