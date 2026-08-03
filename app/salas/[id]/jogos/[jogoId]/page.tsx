'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Jogo = {
  id: string;
  sala_id: string;
  data: string;
  hora: string;
};

type Presenca = {
  user_id: string;
  nome: string;
  nivel_habilidade?: string | null;
  time_numero?: number | null;
};

type Sala = {
  id: string;
  admin_id: string;
  tamanho_time?: number | null;
};

const getNivelHabilidadeValue = (nivel?: string | null) => {
  const valor = (nivel ?? '').trim().toLowerCase();

  switch (valor) {
    case 'sou craque':
      return 5;
    case 'muito bom':
      return 4;
    case 'tô na média':
    case 'to na media':
      return 3;
    case 'ruinzinho':
      return 2;
    case 'sou bagre':
      return 1;
    default:
      return 3;
  }
};

const buildSnakeTimeOrder = (totalTimes: number) => {
  if (totalTimes <= 0) return [];

  const ordem: number[] = [];
  let direction = 1;

  while (ordem.length < totalTimes * 4) {
    if (direction === 1) {
      for (let i = 0; i < totalTimes; i += 1) {
        ordem.push(i);
      }
    } else {
      for (let i = totalTimes - 1; i >= 0; i -= 1) {
        ordem.push(i);
      }
    }

    direction *= -1;
  }

  return ordem;
};

const buildTimesFromAssignments = (jogadores: Presenca[], capacidade: number) => {
  const timesMap = new Map<number, { time: number; jogadores: string[] }>();

  jogadores.forEach((jogador) => {
    const timeNumero = Number(jogador.time_numero ?? 0);
    if (timeNumero <= 0) return;

    const timeAtual = timesMap.get(timeNumero) ?? { time: timeNumero, jogadores: [] };
    timeAtual.jogadores.push(jogador.nome || 'Usuário sem nome');
    timesMap.set(timeNumero, timeAtual);
  });

  const timeCards = Array.from(timesMap.values()).sort((a, b) => a.time - b.time);

  return timeCards.map((timeCard) => ({
    ...timeCard,
    jogadores: [...timeCard.jogadores],
    capacidade,
  }));
};

const gerarDistribuicaoTimes = (jogadores: Presenca[], capacidade: number) => {
  const capacidadeValida = Math.max(1, capacidade || 1);
  const jogadoresOrdenados = [...jogadores].sort((a, b) => {
    const nivelA = getNivelHabilidadeValue(a.nivel_habilidade);
    const nivelB = getNivelHabilidadeValue(b.nivel_habilidade);

    if (nivelB !== nivelA) {
      return nivelB - nivelA;
    }

    return (a.nome || 'Usuário sem nome').localeCompare(b.nome || 'Usuário sem nome');
  });

  const totalTimes = Math.max(1, Math.ceil(jogadoresOrdenados.length / capacidadeValida));
  const ordemTimes = buildSnakeTimeOrder(totalTimes);
  const lotacao = Array.from({ length: totalTimes }, () => 0);
  const atribuicao = new Map<string, number>();

  let currentIndex = 0;

  for (const jogador of jogadoresOrdenados) {
    let timeAtribuido = false;

    while (!timeAtribuido) {
      const timeIndex = ordemTimes[currentIndex % ordemTimes.length];
      currentIndex += 1;

      if (lotacao[timeIndex] < capacidadeValida) {
        lotacao[timeIndex] += 1;
        atribuicao.set(jogador.user_id, timeIndex + 1);
        timeAtribuido = true;
      }
    }
  }

  return Array.from({ length: totalTimes }, (_, index) => ({
    time: index + 1,
    jogadores: jogadoresOrdenados
      .filter((jogador) => atribuicao.get(jogador.user_id) === index + 1)
      .map((jogador) => jogador.nome || 'Usuário sem nome'),
  }));
};

const horas = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0'));
const minutos = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));

const formatDisplayDate = (date: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
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

const getWheelItemClasses = (value: string, selectedValue: string, options: string[]) => {
  const selectedIndex = options.indexOf(selectedValue);
  const valueIndex = options.indexOf(value);
  const distance = Math.abs(valueIndex - selectedIndex);
  const opacity = Math.max(0.2, 1 - distance * 0.17);
  const textSize = distance === 0 ? 'text-base' : distance === 1 ? 'text-sm' : 'text-xs';

  if (value === selectedValue) {
    return 'text-base font-extrabold text-red-500 opacity-100';
  }

  return `${textSize} font-medium text-slate-400 opacity-${Math.round(opacity * 100)}`;
};

export default function JogoDetalhePage() {
  const params = useParams<{ id: string; jogoId: string }>();
  const router = useRouter();
  const salaId = params?.id;
  const jogoId = params?.jogoId;

  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [timesMontados, setTimesMontados] = useState<Array<{ time: number; jogadores: string[]; capacidade?: number }>>([]);
  const [tamanhoTime, setTamanhoTime] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateKey(new Date()));
  const [selectedHour, setSelectedHour] = useState<string>('00');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');

  const diaOptions = gerarDiasDisponiveis();
  const diaColumnRef = useRef<HTMLDivElement | null>(null);
  const horaColumnRef = useRef<HTMLDivElement | null>(null);
  const minutoColumnRef = useRef<HTMLDivElement | null>(null);
  const diaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const horaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const minutoItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!salaId || !jogoId) return;

    const loadJogo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentUser = user?.id ?? null;
      setCurrentUserId(currentUser);

      const { data: jogoData, error: jogoError } = await supabase
        .from('jogos')
        .select('*')
        .eq('id', jogoId)
        .single();

      if (!jogoError && jogoData) {
        const jogoEncontrado = jogoData as Jogo;
        setJogo(jogoEncontrado);
        setSelectedDate(jogoEncontrado.data);
        setSelectedHour(jogoEncontrado.hora.slice(0, 2));
        setSelectedMinute(jogoEncontrado.hora.slice(3, 5));
      }

      const { data: salaData, error: salaError } = await supabase
        .from('salas')
        .select('*')
        .eq('id', salaId)
        .single();

      if (!salaError && salaData) {
        const salaAtual = salaData as Sala;
        setTamanhoTime(typeof salaAtual.tamanho_time === 'number' ? salaAtual.tamanho_time : null);
        setIsAdmin(salaAtual.admin_id === currentUser);
      }

      const { data: presencasData, error: presencasError } = await supabase
        .from('presencas')
        .select('user_id, time_numero, perfis!user_id(nome, nivel_habilidade)')
        .eq('jogo_id', jogoId);

      if (!presencasError && presencasData) {
        const presencasComNome = presencasData.map((presenca) => {
          const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] | { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis)
            ? (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] }).perfis?.[0]
            : (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis;

          return {
            user_id: presenca.user_id,
            nome: perfil?.nome || 'Usuário sem nome',
            nivel_habilidade: perfil?.nivel_habilidade ?? null,
            time_numero: presenca.time_numero ?? null,
          } as Presenca;
        });

        setPresencas(presencasComNome);

        const capacidade = typeof salaData?.tamanho_time === 'number' ? salaData.tamanho_time : 1;
        const timesExistentes = buildTimesFromAssignments(presencasComNome, capacidade || 1);
        setTimesMontados(timesExistentes);

        if (currentUser) {
          setConfirmado(presencasComNome.some((membro) => membro.user_id === currentUser));
        }
      }

      setLoading(false);
    };

    loadJogo();
  }, [salaId, jogoId]);

  useEffect(() => {
    if (!isEditing || !jogo) return;

    setSelectedDate(jogo.data);
    setSelectedHour(jogo.hora.slice(0, 2));
    setSelectedMinute(jogo.hora.slice(3, 5));
  }, [isEditing, jogo]);

  useEffect(() => {
    if (!isEditing) return;

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
  }, [isEditing, selectedDate, selectedHour, selectedMinute]);

  const hasEditChanges =
    !!jogo &&
    (selectedDate !== jogo.data || selectedHour !== jogo.hora.slice(0, 2) || selectedMinute !== jogo.hora.slice(3, 5));

  const handleConfirmarPresenca = async () => {
    if (!currentUserId || !jogoId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (confirmado) {
        const { error } = await supabase
          .from('presencas')
          .delete()
          .eq('jogo_id', jogoId)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('presencas').insert([
          {
            jogo_id: jogoId,
            user_id: currentUserId,
          },
        ]);

        if (error) throw error;
      }

      const { data: presencasAtualizadas, error: presencasError } = await supabase
        .from('presencas')
        .select('user_id, perfis!user_id(nome)')
        .eq('jogo_id', jogoId);

      if (presencasError) throw presencasError;

      const novasPresencas = (presencasAtualizadas ?? []).map((presenca) => {
        const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
          ? (presenca as { perfis?: { nome?: string | null }[] }).perfis?.[0]
          : (presenca as { perfis?: { nome?: string | null } | null }).perfis;

        return {
          user_id: presenca.user_id,
          nome: perfil?.nome || 'Usuário sem nome',
        } as Presenca;
      });

      setPresencas(novasPresencas);
      setConfirmado(novasPresencas.some((membro) => membro.user_id === currentUserId));
    } catch (error) {
      console.error('Erro ao atualizar presença:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMontarTimes = async () => {
    if (!isAdmin || !jogoId || presencas.length === 0 || isSubmitting) return;

    const capacidade = Math.max(1, tamanhoTime ?? 1);
    const jogadores = presencas.map((presenca) => ({
      ...presenca,
      nivel_habilidade: presenca.nivel_habilidade ?? null,
    }));

    const timesDistribuidos = gerarDistribuicaoTimes(jogadores, capacidade);

    try {
      for (const time of timesDistribuidos) {
        for (const jogadorNome of time.jogadores) {
          const jogador = jogadores.find((item) => (item.nome || 'Usuário sem nome') === jogadorNome);
          if (!jogador) continue;

          await supabase
            .from('presencas')
            .update({ time_numero: time.time })
            .eq('jogo_id', jogoId)
            .eq('user_id', jogador.user_id);
        }
      }

      const jogadoresSemTime = jogadores.map((jogador) => ({
        ...jogador,
        time_numero: timesDistribuidos.find((time) => time.jogadores.includes(jogador.nome || 'Usuário sem nome'))?.time ?? null,
      }));

      setPresencas(jogadoresSemTime);
      setTimesMontados(
        timesDistribuidos.map((time) => ({
          ...time,
          capacidade,
        })),
      );
    } catch (error) {
      console.error('Erro ao montar times:', error);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!jogoId || !hasEditChanges || !isAdmin || isSaving) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('jogos')
        .update({
          data: selectedDate,
          hora: `${selectedHour}:${selectedMinute}:00`,
        })
        .eq('id', jogoId);

      if (error) throw error;

      setJogo((prev) =>
        prev
          ? {
              ...prev,
              data: selectedDate,
              hora: `${selectedHour}:${selectedMinute}:00`,
            }
          : prev,
      );
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar alteração do fut:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelarFut = async () => {
    if (!jogoId || !salaId || !isAdmin || isDeleting) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase.from('jogos').delete().eq('id', jogoId);

      if (error) throw error;

      setShowCancelModal(false);
      router.push(`/salas/${salaId}`);
    } catch (error) {
      console.error('Erro ao cancelar fut:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeEditor = () => {
    if (!jogo) return;

    setIsEditing(false);
    setSelectedDate(jogo.data);
    setSelectedHour(jogo.hora.slice(0, 2));
    setSelectedMinute(jogo.hora.slice(3, 5));
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Carregando fut...</p>
        </div>
      </main>
    );
  }

  if (!jogo) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
        <div className="relative z-10 rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-red-300">Fut não encontrado.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <div className="relative z-10 w-full max-w-3xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/salas/${salaId}`} className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Fut marcado</p>
              <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.12em] text-white sm:text-3xl">
                Fut em {formatDisplayDate(jogo.data)} às {jogo.hora.slice(0, 5)}
              </h1>
            </div>

            {isAdmin ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-500/20"
                >
                  Editar Fut
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="rounded-xl border border-red-500/60 bg-transparent px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-300 transition hover:border-red-400 hover:bg-red-500/10"
                >
                  Cancelar Fut
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-[#111214]/95 p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-red-200">Editar horário</p>
              <button
                type="button"
                aria-label="Fechar edição"
                onClick={closeEditor}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-slate-200 transition hover:border-red-500 hover:text-red-300"
              >
                ×
              </button>
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

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicao}
                disabled={!hasEditChanges || isSaving}
                className={[
                  'flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200',
                  !hasEditChanges || isSaving
                    ? 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none'
                    : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40',
                ].join(' ')}
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        ) : null}

        {currentUserId ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleConfirmarPresenca}
              disabled={isSubmitting}
              className={[
                'w-full rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200',
                isSubmitting
                  ? 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none'
                  : confirmado
                    ? 'bg-gradient-to-r from-slate-700 to-slate-500 hover:-translate-y-0.5 hover:shadow-slate-800/40'
                    : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40',
              ].join(' ')}
            >
              {isSubmitting ? 'Aguarde...' : confirmado ? 'Cancelar presença' : 'Confirmar presença'}
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Presenças confirmadas</h2>

          {presencas.length === 0 ? (
            <p className="text-slate-300">Ainda não há confirmações para este fut.</p>
          ) : (
            <ul className="space-y-2">
              {presencas.map((presenca) => (
                <li key={presenca.user_id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  {presenca.nome}
                </li>
              ))}
            </ul>
          )}
        </div>

        {presencas.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Times</h2>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleMontarTimes}
                  disabled={presencas.length === 0}
                  className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Montar Times
                </button>
              ) : null}
            </div>

            {timesMontados.length === 0 ? (
              <p className="text-slate-300">Ainda não foi montado nenhum time para este fut.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {timesMontados.map((time) => {
                  const capacidade = Math.max(1, time.capacidade ?? tamanhoTime ?? 1);
                  const jogadoresExibidos = [...time.jogadores];

                  while (jogadoresExibidos.length < capacidade) {
                    jogadoresExibidos.push('COMPLETA');
                  }

                  return (
                    <div key={time.time} className="rounded-2xl border border-red-500/30 bg-[#111214]/80 p-3">
                      <p className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-red-200">Time {time.time}</p>

                      <ul className="space-y-2">
                        {jogadoresExibidos.map((jogador, index) => (
                          <li
                            key={`${time.time}-${jogador}-${index}`}
                            className={[
                              'rounded-xl border px-2 py-2 text-sm',
                              jogador === 'COMPLETA'
                                ? 'border-dashed border-slate-600 bg-slate-800/40 text-slate-400 line-through'
                                : 'border-slate-700 bg-slate-900/60 text-slate-200',
                            ].join(' ')}
                          >
                            {jogador}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {showCancelModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              aria-label="Fechar confirmação"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
            >
              ×
            </button>

            <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">
              Tem certeza que deseja cancelar esse fut?
            </p>
            <p className="mt-3 text-sm text-slate-300">
              Essa ação não pode ser desfeita e removerá também as presenças já confirmadas.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-slate-500"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelarFut}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? 'Cancelando...' : 'Sim, cancelar fut'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
