'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Sala = {
  id: string;
  nome: string;
  descricao?: string | null;
  tamanho_time?: number | null;
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

const formatDisplayDate = (date: Date | string) => {
  const safeDate = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(safeDate);
};

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const gerarDiasDisponiveis = () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return Array.from({ length: 60 }, (_, index) => {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + index);

    if (index === 0) {
      return { key: formatLocalDateKey(data), label: 'Hoje' };
    }

    if (index === 1) {
      return { key: formatLocalDateKey(data), label: 'Amanhã' };
    }

    const formatted = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(data);

    const normalized = formatted
      .replace('.', '')
      .replace(/^./, (char) => char.toUpperCase())
      .replace(/\s+(\d)/, ' $1');

    const [weekday, dayText, monthText] = normalized.split(' ');
    const shortMonth = monthText ? monthText.charAt(0).toUpperCase() + monthText.slice(1) : monthText;

    return {
      key: formatLocalDateKey(data),
      label: `${weekday}, ${dayText} ${shortMonth}`,
    };
  });
};

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [sala, setSala] = useState<Sala | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateKey(new Date()));
  const [selectedHour, setSelectedHour] = useState<string>('00');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [proximosJogos, setProximosJogos] = useState<Jogo[]>([]);
  const diaOptions = gerarDiasDisponiveis();
  const diaColumnRef = useRef<HTMLDivElement | null>(null);
  const horaColumnRef = useRef<HTMLDivElement | null>(null);
  const minutoColumnRef = useRef<HTMLDivElement | null>(null);
  const diaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const horaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const minutoItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  useEffect(() => {
    if (!showCalendar) return;

    const scrollColumnToSelected = (
      container: HTMLDivElement | null,
      itemRefs: Record<string, HTMLButtonElement | null>,
      selectedValue: string,
    ) => {
      if (!container) return;
      const selectedItem = itemRefs[selectedValue];
      if (!selectedItem) return;

      selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    scrollColumnToSelected(diaColumnRef.current, diaItemRefs.current, selectedDate);
    scrollColumnToSelected(horaColumnRef.current, horaItemRefs.current, selectedHour);
    scrollColumnToSelected(minutoColumnRef.current, minutoItemRefs.current, selectedMinute);
  }, [showCalendar, selectedDate, selectedHour, selectedMinute]);

  const syncSelectionFromScroll = (
    container: HTMLDivElement | null,
    items: Record<string, HTMLButtonElement | null>,
    values: string[],
    setter: (value: string) => void,
  ) => {
    if (!container) return;

    const center = container.scrollTop + container.clientHeight / 2;
    let closestValue = values[0];
    let smallestDistance = Number.POSITIVE_INFINITY;

    values.forEach((value) => {
      const node = items[value];
      if (!node) return;

      const nodeCenter = node.offsetTop + node.offsetHeight / 2;
      const distance = Math.abs(nodeCenter - center);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestValue = value;
      }
    });

    setter(closestValue);
  };

  const handleConfirmarFut = async () => {
    if (!selectedDate || !selectedHour || !selectedMinute || !currentUserId || !id) return;

    const { error } = await supabase.from('jogos').insert([
      {
        sala_id: id,
        data: selectedDate,
        hora: `${selectedHour}:${selectedMinute}:00`,
        criado_por: currentUserId,
      },
    ]);

    if (!error) {
      setShowSuccessModal(true);
      setShowCalendar(false);
      setSelectedDate(formatLocalDateKey(new Date()));
      setSelectedHour('00');
      setSelectedMinute('00');

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

  const getWheelItemClasses = (value: string, selectedValue: string, options: string[]) => {
    const selectedIndex = options.indexOf(selectedValue);
    const valueIndex = options.indexOf(value);
    const distance = Math.abs(valueIndex - selectedIndex);
    const opacity = Math.max(0.2, 1 - distance * 0.17);
    const textSize = distance === 0 ? 'text-base' : distance === 1 ? 'text-sm' : 'text-xs';

    if (value === selectedValue) {
      return `text-base font-extrabold text-red-500 opacity-100`;
    }

    return `${textSize} font-medium text-slate-400 opacity-${Math.round(opacity * 100)}`;
  };

  if (!sala) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando sala...</p>
        </div>
      </main>
    );
  }

  const isAdmin = currentUserId === sala.admin_id;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <div className="mb-4 w-full max-w-3xl">
        <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
          ← Voltar
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-3xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-300">Sala</p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <h1 className="text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl">
              {sala.nome}
            </h1>

            {sala.tamanho_time ? (
              <span className="inline-flex items-center rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-200">
                Times de {sala.tamanho_time}
              </span>
            ) : null}
          </div>

          {sala.descricao ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{sala.descricao}</p>
          ) : null}
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
                <div className="mb-4 flex items-center justify-center">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-red-200">Escolha o horário</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="relative">
                    <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Dia</p>
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-xl border border-red-500/40 bg-red-500/5" />
                    <div
                      ref={diaColumnRef}
                      onScroll={() => {
                        const timer = setTimeout(() => {
                          syncSelectionFromScroll(diaColumnRef.current, diaItemRefs.current, diaOptions.map((option) => option.key), setSelectedDate);
                        }, 80);
                        return () => clearTimeout(timer);
                      }}
                      className="h-52 snap-y snap-mandatory overflow-y-auto scroll-smooth"
                    >
                      {diaOptions.map((option) => (
                        <button
                          key={option.key}
                          ref={(element) => {
                            diaItemRefs.current[option.key] = element;
                          }}
                          type="button"
                          onClick={() => setSelectedDate(option.key)}
                          className={[
                            'flex h-12 w-full snap-center items-center justify-center px-2 text-center transition duration-200',
                            getWheelItemClasses(option.key, selectedDate, diaOptions.map((item) => item.key)),
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Hora</p>
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-xl border border-red-500/40 bg-red-500/5" />
                    <div
                      ref={horaColumnRef}
                      onScroll={() => {
                        const timer = setTimeout(() => {
                          syncSelectionFromScroll(horaColumnRef.current, horaItemRefs.current, horas, setSelectedHour);
                        }, 80);
                        return () => clearTimeout(timer);
                      }}
                      className="h-52 snap-y snap-mandatory overflow-y-auto scroll-smooth"
                    >
                      {horas.map((hora) => (
                        <button
                          key={hora}
                          ref={(element) => {
                            horaItemRefs.current[hora] = element;
                          }}
                          type="button"
                          onClick={() => setSelectedHour(hora)}
                          className={[
                            'flex h-12 w-full snap-center items-center justify-center px-2 text-center transition duration-200',
                            getWheelItemClasses(hora, selectedHour, horas),
                          ].join(' ')}
                        >
                          {hora}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Minuto</p>
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-xl border border-red-500/40 bg-red-500/5" />
                    <div
                      ref={minutoColumnRef}
                      onScroll={() => {
                        const timer = setTimeout(() => {
                          syncSelectionFromScroll(minutoColumnRef.current, minutoItemRefs.current, minutos, setSelectedMinute);
                        }, 80);
                        return () => clearTimeout(timer);
                      }}
                      className="h-52 snap-y snap-mandatory overflow-y-auto scroll-smooth"
                    >
                      {minutos.map((minuto) => (
                        <button
                          key={minuto}
                          ref={(element) => {
                            minutoItemRefs.current[minuto] = element;
                          }}
                          type="button"
                          onClick={() => setSelectedMinute(minuto)}
                          className={[
                            'flex h-12 w-full snap-center items-center justify-center px-2 text-center transition duration-200',
                            getWheelItemClasses(minuto, selectedMinute, minutos),
                          ].join(' ')}
                        >
                          {minuto}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
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
              </div>
            ) : null}
          </div>
        ) : null}

        {showSuccessModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="relative w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                aria-label="Fechar modal"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
              >
                ×
              </button>

              <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">
                Seu fut foi agendado com sucesso!
              </p>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40"
              >
                OK
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Próximos Futs</h2>

          {proximosJogos.length === 0 ? (
            <p className="text-slate-300">Nenhum jogo marcado para esta sala.</p>
          ) : (
            <ul className="space-y-2">
              {proximosJogos.map((jogo) => (
                <li key={jogo.id} className="rounded-xl border border-slate-700 bg-slate-900/60 text-sm text-slate-200">
                  <Link
                    href={`/salas/${id}/jogos/${jogo.id}`}
                    className="block px-3 py-2 transition hover:bg-slate-800/80"
                  >
                    {formatDisplayDate(jogo.data)} — {jogo.hora.slice(0, 5)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
