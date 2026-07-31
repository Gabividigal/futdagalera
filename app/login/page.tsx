'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Placeholder para integração futura com autenticação real.
    return;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setError('Preencha e-mail/usuário e senha para continuar.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(identifier) && identifier.trim().length < 3) {
      setError('Informe um e-mail válido ou um usuário com no mínimo 3 caracteres.');
      return;
    }

    setError('');
    await handleLogin();
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
          <div className="mb-5 text-center">
            <h1 className="text-4xl font-black uppercase tracking-[0.12em] text-white sm:text-5xl">
              ARENA VOVÔ MAU
            </h1>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-red-500/70 bg-white/5 shadow-[0_0_30px_rgba(127,29,29,0.45)]">
              <Image src="/logo.JPG" alt="Logo Arena Vovô Mau" width={120} height={120} priority className="object-cover" />
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center gap-3 text-red-400">
            <svg viewBox="0 0 64 64" aria-hidden="true" className="h-7 w-7 text-red-400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="3" />
              <path d="M32 11c-4 7-6 13-6 20s2 13 6 22c4-9 6-15 6-22s-2-13-6-20Z" stroke="currentColor" strokeWidth="3" />
              <path d="M11 32c8-4 14-6 21-6s13 2 21 6c-8 4-14 6-21 6s-13-2-21-6Z" stroke="currentColor" strokeWidth="3" />
              <path d="M20 20l24 24M44 20L20 44" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-red-300">Club</span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                E-mail ou usuário
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="seu@email.com ou usuario"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 pr-11 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path d="M3 3l18 18" strokeLinecap="round" />
                      <path d="M10.58 10.58A2 2 0 0013.41 13.41" strokeLinecap="round" />
                      <path d="M9.88 5.08A10.94 10.94 0 0112 5c4.97 0 9 4.48 9 7a12.28 12.28 0 01-3.44 5.17M6.61 6.61A12.64 12.64 0 003 12c0 2.52 4.03 7 9 7 1.62 0 3.12-.31 4.46-.86" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            Ainda não tem uma conta?{' '}
            <Link href="/cadastro" className="font-bold text-red-300 transition hover:text-red-200">
              Criar login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
