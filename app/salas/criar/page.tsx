'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const generateInviteCode = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
};

export default function CriarSalaPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tamanhoTime, setTamanhoTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateSala = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescricao = descricao.trim();
    const normalizedTamanhoTime = tamanhoTime.trim();

    if (!trimmedName) {
      setError('Digite um nome para a sala.');
      return;
    }

    if (normalizedTamanhoTime && (!/^[1-9]\d*$/.test(normalizedTamanhoTime) || Number(normalizedTamanhoTime) > 11)) {
      setError('O tamanho do time deve ser um número inteiro entre 1 e 11.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/login');
        return;
      }

      const codigoConvite = generateInviteCode();
      const tamanhoValue = normalizedTamanhoTime ? Number(normalizedTamanhoTime) : null;

      const { data: salaData, error: salaError } = await supabase
        .from('salas')
        .insert([
          {
            nome: trimmedName,
            descricao: trimmedDescricao || null,
            tamanho_time: tamanhoValue,
            admin_id: user.id,
            codigo_convite: codigoConvite,
          },
        ])
        .select()
        .single();

      if (salaError || !salaData) {
        throw salaError ?? new Error('Erro ao criar sala.');
      }

      const { error: membroError } = await supabase.from('membros_sala').insert([
        {
          sala_id: salaData.id,
          user_id: user.id,
        },
      ]);

      if (membroError) {
        throw membroError;
      }

      router.push(`/salas/${salaData.id}?codigo=${codigoConvite}&nome=${encodeURIComponent(trimmedName)}`);
    } catch (err) {
      console.error(err);
      setError('Não foi possível criar a sala. Tente novamente.');
    } finally {
      setLoading(false);
    }
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

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[28px] border border-red-800/60 bg-[#111214]/90 px-5 py-7 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:px-7">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-red-500/70 bg-white/5 shadow-[0_0_20px_rgba(127,29,29,0.45)]">
              <img src="/logo.JPG" alt="Logo Arena Vovô Mau" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="mb-6 text-center text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">
            Criar sala
          </h1>

          <form onSubmit={handleCreateSala} noValidate className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="salaNome" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Nome da sala
              </label>
              <input
                id="salaNome"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Pelada dos Amigos"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div>
              <label htmlFor="salaDescricao" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Descrição
              </label>
              <textarea
                id="salaDescricao"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Endereço, ponto de referência, outras informações..."
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div>
              <label htmlFor="tamanhoTime" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Tamanho de cada time
              </label>
              <input
                id="tamanhoTime"
                type="number"
                min={1}
                max={11}
                value={tamanhoTime}
                onChange={(event) => setTamanhoTime(event.target.value)}
                placeholder="Quantos jogadores por time?"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                loading
                  ? 'cursor-not-allowed bg-slate-600 text-slate-300 shadow-none'
                  : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40'
              }`}
            >
              {loading ? 'Criando...' : 'Criar sala'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
