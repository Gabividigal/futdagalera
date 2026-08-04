'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase/client';

type Sala = {
  id: string;
  nome: string;
};

type PerfilJogador = {
  nome: string;
  nivel_habilidade?: string | null;
};

type HistoricoJogadorRow = {
  jogo_id: string;
  data: string;
  hora: string;
  media: number | null;
};

const formatDisplayDate = (date: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
};

const formatNivelHabilidadeLabel = (nivel?: string | null) => {
  const normalized = (nivel ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'sou craque':
      return 'Sou Craque';
    case 'muito bom':
      return 'Muito Bom';
    case 'tô na média':
    case 'to na media':
      return 'Tô na Média';
    case 'ruinzinho':
      return 'Ruinzinho';
    case 'sou bagre':
      return 'Sou Bagre';
    default:
      return 'Não informado';
  }
};

export default function PerfilJogadorSalaPage() {
  const params = useParams<{ id: string; userId: string }>();
  const salaId = params?.id;
  const userId = params?.userId;

  const [sala, setSala] = useState<Sala | null>(null);
  const [perfil, setPerfil] = useState<PerfilJogador | null>(null);
  const [historico, setHistorico] = useState<HistoricoJogadorRow[]>([]);
  const [futsJogados, setFutsJogados] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!salaId || !userId) return;

    const loadPerfilJogador = async () => {
      setLoading(true);
      setError('');

      try {
        const [salaResult, perfilResult, historicoResult, jogosResult] = await Promise.all([
          supabase.from('salas').select('id, nome').eq('id', salaId).single(),
          supabase.from('perfis').select('nome, nivel_habilidade').eq('id', userId).single(),
          supabase.rpc('obter_historico_jogador', { p_user_id: userId, p_sala_id: salaId }),
          supabase.from('jogos').select('id').eq('sala_id', salaId),
        ]);

        if (salaResult.error) throw salaResult.error;
        if (perfilResult.error) throw perfilResult.error;
        if (historicoResult.error) throw historicoResult.error;
        if (jogosResult.error) throw jogosResult.error;

        setSala(salaResult.data as Sala);
        setPerfil(perfilResult.data as PerfilJogador);
        setHistorico((historicoResult.data ?? []) as HistoricoJogadorRow[]);

        const jogoIds = (jogosResult.data ?? []).map((jogo) => jogo.id);

        if (jogoIds.length === 0) {
          setFutsJogados(0);
        } else {
          const { count, error: presencasCountError } = await supabase
            .from('presencas')
            .select('id', { count: 'exact', head: true })
            .in('jogo_id', jogoIds)
            .eq('user_id', userId);

          if (presencasCountError) throw presencasCountError;
          setFutsJogados(count ?? 0);
        }
      } catch (loadError) {
        console.error('Erro ao carregar perfil do jogador na sala:', loadError);
        setError('Não foi possível carregar o perfil deste jogador nesta sala.');
      } finally {
        setLoading(false);
      }
    };

    void loadPerfilJogador();
  }, [salaId, userId]);

  const dadosGrafico = useMemo(
    () => [...historico]
      .sort((a, b) => new Date(`${a.data}T${a.hora}`).getTime() - new Date(`${b.data}T${b.hora}`).getTime())
      .map((item) => ({
        label: formatDisplayDate(item.data),
        media: Number((item.media ?? 0).toFixed(1)),
        descricao: `${formatDisplayDate(item.data)} às ${item.hora.slice(0, 5)}`,
      })),
    [historico],
  );

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando perfil...</p>
        </div>
      </main>
    );
  }

  if (error || !sala || !perfil) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <div className="relative z-10 w-full max-w-xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <Link href={`/salas/${salaId}`} className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
          <p className="mt-6 text-lg font-bold uppercase tracking-[0.12em] text-red-300">{error || 'Jogador não encontrado.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <div className="relative z-10 w-full max-w-4xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/salas/${salaId}`} className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Perfil do Jogador</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">{perfil.nome}</h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-red-200">
                {formatNivelHabilidadeLabel(perfil.nivel_habilidade)}
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/50 bg-[#111214]/95 px-6 py-4 text-center shadow-[0_20px_60px_rgba(127,29,29,0.2)]">
              <p className="text-5xl font-black uppercase tracking-[0.06em] text-white">{futsJogados}</p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">futs jogados nessa sala</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Rendimento na Sala</h2>
            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-200">
              {sala.nome}
            </span>
          </div>

          {historico.length === 0 ? (
            <p className="text-slate-300">Ainda não há notas liberadas para este jogador nesta sala.</p>
          ) : (
            <>
              <div className="h-80 rounded-2xl border border-slate-800 bg-[#111214]/80 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <YAxis domain={[0, 10]} stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111214',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '16px',
                        color: '#f8fafc',
                      }}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}`, 'Nota']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.descricao ?? ''}
                    />
                    <Line type="monotone" dataKey="media" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-700 bg-[#111214]/80 p-4">
                <h3 className="mb-3 text-base font-black uppercase tracking-[0.12em] text-white">Últimos Futs</h3>
                <ul className="space-y-2">
                  {historico.map((item) => (
                    <li key={item.jogo_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{formatDisplayDate(item.data)} às {item.hora.slice(0, 5)}</p>
                      </div>
                      <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm font-black text-red-200">
                        {(item.media ?? 0).toFixed(1)} ★
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
