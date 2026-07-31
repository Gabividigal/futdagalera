export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-8">
      <div className="w-full max-w-xl rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Pelada AVM
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          App pronto para Supabase e Vercel
        </h1>
        <p className="mt-4 text-base text-slate-300">
          Estrutura inicial configurada com Next.js, TypeScript, Tailwind CSS e cliente do Supabase.
        </p>
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
          Variáveis esperadas: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
        </div>
      </div>
    </main>
  );
}
