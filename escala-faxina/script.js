import { 
    supabase, dataHoje, mesesNomesCompletos, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

// Garante que apenas administradores acedam a esta pasta
const adminAtivo = exigirSessao(true);

const inputDataFaxina = document.getElementById('faxina-data');
if (inputDataFaxina) inputDataFaxina.value = dataHoje;

// =========================================================================
// 1. CARREGAR GRUPOS DE FAXINA, INTEGRANTES E SELETORES
// =========================================================================
export async function carregarGestaoFaxina() {
    const selectFilho = document.getElementById('select-filho-faxina');
    const selectGrupo = document.getElementById('select-grupo-faxina');
    const divSemGrupo = document.getElementById('lista-filhos-sem-grupo');
    const containerGrupos = document.getElementById('lista-grupos-faxina');

    const [resGrupos, resFilhos] = await Promise.all([
        supabase.from('grupos_faxina').select('*').order('nome', { ascending: true }),
        supabase.from('filhos').select('id, nome, grupo_faxina_id').order('nome', { ascending: true })
    ]);

    const grupos = resGrupos.data || [];
    const filhos = resFilhos.data || [];

    const mapaGrupos = {};
    grupos.forEach(g => { mapaGrupos[g.id] = g.nome; });

    // 1. Popular Seletor de Filhos (indicando o grupo atual de cada um)
    if (selectFilho) {
        const valorAtualFilho = selectFilho.value;
        if (filhos.length === 0) {
            selectFilho.innerHTML = `<option value="">Nenhum filho cadastrado</option>`;
        } else {
            selectFilho.innerHTML = `<option value="">Selecione um filho da corrente...</option>` +
                filhos.map(f => {
                    const labelGrupo = f.grupo_faxina_id && mapaGrupos[f.grupo_faxina_id]
                        ? `(${mapaGrupos[f.grupo_faxina_id]})`
                        : `(Sem grupo)`;
                    return `<option value="${f.id}">${f.nome} ${labelGrupo}</option>`;
                }).join('');
            if (valorAtualFilho) selectFilho.value = valorAtualFilho;
        }
    }

    // 2. Popular Seletor de Grupos (incluindo opção para retirar de grupo)
    if (selectGrupo) {
        const valorAtualGrupo = selectGrupo.value;
        let opcoesGrupo = `<option value="">Selecione o grupo de destino...</option>`;
        grupos.forEach(g => {
            opcoesGrupo += `<option value="${g.id}">🧹 ${g.nome}</option>`;
        });
        opcoesGrupo += `<option value="NENHUM">🚫 Retirar de qualquer grupo (Deixar sem escala)</option>`;
        selectGrupo.innerHTML = opcoesGrupo;
        if (valorAtualGrupo) selectGrupo.value = valorAtualGrupo;
    }

    // 3. Mostrar resumo rápido dos filhos que ainda estão sem grupo
    if (divSemGrupo) {
        const semGrupo = filhos.filter(f => !f.grupo_faxina_id || !mapaGrupos[f.grupo_faxina_id]);
        if (semGrupo.length === 0) {
            divSemGrupo.innerHTML = `<span class="text-emerald-700 font-bold text-[11px]"><i class="fa-solid fa-circle-check mr-1"></i>Todos os filhos da corrente estão alocados!</span>`;
        } else {
            divSemGrupo.innerHTML = semGrupo.map(f => `
                <button onclick="selecionarFilhoRapido('${f.id}')" type="button" title="Clique para selecionar este filho" class="bg-white hover:bg-[#8E2638] text-slate-700 hover:text-white border border-[#8E2638]/20 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition capitalize">
                    ${f.nome.split(' ')[0]}
                </button>
            `).join('');
        }
    }

    // 4. Renderizar Cartões dos Grupos de Faxina
    if (!containerGrupos) return;

    if (grupos.length === 0) {
        containerGrupos.innerHTML = `
            <div class="col-span-2 pro-card p-12 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-broom text-3xl text-[#8E2638]/40 mb-3"></i>
                <h4 class="text-base font-extrabold text-slate-800">Nenhum grupo de manutenção criado ainda</h4>
                <p class="text-xs text-slate-500 mt-1">Utilize o formulário acima para criar o Grupo 1, Grupo 2, etc.</p>
            </div>`;
        return;
    }

    containerGrupos.innerHTML = grupos.map(grupo => {
        const integrantes = filhos.filter(f => String(f.grupo_faxina_id) === String(grupo.id));
        const isHoje = grupo.proxima_data === dataHoje;

        let badgeData = `<span class="text-[10px] font-extrabold uppercase bg-[#F5F0E8] text-slate-500 border border-[#8E2638]/15 px-2.5 py-0.5 rounded-full">Sem data</span>`;
        if (grupo.proxima_data) {
            const [ano, mes, dia] = grupo.proxima_data.split('-');
            if (isHoje) {
                badgeData = `<span class="text-[10px] font-extrabold uppercase bg-[#8E2638] text-white px-3 py-0.5 rounded-full animate-pulse">🧹 Escala Hoje (${dia}/${mes})</span>`;
            } else {
                badgeData = `<span class="text-[10px] font-extrabold uppercase bg-[#A9D8E8]/45 text-[#1e4e5f] border border-[#A9D8E8] px-3 py-0.5 rounded-full">📅 Próxima: ${dia}/${mes}/${ano}</span>`;
            }
        }

        const htmlIntegrantes = integrantes.length === 0
            ? `<p class="text-xs text-slate-400 italic py-3">Nenhum filho alocado neste grupo ainda.</p>`
            : `<div class="flex flex-wrap gap-2 pt-1">` + integrantes.map(m => `
                <span class="pilula-integrante-faxina capitalize">
                    <span>${m.nome}</span>
                    <button onclick="removerFilhoDoGrupo('${m.id}', '${m.nome.replace(/'/g, "\\'")}')" type="button" title="Retirar do grupo" class="w-5 h-5 rounded-full bg-[#8E2638]/10 hover:bg-[#8E2638] text-[#8E2638] hover:text-white flex items-center justify-center transition">
                        <i class="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                </span>
            `).join('') + `</div>`;

        return `
            <article class="pro-card p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between gap-6">
                <div class="barra-topo-card ${isHoje ? 'bg-[#8E2638]' : 'bg-gradient-to-r from-[#8E2638] to-[#A9D8E8]'}"></div>
                
                <div class="space-y-5">
                    <!-- Topo do Card do Grupo -->
                    <div class="flex items-start justify-between gap-3 border-b border-[#8E2638]/10 pb-4">
                        <div>
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                ${badgeData}
                                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#8E2638]">
                                    ${integrantes.length} ${integrantes.length === 1 ? 'Integrante' : 'Integrantes'}
                                </span>
                            </div>
                            <h4 class="text-xl font-extrabold text-slate-900">${grupo.nome}</h4>
                        </div>
                        <button onclick="apagarGrupoFaxina('${grupo.id}', '${grupo.nome.replace(/'/g, "\\'")}')" type="button" title="Excluir grupo" class="text-slate-400 hover:text-[#8E2638] w-8 h-8 rounded-xl hover:bg-[#8E2638]/10 flex items-center justify-center transition shrink-0">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>

                    <!-- Edição Rápida de Data e Horário/Obs do Grupo -->
                    <div class="bg-[#F5F0E8]/75 p-4 rounded-2xl border border-[#8E2638]/15 space-y-3">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#8E2638] block">
                            <i class="fa-regular fa-calendar-days mr-1"></i>Atualizar Próxima Escala deste Grupo:
                        </span>
                        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            <div class="sm:col-span-5">
                                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data:</label>
                                <input type="date" id="edit-faxina-data-${grupo.id}" value="${grupo.proxima_data || ''}" class="w-full bg-white border border-[#8E2638]/20 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8E2638]">
                            </div>
                            <div class="sm:col-span-4">
                                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Horário / Obs:</label>
                                <input type="text" id="edit-faxina-obs-${grupo.id}" value="${grupo.observacao || ''}" placeholder="Ex: 09:00h" class="w-full bg-white border border-[#8E2638]/20 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8E2638]">
                            </div>
                            <div class="sm:col-span-3">
                                <button onclick="atualizarDataGrupoFaxina('${grupo.id}')" type="button" class="w-full bg-[#8E2638] hover:bg-[#681927] text-white font-extrabold text-xs py-2 px-3 rounded-xl transition h-[34px] shadow-sm">
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Lista de Integrantes do Grupo -->
                    <div>
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                            Equipa Escalada:
                        </span>
                        ${htmlIntegrantes}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

export function selecionarFilhoRapido(filhoId) {
    const selectFilho = document.getElementById('select-filho-faxina');
    if (selectFilho) {
        selectFilho.value = filhoId;
        selectFilho.focus();
    }
}

// =========================================================================
// 2. CRIAR, ATUALIZAR E EXCLUIR GRUPOS + MOVER FILHOS
// =========================================================================
export async function criarGrupoFaxina(event) {
    event.preventDefault();
    const nome = document.getElementById('faxina-nome').value.trim();
    const data = document.getElementById('faxina-data').value;
    const obs = document.getElementById('faxina-obs').value.trim();
    const btn = document.getElementById('btn-criar-grupo-faxina');

    if (!nome || !data) return;
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('grupos_faxina').insert([{
        nome: nome,
        proxima_data: data,
        observacao: obs || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Grupo Criado!", `O "${nome}" foi registado. Aloque agora os integrantes ao lado.`);
        document.getElementById('faxina-nome').value = '';
        document.getElementById('faxina-obs').value = '';
        carregarGestaoFaxina();
    } else {
        alert("Erro ao criar grupo de faxina.");
    }
}

export async function atualizarDataGrupoFaxina(grupoId) {
    const novaData = document.getElementById(`edit-faxina-data-${grupoId}`)?.value || null;
    const novaObs = document.getElementById(`edit-faxina-obs-${grupoId}`)?.value.trim() || null;

    const { error } = await supabase
        .from('grupos_faxina')
        .update({ proxima_data: novaData, observacao: novaObs })
        .eq('id', grupoId);

    if (!error) {
        mostrarToast("Escala Atualizada!", "A nova data e horário já estão visíveis no painel dos integrantes.");
        carregarGestaoFaxina();
    } else {
        alert("Erro ao atualizar a data do grupo.");
    }
}

export async function moverFilhoGrupo() {
    const filhoId = document.getElementById('select-filho-faxina')?.value;
    const destino = document.getElementById('select-grupo-faxina')?.value;

    if (!filhoId) {
        alert("Selecione primeiro um filho da corrente.");
        return;
    }
    if (!destino) {
        alert("Selecione o grupo de destino.");
        return;
    }

    const grupoIdFinal = destino === 'NENHUM' ? null : destino;

    const { error } = await supabase
        .from('filhos')
        .update({ grupo_faxina_id: grupoIdFinal })
        .eq('id', filhoId);

    if (!error) {
        mostrarToast("Alocação Atualizada!", "O integrante foi vinculado ao grupo selecionado.");
        carregarGestaoFaxina();
    } else {
        alert("Erro ao mover integrante de grupo.");
    }
}

export async function removerFilhoDoGrupo(filhoId, filhoNome) {
    if (confirm(`Deseja retirar ${filhoNome} deste grupo de faxina?`)) {
        const { error } = await supabase
            .from('filhos')
            .update({ grupo_faxina_id: null })
            .eq('id', filhoId);

        if (!error) {
            mostrarToast("Integrante Retirado", `${filhoNome} ficou sem grupo atribuído.`);
            carregarGestaoFaxina();
        }
    }
}

export async function apagarGrupoFaxina(grupoId, grupoNome) {
    if (confirm(`Deseja realmente excluir o "${grupoNome}"? Os integrantes ficarão sem grupo.`)) {
        await supabase.from('filhos').update({ grupo_faxina_id: null }).eq('grupo_faxina_id', grupoId);
        const { error } = await supabase.from('grupos_faxina').delete().eq('id', grupoId);

        if (!error) {
            mostrarToast("Grupo Excluído", `O "${grupoNome}" foi removido com sucesso.`);
            carregarGestaoFaxina();
        } else {
            alert("Erro ao apagar grupo de faxina.");
        }
    }
}

// =========================================================================
// 3. BADGES DO MENU SUPERIOR E ATUALIZAÇÃO EM TEMPO REAL
// =========================================================================
async function atualizarBadgesMenuAdmin() {
    const [resOracao, resDoacoes, resComps] = await Promise.all([
        supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
        supabase.from('doacoes_registros').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('comprovantes').select('id', { count: 'exact', head: true })
    ]);

    const configurarBadge = (idElemento, total) => {
        const el = document.getElementById(idElemento);
        if (!el) return;
        el.innerText = total || 0;
        el.classList.toggle('hidden', !(total > 0));
    };

    configurarBadge('badge-oracao-admin', resOracao.count);
    configurarBadge('badge-doacoes-admin', resDoacoes.count);
    configurarBadge('badge-comprovantes-menu', resComps.count);
}

supabase.channel('admin-faxina-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'grupos_faxina' }, () => carregarGestaoFaxina())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'filhos' }, () => carregarGestaoFaxina())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    criarGrupoFaxina,
    atualizarDataGrupoFaxina,
    moverFilhoGrupo,
    removerFilhoDoGrupo,
    apagarGrupoFaxina,
    selecionarFilhoRapido
});

if (adminAtivo) {
    carregarGestaoFaxina();
    atualizarBadgesMenuAdmin();
}