'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Placeholder para integração futura com autenticação real
    return;
  };

  const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Digite um e-mail válido.');
      return;
    }

    setError('');
    await handleLogin();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0d] px-4 py-10 text-white">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(185,28,28,0.28),_transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(15,23,42,0.6),_rgba(2,6,23,0.95))]" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(16,185,129,0.14), rgba(3,7,18,0.75)),
            radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)`,
          backgroundSize: '36px 36px, 36px 36px, 100% 100%, 100% 100%',
        }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_0%,_rgba(255,255,255,0)_60%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-[28px] border border-red-800/60 bg-[#111214]/90 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="border-b border-red-900/70 bg-gradient-to-r from-[#1a0707] via-[#230a0a] to-[#110b0e] px-6 pb-8 pt-8">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-red-500/60 bg-white/5 shadow-lg shadow-red-900/40">
                <Image src="/logo.jpg" alt="Logo Arena do Maurício" width={120} height={120} priority className="object-cover" />
              </div>

              <h1 className="text-center text-3xl font-black uppercase tracking-[0.08em] text-white">
                Arena do Maurício
              </h1>
            </div>
          </div>

          <div className="px-5 pb-7 pt-6 sm:px-7">
            <div className="mb-5 flex items-center justify-center gap-3 text-red-400">
              <svg
                viewBox="0 0 64 64"
                aria-hidden="true"
                className="h-8 w-8 text-red-400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" />
                <path d="M32 12c-4 8-5 14-5 20s2 12 5 20c3-8 5-14 5-20s-1-12-5-20Z" stroke="currentColor" strokeWidth="3"/>
                <path d="M12 32c8-4 14-5 20-5s12 1 20 5c-8 4-14 5-20 5s-12-1-20-5Z" stroke="currentColor" strokeWidth="3"/>
                <path d="M20 20l24 24M44 20L20 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">
                Clube
              </span>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Sua senha"
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

              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor="remember" className="flex items-center gap-2 text-slate-300">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-red-600 focus:ring-red-500"
                  />
                  <span>Lembrar-me</span>
                </label>

                <Link href="/recuperar-senha" className="font-medium text-red-300 transition hover:text-red-200">
                  Esqueci minha senha
                </Link>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-base font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-red-800/40 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              >
                Entrar
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-300">
              Não tem conta?{' '}
              <Link href="/cadastro" className="font-semibold text-red-300 transition hover:text-red-200">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
