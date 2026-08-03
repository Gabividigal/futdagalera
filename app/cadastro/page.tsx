'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const skillOptions = ['Sou craque', 'Muito bom', 'Tô na média', 'Ruinzinho', 'Sou bagre'];

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    skill: false,
    password: false,
    confirmPassword: false,
  });

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
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = password.length >= 6 && password === confirmPassword;

  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isPhoneValid &&
    isSkillValid &&
    isPasswordValid &&
    isConfirmPasswordValid;

  const handleCreateAccount = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: name,
          celular: phone,
          nivel_habilidade: skill,
        },
      },
    });

    if (error) {
      const normalizedMessage = error.message.toLowerCase();

      if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
        setSubmitError('Este e-mail já está cadastrado');
      } else if (normalizedMessage.includes('password')) {
        setSubmitError('A senha não atende aos requisitos mínimos');
      } else {
        setSubmitError('Não foi possível criar a conta. Tente novamente.');
      }

      setTouched({ name: true, email: true, phone: true, skill: true, password: true, confirmPassword: true });
      return;
    }

    if (data.user) {
      setSubmitError('');
      router.push('/login');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setTouched({
        name: true,
        email: true,
        phone: true,
        skill: true,
        password: true,
        confirmPassword: true,
      });
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
            : field === 'skill'
              ? isSkillValid
              : field === 'password'
                ? isPasswordValid
                : isConfirmPasswordValid;

    if (isValid) return null;

    return <p className="mt-1 text-xs text-red-300">{message}</p>;
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
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
            {submitError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {submitError}
              </div>
            ) : null}

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

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
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
              {renderFieldError('password', 'A senha deve ter no mínimo 6 caracteres.')}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
                Confirme sua senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita sua senha"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 pr-11 text-base text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                >
                  {showConfirmPassword ? (
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
              {renderFieldError('confirmPassword', 'As senhas não coincidem.')}
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
