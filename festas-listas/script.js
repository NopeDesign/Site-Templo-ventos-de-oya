import { 
    supabase, state, dataHoje, mesesNomesCompletos, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

// Verifica sessão ativa (permite Filho e Admin)
const usuarioAtivo = exigirSessao(false);
let modoVisaoAtual = (usuarioAtivo && usuarioAtivo.is_admin) ? 'admin' : 'filho';

const inputDataFesta = document.getElementById('festa-data');
if (inputDataFesta) inputDataFesta.value = dataHoje;

// =========================================================================
// 1. CONFIGURAÇÃO VISUAL POR CARGO (FILHO VS ADMIN)
// =========================================================================
function inicializarInterfacePorCargo() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secFilho = document.getElementById('filho-aba-festas');
    const secAdmin = document.getElementById('form-festas');
    const btnAlternar = document.getElementById('btn-alternar-visao');
    const labelAlternar = document.getElementById('label-alternar-visao');
    const subtituloCargo = document.getElementById('header-subtitulo-cargo');

    if (isAdmin) {
        if (btnAlternar) btnAlternar.classList.remove('hidden');
        if (modoVisaoAtual === 'admin') {
            navAdmin?.classList.remove('hidden');
            navFilho?.classList.add('hidden');
            secAdmin?.classList.remove('hidden');
            secFilho?.classList.add('hidden');
            if (subtituloCargo) subtituloCargo.innerText = 'Direção Espiritual';
            if (labelAlternar) labelAlternar.innerText = 'Visão do Filho';
        } else {
            navFilho?.classList.remove('hidden');
            navAdmin?.classList.add('hidden');
            secFilho?.classList.remove('hidden');
            secAdmin?.classList.add('hidden');
            if (subtituloCargo) subtituloCargo.innerText = 'Portal da Corrente';
            if (labelAlternar) labelAlternar.innerText = 'Gestão Admin';
        }
    } else {
        navFilho?.classList.remove('hidden');
        navAdmin?.classList.add('hidden');
        secFilho?.classList.remove('hidden');
        secAdmin?.classList.add('hidden');
        if (subtituloCargo) subtituloCargo.innerText = 'Portal da Corrente';
    }
}

export function alternarModoVisaoFestas() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;
    modoVisaoAtual = modoVisaoAtual === 'admin' ? 'filho' : 'admin';
    inicializarInterfacePorCargo();
    carregarFestas();
}

// =========================================================================
// 2. CARREGAR FESTAS E ITENS (VISÃO DO FILHO E VISÃO DO ADMIN)
// =========================================================================
function iconeCategoriaFesta(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('bebida')) return 'fa-wine-bottle text-[#8E2638]';
    if (c.includes('vela') || c.includes('firmeza')) return 'fa-fire-flame-simple text-[#8E2638]';
    if (c.includes('comida') || c.includes('doce')) return 'fa-cake-candles text-[#8E2638]';
    if (c.includes('fruta') || c.includes('flor')) return 'fa-apple-whole text-[#2b677a]';
    return 'fa-utensils text-[#2b677a]';
}

export async function carregarFestas() {
    if (!state.usuarioLogado) return;

    const [resFestas, resItens] = await Promise.all([
        supabase.from('festas').select('*').gte('data_festa', dataHoje).order('data_festa', { ascending: true }),
        supabase.from('festa_itens').select('*').order('created_at', { ascending: true })
    ]);

    const festas = resFestas.data || [];
    const itens = resItens.data || [];

    // Atualiza o badge de itens disponíveis na barra do Filho
    const idsFestasAtivas = festas.map(f => f.id);
    const itensDisponiveisCount = itens.filter(i => idsFestasAtivas.includes(i.festa_id) && !i.filho_id).length;
    const badgeFilho = document.getElementById('badge-festas-filho');
    if (badgeFilho) {
        if (itensDisponiveisCount > 0) {
            badgeFilho.innerText = itensDisponiveisCount;
            badgeFilho.classList.remove('hidden');
        } else {
            badgeFilho.classList.add('hidden');
        }
    }

    renderizarFestasFilho(festas, itens);

    if (state.usuarioLogado.is_admin) {
        atualizarSelectFestasAdmin(festas);
        renderizarFestasAdmin(festas, itens);
    }
}

function atualizarSelectFestasAdmin(festas) {
    const select = document.getElementById('item-festa-id');
    if (!select) return;

    const valorAtual = select.value;
    if (festas.length === 0) {
        select.innerHTML = `<option value="">Crie primeiro uma festa ao lado...</option>`;
        return;
    }

    select.innerHTML = festas.map(f => {
        const [ano, mes, dia] = f.data_festa.split('-');
        return `<option value="${f.id}">🎉 ${f.titulo} (${dia}/${mes}/${ano})</option>`;
    }).join('');

    if (valorAtual && festas.some(f => String(f.id) === String(valorAtual))) {
        select.value = valorAtual;
    }
}

// =========================================================================
// 3. RENDERIZAR VISÃO DO FILHO ("QUEM LEVA O QUÊ")
// =========================================================================
function renderizarFestasFilho(festas, todosItens) {
    const container = document.getElementById('container-festas-filho');
    if (!container) return;

    if (festas.length === 0) {
        container.innerHTML = `
            <div class="pro-card p-12 text-center bg-[#F5F0E8]/60 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-gifts text-3xl text-[#8E2638]/40 mb-3"></i>
                <h4 class="text-base font-extrabold text-slate-800">Nenhuma lista de festa ativa no momento</h4>
                <p class="text-xs text-slate-500 mt-1">Assim que a direção abrir uma nova lista colaborativa de festa ou obrigação, ela aparecerá aqui.</p>
            </div>`;
        return;
    }

    container.innerHTML = festas.map(festa => {
        const [ano, mes, dia] = festa.data_festa.split('-');
        const itensDaFesta = todosItens.filter(i => i.festa_id === festa.id);
        const totalItens = itensDaFesta.length;
        const assumidos = itensDaFesta.filter(i => i.filho_id !== null).length;
        const percentagem = totalItens > 0 ? Math.round((assumidos / totalItens) * 100) : 0;

        // Agrupar itens por categoria
        const categorias = [...new Set(itensDaFesta.map(i => i.categoria || 'Outros'))];

        const htmlCategorias = itensDaFesta.length === 0
            ? `<p class="text-xs text-slate-400 italic py-6 text-center">A direção ainda está a cadastrar os itens desta festa.</p>`
            : categorias.map(cat => {
                const itensCat = itensDaFesta.filter(i => (i.categoria || 'Outros') === cat);
                return `
                    <div class="space-y-3">
                        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#8E2638] flex items-center gap-2 border-b border-[#8E2638]/10 pb-2">
                            <i class="fa-solid ${iconeCategoriaFesta(cat)}"></i>
                            <span>${cat}</span>
                            <span class="text-[10px] text-slate-400 font-bold">(${itensCat.length})</span>
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${itensCat.map(item => renderizarItemSlotFilho(item)).join('')}
                        </div>
                    </div>
                `;
            }).join('');

        return `
            <article class="pro-card p-6 sm:p-8 relative overflow-hidden space-y-6">
                <div class="barra-topo-card bg-gradient-to-r from-[#8E2638] via-[#A9D8E8] to-[#8E2638]"></div>
                
                <!-- Cabeçalho da Festa -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#8E2638]/10 pb-5">
                    <div class="flex items-start sm:items-center gap-4">
                        <div class="flex flex-col items-center justify-center bg-[#8E2638] text-white rounded-2xl p-3.5 min-w-[70px] text-center shadow-md shrink-0">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#A9D8E8]">${mesesNomesCompletos[parseInt(mes)-1].substring(0,3)}</span>
                            <span class="text-2xl font-black leading-none mt-1">${dia}</span>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8E2638] block">Lista Oficial da Casa</span>
                            <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">${festa.titulo}</h3>
                            ${festa.observacao ? `
                                <p class="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1.5">
                                    <i class="fa-solid fa-bullhorn text-[#8E2638]"></i> ${festa.observacao}
                                </p>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Progresso da Lista -->
                    <div class="w-full md:w-56 bg-[#F5F0E8] p-3.5 rounded-2xl border border-[#8E2638]/15 shrink-0">
                        <div class="flex justify-between items-center text-[11px] font-extrabold mb-1.5">
                            <span class="text-slate-600 uppercase">Itens Assumidos</span>
                            <span class="text-[#8E2638]">${assumidos} de ${totalItens} (${percentagem}%)</span>
                        </div>
                        <div class="barra-progresso-trilho">
                            <div class="barra-progresso-preenchimento" style="width: ${percentagem}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Categorias e Itens -->
                <div class="space-y-6">
                    ${htmlCategorias}
                </div>
            </article>
        `;
    }).join('');
}

function renderizarItemSlotFilho(item) {
    const user = state.usuarioLogado;
    const estaLivre = !item.filho_id;
    const ehMeu = user && String(item.filho_id) === String(user.id);

    if (estaLivre) {
        return `
            <div class="item-festa-card item-festa-disponivel flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-sm font-extrabold text-slate-900 truncate">${item.nome_item}</p>
                    <span class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                        <i class="fa-regular fa-circle mr-1"></i>Disponível para escolher
                    </span>
                </div>
                <button onclick="assumirItemFesta('${item.id}')" type="button" class="bg-[#8E2638] hover:bg-[#681927] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition shrink-0 shadow-sm flex items-center gap-1.5">
                    <i class="fa-solid fa-hand-holding-heart"></i>
                    <span>Eu vou levar</span>
                </button>
            </div>
        `;
    }

    if (ehMeu) {
        return `
            <div class="item-festa-card item-festa-meu flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-sm font-black text-slate-900 truncate">${item.nome_item}</p>
                    <span class="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8E2638] uppercase tracking-wider">
                        <i class="fa-solid fa-circle-check"></i> Marcado com o seu nome
                    </span>
                </div>
                <button onclick="desmarcarItemFesta('${item.id}')" type="button" class="bg-white hover:bg-red-50 text-[#8E2638] border border-[#8E2638]/30 text-[11px] font-bold px-3 py-2 rounded-xl transition shrink-0">
                    Desmarcar
                </button>
            </div>
        `;
    }

    return `
        <div class="item-festa-card item-festa-ocupado flex items-center justify-between gap-3 opacity-85">
            <div class="min-w-0">
                <p class="text-sm font-bold text-slate-600 line-through truncate">${item.nome_item}</p>
                <span class="text-[11px] font-extrabold text-[#2b677a] capitalize flex items-center gap-1 mt-0.5">
                    <i class="fa-solid fa-user-check text-[10px]"></i> ${item.filho_nome} vai levar
                </span>
            </div>
            <span class="bg-[#A9D8E8]/35 text-[#1e4e5f] text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg shrink-0">
                Assumido
            </span>
        </div>
    `;
}

// =========================================================================
// 4. RENDERIZAR VISÃO DO ADMIN (CONTROLO COMPLETO DAS LISTAS)
// =========================================================================
function renderizarFestasAdmin(festas, todosItens) {
    const container = document.getElementById('lista-festas-admin');
    if (!container) return;

    if (festas.length === 0) {
        container.innerHTML = `
            <div class="pro-card p-10 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-calendar-plus text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhuma festa ativa cadastrada</p>
                <p class="text-xs text-slate-500 mt-1">Utilize o formulário "Passo 1" acima para criar a primeira festa.</p>
            </div>`;
        return;
    }

    container.innerHTML = festas.map(festa => {
        const [ano, mes, dia] = festa.data_festa.split('-');
        const itensDaFesta = todosItens.filter(i => i.festa_id === festa.id);
        const total = itensDaFesta.length;
        const assumidos = itensDaFesta.filter(i => i.filho_id !== null).length;
        const percentagem = total > 0 ? Math.round((assumidos / total) * 100) : 0;

        return `
            <div class="pro-card p-6 sm:p-8 relative overflow-hidden space-y-6">
                <div class="barra-topo-card bg-[#8E2638]"></div>
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#8E2638]/10 pb-4">
                    <div>
                        <div class="flex items-center gap-2.5">
                            <span class="bg-[#8E2638] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                                ${dia}/${mes}/${ano}
                            </span>
                            <span class="text-xs font-extrabold text-[#2b677a]">
                                ${assumidos} de ${total} itens assumidos (${percentagem}%)
                            </span>
                        </div>
                        <h4 class="text-xl font-extrabold text-slate-900 mt-1.5">${festa.titulo}</h4>
                        ${festa.observacao ? `<p class="text-xs text-slate-500 font-medium mt-0.5">${festa.observacao}</p>` : ''}
                    </div>

                    <button onclick="apagarFestaAdmin('${festa.id}')" type="button" class="bg-[#8E2638]/10 hover:bg-[#8E2638] text-[#8E2638] hover:text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition flex items-center gap-2 w-fit shrink-0">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Excluir Festa</span>
                    </button>
                </div>

                ${itensDaFesta.length === 0 ? `
                    <p class="text-xs text-slate-400 italic py-4 text-center">Nenhum item adicionado a esta festa ainda. Utilize o "Passo 2" acima.</p>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${itensDaFesta.map(item => `
                            <div class="p-3.5 rounded-2xl border ${item.filho_id ? 'bg-[#A9D8E8]/20 border-[#A9D8E8]' : 'bg-[#F5F0E8]/60 border-[#8E2638]/15'} flex items-center justify-between gap-2">
                                <div class="min-w-0">
                                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">${item.categoria || 'Item'}</span>
                                    <p class="text-xs font-extrabold text-slate-900 truncate">${item.nome_item}</p>
                                    ${item.filho_id ? `
                                        <p class="text-[11px] font-extrabold text-[#1e4e5f] capitalize mt-1">
                                            <i class="fa-solid fa-check mr-1"></i>${item.filho_nome}
                                        </p>
                                    ` : `
                                        <p class="text-[10px] font-semibold text-amber-700 mt-1">
                                            <i class="fa-regular fa-clock mr-1"></i>Aguardando filho...
                                        </p>
                                    `}
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    ${item.filho_id ? `
                                        <button onclick="desmarcarItemFesta('${item.id}')" type="button" title="Liberar vaga deste item" class="text-slate-400 hover:text-amber-700 w-7 h-7 rounded-lg hover:bg-amber-100/60 flex items-center justify-center transition">
                                            <i class="fa-solid fa-rotate-left text-xs"></i>
                                        </button>
                                    ` : ''}
                                    <button onclick="apagarItemFestaAdmin('${item.id}')" type="button" title="Apagar item" class="text-slate-400 hover:text-[#8E2638] w-7 h-7 rounded-lg hover:bg-[#8E2638]/10 flex items-center justify-center transition">
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }).join('');
}

// =========================================================================
// 5. AÇÕES DO FILHO E DO ADMIN NO SUPABASE
// =========================================================================
export async function assumirItemFesta(itemId) {
    if (!state.usuarioLogado) return;

    const { error } = await supabase
        .from('festa_itens')
        .update({
            filho_id: state.usuarioLogado.id,
            filho_nome: state.usuarioLogado.nome
        })
        .eq('id', itemId);

    if (!error) {
        mostrarToast("Item Confirmado!", "O item ficou registado com o seu nome na lista da festa.");
        carregarFestas();
    } else {
        alert("Erro ao assumir este item da lista.");
    }
}

export async function desmarcarItemFesta(itemId) {
    const { error } = await supabase
        .from('festa_itens')
        .update({
            filho_id: null,
            filho_nome: null
        })
        .eq('id', itemId);

    if (!error) {
        mostrarToast("Vaga Liberada", "O item voltou a ficar disponível na lista da festa.");
        carregarFestas();
    } else {
        alert("Erro ao desmarcar item.");
    }
}

export async function criarFestaAdmin(event) {
    event.preventDefault();
    const titulo = document.getElementById('festa-titulo').value.trim();
    const dataFesta = document.getElementById('festa-data').value;
    const obs = document.getElementById('festa-obs').value.trim();
    const btn = document.getElementById('btn-criar-festa');

    if (!titulo || !dataFesta) return;
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('festas').insert([{
        titulo: titulo,
        data_festa: dataFesta,
        observacao: obs || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Festa Criada!", `A lista "${titulo}" foi aberta. Adicione agora os itens no Passo 2.`);
        document.getElementById('festa-titulo').value = '';
        document.getElementById('festa-obs').value = '';
        carregarFestas();
    } else {
        alert("Erro ao criar festa.");
    }
}

export async function adicionarItemFestaAdmin(event) {
    event.preventDefault();
    const festaId = document.getElementById('item-festa-id').value;
    const categoria = document.getElementById('item-festa-categoria').value;
    const nomeItem = document.getElementById('item-festa-nome').value.trim();
    const qtd = parseInt(document.getElementById('item-festa-qtd').value) || 1;
    const btn = document.getElementById('btn-add-item-festa');

    if (!festaId) {
        alert("Crie ou selecione primeiro uma festa no Passo 1.");
        return;
    }

    if (btn) btn.disabled = true;

    // Cria 'qtd' vagas separadas para que vários filhos possam assumir individualmente
    const novasLinhas = [];
    for (let i = 0; i < Math.min(qtd, 30); i++) {
        novasLinhas.push({
            festa_id: festaId,
            categoria: categoria,
            nome_item: nomeItem,
            filho_id: null,
            filho_nome: null
        });
    }

    const { error } = await supabase.from('festa_itens').insert(novasLinhas);
    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Itens Adicionados!", `${novasLinhas.length}x "${nomeItem}" disponível(is) na lista.`);
        document.getElementById('item-festa-nome').value = '';
        document.getElementById('item-festa-qtd').value = '1';
        carregarFestas();
    } else {
        alert("Erro ao adicionar itens na festa.");
    }
}

export async function apagarItemFestaAdmin(itemId) {
    const { error } = await supabase.from('festa_itens').delete().eq('id', itemId);
    if (!error) {
        carregarFestas();
    }
}

export async function apagarFestaAdmin(festaId) {
    if (confirm("Deseja realmente excluir esta festa e todos os itens vinculados a ela?")) {
        await supabase.from('festa_itens').delete().eq('festa_id', festaId);
        const { error } = await supabase.from('festas').delete().eq('id', festaId);
        if (!error) {
            mostrarToast("Festa Excluída", "A lista e os seus itens foram removidos.");
            carregarFestas();
        }
    }
}

// =========================================================================
// 6. BADGES COMPLEMENTARES E TEMPO REAL
// =========================================================================
async function atualizarBadgesAdmin() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;

    const [resOracao, resDoacoes, resComps] = await Promise.all([
        supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
        supabase.from('doacoes_registros').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('comprovantes').select('id', { count: 'exact', head: true })
    ]);

    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = count || 0;
        el.classList.toggle('hidden', !(count > 0));
    };

    setBadge('badge-oracao-admin', resOracao.count);
    setBadge('badge-doacoes-admin', resDoacoes.count);
    setBadge('badge-comprovantes-menu', resComps.count);
}

supabase.channel('festas-listas-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'festas' }, () => carregarFestas())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'festa_itens' }, () => carregarFestas())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    alternarModoVisaoFestas,
    assumirItemFesta,
    desmarcarItemFesta,
    criarFestaAdmin,
    adicionarItemFestaAdmin,
    apagarItemFestaAdmin,
    apagarFestaAdmin
});

if (usuarioAtivo) {
    inicializarInterfacePorCargo();
    carregarFestas();
    atualizarBadgesAdmin();
}