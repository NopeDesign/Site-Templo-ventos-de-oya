import { supabase, mesesNomesCompletos, state } from './config.js';

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

export async function salvarGira(event) {
    event.preventDefault();
    const { error } = await supabase.from('giras').insert([{
        data: document.getElementById('gira-data').value, 
        linha_trabalho: document.getElementById('gira-template').value, 
        horario_abertura: document.getElementById('gira-abertura').value, 
        horario_fechamento: document.getElementById('gira-fechamento').value, 
        roupa: document.getElementById('gira-roupa').value, 
        banho_ervas: document.getElementById('gira-banho').value 
    }]);
    if(!error) { 
        if (window.mostrarToast) window.mostrarToast('Gira Agendada!', 'O calendário foi atualizado.');
        document.getElementById('form-gira').querySelector('form').reset(); 
        carregarGiras(); 
    } 
}

export async function carregarGiras() {
    const hoje = new Date().toISOString().split('T')[0];
    const [resGiras, resEscalas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', hoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').order('funcao', { ascending: true })
    ]);
    
    const data = resGiras.data || [];
    const escalas = resEscalas.data || [];

    const containerUser = document.getElementById('container-giras');
    const containerAdmin = document.getElementById('container-giras-admin');

    if (data.length === 0) { 
        const msg = `
            <div class="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <i class="fa-regular fa-calendar-xmark text-2xl text-slate-300 mb-2"></i>
                <p class="text-slate-400 text-sm font-medium">Nenhuma gira agendada para os próximos dias.</p>
            </div>`;
        if(containerUser) containerUser.innerHTML = msg;
        if(containerAdmin) containerAdmin.innerHTML = msg;
        return; 
    }
    
    const montarCardsGiras = (visaoAdmin) => {
        let html = '<div class="space-y-4">';
        data.forEach((gira, index) => {
            const [ano, mes, dia] = gira.data.split('-');
            const isProx = index === 0;
            const horaAb = gira.horario_abertura ? gira.horario_abertura.substring(0, 5) : '19:00';
            const infoRoupa = gira.roupa || 'Branca';
            
            // No Admin mostra todos; no Filho mostra APENAS se o próprio filho tiver cargo nesta gira
            const postosDaGira = escalas.filter(e => {
                const pertenceAGira = (e.gira_id === gira.id || e.gira_id === null);
                if (visaoAdmin) return pertenceAGira;
                return pertenceAGira && state.usuarioLogado && e.filho_id === state.usuarioLogado.id;
            });

            const htmlPostos = postosDaGira.length === 0 ? '' : `
                <div class="pt-2 border-t border-slate-100">
                    <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                        <i class="fa-solid fa-clipboard-user mr-1 text-indigo-500"></i>${visaoAdmin ? `Cargos & Postos (${postosDaGira.length}):` : 'Sua Função nesta Gira:'}
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        ${postosDaGira.map(p => `
                            <span class="inline-flex items-center gap-1 ${p.gira_id === null ? 'bg-amber-50/90 text-amber-900 border-amber-200' : 'bg-indigo-50/80 text-indigo-900 border-indigo-200/70'} border text-[11px] font-bold px-2.5 py-0.5 rounded-lg capitalize">
                                <strong class="${p.gira_id === null ? 'text-amber-700' : 'text-indigo-600'}">${p.funcao}${visaoAdmin ? ':' : ''}</strong> 
                                ${visaoAdmin ? p.filho_nome.split(' ')[0] : ''} 
                                ${p.detalhe ? `<span class="text-slate-500 font-normal">(${p.detalhe})</span>` : ''}
                            </span>
                        `).join('')}
                    </div>
                </div>`;

            html += `
            <div class="pro-card pro-card-hover p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 ${isProx ? "ring-2 ring-blue-500/20 bg-gradient-to-r from-blue-50/40 to-white border-blue-200" : ""}">
                <div class="flex flex-col items-center justify-center ${isProx ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-800"} rounded-2xl p-3.5 min-w-[76px] text-center shrink-0">
                    <span class="text-[10px] font-extrabold uppercase tracking-widest ${isProx ? "text-blue-200" : "text-slate-400"}">${mesesNomesCompletos[parseInt(mes)-1].substring(0,3)}</span>
                    <span class="text-2xl font-black leading-none mt-1">${dia}</span>
                </div>

                <div class="flex-grow space-y-2.5 w-full">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <h3 class="font-extrabold text-lg text-slate-900 tracking-tight">${gira.linha_trabalho}</h3>
                        ${isProx ? `<span class="bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span> Próxima Gira</span>` : ''}
                    </div>

                    <div class="flex flex-wrap items-center gap-2 pt-0.5">
                        <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200/60">
                            <i class="fa-regular fa-clock text-slate-400"></i> ${horaAb}h
                        </span>
                        <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200/60">
                            <i class="fa-solid fa-shirt text-slate-400"></i> Roupa: ${infoRoupa}
                        </span>
                    </div>

                    ${gira.banho_ervas ? `
                    <div class="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
                        <i class="fa-solid fa-leaf text-emerald-600 mt-0.5"></i>
                        <p class="leading-relaxed"><strong class="text-slate-800 font-bold">Preceito & Ervas:</strong> ${gira.banho_ervas}</p>
                    </div>` : ''}

                    ${htmlPostos}
                </div>
            </div>`;
        });
        html += '</div>';
        return html;
    };

    if(containerUser) containerUser.innerHTML = montarCardsGiras(false);
    if(containerAdmin) containerAdmin.innerHTML = montarCardsGiras(true);
}

export async function salvarAviso(event) {
    event.preventDefault();
    const { error } = await supabase.from('avisos').insert([{
        data_publicacao: new Date().toISOString().split('T')[0], 
        data_expiracao: document.getElementById('aviso-validade').value, 
        tipo: document.getElementById('aviso-tipo').value, 
        titulo: document.getElementById('aviso-titulo').value, 
        mensagem: document.getElementById('aviso-mensagem').value
    }]);
    if(!error) { 
        if (window.mostrarToast) window.mostrarToast('Aviso Publicado!', 'O comunicado já está no mural.');
        document.getElementById('form-aviso').querySelector('form').reset(); 
    }
}

// --- SISTEMA DE CARGOS FIXOS E ESCALA DE FUNÇÕES DA GIRA ---
function iconeFuncao(funcao) {
    const f = funcao.toLowerCase();
    if (f.includes('pai') || f.includes('mãe') || f.includes('mae')) return 'fa-crown text-amber-500';
    if (f.includes('porteira')) return 'fa-door-open text-amber-600';
    if (f.includes('cambono')) return 'fa-hands-holding-circle text-purple-600';
    if (f.includes('cozinha') || f.includes('café') || f.includes('cafe')) return 'fa-mug-hot text-orange-600';
    if (f.includes('recepção') || f.includes('assistência')) return 'fa-people-arrows text-blue-600';
    if (f.includes('defumação') || f.includes('ervas')) return 'fa-smog text-emerald-600';
    if (f.includes('curimba') || f.includes('ogã') || f.includes('oga') || f.includes('atabaque')) return 'fa-drum text-red-600';
    return 'fa-star text-indigo-600';
}

// VISÃO DO FILHO: MOSTRA APENAS OS CARGOS DELE E ESCONDE O CARD SE ELE NÃO TIVER CARGO
export async function carregarEscalaGiraFilho() {
    const container = document.getElementById('user-escala-gira');
    if (!container) return;
    const cardWrapper = container.closest('.pro-card');

    const hoje = new Date().toISOString().split('T')[0];
    const [resGirasFuturas, resMinhasEscalas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', hoje).order('data', { ascending: true }),
        supabase.from('escala_gira').select('*').eq('filho_id', state.usuarioLogado.id).order('created_at', { ascending: false })
    ]);

    const girasFuturas = resGirasFuturas.data || [];
    const mapaGiras = {};
    girasFuturas.forEach(g => { mapaGiras[g.id] = g; });

    // Filtra apenas os cargos fixos (gira_id === null) ou escalas de giras que ainda vão acontecer
    const meusPostos = (resMinhasEscalas.data || []).filter(p => p.gira_id === null || mapaGiras[p.gira_id]);

    // Se o filho não tiver nenhum cargo nem função escalada, esconde o card para ele
    if (meusPostos.length === 0) {
        if (cardWrapper) cardWrapper.classList.add('hidden');
        return;
    }

    // Se ele tiver cargo, exibe o card apenas com as informações dele
    if (cardWrapper) cardWrapper.classList.remove('hidden');

    container.innerHTML = `<div class="space-y-3">` + meusPostos.map(mp => {
        const isFixo = mp.gira_id === null;
        let etiquetaData = 'Fixo em Todas as Giras';
        let nomeGira = '';

        if (!isFixo && mapaGiras[mp.gira_id]) {
            const g = mapaGiras[mp.gira_id];
            const [ano, mes, dia] = g.data.split('-');
            etiquetaData = `Dia ${dia}/${mes}/${ano}`;
            nomeGira = `<p class="text-[11px] text-indigo-200 font-semibold mt-0.5"><i class="fa-regular fa-calendar mr-1"></i>Gira: ${g.linha_trabalho}</p>`;
        }

        return `
        <div class="${isFixo ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30' : 'bg-indigo-600 border-indigo-500'} border text-white p-4 rounded-2xl shadow-sm">
            <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] font-extrabold uppercase tracking-widest ${isFixo ? 'text-amber-400' : 'text-indigo-200'}">
                    ${isFixo ? '🌟 Seu Cargo na Casa' : '📅 Sua Escala na Gira'}
                </span>
                <span class="bg-white/15 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ${etiquetaData}
                </span>
            </div>
            <p class="text-base font-black mt-1 flex items-center gap-2">
                <i class="fa-solid ${iconeFuncao(mp.funcao)} ${isFixo ? 'text-amber-400' : 'text-amber-300'}"></i> ${mp.funcao}
            </p>
            ${nomeGira}
            ${mp.detalhe ? `
                <div class="mt-2.5 pt-2.5 border-t border-white/10 text-xs text-slate-100 font-medium leading-relaxed">
                    <strong class="text-[10px] uppercase tracking-wider block text-white/60 mb-0.5">O que você vai fazer:</strong>
                    ${mp.detalhe}
                </div>` : ''}
        </div>`;
    }).join('') + `</div>`;
}

export async function carregarEscalaGiraAdmin() {
    const container = document.getElementById('lista-escalas-gira-admin');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10 text-slate-400"><div class="loader"></div></div>';

    const hoje = new Date().toISOString().split('T')[0];
    const [resGiras, resFilhos, resEscalas] = await Promise.all([
        supabase.from('giras').select('*').gte('data', hoje).order('data', { ascending: true }),
        supabase.from('filhos').select('*').order('nome'),
        supabase.from('escala_gira').select('*').order('funcao', { ascending: true })
    ]);

    const giras = resGiras.data || [];
    const filhos = resFilhos.data || [];
    const escalas = resEscalas.data || [];

    const selectGira = document.getElementById('escala-gira-id');
    if (selectGira) {
        let optionsHtml = `<option value="TODAS">🌟 Todas as Giras (Cargo / Função Fixa)</option>`;
        optionsHtml += giras.map(g => {
            const dataBr = g.data.split('-').reverse().join('/');
            return `<option value="${g.id}">📅 Somente na gira ${dataBr} - ${g.linha_trabalho}</option>`;
        }).join('');
        selectGira.innerHTML = optionsHtml;
    }

    const selectFilho = document.getElementById('escala-filho-id');
    if (selectFilho) {
        selectFilho.innerHTML = filhos.map(f => `<option value="${f.id}" data-nome="${f.nome}">${f.nome}</option>`).join('');
    }

    // Card de CARGOS FIXOS (Todas as Giras) no Admin
    const cargosFixos = escalas.filter(e => e.gira_id === null);
    let html = `
        <div class="pro-card p-6 border-2 border-amber-200/80 bg-amber-50/20 space-y-4">
            <div class="flex items-center justify-between border-b border-amber-200/60 pb-3">
                <div>
                    <span class="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest"><i class="fa-solid fa-crown mr-1"></i> Escala Permanente</span>
                    <h4 class="text-lg font-black text-slate-900">Cargos & Funções Fixas (Valem para Todas as Giras)</h4>
                </div>
                <span class="bg-amber-100 text-amber-800 text-xs font-extrabold px-3 py-1 rounded-full">${cargosFixos.length} Fixos</span>
            </div>
            ${cargosFixos.length === 0 
                ? `<p class="text-xs text-slate-400 italic py-2">Nenhum cargo fixo cadastrado. Selecione "🌟 Todas as Giras" acima para adicionar.</p>`
                : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${cargosFixos.map(p => `
                        <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                    <i class="fa-solid ${iconeFuncao(p.funcao)}"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-extrabold text-slate-900">${p.funcao}</span>
                                        <span class="text-xs font-bold text-amber-700 capitalize">&bull; ${p.filho_nome}</span>
                                    </div>
                                    ${p.detalhe ? `<p class="text-[11px] text-slate-500 font-medium mt-0.5">${p.detalhe}</p>` : ''}
                                </div>
                            </div>
                            <button onclick="removerPostoGira('${p.id}')" title="Remover Cargo Fixo" class="text-xs text-red-500 hover:text-red-700 font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 transition">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                   </div>`
            }
        </div>
    `;

    // Cards de cada Gira Específica agendada no Admin
    html += giras.map(gira => {
        const dataBr = gira.data.split('-').reverse().join('/');
        const postosDia = escalas.filter(e => e.gira_id === gira.id);

        const postosHtml = postosDia.length === 0
            ? `<p class="text-xs text-slate-400 italic py-2">Nenhum posto extra específico para este dia.</p>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${postosDia.map(p => `
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                <i class="fa-solid ${iconeFuncao(p.funcao)}"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-extrabold text-slate-900">${p.funcao}</span>
                                    <span class="text-xs font-bold text-purple-700 capitalize">&bull; ${p.filho_nome}</span>
                                </div>
                                ${p.detalhe ? `<p class="text-[11px] text-slate-500 font-medium mt-0.5">${p.detalhe}</p>` : ''}
                            </div>
                        </div>
                        <button onclick="removerPostoGira('${p.id}')" class="text-xs text-red-500 hover:text-red-700 font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 transition">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `).join('')}
               </div>`;

        return `
            <div class="pro-card p-5 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <span class="text-xs font-extrabold text-purple-600 uppercase tracking-wider"><i class="fa-regular fa-calendar mr-1"></i> Gira de ${dataBr}</span>
                        <h4 class="text-lg font-black text-slate-900">${gira.linha_trabalho}</h4>
                    </div>
                    <span class="bg-purple-100 text-purple-800 text-xs font-extrabold px-3 py-1 rounded-full">${postosDia.length} Escalados do Dia</span>
                </div>
                ${postosHtml}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

export async function salvarPostoGira(event) {
    event.preventDefault();
    const giraVal = document.getElementById('escala-gira-id').value;
    const selectFilho = document.getElementById('escala-filho-id');
    const filhoId = selectFilho.value;
    const filhoNome = selectFilho.options[selectFilho.selectedIndex]?.getAttribute('data-nome') || '';
    const funcao = document.getElementById('escala-funcao').value.trim();
    const detalhe = document.getElementById('escala-detalhe').value.trim();

    if (!filhoId || !funcao) {
        alert("Selecione um filho e digite o cargo ou função.");
        return;
    }

    const giraIdFinal = giraVal === 'TODAS' ? null : giraVal;

    const { error } = await supabase.from('escala_gira').insert([{
        gira_id: giraIdFinal,
        filho_id: filhoId,
        filho_nome: filhoNome,
        funcao: funcao,
        detalhe: detalhe
    }]);

    if (!error) {
        document.getElementById('escala-funcao').value = '';
        document.getElementById('escala-detalhe').value = '';
        if (window.mostrarToast) {
            window.mostrarToast("Cargo / Posto Salvo!", `${filhoNome} foi definido(a) como ${funcao}.`);
        }
        carregarEscalaGiraAdmin();
    } else {
        alert("Erro ao salvar. Verifique se executou o SQL da tabela 'escala_gira' no Supabase.");
    }
}

export async function removerPostoGira(id) {
    const { error } = await supabase.from('escala_gira').delete().eq('id', id);
    if (!error) {
        carregarEscalaGiraAdmin();
    }
}