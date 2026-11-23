import { 
    supabase, mesesNomesCompletos, dataHoje, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

let filhosCache = [];
let girasFuturasCache = [];

// Garante que apenas administradores acedam a esta pasta
const adminAtivo = exigirSessao(true);

// =========================================================================
// 1. ÍCONES LITÚRGICOS POR FUNÇÃO / CARGO
// =========================================================================
function iconeFuncao(funcao) {
    const f = (funcao || '').toLowerCase();
    if (f.includes('pai') || f.includes('mãe') || f.includes('mae')) return 'fa-crown text-[#8E2638]';
    if (f.includes('porteira')) return 'fa-door-open text-[#8E2638]';
    if (f.includes('cambono')) return 'fa-hands-holding-circle text-[#8E2638]';
    if (f.includes('cozinha') || f.includes('café') || f.includes('cafe')) return 'fa-mug-hot text-[#8E2638]';
    if (f.includes('recepção') || f.includes('assistência')) return 'fa-people-arrows text-[#8E2638]';
    if (f.includes('defumação') || f.includes('ervas')) return 'fa-smog text-[#8E2638]';
    if (f.includes('curimba') || f.includes('ogã') || f.includes('oga') || f.includes('atabaque')) return 'fa-drum text-[#8E2638]';
    if (f.includes('zeladoria') || f.includes('congá') || f.includes('conga')) return 'fa-wand-sparkles text-[#8E2638]';
    return 'fa-star text-[#8E2638]';
}

// =========================================================================
// 2. CARREGAR SELETORES E QUADRO DE CARGOS & ESCALAS
// =========================================================================
export async function carregarModuloCargosPostos() {
    const selectGira = document.getElementById('escala-gira-id');
    const selectFilho = document.getElementById('escala-filho-id');
    const containerLista = document.getElementById('lista-escalas-gira-admin');

    const [resFilhos, resGiras, resEscalas] = await Promise.all([
        supabase.from('filhos').select('id, nome').order('nome', { ascending: true }),
        supabase.from('giras').select('*').gte('data', dataHoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').order('created_at', { ascending: false })
    ]);

    filhosCache = resFilhos.data || [];
    girasFuturasCache = resGiras.data || [];
    const escalas = resEscalas.data || [];

    // 1. Preencher Seletor de Destino (Cargo Fixo vs Gira Específica)
    if (selectGira) {
        const valorAtualGira = selectGira.value;
        let opcoesGira = `<option value="TODAS">🌟 Todas as Giras (Cargo / Função Fixa da Casa)</option>`;
        girasFuturasCache.forEach(g => {
            const [ano, mes, dia] = g.data.split('-');
            opcoesGira += `<option value="${g.id}">📅 ${dia}/${mes}/${ano} — ${g.linha_trabalho}</option>`;
        });
        selectGira.innerHTML = opcoesGira;
        if (valorAtualGira && (valorAtualGira === 'TODAS' || girasFuturasCache.some(g => g.id === valorAtualGira))) {
            selectGira.value = valorAtualGira;
        }
    }

    // 2. Preencher Seletor de Filhos da Corrente
    if (selectFilho) {
        const valorAtualFilho = selectFilho.value;
        if (filhosCache.length === 0) {
            selectFilho.innerHTML = `<option value="">Nenhum filho cadastrado</option>`;
        } else {
            selectFilho.innerHTML = `<option value="">Selecione um filho da corrente...</option>` +
                filhosCache.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
            if (valorAtualFilho) selectFilho.value = valorAtualFilho;
        }
    }

    // 3. Renderizar Quadro de Cargos Fixos e Escalas por Gira
    if (!containerLista) return;

    const cargosFixos = escalas.filter(e => e.gira_id === null);

    let htmlFinal = '';

    // BLOCO A: CARGOS FIXOS E PERMANENTES DA CASA
    htmlFinal += `
        <div class="pro-card p-6 sm:p-8 relative overflow-hidden">
            <div class="barra-topo-card bg-[#8E2638]"></div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-[#8E2638]/10 pb-4">
                <div class="flex items-center gap-3">
                    <div class="icone-editorial-grena">
                        <i class="fa-solid fa-crown text-base"></i>
                    </div>
                    <div>
                        <span class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8E2638] block">Validade Permanente</span>
                        <h4 class="text-base sm:text-lg font-extrabold text-slate-900">Cargos Fixos da Casa (Todas as Giras)</h4>
                    </div>
                </div>
                <span class="text-xs font-extrabold text-[#8E2638] bg-[#8E2638]/10 border border-[#8E2638]/20 px-3 py-1 rounded-full w-fit">
                    ${cargosFixos.length} ${cargosFixos.length === 1 ? 'Cargo Ativo' : 'Cargos Ativos'}
                </span>
            </div>

            ${cargosFixos.length === 0 ? `
                <div class="bg-[#F5F0E8]/70 p-6 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                    <p class="text-xs text-slate-500 font-medium">Nenhum cargo fixo permanente atribuído ainda. Selecione "Todas as Giras" acima para registar.</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${cargosFixos.map(cf => renderizarCardPosto(cf, true)).join('')}
                </div>
            `}
        </div>
    `;

    // BLOCO B: ESCALAS ESPECÍFICAS DAS PRÓXIMAS GIRAS AGENDADAS
    if (girasFuturasCache.length === 0) {
        htmlFinal += `
            <div class="pro-card p-8 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-regular fa-calendar-plus text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhuma gira futura agendada no momento</p>
                <p class="text-xs text-slate-500 mt-1">Agende uma gira no módulo "Giras & Avisos" para escalar postos específicos por data.</p>
            </div>
        `;
    } else {
        girasFuturasCache.forEach(gira => {
            const [ano, mes, dia] = gira.data.split('-');
            const postosDestaGira = escalas.filter(e => e.gira_id === gira.id);

            htmlFinal += `
                <div class="pro-card p-6 sm:p-8 relative overflow-hidden">
                    <div class="barra-topo-card bg-[#A9D8E8]"></div>
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-[#8E2638]/10 pb-4">
                        <div class="flex items-center gap-3.5">
                            <div class="flex flex-col items-center justify-center bg-[#8E2638] text-white rounded-2xl p-2.5 min-w-[58px] text-center shadow-sm">
                                <span class="text-[9px] font-extrabold uppercase tracking-widest text-[#A9D8E8]">${mesesNomesCompletos[parseInt(mes)-1].substring(0,3)}</span>
                                <span class="text-lg font-black leading-none mt-0.5">${dia}</span>
                            </div>
                            <div>
                                <span class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2b677a] block">Escala do Dia &bull; ${dia}/${mes}/${ano}</span>
                                <h4 class="text-base sm:text-lg font-extrabold text-slate-900">${gira.linha_trabalho}</h4>
                            </div>
                        </div>
                        <span class="text-xs font-extrabold text-[#1e4e5f] bg-[#A9D8E8]/35 border border-[#A9D8E8] px-3 py-1 rounded-full w-fit">
                            ${postosDestaGira.length} ${postosDestaGira.length === 1 ? 'Escalado' : 'Escalados'}
                        </span>
                    </div>

                    ${postosDestaGira.length === 0 ? `
                        <div class="bg-[#F5F0E8]/60 p-5 rounded-2xl border border-dashed border-[#8E2638]/15 text-center">
                            <p class="text-xs text-slate-500 font-medium">Nenhum posto extra escalado especificamente para esta gira (apenas os cargos fixos da casa).</p>
                        </div>
                    ` : `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${postosDestaGira.map(p => renderizarCardPosto(p, false)).join('')}
                        </div>
                    `}
                </div>
            `;
        });
    }

    containerLista.innerHTML = htmlFinal;
}

function renderizarCardPosto(posto, isFixo) {
    return `
        <div class="card-posto-item flex flex-col justify-between gap-3 ${isFixo ? 'bg-[#F5F0E8]/40' : 'bg-white'}">
            <div>
                <div class="flex items-start justify-between gap-2">
                    <span class="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${isFixo ? 'text-[#8E2638]' : 'text-[#2b677a]'}">
                        <i class="fa-solid ${iconeFuncao(posto.funcao)}"></i>
                        ${posto.funcao}
                    </span>
                    <button onclick="removerPostoGira('${posto.id}')" type="button" title="Remover atribuição" class="text-slate-400 hover:text-[#8E2638] w-7 h-7 rounded-lg hover:bg-[#8E2638]/10 flex items-center justify-center transition shrink-0">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
                <p class="text-base font-black text-slate-900 capitalize mt-1">${posto.filho_nome}</p>
                ${posto.detalhe ? `
                    <p class="text-xs text-slate-600 font-medium mt-2 pt-2 border-t border-[#8E2638]/10 leading-relaxed">
                        <i class="fa-solid fa-circle-info text-[#8E2638]/70 mr-1"></i>${posto.detalhe}
                    </p>
                ` : ''}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
                <span>${isFixo ? '🌟 Permanente' : '📅 Escala da Gira'}</span>
                <span class="text-emerald-700"><i class="fa-solid fa-check mr-0.5"></i>Visível no Painel</span>
            </div>
        </div>
    `;
}

// =========================================================================
// 3. SALVAR E REMOVER CARGO / POSTO DA GIRA
// =========================================================================
export async function salvarPostoGira(event) {
    event.preventDefault();
    const giraVal = document.getElementById('escala-gira-id').value;
    const filhoId = document.getElementById('escala-filho-id').value;
    const funcao = document.getElementById('escala-funcao').value.trim();
    const detalhe = document.getElementById('escala-detalhe').value.trim();
    const btn = document.getElementById('btn-salvar-escala');

    if (!filhoId || !funcao) return;

    const filhoObj = filhosCache.find(f => String(f.id) === String(filhoId));
    const filhoNome = filhoObj ? filhoObj.nome : 'Integrante';
    const giraIdFinal = giraVal === 'TODAS' ? null : giraVal;

    if (btn) btn.disabled = true;

    const { error } = await supabase.from('escala_gira').insert([{
        gira_id: giraIdFinal,
        filho_id: filhoId,
        filho_nome: filhoNome,
        funcao: funcao,
        detalhe: detalhe || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast(
            giraIdFinal === null ? 'Cargo Fixo Atribuído!' : 'Posto Escalado!',
            `${filhoNome} foi designado(a) como ${funcao}.`
        );
        document.getElementById('escala-funcao').value = '';
        document.getElementById('escala-detalhe').value = '';
        carregarModuloCargosPostos();
    } else {
        alert("Erro ao salvar cargo ou posto na gira.");
    }
}

export async function removerPostoGira(id) {
    if (confirm("Deseja remover este cargo/posto da escala?")) {
        const { error } = await supabase.from('escala_gira').delete().eq('id', id);
        if (!error) {
            mostrarToast("Posto Removido", "A atribuição foi retirada da escala.");
            carregarModuloCargosPostos();
        }
    }
}

// =========================================================================
// 4. BADGES DE NOTIFICAÇÃO DO MENU SUPERIOR E TEMPO REAL
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
        if (total && total > 0) {
            el.innerText = total;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    };

    configurarBadge('badge-oracao-admin', resOracao.count);
    configurarBadge('badge-doacoes-admin', resDoacoes.count);
    configurarBadge('badge-comprovantes-menu', resComps.count);
}

supabase.channel('admin-cargos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_gira' }, () => carregarModuloCargosPostos())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_oracao' }, () => atualizarBadgesMenuAdmin())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'doacoes_registros' }, () => atualizarBadgesMenuAdmin())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comprovantes' }, () => atualizarBadgesMenuAdmin())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    salvarPostoGira,
    removerPostoGira
});

if (adminAtivo) {
    carregarModuloCargosPostos();
    atualizarBadgesMenuAdmin();
}