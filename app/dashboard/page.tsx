'use client';

import Image from 'next/image';

export default function DashboardPage() {
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

      <div className="relative z-10 w-full max-w-2xl px-4 text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-red-500/70 bg-white/5 shadow-[0_0_30px_rgba(127,29,29,0.45)]">
            <Image src="/logo.JPG" alt="Logo Arena Vovô Mau" width={90} height={90} priority className="object-cover" />
          </div>
        </div>

        <h1 className="text-4xl font-black uppercase tracking-[0.12em] text-white sm:text-5xl lg:text-6xl">
          Fut na Arena Vovô Mau
        </h1>
      </div>
    </main>
  );
}
