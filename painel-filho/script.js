import { 
    supabase, state, mesesNomesCompletos, dataHoje, 
    FINANCEIRO_CONFIG, exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

let presencasCacheLocal = [];

// Garante que há um utilizador autenticado ao abrir a pasta
const usuarioAtivo = exigirSessao(false);

// =========================================================================
// 1. INICIALIZAÇÃO E CARREGAMENTO GERAL DO PAINEL DO FILHO
// =========================================================================
export async function carregarPainelDoFilho() {
    if (!state.usuarioLogado) return;

    // Atualiza os dados do filho e carrega a lista para o Radar de Celebrações
    const { data: todosFilhos } = await supabase.from('filhos').select('*').order('nome');
    if (todosFilhos) {
        const userFresh = todosFilhos.find(f => f.id === state.usuarioLogado.id);
        if (userFresh) {
            state.usuarioLogado = userFresh;
            localStorage.setItem('umbanda_user_session', JSON.stringify(userFresh));
        }
        const containerRadar = document.getElementById('user-radar-aniversariantes');
        if (containerRadar) containerRadar.innerHTML = gerarHtmlRadarAniversariantes(todosFilhos);
    }

    const user = state.usuarioLogado;
    const elNome = document.getElementById('user-nome-display');
    if (elNome) elNome.innerText = user.nome.trim().split(' ')[0];

    const elPixDisplay = document.getElementById('pix-chave-display');
    if (elPixDisplay) elPixDisplay.innerText = FINANCEIRO_CONFIG.chavePix;

    // Executa os carregamentos em paralelo para máxima velocidade
    await Promise.all([
        verificarFichaLiberadaFilho(),
        verificarBadgeFestasAtivas(),
        carregarEscalaGiraFilho(),
        carregarEscalaDoFilho(),
        carregarMuralAvisos(),
        carregarFinanceiroPessoal(),
        carregarGiras()
    ]);
}

// =========================================================================
// 2. ALERTA DE FICHA CADASTRAL E BADGE DE FESTAS
// =========================================================================
async function verificarFichaLiberadaFilho() {
    const banner = document.getElementById('alerta-ficha-liberada');
    if (!banner || !state.usuarioLogado) return;

    const { data } = await supabase
        .from('fichas_cadastrais')
        .select('liberada_para_preencher')
        .eq('filho_id', state.usuarioLogado.id)
        .maybeSingle();

    if (data && data.liberada_para_preencher === true) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

async function verificarBadgeFestasAtivas() {
    const badge = document.getElementById('badge-festas-filho');
    if (!badge) return;

    const [resFestas, resItens] = await Promise.all([
        supabase.from('festas').select('id').gte('data_festa', dataHoje),
        supabase.from('festa_itens').select('id, festa_id, filho_id')
    ]);

    const idsFestas = (resFestas.data || []).map(f => f.id);
    const disponiveis = (resItens.data || []).filter(i => idsFestas.includes(i.festa_id) && !i.filho_id);

    if (disponiveis.length > 0) {
        badge.innerText = disponiveis.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// =========================================================================
// 3. CARGOS FIXOS E ESCALA NA GIRA
// =========================================================================
function iconeFuncao(funcao) {
    const f = (funcao || '').toLowerCase();
    if (f.includes('pai') || f.includes('mãe') || f.includes('mae')) return 'fa-crown text-[#A9D8E8]';
    if (f.includes('porteira')) return 'fa-door-open text-[#A9D8E8]';
    if (f.includes('cambono')) return 'fa-hands-holding-circle text-[#A9D8E8]';
    if (f.includes('cozinha') || f.includes('café') || f.includes('cafe')) return 'fa-mug-hot text-[#A9D8E8]';
    if (f.includes('recepção') || f.includes('assistência')) return 'fa-people-arrows text-[#A9D8E8]';
    if (f.includes('defumação') || f.includes('ervas')) return 'fa-smog text-[#A9D8E8]';
    if (f.includes('curimba') || f.includes('ogã') || f.includes('oga') || f.includes('atabaque')) return 'fa-drum text-[#A9D8E8]';
    return 'fa-star text-[#A9D8E8]';
}

export async function carregarEscalaGiraFilho() {
    const container = document.getElementById('user-escala-gira');
    if (!container || !state.usuarioLogado) return;

    const [resGirasFuturas, resMinhasEscalas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', dataHoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').eq('filho_id', state.usuarioLogado.id).order('created_at', { ascending: false })
    ]);

    const girasFuturas = resGirasFuturas.data || [];
    const mapaGiras = {};
    girasFuturas.forEach(g => { mapaGiras[g.id] = g; });

    const meusPostos = (resMinhasEscalas.data || []).filter(p => p.gira_id === null || mapaGiras[p.gira_id]);

    if (meusPostos.length === 0) {
        container.innerHTML = `
            <div class="bg-[#F5F0E8]/70 p-4 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <p class="text-xs text-slate-500 font-medium">Nenhum cargo fixo ou escala específica atribuída para os próximos dias.</p>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="space-y-3">` + meusPostos.map(mp => {
        const isFixo = mp.gira_id === null;
        let etiquetaData = 'Fixo em Todas as Giras';
        let nomeGira = '';

        if (!isFixo && mapaGiras[mp.gira_id]) {
            const g = mapaGiras[mp.gira_id];
            const [ano, mes, dia] = g.data.split('-');
            etiquetaData = `Dia ${dia}/${mes}/${ano}`;
            nomeGira = `<p class="text-[11px] text-[#A9D8E8] font-semibold mt-0.5"><i class="fa-regular fa-calendar mr-1"></i>Gira: ${g.linha_trabalho}</p>`;
        }

        return `
        <div class="painel-hero-oya text-white p-4 rounded-2xl shadow-sm border border-[#8E2638]/30">
            <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#A9D8E8]">
                    ${isFixo ? '🌟 Cargo na Casa' : '📅 Escala da Gira'}
                </span>
                <span class="bg-white/15 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ${etiquetaData}
                </span>
            </div>
            <p class="text-base font-black mt-1 flex items-center gap-2">
                <i class="fa-solid ${iconeFuncao(mp.funcao)}"></i> ${mp.funcao}
            </p>
            ${nomeGira}
            ${mp.detalhe ? `
                <div class="mt-2.5 pt-2.5 border-t border-white/15 text-xs text-[#F5F0E8]/90 font-medium leading-relaxed">
                    <strong class="text-[10px] uppercase tracking-wider block text-[#A9D8E8] mb-0.5">Orientação:</strong>
                    ${mp.detalhe}
                </div>` : ''}
        </div>`;
    }).join('') + `</div>`;
}

// =========================================================================
// 4. ESCALA DE FAXINA E MANUTENÇÃO DO TEMPLO
// =========================================================================
export async function carregarEscalaDoFilho() {
    const container = document.getElementById('user-escala-faxina');
    if (!container || !state.usuarioLogado) return;
    const user = state.usuarioLogado;
    
    if (!user.grupo_faxina_id) {
        container.innerHTML = `
            <div class="bg-[#F5F0E8]/70 p-4 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <p class="text-xs text-slate-500 font-medium">Você ainda não foi alocado em nenhum grupo de manutenção.</p>
            </div>`;
        return;
    }

    const [resGrupo, resColegas] = await Promise.all([
        supabase.from('grupos_faxina').select('*').eq('id', user.grupo_faxina_id).maybeSingle(),
        supabase.from('filhos').select('id, nome').eq('grupo_faxina_id', user.grupo_faxina_id).order('nome')
    ]);

    if (!resGrupo.data) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center">Grupo não encontrado.</p>`;
        return;
    }

    const grupo = resGrupo.data;
    const colegas = resColegas.data || [];
    
    let dataFormatada = 'A definir';
    let alertaDia = '';

    if (grupo.proxima_data) {
        const [ano, mes, dia] = grupo.proxima_data.split('-');
        dataFormatada = `${dia}/${mes}/${ano}`;

        if (grupo.proxima_data === dataHoje) {
            alertaDia = `<div class="bg-[#8E2638] text-white text-xs font-extrabold p-3 rounded-xl mb-4 flex items-center justify-center uppercase tracking-wider shadow-sm animate-pulse"><i class="fa-solid fa-bell mr-2"></i> Hoje é o seu dia de manutenção!</div>`;
        } else if (grupo.proxima_data > dataHoje) {
            alertaDia = `<div class="bg-[#A9D8E8]/35 border border-[#A9D8E8] text-[#1e4e5f] text-xs font-extrabold p-2.5 rounded-xl mb-4 flex items-center justify-center gap-1.5"><i class="fa-regular fa-calendar-check"></i> Próxima escala agendada</div>`;
        }
    }

    const listaNomes = colegas.map(c => {
        const primeiroNome = c.nome.trim().split(' ')[0];
        const inicial = primeiroNome.charAt(0).toUpperCase();
        if (c.id === user.id) {
            return `<span class="inline-flex items-center gap-1.5 bg-[#8E2638] text-white text-xs font-bold pl-1.5 pr-3 py-1 rounded-full shadow-sm capitalize"><span class="w-5 h-5 rounded-full bg-black/25 flex items-center justify-center text-[10px]">${inicial}</span>${primeiroNome} (Você)</span>`;
        }
        return `<span class="inline-flex items-center gap-1.5 bg-[#F5F0E8] text-slate-700 text-xs font-semibold pl-1.5 pr-3 py-1 rounded-full border border-[#8E2638]/15 capitalize"><span class="w-5 h-5 rounded-full bg-white text-[#8E2638] flex items-center justify-center text-[10px] font-bold shadow-sm">${inicial}</span>${primeiroNome}</span>`;
    }).join('');

    container.innerHTML = `
        ${alertaDia}
        <div class="bg-[#F5F0E8]/80 rounded-2xl p-4 border border-[#8E2638]/15 mb-4">
            <div class="flex justify-between items-center pb-3 border-b border-[#8E2638]/10">
                <span class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Seu Grupo</span>
                <span class="text-xs font-extrabold text-[#8E2638] bg-white border border-[#8E2638]/20 px-3 py-0.5 rounded-full">${grupo.nome}</span>
            </div>
            <div class="pt-3 flex justify-between items-center">
                <span class="text-xs font-bold text-slate-600">Data da Escala</span>
                <span class="text-lg font-black text-slate-900 tracking-tight">${dataFormatada}</span>
            </div>
            ${grupo.observacao ? `
            <div class="mt-3 pt-2.5 border-t border-[#8E2638]/10 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <i class="fa-regular fa-clock text-[#8E2638]"></i> <span>Horário / Obs: <strong class="text-slate-900">${grupo.observacao}</strong></span>
            </div>` : ''}
        </div>
        <div>
            <p class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">Integrantes da Equipa (${colegas.length})</p>
            <div class="flex flex-wrap gap-1.5">${listaNomes}</div>
        </div>
    `;
}

// =========================================================================
// 5. MURAL DE COMUNICADOS OFICIAIS
// =========================================================================
async function carregarMuralAvisos() {
    const containerAvisos = document.getElementById('user-mural-avisos');
    if (!containerAvisos) return;

    const resAvisos = await supabase
        .from('avisos')
        .select('*')
        .gte('data_expiracao', dataHoje)
        .order('data_publicacao', { ascending: false });

    if (!resAvisos.data || resAvisos.data.length === 0) {
        containerAvisos.innerHTML = `
            <div class="flex items-center gap-3 bg-[#F5F0E8]/70 p-4 rounded-2xl border border-dashed border-[#8E2638]/20 text-slate-500">
                <i class="fa-regular fa-bell-slash text-base text-[#8E2638]/60 ml-1"></i>
                <p class="text-xs font-semibold">Nenhum comunicado oficial publicado no momento.</p>
            </div>`;
        return;
    }

    containerAvisos.innerHTML = resAvisos.data.map(aviso => {
        const isUrgente = aviso.tipo === 'urgente';
        const estiloCard = isUrgente 
            ? 'border-[#8E2638]/40 bg-[#8E2638]/5' 
            : 'border-[#8E2638]/15 bg-[#F5F0E8]/60';
        const badge = isUrgente
            ? '<span class="bg-[#8E2638] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">Urgente</span>'
            : '<span class="bg-[#A9D8E8]/50 text-[#1e4e5f] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">Comunicado</span>';

        return `
            <div class="border ${estiloCard} p-4 rounded-2xl shadow-sm transition-all">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <h4 class="font-extrabold text-sm text-slate-900">${aviso.titulo}</h4>
                    ${badge}
                </div>
                <p class="text-xs leading-relaxed text-slate-600 font-medium">${aviso.mensagem}</p>
            </div>`;
    }).join('');
}

// =========================================================================
// 6. CALENDÁRIO DE GIRAS + CHECK-IN DE PRESENÇA E JUSTIFICATIVA
// =========================================================================
export async function carregarGiras() {
    const containerUser = document.getElementById('container-giras');
    if (!containerUser) return;

    const [resGiras, resEscalas, resPresencas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', dataHoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').order('funcao', { ascending: true }),
        supabase.from('presencas_gira').select('*')
    ]);
    
    const data = resGiras.data || [];
    const escalas = resEscalas.data || [];
    const presencas = resPresencas.data || [];
    presencasCacheLocal = presencas;

    if (data.length === 0) { 
        containerUser.innerHTML = `
            <div class="text-center py-10 bg-[#F5F0E8]/60 rounded-2xl border border-dashed border-[#8E2638]/20">
                <i class="fa-regular fa-calendar-xmark text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-slate-500 text-sm font-medium">Nenhuma gira agendada para os próximos dias.</p>
            </div>`;
        return; 
    }
    
    let html = '<div class="space-y-4">';
    data.forEach((gira, index) => {
        const [ano, mes, dia] = gira.data.split('-');
        const isProx = index === 0;
        const horaAb = gira.horario_abertura ? gira.horario_abertura.substring(0, 5) : '19:00';
        const infoRoupa = gira.roupa || 'Branca';
        
        const postosDaGira = escalas.filter(e => 
            (e.gira_id === gira.id || e.gira_id === null) && 
            state.usuarioLogado && e.filho_id === state.usuarioLogado.id
        );

        const htmlPostos = postosDaGira.length === 0 ? '' : `
            <div class="pt-2.5 border-t border-[#8E2638]/10">
                <p class="text-[10px] font-extrabold text-[#8E2638] uppercase tracking-wider mb-1.5">
                    <i class="fa-solid fa-clipboard-user mr-1"></i>Sua Função nesta Gira:
                </p>
                <div class="flex flex-wrap gap-1.5">
                    ${postosDaGira.map(p => `
                        <span class="inline-flex items-center gap-1 bg-[#F5F0E8] text-slate-800 border border-[#8E2638]/20 text-[11px] font-bold px-2.5 py-0.5 rounded-lg capitalize">
                            <strong class="text-[#8E2638]">${p.funcao}</strong> 
                            ${p.detalhe ? `<span class="text-slate-500 font-normal">(${p.detalhe})</span>` : ''}
                        </span>
                    `).join('')}
                </div>
            </div>`;

        const presencasDestaGira = presencas.filter(pr => pr.gira_id === gira.id);
        const minhaResposta = presencasDestaGira.find(pr => state.usuarioLogado && pr.filho_id === state.usuarioLogado.id);
        const estouPresente = minhaResposta && minhaResposta.status === 'presente';
        const estouAusente = minhaResposta && minhaResposta.status === 'ausente';

        const htmlCheckin = `
            <div class="pt-3 mt-1 border-t border-[#8E2638]/10 space-y-2">
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-hand-point-right text-[#8E2638]"></i> Confirmação na Corrente:
                    </span>
                    <div class="flex items-center gap-2">
                        <button onclick="marcarPresencaGira('${gira.id}')" type="button" class="flex-1 sm:flex-initial ${estouPresente ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'} text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-check"></i> ${estouPresente ? 'Presença Confirmada' : 'Vou Comparecer'}
                        </button>
                        <button onclick="abrirModalJustificativa('${gira.id}', '${gira.linha_trabalho.replace(/'/g, "\\'")}', '${dia}/${mes}')" type="button" class="flex-1 sm:flex-initial ${estouAusente ? 'bg-[#8E2638] text-white shadow-sm ring-2 ring-[#8E2638]/30' : 'bg-[#8E2638]/10 hover:bg-[#8E2638]/20 text-[#8E2638] border border-[#8E2638]/25'} text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-comment-medical"></i> ${estouAusente ? 'Ausência Justificada' : 'Justificar Ausência'}
                        </button>
                    </div>
                </div>
                ${estouAusente && minhaResposta.justificativa ? `
                    <div class="bg-[#8E2638]/5 border border-[#8E2638]/20 rounded-xl px-3 py-2 text-[11px] text-[#8E2638] flex items-center justify-between gap-2">
                        <span><strong>Justificativa enviada:</strong> "${minhaResposta.justificativa}"</span>
                        <span class="text-[10px] font-extrabold uppercase shrink-0">Registado</span>
                    </div>
                ` : ''}
            </div>`;

        html += `
        <div class="pro-card pro-card-hover p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 ${isProx ? "ring-2 ring-[#8E2638]/25 bg-gradient-to-r from-[#F5F0E8]/60 to-white" : ""}">
            <div class="flex flex-col items-center justify-center ${isProx ? "bg-[#8E2638] text-white shadow-md" : "bg-[#F5F0E8] text-[#8E2638] border border-[#8E2638]/20"} rounded-2xl p-3.5 min-w-[76px] text-center shrink-0">
                <span class="text-[10px] font-extrabold uppercase tracking-widest ${isProx ? "text-[#A9D8E8]" : "text-slate-500"}">${mesesNomesCompletos[parseInt(mes)-1].substring(0,3)}</span>
                <span class="text-2xl font-black leading-none mt-1">${dia}</span>
            </div>

            <div class="flex-grow space-y-2.5 w-full">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h4 class="font-extrabold text-lg text-slate-900 tracking-tight">${gira.linha_trabalho}</h4>
                    ${isProx ? `<span class="bg-[#A9D8E8]/45 text-[#1e4e5f] border border-[#A9D8E8] text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#8E2638] animate-ping"></span> Próxima Gira</span>` : ''}
                </div>

                <div class="flex flex-wrap items-center gap-2 pt-0.5">
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-[#F5F0E8] text-slate-700 px-3 py-1 rounded-lg border border-[#8E2638]/15">
                        <i class="fa-regular fa-clock text-[#8E2638]"></i> ${horaAb}h
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-[#F5F0E8] text-slate-700 px-3 py-1 rounded-lg border border-[#8E2638]/15">
                        <i class="fa-solid fa-shirt text-[#8E2638]"></i> Roupa: ${infoRoupa}
                    </span>
                </div>

                ${gira.banho_ervas ? `
                <div class="bg-[#A9D8E8]/20 border border-[#A9D8E8]/60 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2.5">
                    <i class="fa-solid fa-leaf text-[#2b677a] mt-0.5"></i>
                    <p class="leading-relaxed"><strong class="text-slate-900 font-bold">Preceito &amp; Ervas:</strong> ${gira.banho_ervas}</p>
                </div>` : ''}

                ${htmlPostos}
                ${htmlCheckin}
            </div>
        </div>`;
    });
    html += '</div>';
    containerUser.innerHTML = html;
}

export async function marcarPresencaGira(giraId) {
    if (!state.usuarioLogado) return;
    const user = state.usuarioLogado;

    const { error } = await supabase.from('presencas_gira').upsert({
        gira_id: giraId,
        filho_id: user.id,
        filho_nome: user.nome,
        status: 'presente',
        justificativa: null,
        updated_at: new Date().toISOString()
    }, { onConflict: 'gira_id,filho_id' });

    if (!error) {
        mostrarToast("Presença Confirmada!", "A direção já registou que você irá comparecer à gira.");
        carregarGiras();
    } else {
        alert("Erro ao confirmar presença.");
    }
}

export function abrirModalJustificativa(giraId, linhaTrabalho, dataCurta) {
    document.getElementById('just-gira-id').value = giraId;
    document.getElementById('modal-just-titulo').innerText = `Ausência: ${linhaTrabalho} (${dataCurta})`;
    
    const existente = presencasCacheLocal.find(
        p => p.gira_id === giraId && state.usuarioLogado && p.filho_id === state.usuarioLogado.id
    );
    document.getElementById('just-motivo-texto').value = (existente && existente.justificativa) ? existente.justificativa : '';
    document.getElementById('modal-justificativa-gira').classList.remove('hidden');
}

export function fecharModalJustificativa() {
    document.getElementById('modal-justificativa-gira').classList.add('hidden');
}

export async function confirmarJustificativaAusencia(event) {
    event.preventDefault();
    if (!state.usuarioLogado) return;

    const giraId = document.getElementById('just-gira-id').value;
    const motivo = document.getElementById('just-motivo-texto').value.trim();
    const btn = document.getElementById('btn-enviar-justificativa');

    if (btn) btn.disabled = true;

    const { error } = await supabase.from('presencas_gira').upsert({
        gira_id: giraId,
        filho_id: state.usuarioLogado.id,
        filho_nome: state.usuarioLogado.nome,
        status: 'ausente',
        justificativa: motivo,
        updated_at: new Date().toISOString()
    }, { onConflict: 'gira_id,filho_id' });

    if (btn) btn.disabled = false;

    if (!error) {
        fecharModalJustificativa();
        mostrarToast("Justificativa Enviada!", "A direção espiritual recebeu o motivo da sua ausência.");
        carregarGiras();
    } else {
        alert("Erro ao enviar justificativa.");
    }
}

// =========================================================================
// 7. RADAR DE CELEBRAÇÕES (ANIVERSÁRIOS DE VIDA E DE CORRENTE)
// =========================================================================
export function gerarHtmlRadarAniversariantes(listaFilhos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();
    const anoAtual = hoje.getFullYear();

    const tituloMes = document.getElementById('mes-celebracao-titulo');
    if (tituloMes) tituloMes.innerText = mesesNomesCompletos[mesAtual - 1];

    const anivVida = (listaFilhos || [])
        .filter(f => f.data_nascimento && parseInt(f.data_nascimento.split('-')[1]) === mesAtual)
        .map(f => {
            const [ano, mes, dia] = f.data_nascimento.split('-').map(Number);
            return { nome: f.nome, dia, mes, isHoje: dia === diaAtual };
        })
        .sort((a, b) => a.dia - b.dia);

    const anivTerreiro = (listaFilhos || [])
        .filter(f => f.data_entrada && parseInt(f.data_entrada.split('-')[1]) === mesAtual)
        .map(f => {
            const [ano, mes, dia] = f.data_entrada.split('-').map(Number);
            const anos = anoAtual - ano;
            return { nome: f.nome, dia, mes, anos, isHoje: dia === diaAtual };
        })
        .filter(item => item.anos >= 1)
        .sort((a, b) => a.dia - b.dia);

    const htmlVida = anivVida.length === 0
        ? `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum aniversariante registado neste mês.</p>`
        : anivVida.map(a => `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${a.isHoje ? 'bg-[#8E2638]/10 border-[#8E2638]/40 shadow-sm' : 'bg-white border-slate-200/80'}">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${a.isHoje ? 'bg-[#8E2638] text-white' : 'bg-[#F5F0E8] text-[#8E2638]'} font-black text-xs flex items-center justify-center shrink-0">
                        ${a.dia.toString().padStart(2, '0')}
                    </span>
                    <span class="font-bold text-slate-800 text-xs capitalize">${a.nome}</span>
                </div>
                ${a.isHoje 
                    ? `<span class="bg-[#8E2638] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-bounce">🎉 É Hoje!</span>` 
                    : `<span class="text-[11px] font-bold text-slate-400">Dia ${a.dia.toString().padStart(2, '0')}/${a.mes.toString().padStart(2, '0')}</span>`}
            </div>
        `).join('');

    const htmlTerreiro = anivTerreiro.length === 0
        ? `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum aniversário de corrente neste mês.</p>`
        : anivTerreiro.map(t => `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${t.isHoje ? 'bg-[#A9D8E8]/35 border-[#2b677a]/40 shadow-sm' : 'bg-white border-slate-200/80'}">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${t.isHoje ? 'bg-[#2b677a] text-white' : 'bg-[#A9D8E8]/30 text-[#1e4e5f]'} font-black text-xs flex items-center justify-center shrink-0">
                        ${t.dia.toString().padStart(2, '0')}
                    </span>
                    <div>
                        <p class="font-bold text-slate-800 text-xs capitalize leading-tight">${t.nome}</p>
                        <p class="text-[10px] font-semibold text-[#2b677a]">${t.anos} ${t.anos === 1 ? 'ano de casa' : 'anos de casa'}</p>
                    </div>
                </div>
                ${t.isHoje 
                    ? `<span class="bg-[#2b677a] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">🕊️ Hoje!</span>` 
                    : `<span class="bg-[#A9D8E8]/40 text-[#1e4e5f] text-[10px] font-extrabold px-2 py-0.5 rounded-lg">${t.anos} ${t.anos === 1 ? 'Ano' : 'Anos'}</span>`}
            </div>
        `).join('');

    return `
        <div class="bg-[#F5F0E8]/60 p-4 rounded-2xl border border-[#8E2638]/15 space-y-2.5">
            <h4 class="text-xs font-extrabold text-[#8E2638] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-cake-candles"></i> Aniversários de Vida
            </h4>
            <div class="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">${htmlVida}</div>
        </div>
        <div class="bg-[#F5F0E8]/60 p-4 rounded-2xl border border-[#8E2638]/15 space-y-2.5">
            <h4 class="text-xs font-extrabold text-[#2b677a] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-dove"></i> Tempo de Corrente
            </h4>
            <div class="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">${htmlTerreiro}</div>
        </div>
    `;
}

// =========================================================================
// 8. FICHA FINANCEIRA PESSOAL, PIX E ENVIO DE COMPROVANTE
// =========================================================================
async function carregarFinanceiroPessoal() {
    if (!state.usuarioLogado) return;
    const user = state.usuarioLogado;

    const [resPagos, resExtras, resComps] = await Promise.all([
        supabase.from('mensalidades').select('*').eq('filho_id', user.id),
        supabase.from('debitos_extras').select('*').eq('filho_id', user.id),
        supabase.from('comprovantes').select('id, observacao, created_at').eq('filho_id', user.id).order('created_at', { ascending: false })
    ]);

    const pagamentos = (resPagos.data || []).map(p => p.mes_ano);
    const extras = resExtras.data || [];
    const meusComprovantes = resComps.data || [];

    const divMeusComps = document.getElementById('user-comprovantes-enviados');
    if (divMeusComps) {
        divMeusComps.innerHTML = meusComprovantes.length === 0 ? '' : meusComprovantes.map(c => `
            <div class="flex items-center justify-between bg-black/25 border border-white/15 px-3 py-2 rounded-xl text-[11px]">
                <span class="text-white font-semibold truncate pr-2"><i class="fa-regular fa-clock text-[#A9D8E8] mr-1.5"></i>${c.observacao}</span>
                <span class="text-[#A9D8E8] font-extrabold uppercase text-[9px] shrink-0">Em Análise</span>
            </div>
        `).join('');
    }

    const dataInicio = new Date(user.data_entrada || user.data_cadastro || dataHoje);
    const dataAtual = new Date();
    let cursorData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
    let hojeData = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
    
    let dataLimite = new Date(hojeData);
    pagamentos.forEach(mesStr => {
        const [anoP, mesP] = mesStr.split('-').map(Number);
        const dataP = new Date(anoP, mesP - 1, 1);
        if (dataP > dataLimite) dataLimite = dataP;
    });

    let mesesList = [];
    while(cursorData <= dataLimite) {
        const isFuturo = cursorData > hojeData;
        mesesList.unshift({ ano: cursorData.getFullYear(), mes: cursorData.getMonth() + 1, isFuturo });
        cursorData.setMonth(cursorData.getMonth() + 1);
    }

    let htmlMeses = '';
    let valorDevidoMeses = 0;
    
    mesesList.forEach(m => {
        let mesStr = `${m.ano}-${m.mes.toString().padStart(2, '0')}`;
        let isPago = pagamentos.includes(mesStr);
        if(!isPago && !m.isFuturo) {
            valorDevidoMeses += 100;
            htmlMeses += `
                <div class="flex justify-between items-center p-3 border border-[#8E2638]/25 bg-[#8E2638]/5 rounded-xl text-xs">
                    <span class="font-bold text-slate-800">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                    <span class="bg-[#8E2638] text-white font-extrabold px-2.5 py-1 rounded-lg">R$ 100,00</span>
                </div>`;
        } else if (isPago) {
            const labelPago = m.isFuturo ? 'Adiantado' : 'Pago';
            const corBadge = m.isFuturo ? 'text-[#1e4e5f] bg-[#A9D8E8]/50' : 'text-emerald-800 bg-emerald-100/80';
            htmlMeses += `
                <div class="flex justify-between items-center p-3 border border-slate-200/80 bg-[#F5F0E8]/50 rounded-xl text-xs">
                    <span class="font-bold text-slate-700">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                    <span class="inline-flex items-center gap-1 ${corBadge} px-2.5 py-1 rounded-lg font-extrabold text-[10px] uppercase">
                        <i class="fa-solid fa-circle-check"></i> ${labelPago}
                    </span>
                </div>`;
        }
    });

    const elListaMensalidades = document.getElementById('user-lista-mensalidades');
    if (elListaMensalidades) {
        elListaMensalidades.innerHTML = htmlMeses || `
            <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold text-center">
                <i class="fa-solid fa-check mr-1"></i> Sem mensalidades pendentes!
            </div>`;
    }

    let valorDevidoExtras = 0;
    const htmlExt = extras.map(e => {
        valorDevidoExtras += e.valor;
        return `
            <div class="flex justify-between items-center p-3 border border-[#8E2638]/20 bg-[#F5F0E8] rounded-xl text-xs">
                <span class="font-bold text-slate-800 truncate pr-2">${e.descricao}</span>
                <span class="bg-[#8E2638]/15 text-[#8E2638] font-extrabold px-2.5 py-1 rounded-lg whitespace-nowrap">R$ ${e.valor.toFixed(2).replace('.', ',')}</span>
            </div>`;
    }).join('');

    const elListaExtras = document.getElementById('user-lista-extras');
    if (elListaExtras) {
        elListaExtras.innerHTML = htmlExt || `
            <div class="p-3 bg-[#F5F0E8]/60 border border-dashed border-[#8E2638]/20 rounded-xl text-slate-500 text-xs font-medium text-center">
                Nenhum consumo extra registado.
            </div>`;
    }

    const total = valorDevidoMeses + valorDevidoExtras;
    state.totalDividaUsuarioLogado = total;

    const elTotal = document.getElementById('user-total-divida');
    const boxSaldo = document.getElementById('box-saldo-user');
    
    if (elTotal) {
        elTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
        elTotal.className = `text-3xl font-black tracking-tight ${total === 0 ? 'text-emerald-700' : 'text-[#8E2638]'}`;
    }
    
    if (boxSaldo) {
        boxSaldo.className = total === 0 
            ? 'bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 mb-5 text-center transition-colors'
            : 'bg-[#8E2638]/5 rounded-2xl p-5 border border-[#8E2638]/25 mb-5 text-center transition-colors';
    }
}

export function copiarChavePix() {
    navigator.clipboard.writeText(FINANCEIRO_CONFIG.chavePix).then(() => {
        mostrarToast("Chave PIX Copiada!", `Chave copiada: ${FINANCEIRO_CONFIG.chavePix}`);
    });
}

export async function enviarComprovanteSupabase(event) {
    event.preventDefault();
    const inputFile = document.getElementById('input-arquivo-comprovante');
    const inputObs = document.getElementById('input-obs-comprovante');
    const btn = document.getElementById('btn-enviar-comprovante');

    if (!inputFile.files || inputFile.files.length === 0) return;
    const file = inputFile.files[0];

    if (file.size > 6 * 1024 * 1024) {
        alert("O ficheiro é muito grande! Escolha uma imagem ou PDF de até 6MB.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="loader w-3.5 h-3.5 border-2 mr-2"></div> A guardar...`;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        const user = state.usuarioLogado;
        const valorFormatado = `R$ ${(state.totalDividaUsuarioLogado || 0).toFixed(2).replace('.', ',')}`;

        const { error } = await supabase.from('comprovantes').insert([{
            filho_id: user.id,
            filho_nome: user.nome,
            valor_pendente: valorFormatado,
            observacao: inputObs.value.trim(),
            arquivo_base64: base64Data,
            arquivo_tipo: file.type
        }]);

        btn.disabled = false;

        if (error) {
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Enviar Comprovante pelo Portal</span>`;
            alert("Erro ao guardar comprovante.");
        } else {
            btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Comprovante Recebido!</span>`;
            document.getElementById('form-comprovante-supabase').reset();
            mostrarToast("Comprovante Enviado!", "A tesouraria já recebeu o seu comprovante para dar baixa.");
            carregarFinanceiroPessoal();
            setTimeout(() => {
                btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Enviar Comprovante pelo Portal</span>`;
            }, 3500);
        }
    };
    reader.readAsDataURL(file);
}

export function enviarComprovanteWhatsApp() {
    const user = state.usuarioLogado;
    const valorFormatado = (state.totalDividaUsuarioLogado || 0).toFixed(2).replace('.', ',');
    const msg = `Olá! Sou o(a) *${user.nome}*, enviei no portal o comprovante referente à minha ficha financeira (Saldo: *R$ ${valorFormatado}*).`;
    const url = `https://wa.me/${FINANCEIRO_CONFIG.whatsappNumero}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// =========================================================================
// 9. NOTIFICAÇÕES NATIVAS, REALTIME E PWA
// =========================================================================
const btnNotif = document.getElementById('btn-notificacoes');

function verificarBotaoNotificacao() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        if (btnNotif) btnNotif.classList.remove('hidden');
    } else {
        if (btnNotif) btnNotif.classList.add('hidden');
    }
}

window.pedirPermissaoNotificacao = async function() {
    if (!('Notification' in window)) {
        alert("O seu navegador não suporta notificações.");
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        if (btnNotif) btnNotif.classList.add('hidden');
        mostrarToast("Alertas Ativados!", "Você será avisado sempre que houver novidades no portal.");
    }
};

supabase.channel('painel-filho-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => carregarMuralAvisos())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'giras' }, () => carregarGiras())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_gira' }, () => {
        carregarEscalaGiraFilho();
        carregarGiras();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_cadastrais' }, () => verificarFichaLiberadaFilho())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    copiarChavePix,
    enviarComprovanteSupabase,
    enviarComprovanteWhatsApp,
    marcarPresencaGira,
    abrirModalJustificativa,
    fecharModalJustificativa,
    confirmarJustificativaAusencia
});

if (usuarioAtivo) {
    verificarBotaoNotificacao();
    carregarPainelDoFilho();
}