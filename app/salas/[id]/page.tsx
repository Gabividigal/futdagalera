'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Sala = {
  id: string;
  nome: string;
  descricao?: string | null;
  tamanho_time?: number | null;
  codigo_convite: string;
  admin_id: string;
  cohost_id?: string | null;
};

type Membro = {
  user_id: string;
  nome: string;
  notaSala?: number | null;
};

type Jogo = {
  id: string;
  data: string;
  hora: string;
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
  if (!hourValue) {
    return 'Informe a hora.';
  }

  const hourNumber = Number(hourValue);
  if (!Number.isInteger(hourNumber) || hourNumber < 0 || hourNumber > 23) {
    return 'A hora deve estar entre 00 e 23.';
  }

  if (!minuteValue) {
    return 'Informe os minutos.';
  }

  const minuteNumber = Number(minuteValue);
  if (!Number.isInteger(minuteNumber) || minuteNumber < 0 || minuteNumber > 59) {
    return 'Os minutos devem estar entre 00 e 59.';
  }

  return '';
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
  const router = useRouter();
  const id = params?.id;
  const [sala, setSala] = useState<Sala | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editError, setEditError] = useState('');
  const [removeMemberError, setRemoveMemberError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingSala, setIsSavingSala] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateKey(new Date()));
  const [editForm, setEditForm] = useState({ nome: '', descricao: '', tamanho_time: '' });
  const [memberToRemove, setMemberToRemove] = useState<Membro | null>(null);
  const [memberToRoleChange, setMemberToRoleChange] = useState<Membro | null>(null);
  const [roleAction, setRoleAction] = useState<'transfer-host' | 'toggle-cohost' | null>(null);
  const [cohostNome, setCohostNome] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<string>('00');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [timeValidationError, setTimeValidationError] = useState('');
  const [proximosJogos, setProximosJogos] = useState<Jogo[]>([]);
  const [loadingNotasMembros, setLoadingNotasMembros] = useState(false);
  const diaOptions = gerarDiasDisponiveis();
  const diaColumnRef = useRef<HTMLDivElement | null>(null);
  const diaItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
        const salaAtual = salaData as Sala;
        setSala(salaAtual);

        if (salaAtual.cohost_id) {
          const { data: cohostData } = await supabase.from('perfis').select('nome').eq('id', salaAtual.cohost_id).single();
          setCohostNome(cohostData?.nome || 'Usuário sem nome');
        } else {
          setCohostNome(null);
        }
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

    const carregarNotasDosMembros = async () => {
      if (!id) return;

      setLoadingNotasMembros(true);

      const { data: jogosDaSalaData } = await supabase.from('jogos').select('id').eq('sala_id', id);
      const jogoIds = jogosDaSalaData?.map((jogo) => jogo.id) ?? [];

      if (jogoIds.length === 0) {
        setMembros((currentMembers) => currentMembers.map((member) => ({ ...member, notaSala: null })));
        setLoadingNotasMembros(false);
        return;
      }

      const { data: avaliacoesData } = await supabase
        .from('avaliacoes')
        .select('avaliado_id, nota, jogo_id')
        .in('jogo_id', jogoIds);

      const { data: perfisData } = await supabase.from('perfis').select('id, nivel_habilidade');

      const notasPorUsuario = new Map<string, number>();

      if (avaliacoesData) {
        const porUsuario = new Map<string, Map<string, number[]>>();

        avaliacoesData.forEach((avaliacao) => {
          const userId = String(avaliacao.avaliado_id);
          const jogoId = String(avaliacao.jogo_id);

          if (!porUsuario.has(userId)) {
            porUsuario.set(userId, new Map<string, number[]>());
          }

          const notasPorJogo = porUsuario.get(userId)!;
          if (!notasPorJogo.has(jogoId)) {
            notasPorJogo.set(jogoId, []);
          }
          notasPorJogo.get(jogoId)!.push(Number(avaliacao.nota));
        });

        porUsuario.forEach((notasPorJogo, userId) => {
          const mediasPorJogo = Array.from(notasPorJogo.values()).map((notas) => {
            const soma = notas.reduce((total, nota) => total + nota, 0);
            return soma / notas.length;
          });

          const notaMediaSala = mediasPorJogo.reduce((total, media) => total + media, 0) / mediasPorJogo.length;
          notasPorUsuario.set(userId, notaMediaSala);
        });
      }

      const perfisMap = new Map<string, string | null>();
      (perfisData ?? []).forEach((perfil) => {
        perfisMap.set(String(perfil.id), perfil.nivel_habilidade ?? null);
      });

      setMembros((currentMembers) =>
        currentMembers.map((member) => {
          const notaExistente = notasPorUsuario.get(member.user_id);
          if (typeof notaExistente === 'number') {
            return { ...member, notaSala: Number(notaExistente.toFixed(1)) };
          }

          const nivel = perfisMap.get(member.user_id);
          return { ...member, notaSala: Number(getNivelHabilidadeValue(nivel).toFixed(1)) };
        }),
      );
      setLoadingNotasMembros(false);
    };

    loadSala();
    carregarNotasDosMembros();
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
  }, [showCalendar, selectedDate]);

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
    if (!currentUserId || !id) return;

    const normalizedHour = normalizeTimeValue(selectedHour, 23);
    const normalizedMinute = normalizeTimeValue(selectedMinute, 59);
    const validationError = getTimeValidationError(normalizedHour, normalizedMinute);

    if (!selectedDate || validationError) {
      setTimeValidationError(validationError || 'Informe um horário válido.');
      return;
    }

    setTimeValidationError('');

    const { error } = await supabase.from('jogos').insert([
      {
        sala_id: id,
        data: selectedDate,
        hora: `${normalizedHour}:${normalizedMinute}:00`,
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

  const handleDeleteSala = async () => {
    if (!id || !sala || !isAdminOuCohost || isDeleting) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const { error } = await supabase.from('salas').delete().eq('id', id);

      if (error) {
        throw error;
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Erro ao apagar sala:', error);
      setDeleteError('Não foi possível apagar a sala. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSala = async () => {
    if (!id || !sala) return;

    const nome = editForm.nome.trim();
    const descricao = editForm.descricao.trim();
    const tamanhoTimeValue = editForm.tamanho_time === '' ? null : Number(editForm.tamanho_time);

    if (!nome) {
      setEditError('Informe um nome para a sala.');
      return;
    }

    if (tamanhoTimeValue !== null && (!Number.isFinite(tamanhoTimeValue) || tamanhoTimeValue <= 0)) {
      setEditError('O tamanho de cada time precisa ser maior que zero.');
      return;
    }

    setIsSavingSala(true);
    setEditError('');

    try {
      const { error } = await supabase
        .from('salas')
        .update({
          nome,
          descricao: descricao || null,
          tamanho_time: tamanhoTimeValue,
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setSala((currentSala) =>
        currentSala
          ? {
              ...currentSala,
              nome,
              descricao: descricao || null,
              tamanho_time: tamanhoTimeValue,
            }
          : currentSala,
      );
      setShowEditModal(false);
    } catch (error) {
      console.error('Erro ao atualizar sala:', error);
      setEditError('Não foi possível salvar as alterações da sala.');
    } finally {
      setIsSavingSala(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!id || !memberToRemove || !isAdmin) return;

    setIsRemovingMember(true);
    setRemoveMemberError('');

    try {
      const { error } = await supabase.from('membros_sala').delete().eq('sala_id', id).eq('user_id', memberToRemove.user_id);

      if (error) {
        throw error;
      }

      setMembros((currentMembers) => currentMembers.filter((member) => member.user_id !== memberToRemove.user_id));
      setShowRemoveMemberModal(false);
      setMemberToRemove(null);
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      setRemoveMemberError('Não foi possível remover esse membro. Tente novamente.');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleRoleAction = async () => {
    if (!id || !sala || !memberToRoleChange || !roleAction || !isAdmin || isUpdatingRole) return;

    setIsUpdatingRole(true);
    setRoleError('');

    try {
      const nextPayload = roleAction === 'transfer-host'
        ? { admin_id: memberToRoleChange.user_id }
        : { cohost_id: sala.cohost_id === memberToRoleChange.user_id ? null : memberToRoleChange.user_id };

      const { error } = await supabase.from('salas').update(nextPayload).eq('id', id);

      if (error) {
        throw error;
      }

      setSala((currentSala) =>
        currentSala
          ? {
              ...currentSala,
              ...nextPayload,
            }
          : currentSala,
      );

      if (roleAction === 'toggle-cohost') {
        setCohostNome(nextPayload.cohost_id ? memberToRoleChange.nome : null);
      }

      setShowRoleModal(false);
      setMemberToRoleChange(null);
      setRoleAction(null);
    } catch (error) {
      console.error('Erro ao alterar função da sala:', error);
      setRoleError('Não foi possível atualizar a função desse membro. Tente novamente.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const isConfirmDisabled = !selectedDate || !selectedHour || !selectedMinute || !!timeValidationError;

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
  const isAdminOuCohost = isAdmin || currentUserId === sala.cohost_id;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <div className="relative z-10 w-full max-w-3xl rounded-[28px] border border-red-800/60 bg-[#111214]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-7">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.12em] text-red-300 transition hover:text-red-200">
            ← Voltar
          </Link>
        </div>

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

          {cohostNome ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-200">
              Co-host: {cohostNome}
            </div>
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

        {!isAdmin && currentUserId === sala.cohost_id ? (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Você é o co-host desta sala
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-lg font-black uppercase tracking-[0.12em] text-white">Membros</h2>

          {membros.length === 0 ? (
            <p className="text-slate-300">Nenhum membro encontrado nesta sala.</p>
          ) : (
            <ul className="space-y-2">
              {membros.map((membro) => {
                const papel = membro.user_id === sala.admin_id
                  ? '(host)'
                  : membro.user_id === sala.cohost_id
                    ? '(co-host)'
                    : null;

                return (
                  <li key={membro.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{membro.nome}</p>
                      {papel ? (
                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{papel}</p>
                      ) : null}
                    </div>

                    <div className="ml-3 flex items-center gap-2">
                      {loadingNotasMembros ? (
                        <span className="text-xs text-slate-400">...</span>
                      ) : (
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-sm font-black text-red-200">
                          {membro.notaSala?.toFixed(1) ?? '5.0'}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isAdminOuCohost ? (
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
                        setTimeValidationError(getTimeValidationError(nextValue, selectedMinute));
                      }}
                      onBlur={() => {
                        const normalizedHour = normalizeTimeValue(selectedHour, 23);
                        const normalizedMinute = normalizeTimeValue(selectedMinute, 59);
                        setSelectedHour(normalizedHour);
                        setSelectedMinute(normalizedMinute);
                        setTimeValidationError(getTimeValidationError(normalizedHour, normalizedMinute));
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
                        setTimeValidationError(getTimeValidationError(selectedHour, nextValue));
                      }}
                      onBlur={() => {
                        const normalizedHour = normalizeTimeValue(selectedHour, 23);
                        const normalizedMinute = normalizeTimeValue(selectedMinute, 59);
                        setSelectedHour(normalizedHour);
                        setSelectedMinute(normalizedMinute);
                        setTimeValidationError(getTimeValidationError(normalizedHour, normalizedMinute));
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base font-semibold text-white outline-none transition focus:border-red-500"
                      placeholder="00"
                    />
                  </div>
                </div>

                {timeValidationError ? (
                  <p className="mt-3 text-xs text-red-300">{timeValidationError}</p>
                ) : null}

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

        {isAdminOuCohost ? (
          <div className="mt-6 border-t border-red-800/40 pt-5">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!sala) return;
                  setEditForm({
                    nome: sala.nome,
                    descricao: sala.descricao ?? '',
                    tamanho_time: sala.tamanho_time?.toString() ?? '',
                  });
                  setEditError('');
                  setShowEditModal(true);
                }}
                className="w-full rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-900/50"
              >
                Editar Sala
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setShowDeleteModal(true);
                }}
                className="w-full rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-900/50"
              >
                Apagar Sala
              </button>
            </div>

            {deleteError ? (
              <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {deleteError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.8)] sm:p-6">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              aria-label="Fechar edição"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
            >
              ×
            </button>

            <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">Editar Sala</p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="edit-sala-nome" className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                  Nome da sala
                </label>
                <input
                  id="edit-sala-nome"
                  value={editForm.nome}
                  onChange={(event) => setEditForm((current) => ({ ...current, nome: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-red-500"
                />
              </div>

              <div>
                <label htmlFor="edit-sala-descricao" className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                  Descrição
                </label>
                <textarea
                  id="edit-sala-descricao"
                  value={editForm.descricao}
                  onChange={(event) => setEditForm((current) => ({ ...current, descricao: event.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-red-500"
                />
              </div>

              <div>
                <label htmlFor="edit-sala-tamanho" className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                  Tamanho de cada time
                </label>
                <input
                  id="edit-sala-tamanho"
                  type="number"
                  min={1}
                  value={editForm.tamanho_time}
                  onChange={(event) => setEditForm((current) => ({ ...current, tamanho_time: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-red-500"
                />
              </div>

              {isAdminOuCohost ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <h3 className="mb-3 text-base font-black uppercase tracking-[0.12em] text-white">Gerenciar Membros</h3>

                  {membros.length === 0 ? (
                    <p className="text-sm text-slate-300">Nenhum membro encontrado nesta sala.</p>
                  ) : (
                    <ul className="space-y-2">
                      {membros.map((membro) => {
                        const isOwner = membro.user_id === sala.admin_id;
                        const isCurrentCohost = membro.user_id === sala.cohost_id;

                        return (
                          <li
                            key={membro.user_id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="text-sm text-slate-200">{membro.nome}</span>

                            {!isOwner ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemberToRemove(membro);
                                    setRemoveMemberError('');
                                    setShowRemoveMemberModal(true);
                                  }}
                                  className="rounded-lg border border-red-500/60 bg-red-900/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-900/40"
                                >
                                  Remover
                                </button>
                                {isAdmin ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMemberToRoleChange(membro);
                                        setRoleAction('transfer-host');
                                        setRoleError('');
                                        setShowRoleModal(true);
                                      }}
                                      className="rounded-lg border border-red-500/60 bg-red-900/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-900/40"
                                    >
                                      Tornar Host
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMemberToRoleChange(membro);
                                        setRoleAction('toggle-cohost');
                                        setRoleError('');
                                        setShowRoleModal(true);
                                      }}
                                      className="rounded-lg border border-red-500/60 bg-red-900/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400 hover:bg-red-900/40"
                                    >
                                      {isCurrentCohost ? 'Remover Co-host' : 'Tornar Co-host'}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Admin</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              {editError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{editError}</div>
              ) : null}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSala}
                disabled={isSavingSala}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingSala ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRoleModal && memberToRoleChange ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => {
                setShowRoleModal(false);
                setMemberToRoleChange(null);
                setRoleAction(null);
                setRoleError('');
              }}
              aria-label="Fechar confirmação"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
            >
              ×
            </button>

            <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">
              {roleAction === 'transfer-host'
                ? 'Tem certeza?'
                : sala?.cohost_id === memberToRoleChange.user_id
                  ? 'Remover co-host?'
                  : 'Definir co-host?'}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {roleAction === 'transfer-host'
                ? `Você deixará de ser o host desta sala e perderá as permissões administrativas. O novo host será ${memberToRoleChange.nome}.`
                : sala?.cohost_id === memberToRoleChange.user_id
                  ? `Você está removendo ${memberToRoleChange.nome} como co-host desta sala.`
                  : `Você está definindo ${memberToRoleChange.nome} como co-host desta sala.`}
            </p>

            {roleError ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {roleError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  setMemberToRoleChange(null);
                  setRoleAction(null);
                  setRoleError('');
                }}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRoleAction}
                disabled={isUpdatingRole}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdatingRole ? 'Atualizando...' : roleAction === 'transfer-host' ? 'Sim, transferir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRemoveMemberModal && memberToRemove ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => {
                setShowRemoveMemberModal(false);
                setMemberToRemove(null);
                setRemoveMemberError('');
              }}
              aria-label="Fechar confirmação"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
            >
              ×
            </button>

            <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">Remover {memberToRemove.nome} da sala?</p>

            {removeMemberError ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {removeMemberError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRemoveMemberModal(false);
                  setMemberToRemove(null);
                  setRemoveMemberError('');
                }}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                disabled={isRemovingMember}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRemovingMember ? 'Removendo...' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-md rounded-[28px] border border-red-800/60 bg-[#111214]/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              aria-label="Fechar confirmação"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg text-white transition hover:border-red-500 hover:text-red-300"
            >
              ×
            </button>

            <p className="mt-6 text-xl font-black uppercase tracking-[0.12em] text-white">Apagar sala?</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tem certeza que deseja apagar a sala <span className="font-bold text-red-200">{sala.nome}</span>? Essa ação é permanente
              e vai remover todos os membros, jogos marcados e presenças confirmadas. Não pode ser desfeita.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteSala}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-900/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-red-800/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? 'Apagando...' : 'Sim, apagar sala'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
