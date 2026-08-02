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

type Jogo = {
  id: string;
  data: string;
  hora: string;
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const horas = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0'));
const minutos = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));

const formatDateISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date: Date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [sala, setSala] = useState<Sala | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [proximosJogos, setProximosJogos] = useState<Jogo[]>([]);

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

      const hoje = new Date();
      const hojeISO = formatDateISO(hoje);
      const { data: jogosData, error: jogosError } = await supabase
        .from('jogos')
        .select('*')
        .eq('sala_id', id)
        .gte('data', hojeISO)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (!jogosError && jogosData) {
        setProximosJogos(jogosData as Jogo[]);
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

  const isPastDate = (date: Date) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return date < hoje;
  };

  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth);

  const getCalendarDays = () => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const cells: Array<Date | null> = [];

    for (let index = 0; index < totalCells; index += 1) {
      const dayNumber = index - startOffset + 1;
      if (dayNumber <= 0 || dayNumber > lastDay.getDate()) {
        cells.push(null);
        continue;
      }

      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber));
    }

    return cells;
  };

  const handleConfirmarFut = async () => {
    if (!selectedDate || !selectedHour || !selectedMinute || !currentUserId || !id) return;

    const { error } = await supabase.from('jogos').insert([
      {
        sala_id: id,
        data: formatDateISO(selectedDate),
        hora: `${selectedHour}:${selectedMinute}:00`,
        criado_por: currentUserId,
      },
    ]);

    if (!error) {
      const dataFormatada = formatDisplayDate(selectedDate);
      setSuccessMessage(`Fut marcado para ${dataFormatada} às ${selectedHour}:${selectedMinute}`);
      setShowCalendar(false);
      setSelectedDate(null);
      setSelectedHour(null);
      setSelectedMinute(null);

      const hoje = new Date();
      const hojeISO = formatDateISO(hoje);
      const { data: jogosAtualizados } = await supabase
        .from('jogos')
        .select('*')
        .eq('sala_id', id)
        .gte('data', hojeISO)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (jogosAtualizados) {
        setProximosJogos(jogosAtualizados as Jogo[]);
      }
    }
  };

  const isConfirmDisabled = !selectedDate || !selectedHour || !selectedMinute;
  const calendarDays = getCalendarDays();

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

        {isAdmin ? (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <button
              type="button"
              onClick={() => setShowCalendar((value) => !value)}
              className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
            >
              Marcar Fut
            </button>

            {showCalendar ? (
              <div className="mt-4 rounded-2xl border border-red-500/40 bg-[#111214]/90 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-xl text-white hover:border-red-500"
                    aria-label="Mês anterior"
                  >
                    &lt;
                  </button>
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-red-200">{monthName}</p>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-xl text-white hover:border-red-500"
                    aria-label="Próximo mês"
                  >
                    &gt;
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {diasSemana.map((dia) => (
                    <span key={dia}>{dia}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="h-11 rounded-xl border border-slate-800 bg-slate-950/40" />;
                    }

                    const disabled = isPastDate(day);
                    const isSelected = selectedDate && selectedDate.toDateString() === day.toDateString();

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedDate(day)}
                        className={[
                          'flex h-11 items-center justify-center rounded-xl border text-sm font-bold transition',
                          disabled ? 'cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-500' : 'border-slate-700 bg-slate-900/60 text-white hover:border-red-500',
                          isSelected ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-900/30' : '',
                        ].join(' ')}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                {selectedDate ? (
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">Hora</p>
                      <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto pr-1">
                        {horas.map((hora) => (
                          <button
                            key={hora}
                            type="button"
                            onClick={() => setSelectedHour(hora)}
                            className={[
                              'rounded-lg border px-2 py-2 text-sm font-bold transition',
                              selectedHour === hora ? 'border-red-500 bg-red-600 text-white' : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-red-500',
                            ].join(' ')}
                          >
                            {hora}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">Minuto</p>
                      <div className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto pr-1">
                        {minutos.map((minuto) => (
                          <button
                            key={minuto}
                            type="button"
                            onClick={() => setSelectedMinute(minuto)}
                            className={[
                              'rounded-lg border px-2 py-2 text-sm font-bold transition',
                              selectedMinute === minuto ? 'border-red-500 bg-red-600 text-white' : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-red-500',
                            ].join(' ')}
                          >
                            {minuto}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmarFut}
                      disabled={isConfirmDisabled}
                      className={[
                        'w-full rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200',
                        isConfirmDisabled ? 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none' : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40',
                      ].join(' ')}
                    >
                      Confirmar Fut
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Próximos jogos</h2>

          {proximosJogos.length === 0 ? (
            <p className="text-slate-300">Nenhum jogo marcado para esta sala.</p>
          ) : (
            <ul className="space-y-2">
              {proximosJogos.map((jogo) => (
                <li key={jogo.id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }).format(new Date(`${jogo.data}T00:00:00`))} — {jogo.hora.slice(0, 5)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

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
