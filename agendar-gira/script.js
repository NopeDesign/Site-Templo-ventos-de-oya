import { 
    supabase, mesesNomesCompletos, dataHoje, state, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

let girasCacheLocal = [];

// Garante que apenas administradores acedam a esta pasta
const adminAtivo = exigirSessao(true);

// Preenche as datas padrão nos formulários ao abrir a página
const inputGiraData = document.getElementById('gira-data');
if (inputGiraData) inputGiraData.value = dataHoje;

const inputAvisoValidade = document.getElementById('aviso-validade');
if (inputAvisoValidade) inputAvisoValidade.value = dataHoje;

// =========================================================================
// 1. PREENCHIMENTO AUTOMÁTICO DE ROUPA E PRECEITO POR LINHA DE TRABALHO
// =========================================================================
export function atualizarResumoGira() {
    const linha = document.getElementById('gira-template').value;
    const inputRoupa = document.getElementById('gira-roupa');
    const inputBanho = document.getElementById('gira-banho');
    const preceitoPadrao = "Proibido carne vermelha, bebida alcoólica e relação sexual 24h antes.";
    
    inputBanho.value = "";
    inputRoupa.value = "Branca";

    if (linha === "Exu e Pombagira") {
        inputRoupa.value = "Preta e Vermelha";
        inputBanho.value = preceitoPadrao;
    } else if (linha === "Malandros") {
        inputRoupa.value = "Branca e Vermelha";
        inputBanho.value = `Alecrim, Levante e Peregum Roxo | ${preceitoPadrao}`;
    } else if (linha === "Exu Mirim") {
        inputRoupa.value = "Branca (Outra cor apenas se a mãe liberar)";
        inputBanho.value = `Palha de alho, Hortelã e Alecrim | ${preceitoPadrao}`;
    } else {
        inputBanho.value = preceitoPadrao;
    }
}

// =========================================================================
// 2. AGENDAR NOVA GIRA E LISTAR GIRAS COM CHECK-IN DA CORRENTE
// =========================================================================
export async function salvarGira(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-gira');
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('giras').insert([{
        data: document.getElementById('gira-data').value, 
        linha_trabalho: document.getElementById('gira-template').value.trim(), 
        horario_abertura: document.getElementById('gira-abertura').value, 
        horario_fechamento: document.getElementById('gira-fechamento').value, 
        roupa: document.getElementById('gira-roupa').value.trim() || 'Branca', 
        banho_ervas: document.getElementById('gira-banho').value.trim() 
    }]);

    if (btn) btn.disabled = false;

    if (!error) { 
        mostrarToast('Gira Agendada!', 'O calendário oficial da corrente foi atualizado.');
        document.getElementById('form-gira').querySelector('form').reset();
        if (inputGiraData) inputGiraData.value = dataHoje;
        document.getElementById('gira-abertura').value = '19:00';
        document.getElementById('gira-fechamento').value = '22:00';
        document.getElementById('gira-roupa').value = 'Branca';
        carregarGirasAdmin(); 
    } else {
        alert("Erro ao publicar o agendamento da gira.");
    }
}

export async function carregarGirasAdmin() {
    const containerAdmin = document.getElementById('container-giras-admin');
    if (!containerAdmin) return;

    const [resGiras, resEscalas, resPresencas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', dataHoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').order('funcao', { ascending: true }),
        supabase.from('presencas_gira').select('*')
    ]);
    
    const data = resGiras.data || [];
    const escalas = resEscalas.data || [];
    const presencas = resPresencas.data || [];

    girasCacheLocal = data;

    if (data.length === 0) { 
        containerAdmin.innerHTML = `
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
        
        const postosDaGira = escalas.filter(e => e.gira_id === gira.id || e.gira_id === null);

        const htmlPostos = postosDaGira.length === 0 ? '' : `
            <div class="pt-2.5 border-t border-[#8E2638]/10">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    <i class="fa-solid fa-clipboard-user mr-1 text-[#8E2638]"></i>Cargos &amp; Postos Escalados (${postosDaGira.length}):
                </p>
                <div class="flex flex-wrap gap-1.5">
                    ${postosDaGira.map(p => `
                        <span class="inline-flex items-center gap-1 ${p.gira_id === null ? 'bg-[#F5F0E8] text-[#8E2638] border-[#8E2638]/25' : 'bg-[#A9D8E8]/30 text-[#1e4e5f] border-[#A9D8E8]'} border text-[11px] font-bold px-2.5 py-0.5 rounded-lg capitalize">
                            <strong>${p.funcao}:</strong> ${p.filho_nome.split(' ')[0]} 
                            ${p.detalhe ? `<span class="text-slate-500 font-normal">(${p.detalhe})</span>` : ''}
                        </span>
                    `).join('')}
                </div>
            </div>`;

        const presencasDestaGira = presencas.filter(pr => pr.gira_id === gira.id);
        const qtdPresentes = presencasDestaGira.filter(pr => pr.status === 'presente').length;
        const qtdAusentes = presencasDestaGira.filter(pr => pr.status === 'ausente').length;

        const htmlCheckin = `
            <div class="pt-3 mt-1 border-t border-[#8E2638]/10 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold px-3 py-1 rounded-xl">
                        <i class="fa-solid fa-circle-check text-emerald-600"></i> ${qtdPresentes} Confirmados
                    </span>
                    <span class="inline-flex items-center gap-1.5 bg-[#8E2638]/10 text-[#8E2638] border border-[#8E2638]/25 text-xs font-extrabold px-3 py-1 rounded-xl">
                        <i class="fa-solid fa-circle-xmark"></i> ${qtdAusentes} Ausentes
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="abrirModalPresencasAdmin('${gira.id}')" type="button" class="bg-[#8E2638] hover:bg-[#681927] text-white text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-users-viewfinder"></i> Ver Lista de Presença
                    </button>
                    <button onclick="apagarGiraAdmin('${gira.id}')" type="button" title="Cancelar/Apagar Gira" class="bg-[#F5F0E8] hover:bg-red-100 text-slate-500 hover:text-red-700 border border-[#8E2638]/15 text-xs font-bold px-3 py-2 rounded-xl transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
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
    containerAdmin.innerHTML = html;
}

export async function apagarGiraAdmin(id) {
    if (confirm("Deseja realmente apagar esta gira do calendário?")) {
        const { error } = await supabase.from('giras').delete().eq('id', id);
        if (!error) {
            mostrarToast("Gira Removida", "O agendamento foi apagado do calendário.");
            carregarGirasAdmin();
        }
    }
}

// =========================================================================
// 3. MODAL DE LISTA DE PRESENÇA E JUSTIFICATIVAS DA GIRA
// =========================================================================
export async function abrirModalPresencasAdmin(giraId) {
    const gira = girasCacheLocal.find(g => g.id === giraId);
    const tituloEl = document.getElementById('modal-pres-admin-titulo');
    if (gira && tituloEl) {
        const dataBr = gira.data.split('-').reverse().join('/');
        tituloEl.innerText = `${gira.linha_trabalho} (${dataBr})`;
    }

    const [resFilhos, resPres] = await Promise.all([
        supabase.from('filhos').select('id, nome').order('nome'),
        supabase.from('presencas_gira').select('*').eq('gira_id', giraId).order('filho_nome')
    ]);

    const todosFilhos = resFilhos.data || [];
    const respostas = resPres.data || [];

    const confirmados = respostas.filter(r => r.status === 'presente');
    const ausentes = respostas.filter(r => r.status === 'ausente');
    const idsQueResponderam = respostas.map(r => r.filho_id);
    const pendentes = todosFilhos.filter(f => !idsQueResponderam.includes(f.id));

    document.getElementById('cont-admin-presentes').innerText = confirmados.length;
    document.getElementById('cont-admin-ausentes').innerText = ausentes.length;
    document.getElementById('cont-admin-pendentes').innerText = pendentes.length;

    const divConfirmados = document.getElementById('lista-admin-confirmados');
    divConfirmados.innerHTML = confirmados.length === 0
        ? `<p class="text-xs text-slate-400 italic py-2">Nenhum médium confirmou presença ainda.</p>`
        : confirmados.map(c => `
            <div class="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
                <span class="font-bold text-slate-800 capitalize"><i class="fa-solid fa-check text-emerald-700 mr-2"></i>${c.filho_nome}</span>
                <span class="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">Confirmado</span>
            </div>
        `).join('');

    const divAusentes = document.getElementById('lista-admin-ausentes');
    divAusentes.innerHTML = ausentes.length === 0
        ? `<p class="text-xs text-slate-400 italic py-2">Nenhuma ausência registada.</p>`
        : ausentes.map(a => `
            <div class="p-3 bg-[#8E2638]/5 border border-[#8E2638]/25 rounded-xl text-xs space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="font-extrabold text-slate-900 capitalize"><i class="fa-solid fa-user-xmark text-[#8E2638] mr-1.5"></i>${a.filho_nome}</span>
                    <span class="text-[10px] font-extrabold uppercase text-[#8E2638] bg-[#8E2638]/10 px-2 py-0.5 rounded-md">Ausente</span>
                </div>
                <p class="text-slate-700 font-medium bg-white p-2.5 rounded-lg border border-[#8E2638]/15">
                    <strong class="text-[#8E2638]">Motivo:</strong> ${a.justificativa || 'Sem motivo detalhado.'}
                </p>
            </div>
        `).join('');

    const divPendentes = document.getElementById('lista-admin-pendentes');
    divPendentes.innerHTML = pendentes.length === 0
        ? `<p class="text-xs text-emerald-700 font-bold">Todos os filhos da corrente já responderam!</p>`
        : pendentes.map(p => `
            <span class="inline-flex items-center gap-1 bg-[#F5F0E8] text-slate-700 border border-[#8E2638]/15 text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize">
                ${p.nome}
            </span>
        `).join('');

    document.getElementById('modal-presencas-admin').classList.remove('hidden');
}

export function fecharModalPresencasAdmin() {
    document.getElementById('modal-presencas-admin').classList.add('hidden');
}

// =========================================================================
// 4. PUBLICAR E GERIR COMUNICADOS OFICIAIS DO MURAL
// =========================================================================
export async function salvarAviso(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-aviso');
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('avisos').insert([{
        data_publicacao: dataHoje, 
        data_expiracao: document.getElementById('aviso-validade').value, 
        tipo: document.getElementById('aviso-tipo').value, 
        titulo: document.getElementById('aviso-titulo').value.trim(), 
        mensagem: document.getElementById('aviso-mensagem').value.trim()
    }]);

    if (btn) btn.disabled = false;

    if (!error) { 
        mostrarToast('Comunicado Publicado!', 'O aviso já está disponível no mural dos filhos.');
        document.getElementById('form-aviso').querySelector('form').reset();
        if (inputAvisoValidade) inputAvisoValidade.value = dataHoje;
        carregarAvisosAdmin();
    } else {
        alert("Erro ao publicar comunicado.");
    }
}

export async function carregarAvisosAdmin() {
    const container = document.getElementById('admin-lista-avisos');
    if (!container) return;

    const { data } = await supabase
        .from('avisos')
        .select('*')
        .gte('data_expiracao', dataHoje)
        .order('data_publicacao', { ascending: false });

    const avisos = data || [];
    if (avisos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-2 text-center">Nenhum comunicado ativo no mural.</p>`;
        return;
    }

    container.innerHTML = avisos.map(a => {
        const expBr = a.data_expiracao.split('-').reverse().join('/');
        return `
            <div class="flex items-center justify-between p-3 bg-[#F5F0E8]/70 border border-[#8E2638]/15 rounded-xl text-xs gap-2">
                <div class="min-w-0">
                    <p class="font-extrabold text-slate-900 truncate">${a.titulo}</p>
                    <p class="text-[10px] font-semibold text-slate-500">Visível até ${expBr}</p>
                </div>
                <button onclick="apagarAvisoAdmin('${a.id}')" type="button" title="Remover aviso" class="text-slate-400 hover:text-[#8E2638] px-2 py-1 rounded-lg hover:bg-[#8E2638]/10 transition shrink-0">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

export async function apagarAvisoAdmin(id) {
    if (confirm("Deseja remover este comunicado do mural?")) {
        const { error } = await supabase.from('avisos').delete().eq('id', id);
        if (!error) {
            mostrarToast("Aviso Removido", "O comunicado foi retirado do mural.");
            carregarAvisosAdmin();
        }
    }
}

// =========================================================================
// 5. BADGES DE NOTIFICAÇÃO DO MENU SUPERIOR E TEMPO REAL
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

supabase.channel('admin-giras-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'presencas_gira' }, (payload) => {
        const pres = payload.new;
        if (pres) {
            if (pres.status === 'ausente') {
                mostrarToast(`⚠️ Ausência Justificada`, `${pres.filho_nome}: "${pres.justificativa || 'Sem motivo'}"`);
            } else {
                mostrarToast(`✅ Presença Confirmada`, `${pres.filho_nome} confirmou presença na gira.`);
            }
        }
        carregarGirasAdmin();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_oracao' }, () => atualizarBadgesMenuAdmin())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'doacoes_registros' }, () => atualizarBadgesMenuAdmin())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comprovantes' }, () => atualizarBadgesMenuAdmin())
    .subscribe();

// Expor funções para os eventos do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    atualizarResumoGira,
    salvarGira,
    apagarGiraAdmin,
    abrirModalPresencasAdmin,
    fecharModalPresencasAdmin,
    salvarAviso,
    apagarAvisoAdmin
});

if (adminAtivo) {
    carregarGirasAdmin();
    carregarAvisosAdmin();
    atualizarBadgesMenuAdmin();
}