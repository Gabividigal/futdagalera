'use client';

import { useSearchParams } from 'next/navigation';

export default function SalaPage() {
  const searchParams = useSearchParams();
  const codigoConvite = searchParams.get('codigo') ?? 'XXXXXX';
  const nomeSala = searchParams.get('nome') ?? 'Sala';

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

      <div className="relative z-10 w-full max-w-xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 px-6 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-300">Sala criada</p>
        <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.12em] text-white">{nomeSala}</h1>
        <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm uppercase tracking-[0.14em] text-slate-300">Código de convite</p>
          <p className="mt-2 text-3xl font-black tracking-[0.2em] text-white">{codigoConvite}</p>
        </div>
      </div>
    </main>
  );
}
