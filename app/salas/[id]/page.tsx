'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Sala = {
  id: string;
  nome: string;
  codigo_convite: string;
  admin_id: string;
};

type Membro = {
  user_id: string;
  nome: string;
};

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [sala, setSala] = useState<Sala | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadSala = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      const { data: salaData, error: salaError } = await supabase
        .from('salas')
        .select('*')
        .eq('id', id)
        .single();

      if (!salaError && salaData) {
        setSala(salaData as Sala);
      }

      const { data: membrosData, error: membrosError } = await supabase
        .from('membros_sala')
        .select('user_id, perfis!user_id(nome)')
        .eq('sala_id', id);

      if (!membrosError && membrosData) {
        const membrosComNome = membrosData.map((membro) => {
          const perfil = Array.isArray((membro as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
            ? (membro as { perfis?: { nome?: string | null }[] }).perfis?.[0]
            : (membro as { perfis?: { nome?: string | null } | null }).perfis;

          return {
            user_id: membro.user_id,
            nome: perfil?.nome || 'Usuário sem nome',
          } as Membro;
        });

        setMembros(membrosComNome);
      }
    };

    loadSala();
  }, [id]);

  const handleCopyCode = async () => {
    if (!sala?.codigo_convite) return;

    await navigator.clipboard.writeText(sala.codigo_convite);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!sala) {
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
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando sala...</p>
        </div>
      </main>
    );
  }

  const isAdmin = currentUserId === sala.admin_id;

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
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-300">Sala</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">
            {sala.nome}
          </h1>
        </div>

        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Código de convite</p>
              <p className="mt-2 text-2xl font-black tracking-[0.2em] text-white">{sala.codigo_convite}</p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
            >
              {copied ? 'Copiado!' : 'Copiar código'}
            </button>
          </div>
        </div>

        {isAdmin ? (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Você é o administrador desta sala
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Membros</h2>

          {membros.length === 0 ? (
            <p className="text-slate-300">Nenhum membro encontrado nesta sala.</p>
          ) : (
            <ul className="space-y-2">
              {membros.map((membro) => (
                <li key={membro.user_id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  {membro.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
