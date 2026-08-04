'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const skillOptions = ['Sou craque', 'Muito bom', 'Tô na média', 'Ruinzinho', 'Sou bagre'];

type Perfil = {
  id: string;
  nome: string | null;
  celular: string | null;
  nivel_habilidade: string | null;
};

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ nome: '', celular: '', nivel_habilidade: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    const loadPerfil = async () => {
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
      setEmail(user.email ?? '');

      const { data, error: perfilError } = await supabase
        .from('perfis')
        .select('id, nome, celular, nivel_habilidade')
        .eq('id', user.id)
        .maybeSingle();

      if (!perfilError && data) {
        setPerfil(data);
        setForm({
          nome: data.nome ?? '',
          celular: data.celular ?? '',
          nivel_habilidade: data.nivel_habilidade ?? '',
        });
      }

      setLoading(false);
    };

    loadPerfil();
  }, [router]);

  const handleStartEdit = () => {
    setForm({
      nome: perfil?.nome ?? '',
      celular: perfil?.celular ?? '',
      nivel_habilidade: perfil?.nivel_habilidade ?? '',
    });
    setStatus('');
    setError('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    setSaving(true);
    setError('');
    setStatus('');

    const nome = form.nome.trim();

    const { error: saveError } = await supabase.from('perfis').upsert({
      id: userId,
      nome,
      celular: form.celular,
      nivel_habilidade: form.nivel_habilidade,
    });

    setSaving(false);

    if (saveError) {
      setError('Não foi possível salvar as alterações. Tente novamente.');
      return;
    }

    setPerfil({ id: userId, nome, celular: form.celular, nivel_habilidade: form.nivel_habilidade });
    setIsEditing(false);
    setStatus('Perfil atualizado com sucesso!');
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando perfil...</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
        </div>

        <h1 className="mb-6 text-center text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">
          Meu perfil
        </h1>

        {status ? (
          <div className="mb-5 rounded-xl border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">
            {status}
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="nome" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div>
              <label htmlFor="celular" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Celular
              </label>
              <input
                id="celular"
                type="tel"
                value={form.celular}
                onChange={(event) => setForm((current) => ({ ...current, celular: formatPhone(event.target.value) }))}
                placeholder="(99) 99999-9999"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div>
              <label htmlFor="skill" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Qual seu nível de habilidade?
              </label>
              <select
                id="skill"
                value={form.nivel_habilidade}
                onChange={(event) => setForm((current) => ({ ...current, nivel_habilidade: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="" className="text-slate-400">
                  Selecione
                </option>
                {skillOptions.map((option) => (
                  <option key={option} value={option} className="text-white bg-slate-900">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-red-500 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Nome</p>
              <p className="mt-1 text-lg font-bold text-white">{perfil?.nome || '—'}</p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">E-mail</p>
              <p className="mt-1 text-lg font-bold text-white">{email || '—'}</p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Celular</p>
              <p className="mt-1 text-lg font-bold text-white">{perfil?.celular || '—'}</p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Nível de habilidade</p>
              <p className="mt-1 text-lg font-bold text-white">{perfil?.nivel_habilidade || '—'}</p>
            </div>

            <button
              type="button"
              onClick={handleStartEdit}
              className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
            >
              Editar Perfil
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
