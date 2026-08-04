'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase/client';

type Jogo = {
  id: string;
  sala_id: string;
  data: string;
  hora: string;
  notas_liberadas?: boolean;
};

type Presenca = {
  id?: string;
  user_id?: string | null;
  nome: string;
  nome_convidado?: string | null;
  nivel_habilidade?: string | null;
  time_numero?: number | null;
  valor_habilidade?: number | null;
};

type Sala = {
  id: string;
  admin_id: string;
  cohost_id?: string | null;
  tamanho_time?: number | null;
  nome?: string | null;
};

type TimeCardDisplay = {
  time: number;
  jogadores: Presenca[];
  cor: string;
  capacidade: number;
};

type TimeJogo = {
  id?: string;
  jogo_id: string;
  numero: number;
  cor: string;
};

type MembroSalaGerencia = {
  user_id: string;
  nome: string;
  confirmado: boolean;
};

type PresencaGerenciaItem = {
  id?: string;
  user_id?: string | null;
  nome: string;
  confirmado: boolean;
  tipo: 'membro' | 'convidado';
};

type ResumoAvaliacaoRow = {
  avaliadores_distintos: number;
  total_elegiveis: number;
  avaliado_id: string | null;
  media_parcial: number | null;
};

const getNivelHabilidadeValue = (nivel?: string | null) => {
  const valor = (nivel ?? '').trim().toLowerCase();

  switch (valor) {
    case 'sou craque':
      return 10;
    case 'muito bom':
      return 7.5;
    case 'tô na média':
    case 'to na media':
      return 5;
    case 'ruinzinho':
      return 2.5;
    case 'sou bagre':
      return 0;
    default:
      return 5;
  }
};

const getNotaNaSalaValue = async (userId: string, salaId: string) => {
  const { data: jogosDaSalaData } = await supabase.from('jogos').select('id').eq('sala_id', salaId);
  const jogoIds = jogosDaSalaData?.map((jogo) => jogo.id) ?? [];

  if (jogoIds.length === 0) {
    return null;
  }

  const { data: avaliacoesData } = await supabase
    .from('avaliacoes')
    .select('nota, jogo_id')
    .in('jogo_id', jogoIds)
    .eq('avaliado_id', userId);

  if (!avaliacoesData || avaliacoesData.length === 0) {
    return null;
  }

  const mediasPorJogo = Object.values(
    avaliacoesData.reduce<Record<string, number[]>>((accumulator, avaliacao) => {
      const jogoId = String(avaliacao.jogo_id);
      if (!accumulator[jogoId]) {
        accumulator[jogoId] = [];
      }
      accumulator[jogoId].push(Number(avaliacao.nota));
      return accumulator;
    }, {}),
  ).map((notas) => notas.reduce((total, nota) => total + nota, 0) / notas.length);

  if (mediasPorJogo.length === 0) {
    return null;
  }

  return mediasPorJogo.reduce((total, media) => total + media, 0) / mediasPorJogo.length;
};

const buildSnakeTimeOrder = (totalTimes: number) => {
  if (totalTimes <= 0) return [];

  const ordem: number[] = [];
  let indice = 0;
  let direcao = 1;

  while (ordem.length < totalTimes * 4) {
    ordem.push(indice);

    indice += direcao;

    if (indice >= totalTimes) {
      indice = totalTimes - 2;
      direcao = -1;
    } else if (indice < 0) {
      indice = 1;
      direcao = 1;
    }
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

const gerarDistribuicaoTimes = (jogadores: Presenca[], capacidade: number, numeroDeTimesOverride?: number) => {
  const capacidadeValida = Math.max(1, Number(capacidade) || 1);
  const jogadoresOrdenados = [...jogadores].sort((a, b) => {
    const habilidadeA = a.valor_habilidade ?? getNivelHabilidadeValue(a.nivel_habilidade);
    const habilidadeB = b.valor_habilidade ?? getNivelHabilidadeValue(b.nivel_habilidade);

    if (habilidadeB !== habilidadeA) {
      return habilidadeB - habilidadeA;
    }

    return (a.nome || 'Usuário sem nome').localeCompare(b.nome || 'Usuário sem nome');
  });

  const totalTimes = Math.max(1, numeroDeTimesOverride ?? Math.ceil(jogadoresOrdenados.length / capacidadeValida));
  const ordemTimes = buildSnakeTimeOrder(totalTimes);
  const lotacao = Array.from({ length: totalTimes }, () => 0);
  const atribuicao = new Map<string, number>();
  const jogadoresComChave = jogadoresOrdenados.map((jogador, index) => ({
    jogador,
    chave: jogador.user_id ?? `${jogador.nome || 'convidado'}-${index}`,
  }));

  let currentIndex = 0;

  for (const { jogador, chave } of jogadoresComChave) {
    let timeAtribuido = false;
    let tentativas = 0;

    while (!timeAtribuido && tentativas < totalTimes * jogadoresOrdenados.length) {
      const timeIndex = ordemTimes[currentIndex % ordemTimes.length];
      currentIndex += 1;
      tentativas += 1;

      if (lotacao[timeIndex] < capacidadeValida) {
        lotacao[timeIndex] += 1;
        atribuicao.set(chave, timeIndex + 1);
        timeAtribuido = true;
      }
    }

    if (!timeAtribuido) {
      const primeiroTimeDisponivel = lotacao.findIndex((quantidade) => quantidade < capacidadeValida);
      if (primeiroTimeDisponivel >= 0) {
        lotacao[primeiroTimeDisponivel] += 1;
        atribuicao.set(chave, primeiroTimeDisponivel + 1);
      }
    }
  }

  return Array.from({ length: totalTimes }, (_, index) => ({
    time: index + 1,
    jogadores: jogadoresComChave
      .filter(({ chave }) => atribuicao.get(chave) === index + 1)
      .map(({ jogador }) => jogador.nome || 'Usuário sem nome'),
  }));
};

const getCorDoTime = (numeroDoTime: number, coresUsadas: string[]) => {
  const coresFixas = ['Preto', 'Branco', 'Vermelho', 'Amarelo'];
  const coresExtras = ['Azul', 'Verde', 'Roxo', 'Laranja', 'Rosa', 'Cinza', 'Turquesa', 'Marrom'];

  if (numeroDoTime <= coresFixas.length) {
    return coresFixas[numeroDoTime - 1];
  }

  if (numeroDoTime === 5) {
    return 'Multicolor';
  }

  const coresDisponiveis = coresExtras.filter((cor) => !coresUsadas.includes(cor));

  if (coresDisponiveis.length > 0) {
    return coresDisponiveis[Math.floor(Math.random() * coresDisponiveis.length)];
  }

  return coresExtras[Math.floor(Math.random() * coresExtras.length)];
};

const getCorClasses = (cor: string) => {
  switch (cor) {
    case 'Preto':
      return 'bg-slate-950 text-slate-100 border-slate-600';
    case 'Branco':
      return 'bg-slate-100 text-slate-900 border-slate-300';
    case 'Vermelho':
      return 'bg-red-700 text-red-100 border-red-500';
    case 'Amarelo':
      return 'bg-yellow-400 text-yellow-950 border-yellow-300';
    case 'Azul':
      return 'bg-blue-600 text-blue-50 border-blue-400';
    case 'Verde':
      return 'bg-emerald-600 text-emerald-50 border-emerald-400';
    case 'Roxo':
      return 'bg-violet-600 text-violet-50 border-violet-400';
    case 'Laranja':
      return 'bg-orange-500 text-orange-50 border-orange-300';
    case 'Rosa':
      return 'bg-pink-500 text-pink-50 border-pink-300';
    case 'Cinza':
      return 'bg-slate-500 text-slate-50 border-slate-300';
    case 'Turquesa':
      return 'bg-cyan-500 text-cyan-50 border-cyan-300';
    case 'Marrom':
      return 'bg-amber-800 text-amber-50 border-amber-500';
    case 'Multicolor':
      return 'bg-gradient-to-r from-red-600 via-yellow-400 via-sky-500 to-violet-600 text-white border-red-300';
    default:
      return 'bg-slate-800 text-slate-100 border-slate-600';
  }
};

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

const normalizeTimeValue = (value: string, max: number) => {
  const sanitizedValue = value.replace(/\D/g, '');

  if (!sanitizedValue) {
    return '';
  }

  const numericValue = Number(sanitizedValue);

  if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > max) {
    return sanitizedValue;
  }

  return String(numericValue).padStart(2, '0');
};

const getTimeValidationError = (hourValue: string, minuteValue: string) => {
  const hourNumber = Number(hourValue);
  const minuteNumber = Number(minuteValue);

  if (!Number.isInteger(hourNumber) || hourNumber < 0 || hourNumber > 23) {
    return 'A hora deve estar entre 00 e 23.';
  }

  if (!Number.isInteger(minuteNumber) || minuteNumber < 0 || minuteNumber > 59) {
    return 'Os minutos devem estar entre 00 e 59.';
  }

  return '';
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

const getPdfCorRgb = (cor: string): [number, number, number] => {
  switch (cor) {
    case 'Preto':
      return [15, 23, 42];
    case 'Branco':
      return [241, 245, 249];
    case 'Vermelho':
      return [185, 28, 28];
    case 'Amarelo':
      return [250, 204, 21];
    case 'Azul':
      return [37, 99, 235];
    case 'Verde':
      return [5, 150, 105];
    case 'Roxo':
      return [124, 58, 237];
    case 'Laranja':
      return [249, 115, 22];
    case 'Rosa':
      return [236, 72, 153];
    case 'Cinza':
      return [100, 116, 139];
    case 'Turquesa':
      return [6, 182, 212];
    case 'Marrom':
      return [146, 64, 14];
    case 'Multicolor':
      return [127, 29, 29];
    default:
      return [30, 41, 59];
  }
};

const getCorTextoNoPDF = (cor: string): [number, number, number] => {
  if (cor === 'Branco' || cor === 'Amarelo') {
    return [15, 23, 42];
  }

  return [248, 250, 252];
};

const buildPdfFileName = (nomeSala: string) => {
  const normalized = nomeSala
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `times-${normalized || 'sala'}.pdf`;
};

export default function JogoDetalhePage() {
  const params = useParams<{ id: string; jogoId: string }>();
  const router = useRouter();
  const salaId = params?.id;
  const jogoId = params?.jogoId;

  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [timesDoJogo, setTimesDoJogo] = useState<TimeJogo[]>([]);
  const [timesMontados, setTimesMontados] = useState<Array<{ time: number; jogadores: string[]; capacidade?: number }>>([]);
  const [tamanhoTime, setTamanhoTime] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminOuCohost, setIsAdminOuCohost] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasEvaluatedCurrentGame, setHasEvaluatedCurrentGame] = useState(false);
  const [avaliacaoError, setAvaliacaoError] = useState('');
  const [isSavingAvaliacoes, setIsSavingAvaliacoes] = useState(false);
  const [avaliacaoNotas, setAvaliacaoNotas] = useState<Record<string, string>>({});
  const [membrosSalaParaGerenciar, setMembrosSalaParaGerenciar] = useState<MembroSalaGerencia[]>([]);
  const [guestName, setGuestName] = useState('');
  const [isUpdatingManagedPresence, setIsUpdatingManagedPresence] = useState(false);
  const [selectedPlayerForSwap, setSelectedPlayerForSwap] = useState<Presenca | null>(null);
  const [isSwappingPlayers, setIsSwappingPlayers] = useState(false);
  const [isSharingTimes, setIsSharingTimes] = useState(false);
  const [salaNome, setSalaNome] = useState('Sala');
  const [activeTab, setActiveTab] = useState<'jogo' | 'notas'>('jogo');
  const [resumoAvaliacoesMap, setResumoAvaliacoesMap] = useState<Record<string, number | null>>({});
  const [resumoAvaliadoresDistintos, setResumoAvaliadoresDistintos] = useState(0);
  const [resumoTotalElegiveis, setResumoTotalElegiveis] = useState(0);
  const [isLoadingResumoAvaliacoes, setIsLoadingResumoAvaliacoes] = useState(false);
  const [isLiberandoNotas, setIsLiberandoNotas] = useState(false);
  const [mediasPublicasMap, setMediasPublicasMap] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateKey(new Date()));
  const [selectedHour, setSelectedHour] = useState<string>('00');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [timeValidationError, setTimeValidationError] = useState('');

  const diaOptions = gerarDiasDisponiveis();
  const diaColumnRef = useRef<HTMLDivElement | null>(null);
  const diaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const carregarMediasPublicas = async (targetJogoId: string) => {
    const { data, error } = await supabase.rpc('obter_medias_publicas', { p_jogo_id: targetJogoId });

    if (error || !data) {
      setMediasPublicasMap({});
      return;
    }

    const nextMap = (data as Array<{ avaliado_id: string; media: number | null }>).reduce<Record<string, number>>((accumulator, item) => {
      if (item.avaliado_id && typeof item.media === 'number') {
        accumulator[item.avaliado_id] = Number(item.media);
      }
      return accumulator;
    }, {});

    setMediasPublicasMap(nextMap);
  };

  const refreshPresenceData = async () => {
    if (!salaId || !jogoId) return;

    const { data: presencasAtualizadas, error: presencasError } = await supabase
      .from('presencas')
      .select('id, user_id, nome_convidado, time_numero, perfis!user_id(id, nome, nivel_habilidade)')
      .eq('jogo_id', jogoId);

    if (!presencasError && presencasAtualizadas) {
      const novasPresencas = presencasAtualizadas.map((presenca) => {
        const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] | { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis)
          ? (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] }).perfis?.[0]
          : (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis;

        return {
          id: presenca.id,
          user_id: presenca.user_id,
          nome: presenca.user_id ? perfil?.nome || 'Usuário sem nome' : (presenca.nome_convidado || 'Convidado'),
          nome_convidado: presenca.nome_convidado ?? null,
          nivel_habilidade: perfil?.nivel_habilidade ?? null,
          time_numero: presenca.time_numero ?? null,
          valor_habilidade: presenca.user_id ? getNivelHabilidadeValue(perfil?.nivel_habilidade ?? null) : 5,
        } as Presenca;
      });

      setPresencas(novasPresencas);
      setConfirmado(novasPresencas.some((membro) => membro.user_id === currentUserId));
    }

    const { data: membrosSalaData, error: membrosSalaError } = await supabase
      .from('membros_sala')
      .select('user_id, perfis!user_id(id, nome)')
      .eq('sala_id', salaId);

    if (!membrosSalaError && membrosSalaData) {
      const presencasMap = new Set(
        (presencasAtualizadas ?? [])
          .filter((presenca) => presenca.user_id !== null)
          .map((presenca) => presenca.user_id),
      );

      const membrosAtualizados = membrosSalaData.map((membro) => {
        const perfil = Array.isArray((membro as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
          ? (membro as { perfis?: { nome?: string | null }[] }).perfis?.[0]
          : (membro as { perfis?: { nome?: string | null } | null }).perfis;

        return {
          user_id: membro.user_id,
          nome: perfil?.nome || 'Usuário sem nome',
          confirmado: presencasMap.has(membro.user_id),
        } as MembroSalaGerencia;
      });

      setMembrosSalaParaGerenciar(membrosAtualizados);
    }
  };

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
        setSalaNome((salaAtual.nome || '').trim() || 'Sala');
        setTamanhoTime(typeof salaAtual.tamanho_time === 'number' ? salaAtual.tamanho_time : null);
        const isCurrentAdmin = salaAtual.admin_id === currentUser;
        const isCurrentAdminOuCohost = isCurrentAdmin || salaAtual.cohost_id === currentUser;
        setIsAdmin(isCurrentAdmin);
        setIsAdminOuCohost(isCurrentAdminOuCohost);
      }

      const { data: presencasData, error: presencasError } = await supabase
        .from('presencas')
        .select('id, user_id, nome_convidado, time_numero, perfis!user_id(id, nome, nivel_habilidade)')
        .eq('jogo_id', jogoId);

      if (!presencasError && presencasData) {
        const presencasComNome = presencasData.map((presenca) => {
          const perfil = Array.isArray((presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] | { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis)
            ? (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null }[] }).perfis?.[0]
            : (presenca as { perfis?: { nome?: string | null; nivel_habilidade?: string | null } | null }).perfis;

          return {
            id: presenca.id,
            user_id: presenca.user_id,
            nome: presenca.user_id ? perfil?.nome || 'Usuário sem nome' : (presenca.nome_convidado || 'Convidado'),
            nome_convidado: presenca.nome_convidado ?? null,
            nivel_habilidade: perfil?.nivel_habilidade ?? null,
            time_numero: presenca.time_numero ?? null,
            valor_habilidade: presenca.user_id ? getNivelHabilidadeValue(perfil?.nivel_habilidade ?? null) : 5,
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

      const { data: membrosSalaData, error: membrosSalaError } = await supabase
        .from('membros_sala')
        .select('user_id, perfis!user_id(id, nome)')
        .eq('sala_id', salaId);

      if (!membrosSalaError && membrosSalaData) {
        const presencasMap = new Set((presencasData ?? []).map((presenca) => presenca.user_id));

        setMembrosSalaParaGerenciar(
          membrosSalaData.map((membro) => {
            const perfil = Array.isArray((membro as { perfis?: { nome?: string | null }[] | { nome?: string | null } | null }).perfis)
              ? (membro as { perfis?: { nome?: string | null }[] }).perfis?.[0]
              : (membro as { perfis?: { nome?: string | null } | null }).perfis;

            return {
              user_id: membro.user_id,
              nome: perfil?.nome || 'Usuário sem nome',
              confirmado: presencasMap.has(membro.user_id),
            } as MembroSalaGerencia;
          }),
        );
      }

      if (currentUser) {
        const { data: avaliacoesData, error: avaliacoesError } = await supabase
          .from('avaliacoes')
          .select('id')
          .eq('jogo_id', jogoId)
          .eq('avaliador_id', currentUser);

        if (!avaliacoesError) {
          setHasEvaluatedCurrentGame(Boolean(avaliacoesData && avaliacoesData.length > 0));
        }
      }

      const { data: timesData, error: timesError } = await supabase
        .from('times')
        .select('*')
        .eq('jogo_id', jogoId)
        .order('numero', { ascending: true });

      if (!timesError && timesData) {
        setTimesDoJogo(
          timesData.map((time) => ({
            id: time.id,
            jogo_id: time.jogo_id,
            numero: Number(time.numero),
            cor: String(time.cor || 'Preto'),
          })),
        );
      }

      await carregarMediasPublicas(jogoId);

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
  }, [isEditing, selectedDate]);

  const hasEditChanges =
    !!jogo &&
    (selectedDate !== jogo.data || selectedHour !== jogo.hora.slice(0, 2) || selectedMinute !== jogo.hora.slice(3, 5));

  const futJaComecou = !!jogo && new Date(`${jogo.data}T${jogo.hora}`) <= new Date();
  const isParticipante = currentUserId
    ? presencas.some((presenca) => presenca.user_id === currentUserId && presenca.time_numero !== null)
    : false;
  const jogadoresParaAvaliar = presencas.filter(
    (presenca): presenca is Presenca & { user_id: string } =>
      Boolean(presenca.user_id) && presenca.user_id !== currentUserId && presenca.time_numero !== null,
  );
  const todosCamposValidos = jogadoresParaAvaliar.length > 0 && jogadoresParaAvaliar.every((jogador) => {
    const valor = avaliacaoNotas[jogador.user_id]?.trim();

    if (!valor) {
      return false;
    }

    if (!/^\d+(\.\d)?$/.test(valor)) {
      return false;
    }

    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 && numero <= 10;
  });

  const getCardsTimes = (): TimeCardDisplay[] => {
    if (timesDoJogo.length > 0) {
      return timesDoJogo.map((time) => ({
        time: time.numero,
        jogadores: presencas
          .filter((presenca) => Number(presenca.time_numero ?? 0) === time.numero)
          .map((presenca) => ({
            user_id: presenca.user_id,
            nome: presenca.nome || 'Usuário sem nome',
            nivel_habilidade: presenca.nivel_habilidade ?? null,
            time_numero: presenca.time_numero ?? null,
            valor_habilidade: presenca.valor_habilidade ?? null,
          } as Presenca)),
        cor: time.cor,
        capacidade: Math.max(1, tamanhoTime ?? 1),
      }));
    }

    return timesMontados.map((time) => ({
      time: time.time,
      jogadores: time.jogadores
        .map((nome) => {
          const jogadorEncontrado = presencas.find((presenca) => (presenca.nome || 'Usuário sem nome') === nome);
          return jogadorEncontrado
            ? ({
                user_id: jogadorEncontrado.user_id,
                nome: jogadorEncontrado.nome || 'Usuário sem nome',
                nivel_habilidade: jogadorEncontrado.nivel_habilidade ?? null,
                time_numero: jogadorEncontrado.time_numero ?? null,
                valor_habilidade: jogadorEncontrado.valor_habilidade ?? null,
              } as Presenca)
            : ({
                user_id: `fallback-${nome}`,
                nome,
                nivel_habilidade: null,
                time_numero: time.time,
                valor_habilidade: null,
              } as Presenca);
        }),
      cor: timesDoJogo.find((item) => item.numero === time.time)?.cor ?? 'Preto',
      capacidade: Math.max(1, time.capacidade ?? tamanhoTime ?? 1),
    }));
  };

  const cardsTimes = getCardsTimes();
  const participantesElegiveis = presencas
    .filter((presenca): presenca is Presenca & { user_id: string } => Boolean(presenca.user_id) && !presenca.nome_convidado)
    .sort((a, b) => (a.nome || 'Usuário sem nome').localeCompare(b.nome || 'Usuário sem nome'));

  const carregarResumoAvaliacoes = async () => {
    if (!jogoId || !isAdminOuCohost) return;

    setIsLoadingResumoAvaliacoes(true);

    try {
      const { data, error } = await supabase.rpc('obter_resumo_avaliacoes', { p_jogo_id: jogoId });

      if (error) throw error;

      const rows = (data ?? []) as ResumoAvaliacaoRow[];
      const progressRow = rows[0];

      setResumoAvaliadoresDistintos(Number(progressRow?.avaliadores_distintos ?? 0));
      setResumoTotalElegiveis(Number(progressRow?.total_elegiveis ?? 0));

      const nextMap = rows.reduce<Record<string, number | null>>((accumulator, row) => {
        if (!row.avaliado_id) return accumulator;
        accumulator[row.avaliado_id] = typeof row.media_parcial === 'number' ? Number(row.media_parcial) : null;
        return accumulator;
      }, {});

      setResumoAvaliacoesMap(nextMap);
    } catch (error) {
      console.error('Erro ao carregar resumo de avaliações:', error);
      setResumoAvaliadoresDistintos(0);
      setResumoTotalElegiveis(0);
      setResumoAvaliacoesMap({});
    } finally {
      setIsLoadingResumoAvaliacoes(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'notas' || !isAdminOuCohost) return;
    carregarResumoAvaliacoes();
  }, [activeTab, isAdminOuCohost, jogoId]);

  const handleLiberarNotas = async () => {
    if (!jogoId || !isAdminOuCohost || isLiberandoNotas || jogo?.notas_liberadas) return;

    const confirmadoLiberacao = window.confirm('Isso vai mostrar as médias pra todo mundo. Confirma?');
    if (!confirmadoLiberacao) return;

    setIsLiberandoNotas(true);

    try {
      const { error } = await supabase.rpc('liberar_notas_jogo', { p_jogo_id: jogoId });
      if (error) throw error;

      setJogo((prev) => (prev ? { ...prev, notas_liberadas: true } : prev));
      await carregarMediasPublicas(jogoId);
      await carregarResumoAvaliacoes();
    } catch (error) {
      console.error('Erro ao liberar notas do jogo:', error);
      alert('Não foi possível liberar as notas agora. Tente novamente.');
    } finally {
      setIsLiberandoNotas(false);
    }
  };

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
        const { error } = await supabase.from('presencas').upsert([
          {
            jogo_id: jogoId,
            user_id: currentUserId,
          },
        ], { onConflict: 'jogo_id,user_id', ignoreDuplicates: true });

        if (error) throw error;
      }

      await refreshPresenceData();
    } catch (error) {
      console.error('Erro ao atualizar presença:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdicionarConvidado = async () => {
    if (!jogoId || !salaId || isUpdatingManagedPresence) return;

    const nome = guestName.trim();
    if (!nome) return;

    setIsUpdatingManagedPresence(true);

    try {
      const { error } = await supabase.from('presencas').insert([
        {
          jogo_id: jogoId,
          user_id: null,
          nome_convidado: nome,
        },
      ]);

      if (error) throw error;

      setGuestName('');
      await refreshPresenceData();
    } catch (error) {
      console.error('Erro ao adicionar convidado:', error);
    } finally {
      setIsUpdatingManagedPresence(false);
    }
  };

  const handleGerenciarPresenca = async (item: PresencaGerenciaItem, confirmar: boolean) => {
    if (!jogoId || !salaId || isUpdatingManagedPresence) return;

    setIsUpdatingManagedPresence(true);

    try {
      if (confirmar) {
        if (item.tipo === 'membro' && item.user_id) {
          setMembrosSalaParaGerenciar((current) => current.map((membro) => (membro.user_id === item.user_id ? { ...membro, confirmado: true } : membro)));
          setPresencas((current) => [
            ...current,
            {
              id: `optimistic-${item.user_id}`,
              user_id: item.user_id,
              nome: item.nome,
              nome_convidado: null,
              nivel_habilidade: null,
              time_numero: null,
              valor_habilidade: 5,
            } as Presenca,
          ]);

          const { error } = await supabase.from('presencas').upsert([
            {
              jogo_id: jogoId,
              user_id: item.user_id,
            },
          ], { onConflict: 'jogo_id,user_id', ignoreDuplicates: true });

          if (error) throw error;
        }
      } else if (item.tipo === 'convidado' && item.id) {
        setPresencas((current) => current.filter((presenca) => presenca.id !== item.id));

        const { error } = await supabase
          .from('presencas')
          .delete()
          .eq('id', item.id);

        if (error) throw error;
      } else if (item.tipo === 'membro' && item.user_id) {
        setMembrosSalaParaGerenciar((current) => current.map((membro) => (membro.user_id === item.user_id ? { ...membro, confirmado: false } : membro)));
        setPresencas((current) => current.filter((presenca) => presenca.user_id !== item.user_id));

        const { error } = await supabase
          .from('presencas')
          .delete()
          .eq('jogo_id', jogoId)
          .eq('user_id', item.user_id);

        if (error) throw error;
      }

      await refreshPresenceData();
    } catch (error) {
      console.error('Erro ao atualizar presença do item:', error);
    } finally {
      setIsUpdatingManagedPresence(false);
    }
  };

  const handleSelecionarJogadorParaTroca = async (jogador: Presenca) => {
    if (!isAdminOuCohost || !jogoId || isSwappingPlayers) return;

    if (!selectedPlayerForSwap) {
      setSelectedPlayerForSwap(jogador);
      return;
    }

    if (selectedPlayerForSwap.user_id === jogador.user_id) {
      setSelectedPlayerForSwap(null);
      return;
    }

    if (selectedPlayerForSwap.time_numero === null || jogador.time_numero === null) {
      setSelectedPlayerForSwap(null);
      return;
    }

    setIsSwappingPlayers(true);

    try {
      const timeDoPrimeiro = selectedPlayerForSwap.time_numero;
      const timeDoSegundo = jogador.time_numero;

      const { error: erroPrimeiro } = await supabase
        .from('presencas')
        .update({ time_numero: timeDoSegundo })
        .eq('jogo_id', jogoId)
        .eq('user_id', selectedPlayerForSwap.user_id);

      const { error: erroSegundo } = await supabase
        .from('presencas')
        .update({ time_numero: timeDoPrimeiro })
        .eq('jogo_id', jogoId)
        .eq('user_id', jogador.user_id);

      if (erroPrimeiro || erroSegundo) {
        throw new Error('Não foi possível trocar os jogadores.');
      }

      await refreshPresenceData();
      setSelectedPlayerForSwap(null);
    } catch (error) {
      console.error('Erro ao trocar jogadores de time:', error);
    } finally {
      setIsSwappingPlayers(false);
    }
  };

  const handleSalvarAvaliacoes = async () => {
    if (!currentUserId || !jogoId || jogadoresParaAvaliar.length === 0 || !todosCamposValidos || isSavingAvaliacoes) return;

    setIsSavingAvaliacoes(true);
    setAvaliacaoError('');

    try {
      const inserts = jogadoresParaAvaliar.map((jogador) => ({
        jogo_id: jogoId,
        avaliador_id: currentUserId,
        avaliado_id: jogador.user_id,
        nota: Number(Number(avaliacaoNotas[jogador.user_id]).toFixed(1)),
      }));

      const { error } = await supabase.from('avaliacoes').insert(inserts);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Você já avaliou este fut.');
        }
        throw error;
      }

      setHasEvaluatedCurrentGame(true);
      setAvaliacaoNotas({});
    } catch (error) {
      console.error('Erro ao salvar avaliações:', error);
      setAvaliacaoError(
        error instanceof Error && error.message === 'Você já avaliou este fut.'
          ? 'Você já avaliou os jogadores deste fut. Obrigado!'
          : 'Não foi possível salvar as avaliações. Tente novamente.',
      );
    } finally {
      setIsSavingAvaliacoes(false);
    }
  };

  const handleMontarTimes = async () => {
    if (!isAdminOuCohost || !jogoId || !salaId || presencas.length === 0 || isSubmitting) return;

    try {
      const { data: salaAtualData, error: salaAtualError } = await supabase
        .from('salas')
        .select('tamanho_time')
        .eq('id', salaId)
        .single();

      if (salaAtualError) throw salaAtualError;

      const capacidade = Math.max(1, Number(salaAtualData?.tamanho_time ?? tamanhoTime ?? 1));
      const numeroDeTimes = Math.max(1, Math.ceil(presencas.length / capacidade));
      const jogadores = await Promise.all(
        presencas.map(async (presenca) => {
          const notaNaSala = salaId && presenca.user_id ? await getNotaNaSalaValue(presenca.user_id, salaId) : null;
          const valorHabilidade = notaNaSala ?? getNivelHabilidadeValue(presenca.nivel_habilidade);

          return {
            ...presenca,
            nivel_habilidade: presenca.nivel_habilidade ?? null,
            valor_habilidade: valorHabilidade,
          } as Presenca;
        }),
      );

      const timesDistribuidos = gerarDistribuicaoTimes(jogadores, capacidade, numeroDeTimes);
      const coresUsadas: string[] = [];
      const timesParaInserir: TimeJogo[] = [];

      for (let numeroDoTime = 1; numeroDoTime <= numeroDeTimes; numeroDoTime += 1) {
        const cor = getCorDoTime(numeroDoTime, coresUsadas);
        coresUsadas.push(cor);

        timesParaInserir.push({
          jogo_id: jogoId,
          numero: numeroDoTime,
          cor,
        });
      }

      await supabase.from('times').delete().eq('jogo_id', jogoId);

      if (timesParaInserir.length > 0) {
        const { error: timesError } = await supabase.from('times').insert(
          timesParaInserir.map((time) => ({
            jogo_id: time.jogo_id,
            numero: time.numero,
            cor: time.cor,
          })),
        );

        if (timesError) throw timesError;
      }

      for (const time of timesDistribuidos) {
        for (const jogadorNome of time.jogadores) {
          const jogador = jogadores.find((item) => (item.nome || 'Usuário sem nome') === jogadorNome);
          if (!jogador) continue;

          if (jogador.id) {
            await supabase.from('presencas').update({ time_numero: time.time }).eq('id', jogador.id);
          } else if (jogador.user_id) {
            await supabase
              .from('presencas')
              .update({ time_numero: time.time })
              .eq('jogo_id', jogoId)
              .eq('user_id', jogador.user_id);
          } else {
            await supabase
              .from('presencas')
              .update({ time_numero: time.time })
              .eq('jogo_id', jogoId)
              .eq('user_id', null);
          }
        }
      }

      const jogadoresSemTime = jogadores.map((jogador) => ({
        ...jogador,
        time_numero: timesDistribuidos.find((time) => time.jogadores.includes(jogador.nome || 'Usuário sem nome'))?.time ?? null,
      }));

      setPresencas(jogadoresSemTime);
      setTimesDoJogo(timesParaInserir);
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
    const validationError = getTimeValidationError(selectedHour, selectedMinute);

    if (!jogoId || !hasEditChanges || !isAdminOuCohost || isSaving || validationError) {
      setTimeValidationError(validationError);
      return;
    }

    setIsSaving(true);
    setTimeValidationError('');

    try {
      const horaFormatada = normalizeTimeValue(selectedHour, 23);
      const minutoFormatado = normalizeTimeValue(selectedMinute, 59);

      const { error } = await supabase
        .from('jogos')
        .update({
          data: selectedDate,
          hora: `${horaFormatada}:${minutoFormatado}:00`,
        })
        .eq('id', jogoId);

      if (error) throw error;

      setJogo((prev) =>
        prev
          ? {
              ...prev,
              data: selectedDate,
              hora: `${horaFormatada}:${minutoFormatado}:00`,
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
    if (!jogoId || !salaId || !isAdminOuCohost || isDeleting) return;

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

  const handleCompartilharTimes = async () => {
    if (!jogo || cardsTimes.length === 0 || isSharingTimes) return;

    setIsSharingTimes(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 16;
      const contentWidth = pageWidth - marginX * 2;
      let currentY = 18;

      const ensureSpace = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - 18) {
          doc.addPage();
          currentY = 18;
        }
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(185, 28, 28);
      doc.text('FUT DA GALERA', marginX, currentY);
      currentY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`Sala: ${salaNome}`, marginX, currentY);
      currentY += 6;
      doc.text(`Fut: ${formatDisplayDate(jogo.data)} às ${jogo.hora.slice(0, 5)}`, marginX, currentY);
      currentY += 10;

      cardsTimes.forEach((time) => {
        const capacidade = Math.max(1, Number(time.capacidade ?? 1));
        const vagasSobrando = Math.max(0, capacidade - time.jogadores.length);
        const linhasJogadores = time.jogadores.length + vagasSobrando;
        const blocoAltura = 14 + linhasJogadores * 6 + 4;

        ensureSpace(blocoAltura);

        const [r, g, b] = getPdfCorRgb(time.cor);
        const [tr, tg, tb] = getCorTextoNoPDF(time.cor);

        doc.setFillColor(r, g, b);
        doc.setDrawColor(71, 85, 105);
        doc.rect(marginX, currentY, 8, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(`Time ${time.cor}`, marginX + 12, currentY + 6);

        currentY += 11;

        doc.setFillColor(r, g, b);
        doc.setTextColor(tr, tg, tb);
        doc.roundedRect(marginX, currentY, contentWidth, linhasJogadores * 6 + 4, 2, 2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        let linhaY = currentY + 5;
        time.jogadores.forEach((jogador) => {
          doc.text(`- ${jogador.nome || 'Usuário sem nome'}`, marginX + 3, linhaY);
          linhaY += 6;
        });

        for (let vagaIndex = 0; vagaIndex < vagasSobrando; vagaIndex += 1) {
          doc.text('- COMPLETA', marginX + 3, linhaY);
          linhaY += 6;
        }

        currentY += linhasJogadores * 6 + 10;
      });

      const totalPaginas = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
        doc.setPage(pagina);
        doc.text('Gerado por FUT DA GALERA', marginX, pageHeight - 10);
      }

      const fileName = buildPdfFileName(salaNome);
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          title: 'Times do FUT DA GALERA',
          text: `${salaNome} - ${formatDisplayDate(jogo.data)} às ${jogo.hora.slice(0, 5)}`,
          files: [pdfFile],
        });
      } else {
        doc.save(fileName);
      }

    } catch (error) {
      console.error('Erro ao compartilhar times:', error);
      alert('Não foi possível gerar o PDF dos times. Tente novamente.');
    } finally {
      setIsSharingTimes(false);
    }
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

            {isAdminOuCohost ? (
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

        {isAdminOuCohost ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-[#111214]/90 p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('jogo')}
                className={[
                  'rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition',
                  activeTab === 'jogo'
                    ? 'border border-red-500/60 bg-red-500/20 text-red-100'
                    : 'border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-red-500/40 hover:text-red-200',
                ].join(' ')}
              >
                Jogo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notas')}
                className={[
                  'rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition',
                  activeTab === 'notas'
                    ? 'border border-red-500/60 bg-red-500/20 text-red-100'
                    : 'border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-red-500/40 hover:text-red-200',
                ].join(' ')}
              >
                Avaliações
              </button>
            </div>
          </div>
        ) : null}

        <div className={activeTab === 'jogo' ? '' : 'hidden'}>

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
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

              <div className="flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-3 sm:col-span-1">
                <label htmlFor="hora-fut" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                  Hora
                </label>
                <input
                  id="hora-fut"
                  type="number"
                  min="0"
                  max="23"
                  inputMode="numeric"
                  value={selectedHour}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D/g, '');
                    setSelectedHour(nextValue);
                    setTimeValidationError('');
                  }}
                  onBlur={() => {
                    const normalizedHour = normalizeTimeValue(selectedHour, 23);
                    setSelectedHour(normalizedHour);
                    setTimeValidationError(getTimeValidationError(normalizedHour, selectedMinute));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base font-semibold text-white outline-none transition focus:border-red-500"
                  placeholder="00"
                />
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-3 sm:col-span-1">
                <label htmlFor="minuto-fut" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                  Minuto
                </label>
                <input
                  id="minuto-fut"
                  type="number"
                  min="0"
                  max="59"
                  inputMode="numeric"
                  value={selectedMinute}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D/g, '');
                    setSelectedMinute(nextValue);
                    setTimeValidationError('');
                  }}
                  onBlur={() => {
                    const normalizedMinute = normalizeTimeValue(selectedMinute, 59);
                    setSelectedMinute(normalizedMinute);
                    setTimeValidationError(getTimeValidationError(selectedHour, normalizedMinute));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base font-semibold text-white outline-none transition focus:border-red-500"
                  placeholder="00"
                />
              </div>
            </div>

            {timeValidationError ? (
              <p className="mt-3 text-xs text-red-300">{timeValidationError}</p>
            ) : null}

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

        {futJaComecou && isParticipante && !hasEvaluatedCurrentGame ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
            <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Avaliar Jogadores</h2>
            <p className="mb-4 text-sm text-slate-300">Agora que o fut já começou, avalie o desempenho dos jogadores que participaram.</p>

            {jogadoresParaAvaliar.length === 0 ? (
              <p className="text-sm text-slate-300">Não há outros participantes para avaliar neste fut.</p>
            ) : (
              <div className="space-y-3">
                {jogadoresParaAvaliar.map((jogador) => (
                  <div key={jogador.user_id} className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-slate-200">{jogador.nome}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={avaliacaoNotas[jogador.user_id] ?? ''}
                      onChange={(event) =>
                        setAvaliacaoNotas((current) => ({
                          ...current,
                          [jogador.user_id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500 sm:w-28"
                      placeholder="0 a 10"
                    />
                  </div>
                ))}

                {avaliacaoError ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {avaliacaoError}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSalvarAvaliacoes}
                  disabled={!todosCamposValidos || isSavingAvaliacoes}
                  className={[
                    'w-full rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition duration-200',
                    !todosCamposValidos || isSavingAvaliacoes
                      ? 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none'
                      : 'bg-gradient-to-r from-red-700 to-red-500 hover:-translate-y-0.5 hover:shadow-red-800/40',
                  ].join(' ')}
                >
                  {isSavingAvaliacoes ? 'Salvando...' : 'Salvar Notas'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {futJaComecou && isParticipante && hasEvaluatedCurrentGame ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-slate-200">
            Você já avaliou os jogadores deste fut. Obrigado!
          </div>
        ) : null}

        {isAdminOuCohost ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-[#111214]/90 p-4">
            <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Gerenciar Presenças</h2>
            <p className="mb-4 text-sm text-slate-300">Confirme ou remova a presença de membros da sala e de convidados avulsos para este fut.</p>

            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3 sm:flex-row">
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Nome do convidado avulso"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500"
              />
              <button
                type="button"
                disabled={isUpdatingManagedPresence || !guestName.trim()}
                onClick={handleAdicionarConvidado}
                className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adicionar Convidado
              </button>
            </div>

            {(() => {
              const itensGerenciamento: PresencaGerenciaItem[] = [
                ...membrosSalaParaGerenciar.map((membro) => ({
                  id: undefined,
                  user_id: membro.user_id,
                  nome: membro.nome,
                  confirmado: membro.confirmado,
                  tipo: 'membro' as const,
                })),
                ...presencas
                  .filter((presenca) => Boolean(presenca.nome_convidado))
                  .map((presenca) => ({
                    id: presenca.id,
                    user_id: null,
                    nome: presenca.nome_convidado || presenca.nome || 'Convidado',
                    confirmado: true,
                    tipo: 'convidado' as const,
                  })),
              ];

              if (itensGerenciamento.length === 0) {
                return <p className="text-slate-300">Nenhum membro ou convidado disponível para gestão.</p>;
              }

              return (
                <ul className="space-y-2">
                  {itensGerenciamento.map((item) => (
                    <li key={`${item.tipo}-${item.id ?? item.user_id ?? item.nome}`} className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-semibold text-slate-100">{item.nome}</span>
                      <button
                        type="button"
                        disabled={isUpdatingManagedPresence}
                        onClick={() => handleGerenciarPresenca(item, !item.confirmado)}
                        className={[
                          'rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition',
                          item.confirmado
                            ? 'border border-slate-600 bg-slate-800 text-slate-200 hover:border-red-500 hover:text-red-200'
                            : 'border border-red-500/60 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20',
                          isUpdatingManagedPresence ? 'cursor-not-allowed opacity-60' : '',
                        ].join(' ')}
                      >
                        {item.confirmado ? 'Remover Presença' : 'Confirmar Presença'}
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">
            Presenças confirmadas <span className="text-sm font-semibold text-slate-400">({presencas.length})</span>
          </h2>

          {presencas.length === 0 ? (
            <p className="text-slate-300">Ainda não há confirmações para este fut.</p>
          ) : (
            <ul className="space-y-2">
              {presencas.map((presenca) => (
                <li key={presenca.id ?? presenca.user_id ?? presenca.nome} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  <span>{presenca.nome_convidado ? presenca.nome_convidado : presenca.nome}</span>
                  <div className="flex items-center gap-2">
                    {!presenca.nome_convidado && presenca.user_id && jogo?.notas_liberadas && typeof mediasPublicasMap[presenca.user_id] === 'number' ? (
                      <span className="rounded-lg border border-red-500/60 bg-red-900/50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-white">
                        {mediasPublicasMap[presenca.user_id].toFixed(1)}
                      </span>
                    ) : null}
                    {presenca.nome_convidado ? (
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">(convidado)</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {presencas.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Times</h2>
                <button
                  type="button"
                  onClick={handleCompartilharTimes}
                  disabled={isSharingTimes || cardsTimes.length === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                    <path d="M17 8a3 3 0 1 0-2.83-4" />
                    <path d="M7 14a3 3 0 1 0 2.83 4" />
                    <path d="M8.59 13.51 15.42 10.49" />
                  </svg>
                  {isSharingTimes ? 'Gerando...' : 'Compartilhar'}
                </button>
              </div>

              {isAdminOuCohost ? (
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

            {(() => {
              const cardsTimesData = cardsTimes;

              if (cardsTimesData.length === 0) {
                return <p className="text-slate-300">Ainda não foi montado nenhum time para este fut.</p>;
              }

              return (
                <div className="grid gap-3 md:grid-cols-2">
                  {cardsTimesData.map((time) => {
                    const capacidade = Math.max(1, time.capacidade ?? tamanhoTime ?? 1);
                    const jogadoresExibidos: Array<Presenca | 'COMPLETA'> = [...time.jogadores];

                    while (jogadoresExibidos.length < capacidade) {
                      jogadoresExibidos.push('COMPLETA');
                    }

                    return (
                      <div key={time.time} className="rounded-2xl border border-red-500/30 bg-[#111214]/80 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-red-200">Time {time.time} — Camisa {time.cor}</p>
                          <span className={['inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]', getCorClasses(time.cor)].join(' ')}>
                            {time.cor}
                          </span>
                        </div>

                        <ul className="space-y-2">
                          {jogadoresExibidos.map((jogador, index) => {
                            const isPlaceholder = jogador === 'COMPLETA';
                            const jogadorAtual = isPlaceholder ? null : jogador;
                            const isSelected = Boolean(jogadorAtual && selectedPlayerForSwap?.user_id === jogadorAtual.user_id);

                            return (
                              <li
                                key={`${time.time}-${jogador}-${index}`}
                                className={[
                                  'rounded-xl border px-2 py-2 text-sm',
                                  isPlaceholder
                                    ? 'border-dashed border-slate-600 bg-slate-800/40 text-slate-400 line-through'
                                    : isSelected
                                      ? 'border-red-500 bg-red-500/10 text-red-100'
                                      : 'border-slate-700 bg-slate-900/60 text-slate-200',
                                ].join(' ')}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{isPlaceholder ? jogador : jogador.nome || 'Usuário sem nome'}</span>
                                  {!isPlaceholder && isAdminOuCohost ? (
                                    <button
                                      type="button"
                                      disabled={isSwappingPlayers}
                                      onClick={() => handleSelecionarJogadorParaTroca(jogadorAtual as Presenca)}
                                      className={[
                                        'rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition',
                                        isSelected
                                          ? 'border-red-400 bg-red-500/20 text-red-100'
                                          : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:border-red-500 hover:text-red-200',
                                        isSwappingPlayers ? 'cursor-not-allowed opacity-60' : '',
                                      ].join(' ')}
                                    >
                                      {isSelected ? 'Selecionado' : 'Selecionar'}
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : null}

        </div>

        {isAdminOuCohost && activeTab === 'notas' ? (
          <div className="rounded-2xl border border-red-500/40 bg-[#111214]/90 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Resumo de Avaliações</h2>
              {jogo?.notas_liberadas ? (
                <span className="rounded-xl border border-red-500/60 bg-red-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
                  Notas já liberadas
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleLiberarNotas}
                  disabled={isLiberandoNotas}
                  className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLiberandoNotas ? 'Liberando...' : 'Liberar Notas para Todos'}
                </button>
              )}
            </div>

            {isLoadingResumoAvaliacoes ? (
              <p className="text-sm text-slate-300">Carregando resumo...</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-200">
                  {resumoAvaliadoresDistintos} de {resumoTotalElegiveis} confirmados já enviaram suas notas
                </p>

                {participantesElegiveis.length === 0 ? (
                  <p className="text-sm text-slate-300">Ainda não há participantes elegíveis para avaliação neste fut.</p>
                ) : (
                  <ul className="space-y-2">
                    {participantesElegiveis.map((jogador) => {
                      const mediaJogador = jogador.user_id ? resumoAvaliacoesMap[jogador.user_id] : null;
                      const temMedia = typeof mediaJogador === 'number' && Number.isFinite(mediaJogador);

                      return (
                        <li key={`resumo-${jogador.user_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                          <span className="font-semibold">{jogador.nome || 'Usuário sem nome'}</span>
                          {temMedia ? (
                            <span className="rounded-lg border border-red-500/60 bg-red-900/50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-white">
                              {mediaJogador.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Sem notas ainda</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
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
