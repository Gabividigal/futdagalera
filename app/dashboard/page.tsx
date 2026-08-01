'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Sala = {
  id: string;
  nome: string;
  codigo_convite: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('membros_sala')
        .select('sala_id, salas ( id, nome, codigo_convite )')
        .eq('user_id', user.id);

      if (!error && data) {
        const mappedSalas = data
          .map((item) => item.salas)
          .filter((sala): sala is Sala => Boolean(sala));

        setSalas(mappedSalas);
      }

      setLoading(false);
    };

    loadDashboard();
  }, [router]);

  const handleJoinByCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    const code = inviteCode.trim().toUpperCase();

    if (!code) {
      setStatus('Digite um código de convite.');
      return;
    }

    const { data: salaEncontrada, error } = await supabase
      .from('salas')
      .select('*')
      .eq('codigo_convite', code)
      .maybeSingle();

    if (error) {
      setStatus('Código inválido');
      return;
    }

    if (!salaEncontrada) {
      setStatus('Código inválido');
      return;
    }

    const { data: membroExistente } = await supabase
      .from('membros_sala')
      .select('id')
      .eq('sala_id', salaEncontrada.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membroExistente) {
      setStatus('Você já faz parte dessa sala');
      return;
    }

    const { error: insertError } = await supabase.from('membros_sala').insert([
      {
        sala_id: salaEncontrada.id,
        user_id: userId,
      },
    ]);

    if (insertError) {
      setStatus('Não foi possível entrar na sala. Tente novamente.');
      return;
    }

    router.push(`/salas/${salaEncontrada.id}`);
  };

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

      <div className="relative z-10 w-full max-w-4xl px-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-red-500/70 bg-white/5 shadow-[0_0_30px_rgba(127,29,29,0.45)]">
            <Image src="/logo.JPG" alt="Logo Arena Vovô Mau" width={90} height={90} priority className="object-cover" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.12em] text-white sm:text-3xl">
            Fut na Arena Vovô Mau
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-black uppercase tracking-[0.12em] text-white">Minhas salas</h2>
              <button
                type="button"
                onClick={() => router.push('/salas/criar')}
                className="rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
              >
                Criar nova sala
              </button>
            </div>

            {loading ? (
              <p className="text-slate-300">Carregando salas...</p>
            ) : salas.length === 0 ? (
              <p className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-slate-300">
                Você ainda não faz parte de nenhuma sala
              </p>
            ) : (
              <div className="space-y-3">
                {salas.map((sala) => (
                  <button
                    key={sala.id}
                    type="button"
                    onClick={() => router.push(`/salas/${sala.id}`)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-left transition hover:border-red-500 hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-white">{sala.nome}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-red-300">Abrir</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-6">
            <h3 className="mb-4 text-lg font-black uppercase tracking-[0.12em] text-white">
              Entrar com código de convite
            </h3>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="K3F9XZ"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
              >
                Entrar
              </button>
            </form>

            {status ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {status}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
