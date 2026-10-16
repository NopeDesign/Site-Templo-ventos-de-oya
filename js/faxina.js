import { supabase, state } from './config.js';

// 1. ESCALA DO FILHO (Cole aqui)
export async function carregarEscalaDoFilho() {
    const container = document.getElementById('user-escala-faxina');
    const user = state.usuarioLogado;
    
    if (!user.grupo_faxina_id) {
        container.innerHTML = `
            <div class="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200 text-center">
                <p class="text-xs text-slate-400 font-medium">Você ainda não foi alocado em nenhum grupo de limpeza.</p>
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
    const hoje = new Date().toISOString().split('T')[0];
    
    let dataFormatada = 'A definir';
    let alertaDia = '';

    if (grupo.proxima_data) {
        const [ano, mes, dia] = grupo.proxima_data.split('-');
        dataFormatada = `${dia}/${mes}/${ano}`;

        if (grupo.proxima_data === hoje) {
            alertaDia = `<div class="bg-amber-500 text-white text-xs font-extrabold p-3 rounded-xl mb-4 flex items-center justify-center uppercase tracking-wider shadow-sm animate-pulse"><i class="fa-solid fa-bell mr-2"></i> Hoje é o seu dia de faxina!</div>`;
        } else if (grupo.proxima_data > hoje) {
            alertaDia = `<div class="bg-teal-50 border border-teal-200/80 text-teal-700 text-xs font-bold p-2.5 rounded-xl mb-4 flex items-center justify-center gap-1.5"><i class="fa-regular fa-calendar-check"></i> Próxima escala agendada</div>`;
        }
    }

    const listaNomes = colegas.map(c => {
        const primeiroNome = c.nome.trim().split(' ')[0];
        const inicial = primeiroNome.charAt(0).toUpperCase();
        if (c.id === user.id) {
            return `<span class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-xs font-bold pl-1.5 pr-3 py-1 rounded-full shadow-sm capitalize"><span class="w-5 h-5 rounded-full bg-teal-800 flex items-center justify-center text-[10px]">${inicial}</span>${primeiroNome} (Você)</span>`;
        }
        return `<span class="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold pl-1.5 pr-3 py-1 rounded-full border border-slate-200/80 capitalize"><span class="w-5 h-5 rounded-full bg-white text-slate-500 flex items-center justify-center text-[10px] font-bold shadow-sm">${inicial}</span>${primeiroNome}</span>`;
    }).join('');

    container.innerHTML = `
        ${alertaDia}
        <div class="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 border border-slate-200/80 mb-4">
            <div class="flex justify-between items-center pb-3 border-b border-slate-200/60">
                <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Seu Grupo</span>
                <span class="text-xs font-extrabold text-teal-800 bg-teal-100/80 border border-teal-200 px-3 py-0.5 rounded-full">${grupo.nome}</span>
            </div>
            <div class="pt-3 flex justify-between items-center">
                <span class="text-xs font-bold text-slate-500">Data da Limpeza</span>
                <span class="text-lg font-black text-slate-900 tracking-tight">${dataFormatada}</span>
            </div>
            ${grupo.observacao ? `
            <div class="mt-3 pt-2.5 border-t border-slate-200/50 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <i class="fa-regular fa-clock text-teal-600"></i> <span>Horário / Obs: <strong class="text-slate-800">${grupo.observacao}</strong></span>
            </div>` : ''}
        </div>
        <div>
            <p class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">Integrantes da Equipe (${colegas.length})</p>
            <div class="flex flex-wrap gap-1.5">${listaNomes}</div>
        </div>
    `;
}

// 2. GESTÃO DE FAXINA PARA O ADMIN
export async function carregarFaxinaAdmin() {
    const container = document.getElementById('lista-grupos-faxina');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10 text-slate-400 col-span-2"><div class="loader"></div></div>';

    const [resGrupos, resFilhos] = await Promise.all([
        supabase.from('grupos_faxina').select('*').order('proxima_data', { ascending: true }),
        supabase.from('filhos').select('*').order('nome')
    ]);

    const grupos = resGrupos.data || [];
    const filhos = resFilhos.data || [];

    const selectFilho = document.getElementById('select-filho-faxina');
    if (selectFilho) {
        selectFilho.innerHTML = filhos.map(f => {
            const grpAtual = grupos.find(g => g.id === f.grupo_faxina_id);
            const labelGrp = grpAtual ? ` (Atual: ${grpAtual.nome})` : ' (Sem grupo)';
            return `<option value="${f.id}">${f.nome}${labelGrp}</option>`;
        }).join('');
    }

    const selectGrupo = document.getElementById('select-grupo-faxina');
    if (selectGrupo) {
        selectGrupo.innerHTML = `<option value="">-- Sem Grupo (Remover da escala) --</option>` + 
            grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
    }

    if (grupos.length === 0) {
        container.innerHTML = '<p class="text-slate-400 col-span-2 text-center py-6 text-sm">Nenhum grupo de faxina criado ainda.</p>';
        return;
    }

    let html = '';
    grupos.forEach(grupo => {
        const membros = filhos.filter(f => f.grupo_faxina_id === grupo.id);
        const dataFormatada = grupo.proxima_data ? grupo.proxima_data.split('-').reverse().join('/') : 'Sem data definida';

        const membrosHtml = membros.length === 0 
            ? `<p class="text-xs text-slate-400 italic py-2">Nenhum integrante neste grupo.</p>`
            : membros.map(m => `
                <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <span class="font-semibold text-slate-700 capitalize"><i class="fa-solid fa-user text-slate-400 mr-2 text-xs"></i>${m.nome}</span>
                    <button onclick="removerFilhoDoGrupo('${m.id}')" class="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-0.5 rounded hover:bg-red-50 transition">
                        <i class="fa-solid fa-user-minus mr-1"></i>Tirar
                    </button>
                </div>`).join('');

        html += `
        <div class="pro-card p-5 space-y-4">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-extrabold text-base text-slate-900">${grupo.nome}</h4>
                    <p class="text-xs text-teal-600 font-bold mt-0.5"><i class="fa-regular fa-calendar mr-1"></i> ${dataFormatada}</p>
                </div>
                <button onclick="apagarItem('grupos_faxina', '${grupo.id}')" class="text-slate-400 hover:text-red-500 transition p-1"><i class="fa-solid fa-trash"></i></button>
            </div>
            
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[10px] font-extrabold text-slate-400 uppercase">Mudar Data</label>
                        <input type="date" id="data-grp-${grupo.id}" value="${grupo.proxima_data || ''}" class="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg mt-1 font-medium">
                    </div>
                    <div>
                        <label class="text-[10px] font-extrabold text-slate-400 uppercase">Horário / Obs</label>
                        <input type="text" id="obs-grp-${grupo.id}" value="${grupo.observacao || ''}" placeholder="Ex: 09h" class="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg mt-1 font-medium">
                    </div>
                </div>
                <button onclick="atualizarAgendaGrupo('${grupo.id}')" class="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 rounded-lg transition shadow-sm">
                    Atualizar Escala
                </button>
            </div>

            <div>
                <p class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Integrantes (${membros.length})</p>
                <div class="space-y-2 max-h-[180px] custom-scroll overflow-y-auto pr-1">${membrosHtml}</div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

export async function criarGrupoFaxina(event) {
    event.preventDefault();
    const nome = document.getElementById('faxina-nome').value.trim();
    const proxima_data = document.getElementById('faxina-data').value;
    const observacao = document.getElementById('faxina-obs').value.trim();

    const { error } = await supabase.from('grupos_faxina').insert([{ nome, proxima_data, observacao }]);
    if (!error) {
        document.getElementById('faxina-nome').value = '';
        document.getElementById('faxina-obs').value = '';
        carregarFaxinaAdmin();
    } else alert("Erro ao criar grupo.");
}

export async function atualizarAgendaGrupo(grupoId) {
    const novaData = document.getElementById(`data-grp-${grupoId}`).value;
    const novaObs = document.getElementById(`obs-grp-${grupoId}`).value.trim();
    const { error } = await supabase.from('grupos_faxina').update({ proxima_data: novaData || null, observacao: novaObs }).eq('id', grupoId);
    if (!error) { alert("Escala atualizada com sucesso!"); carregarFaxinaAdmin(); }
}

export async function moverFilhoGrupo() {
    const filhoId = document.getElementById('select-filho-faxina').value;
    const grupoId = document.getElementById('select-grupo-faxina').value;
    if (!filhoId) return;
    const { error } = await supabase.from('filhos').update({ grupo_faxina_id: grupoId === "" ? null : grupoId }).eq('id', filhoId);
    if (!error) { alert("Integrante movido com sucesso!"); carregarFaxinaAdmin(); }
}

export async function removerFilhoDoGrupo(filhoId) {
    const { error } = await supabase.from('filhos').update({ grupo_faxina_id: null }).eq('id', filhoId);
    if (!error) carregarFaxinaAdmin();
}