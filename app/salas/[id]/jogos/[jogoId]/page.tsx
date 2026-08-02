'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Jogo = {
  id: string;
  sala_id: string;
  data: string;
  hora: string;
};

type Presenca = {
  user_id: string;
  nome: string;
};

const formatDisplayDate = (date: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
};

export default function JogoDetalhePage() {
  const params = useParams<{ id: string; jogoId: string }>();
  const salaId = params?.id;
  const jogoId = params?.jogoId;

  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salaId || !jogoId) return;

    const loadJogo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      const { data: jogoData, error: jogoError } = await supabase
        .from('jogos')
        .select('*')
        .eq('id', jogoId)
        .single();

      if (!jogoError && jogoData) {
        setJogo(jogoData as Jogo);
      }

      const { data: presencasData, error: presencasError } = await supabase
        .from('presencas')
        .select('user_id, perfis!user_id(nome)')
        .eq('jogo_id', jogoId);

      if (!presencasError && presencasData) {
        const presencasComNome = presencasData.map((presenca) => {
          const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
            ? (presenca as { perfis?: { nome?: string | null }[] }).perfis?.[0]
            : (presenca as { perfis?: { nome?: string | null } | null }).perfis;

          return {
            user_id: presenca.user_id,
            nome: perfil?.nome || 'Usuário sem nome',
          } as Presenca;
        });

        setPresencas(presencasComNome);

        if (user) {
          setConfirmado(presencasComNome.some((membro) => membro.user_id === user.id));
        }
      }

      setLoading(false);
    };

    loadJogo();
  }, [salaId, jogoId]);

  const handleConfirmarPresenca = async () => {
    if (!currentUserId || !jogoId) return;

    const { error } = await supabase.from('presencas').insert([
      {
        jogo_id: jogoId,
        user_id: currentUserId,
      },
    ]);

    if (!error) {
      const { data: presencasAtualizadas, error: presencasError } = await supabase
        .from('presencas')
        .select('user_id, perfis!user_id(nome)')
        .eq('jogo_id', jogoId);

      if (!presencasError && presencasAtualizadas) {
        const novasPresencas = presencasAtualizadas.map((presenca) => {
          const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
            ? (presenca as { perfis?: { nome?: string | null }[] }).perfis?.[0]
            : (presenca as { perfis?: { nome?: string | null } | null }).perfis;

          return {
            user_id: presenca.user_id,
            nome: perfil?.nome || 'Usuário sem nome',
          } as Presenca;
        });

        setPresencas(novasPresencas);
        setConfirmado(novasPresencas.some((membro) => membro.user_id === currentUserId));
      }
    }
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4 py-10 text-white">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(190,24,24,0.28),_transparent_35%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(9,9,11,0.9),_rgba(16,20,24,0.96))]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(34,197,94,0.15), rgba(17,24,39,0.7)),
                radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 62%)`,
              backgroundSize: '28px 28px, 28px 28px, 100% 100%, 100% 100%',
            }}
          />
        </div>

        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando fut...</p>
        </div>
      </main>
    );
  }

  if (!jogo) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4 py-10 text-white">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(190,24,24,0.28),_transparent_35%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(9,9,11,0.9),_rgba(16,20,24,0.96))]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(34,197,94,0.15), rgba(17,24,39,0.7)),
                radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 62%)`,
              backgroundSize: '28px 28px, 28px 28px, 100% 100%, 100% 100%',
            }}
          />
        </div>

        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Fut não encontrado.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4 py-10 text-white">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(190,24,24,0.28),_transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(9,9,11,0.9),_rgba(16,20,24,0.96))]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(34,197,94,0.15), rgba(17,24,39,0.7)),
              radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 62%)`,
            backgroundSize: '28px 28px, 28px 28px, 100% 100%, 100% 100%',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-3xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/salas/${salaId}`} className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Fut marcado</p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.12em] text-white sm:text-3xl">
            Fut em {formatDisplayDate(jogo.data)} às {jogo.hora.slice(0, 5)}
          </h1>
        </div>

        {currentUserId ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleConfirmarPresenca}
              disabled={confirmado}
              className={[
                'w-full rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200',
                confirmado
                  ? 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none'
                  : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40',
              ].join(' ')}
            >
              {confirmado ? 'Presença confirmada' : 'Confirmar presença'}
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Presenças confirmadas</h2>

          {presencas.length === 0 ? (
            <p className="text-slate-300">Ainda não há confirmações para este fut.</p>
          ) : (
            <ul className="space-y-2">
              {presencas.map((presenca) => (
                <li key={presenca.user_id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  {presenca.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
