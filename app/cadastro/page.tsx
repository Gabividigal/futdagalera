'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const skillOptions = ['Sou craque', 'Muito bom', 'Tô na média', 'Ruinzinho', 'Sou bagre'];

export default function CadastroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false, phone: false, skill: false });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = emailRegex.test(email.trim());
  const isPhoneValid = /^\(\d{2}\) \d{5}-\d{4}$/.test(phone);
  const isSkillValid = Boolean(skill);

  const isFormValid = isNameValid && isEmailValid && isPhoneValid && isSkillValid;

  const handleCreateAccount = async () => {
    // Placeholder para integração futura com cadastro real.
    return;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setTouched({ name: true, email: true, phone: true, skill: true });
      return;
    }

    await handleCreateAccount();
  };

  const renderFieldError = (field: keyof typeof touched, message: string) => {
    if (!touched[field]) return null;

    const isValid =
      field === 'name'
        ? isNameValid
        : field === 'email'
          ? isEmailValid
          : field === 'phone'
            ? isPhoneValid
            : isSkillValid;

    if (isValid) return null;

    return <p className="mt-1 text-xs text-red-300">{message}</p>;
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
          <div className="mb-4 flex items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-red-500/70 bg-white/5 shadow-[0_0_20px_rgba(127,29,29,0.45)]">
              <Image src="/logo.JPG" alt="Logo Arena Vovô Mau" width={72} height={72} priority className="object-cover" />
            </div>
          </div>

          <h1 className="mb-6 text-center text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">
            Criar conta
          </h1>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome completo"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              {renderFieldError('name', 'Informe um nome válido.')}
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              {renderFieldError('email', 'Digite um e-mail válido.')}
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Celular
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(99) 99999-9999"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              {renderFieldError('phone', 'Informe o celular completo no formato (99) 99999-9999.')}
            </div>

            <div>
              <label htmlFor="skill" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Qual seu nível de habilidade?
              </label>
              <select
                id="skill"
                value={skill}
                onBlur={() => setTouched((prev) => ({ ...prev, skill: true }))}
                onChange={(event) => setSkill(event.target.value)}
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
              {renderFieldError('skill', 'Selecione seu nível de habilidade.')}
            </div>

            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full rounded-xl px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                isFormValid
                  ? 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40'
                  : 'cursor-not-allowed bg-slate-600 text-slate-300 shadow-none'
              }`}
            >
              Criar conta
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-bold text-red-300 transition hover:text-red-200">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
