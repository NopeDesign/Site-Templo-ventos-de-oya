import { supabase, state, mesesNomesCompletos } from './config.js';
import { gerarHtmlRadarAniversariantes } from './painelFilho.js';

export async function adicionarFilho(event) {
    event.preventDefault();
    const nascimentoVal = document.getElementById('novo-filho-nascimento').value;
    const { error } = await supabase.from('filhos').insert([{ 
        nome: document.getElementById('novo-filho-nome').value, 
        data_nascimento: nascimentoVal ? nascimentoVal : null,
        data_entrada: document.getElementById('novo-filho-data').value,
        senha: document.getElementById('novo-filho-senha').value,
        is_admin: document.getElementById('novo-filho-admin').checked,
        valor_mensalidade: 100.00 
    }]);
    if(!error) { 
        document.getElementById('novo-filho-nome').form.reset(); 
        carregarMensalidades(); 
        if (window.mostrarToast) window.mostrarToast("Integrante Adicionado!", "Novo filho registado na corrente.");
    } else {
        alert("Erro ao cadastrar. Verifique se executou o comando SQL da coluna data_nascimento no Supabase.");
    }
}

export async function salvarDatasFilho() {
    if (!state.filhoSendoEditado) return;
    const nasc = document.getElementById('edit-filho-nascimento').value;
    const entr = document.getElementById('edit-filho-entrada').value;

    const { error } = await supabase.from('filhos').update({
        data_nascimento: nasc ? nasc : null,
        data_entrada: entr ? entr : null
    }).eq('id', state.filhoSendoEditado);

    if (!error) {
        if (window.mostrarToast) window.mostrarToast("Datas Atualizadas!", "A data de nascimento e ingresso foram salvas.");
        await carregarMensalidades();
        abrirFicha(state.filhoSendoEditado);
    } else {
        alert("Erro ao salvar datas. Verifique se criou a coluna data_nascimento no Supabase.");
    }
}

export async function carregarMensalidades() {
    const container = document.getElementById('lista-filhos-limpa');
    container.innerHTML = '<div class="text-center py-10 text-slate-400 col-span-2"><div class="loader"></div></div>';
    
    const [resF, resP, resE, resC] = await Promise.all([
        supabase.from('filhos').select('*').order('nome'),
        supabase.from('mensalidades').select('*'),
        supabase.from('debitos_extras').select('*'),
        supabase.from('comprovantes').select('*').order('created_at', { ascending: false })
    ]);

    state.filhosDataLocal = resF.data || [];
    state.pagamentosDataLocal = resP.data || [];
    state.debitosExtrasLocal = resE.data || [];
    state.comprovantesLocal = resC.data || [];

    // Atualiza o Radar de Aniversariantes no Painel Admin
    const radarAdmin = document.getElementById('admin-radar-aniversariantes');
    if (radarAdmin) radarAdmin.innerHTML = gerarHtmlRadarAniversariantes(state.filhosDataLocal);

    renderizarComprovantesAdmin();

    if (state.filhosDataLocal.length === 0) {
        container.innerHTML = '<p class="text-slate-400">Nenhum integrante.</p>';
        return;
    }
    
    const dataAtual = new Date();
    let html = '';
    state.filhosDataLocal.forEach(filho => {
        const dataInicio = new Date(filho.data_entrada || filho.data_cadastro);
        const pagamentos = state.pagamentosDataLocal.filter(p => p.filho_id === filho.id).map(p => p.mes_ano);
        const extras = state.debitosExtrasLocal.filter(e => e.filho_id === filho.id);
        const temComp = state.comprovantesLocal.some(c => c.filho_id === filho.id);
        
        let cursorData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
        let hojeData = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
        let mesesAtrasados = 0; let totalExtras = 0;
        
        extras.forEach(e => totalExtras += e.valor);
        while(cursorData <= hojeData) {
            let mesStr = `${cursorData.getFullYear()}-${(cursorData.getMonth()+1).toString().padStart(2, '0')}`;
            if(!pagamentos.includes(mesStr)) mesesAtrasados++;
            cursorData.setMonth(cursorData.getMonth() + 1);
        }

        let totalDivida = (mesesAtrasados * 100) + totalExtras;
        let cargoBadge = filho.is_admin ? `<span class="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded ml-2 font-bold uppercase">Admin</span>` : '';
        let compBadge = temComp ? `<span class="bg-teal-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2 font-extrabold uppercase animate-pulse"><i class="fa-solid fa-receipt mr-1"></i>Comprovante</span>` : '';
        
        html += `
            <div onclick="abrirFicha('${filho.id}')" class="cursor-pointer flex justify-between items-center p-5 rounded-xl border ${totalDivida > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"} hover:shadow-md transition">
                <div>
                    <p class="font-bold text-slate-800 text-base capitalize">${filho.nome} ${cargoBadge}${compBadge}</p>
                    <p class="text-xs mt-1 ${totalDivida>0?'text-red-600 font-bold':'text-emerald-600 font-semibold'}">${totalDivida>0? `Dívida: R$ ${totalDivida.toFixed(2)}` : 'Em dia'}</p>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300"></i>
            </div>`;
    });
    container.innerHTML = html;
}

function renderizarComprovantesAdmin() {
    const container = document.getElementById('lista-comprovantes-admin');
    const badgeMenu = document.getElementById('badge-comprovantes-menu');
    const comps = state.comprovantesLocal || [];

    if (badgeMenu) {
        if (comps.length > 0) {
            badgeMenu.innerText = comps.length;
            badgeMenu.classList.remove('hidden');
        } else {
            badgeMenu.classList.add('hidden');
        }
    }

    if (!container) return;

    if (comps.length === 0) {
        container.innerHTML = `<p class="text-xs text-teal-800/70 italic">Nenhum comprovante pendente no momento.</p>`;
        return;
    }

    container.innerHTML = comps.map(c => {
        const dataEnvio = new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `
        <div class="bg-white p-4 rounded-xl border border-teal-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-extrabold text-slate-900 text-sm capitalize">${c.filho_nome}</span>
                    <span class="text-[11px] text-slate-400 font-semibold">&bull; ${dataEnvio}</span>
                </div>
                <p class="text-xs text-teal-700 font-bold mt-0.5">Ref: ${c.observacao} <span class="text-slate-400 font-normal">(Ficha: ${c.valor_pendente || 'R$ 0,00'})</span></p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
                <button onclick="verComprovanteModal('${c.id}')" class="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5">
                    <i class="fa-regular fa-eye"></i> Ver Foto/PDF
                </button>
                <button onclick="abrirFicha('${c.filho_id}')" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5">
                    <i class="fa-solid fa-folder-open"></i> Dar Baixa na Ficha
                </button>
                <button onclick="apagarComprovante('${c.id}')" title="Apagar Comprovante" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1">
                    <i class="fa-solid fa-trash"></i> Apagar
                </button>
            </div>
        </div>`;
    }).join('');
}

export function verComprovanteModal(compId) {
    const comp = state.comprovantesLocal.find(c => c.id === compId);
    if (!comp) return;

    document.getElementById('modal-comp-titulo').innerText = `Comprovante de ${comp.filho_nome}`;
    document.getElementById('modal-comp-subtitulo').innerText = `Referente a: ${comp.observacao}`;
    const corpo = document.getElementById('modal-comp-corpo');

    if (comp.arquivo_tipo && comp.arquivo_tipo.includes('pdf')) {
        corpo.innerHTML = `<iframe src="${comp.arquivo_base64}" class="w-full h-[500px] rounded-xl border border-slate-300"></iframe>`;
    } else {
        corpo.innerHTML = `<img src="${comp.arquivo_base64}" alt="Comprovante" class="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md">`;
    }

    document.getElementById('modal-comprovante').classList.remove('hidden');
}

export function fecharModalComprovante() {
    document.getElementById('modal-comprovante').classList.add('hidden');
    document.getElementById('modal-comp-corpo').innerHTML = '';
}

export async function apagarComprovante(compId) {
    if (confirm("Já deu baixa na ficha? Deseja apagar este comprovante do sistema?")) {
        await supabase.from('comprovantes').delete().eq('id', compId);
        if (window.mostrarToast) window.mostrarToast("Comprovante Apagado!", "O comprovante foi removido da lista.");
        carregarMensalidades();
    }
}

export function abrirFicha(filho_id) {
    state.filhoSendoEditado = filho_id;
    const filho = state.filhosDataLocal.find(f => f.id === filho_id);
    const pagamentos = state.pagamentosDataLocal.filter(p => p.filho_id === filho.id).map(p => p.mes_ano);
    const extras = state.debitosExtrasLocal.filter(e => e.filho_id === filho.id);
    
    document.getElementById('ficha-nome').innerText = filho.nome;
    
    // Preenche os campos de edição de Nascimento e Ingresso
    const inputEditNasc = document.getElementById('edit-filho-nascimento');
    const inputEditEntr = document.getElementById('edit-filho-entrada');
    if (inputEditNasc) inputEditNasc.value = filho.data_nascimento || '';
    if (inputEditEntr) inputEditEntr.value = filho.data_entrada || '';

    const dataInicio = new Date(filho.data_entrada || filho.data_cadastro);
    let cursorData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
    let hojeData = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    let dataLimite = new Date(hojeData);
    pagamentos.forEach(mesStr => {
        const [anoP, mesP] = mesStr.split('-').map(Number);
        const dataP = new Date(anoP, mesP - 1, 1);
        if (dataP > dataLimite) dataLimite = dataP;
    });

    let mesesList = []; 
    let mesesAtrasados = 0;
    
    while(cursorData <= dataLimite) {
        const isFuturo = cursorData > hojeData;
        mesesList.unshift({ ano: cursorData.getFullYear(), mes: cursorData.getMonth() + 1, isFuturo });
        cursorData.setMonth(cursorData.getMonth() + 1);
    }

    let htmlMeses = '';
    mesesList.forEach(m => {
        let mesStr = `${m.ano}-${m.mes.toString().padStart(2, '0')}`;
        let isPago = pagamentos.includes(mesStr);
        
        if(!isPago && !m.isFuturo) mesesAtrasados++;

        let bgLinha = isPago 
            ? (m.isFuturo ? "bg-teal-50/60 border-teal-200" : "bg-white border-slate-200") 
            : "bg-red-50/50 border-red-200";
            
        let statusTexto = isPago 
            ? (m.isFuturo 
                ? `<span class="text-teal-700 font-extrabold text-[10px] uppercase"><i class="fa-solid fa-forward-fast mr-1"></i>Pago (Adiantado)</span>` 
                : `<span class="text-emerald-600 font-bold text-[10px] uppercase">Pago</span>`) 
            : `<span class="text-red-600 font-bold text-[10px] uppercase">Pendente</span>`;
            
        let btnHtml = isPago 
            ? `<button onclick="alterarPagamentoNaFicha('${mesStr}', false)" class="text-[10px] text-slate-400 hover:text-red-500 underline uppercase">Desfazer</button>` 
            : `<button onclick="alterarPagamentoNaFicha('${mesStr}', true)" class="bg-slate-900 text-white py-1 px-3 rounded-md text-xs">Pagar</button>`;
            
        htmlMeses += `<div class="flex justify-between items-center p-3 border ${bgLinha} rounded-lg mb-2"><div><p class="font-bold text-sm">${mesesNomesCompletos[m.mes-1]} ${m.ano}</p><p class="mt-0.5">${statusTexto}</p></div><div>${btnHtml}</div></div>`;
    });
    document.getElementById('ficha-lista-meses').innerHTML = htmlMeses;

    let valorTotalExtras = 0;
    const htmlExtras = extras.length === 0 
        ? '<p class="text-slate-400 text-xs italic">Nenhum registo extra.</p>'
        : extras.map(extra => {
            valorTotalExtras += extra.valor;
            return `<div class="flex justify-between items-center p-3 border border-red-200 bg-red-50/50 rounded-lg mb-2"><div><p class="font-semibold text-sm">${extra.descricao}</p><p class="text-red-600 font-bold text-xs mt-0.5">R$ ${extra.valor.toFixed(2)}</p></div><button onclick="pagarDebitoExtra('${extra.id}')" class="bg-slate-900 text-white py-1 px-3 rounded-md text-xs">Quitar</button></div>`;
        }).join('');

    document.getElementById('ficha-lista-extras').innerHTML = htmlExtras;
    document.getElementById('ficha-divida-meses').innerText = mesesAtrasados;
    document.getElementById('ficha-divida-extras').innerText = extras.length;
    document.getElementById('ficha-divida-valor').innerText = `R$ ${((mesesAtrasados * 100) + valorTotalExtras).toFixed(2).replace('.', ',')}`;
    document.getElementById('modal-ficha').classList.remove('hidden');
}

export async function adiantarMensalidade() {
    if (!state.filhoSendoEditado) return;
    const filho = state.filhosDataLocal.find(f => f.id === state.filhoSendoEditado);
    const pagamentos = state.pagamentosDataLocal.filter(p => p.filho_id === filho.id).map(p => p.mes_ano);

    let dataAlvo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    while (true) {
        let mesTeste = `${dataAlvo.getFullYear()}-${(dataAlvo.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!pagamentos.includes(mesTeste)) {
            break;
        }
        dataAlvo.setMonth(dataAlvo.getMonth() + 1);
    }

    const mesAnoStr = `${dataAlvo.getFullYear()}-${(dataAlvo.getMonth() + 1).toString().padStart(2, '0')}`;
    const nomeMes = mesesNomesCompletos[dataAlvo.getMonth()];
    const ano = dataAlvo.getFullYear();

    if (confirm(`Confirmar adiantamento da mensalidade de ${nomeMes}/${ano} (R$ 100,00) para ${filho.nome}?`)) {
        await supabase.from('mensalidades').insert([{ filho_id: state.filhoSendoEditado, mes_ano: mesAnoStr }]);
        await supabase.from('caixa').insert([{ 
            tipo: 'entrada', 
            valor: 100.00, 
            descricao: `Mensalidade Adiantada (${ (dataAlvo.getMonth() + 1).toString().padStart(2, '0') }/${ano}) - ${filho.nome}` 
        }]);
        await carregarMensalidades();
        abrirFicha(state.filhoSendoEditado);
    }
}

export async function alterarPagamentoNaFicha(mes_ano, marcarComoPago) {
    const filho = state.filhosDataLocal.find(f => f.id === state.filhoSendoEditado);
    if(marcarComoPago) {
        await supabase.from('mensalidades').insert([{ filho_id: state.filhoSendoEditado, mes_ano }]);
        await supabase.from('caixa').insert([{ tipo: 'entrada', valor: 100.00, descricao: `Mensalidade (${mes_ano.split('-').reverse().join('/')}) - ${filho.nome}` }]);
    } else {
        await supabase.from('mensalidades').delete().match({ filho_id: state.filhoSendoEditado, mes_ano });
    }
    await carregarMensalidades();
    abrirFicha(state.filhoSendoEditado);
}

export async function adicionarDebitoExtra(event) {
    event.preventDefault();
    await supabase.from('debitos_extras').insert([{
        filho_id: state.filhoSendoEditado,
        descricao: document.getElementById('extra-desc').value,
        valor: parseFloat(document.getElementById('extra-valor').value)
    }]);
    document.getElementById('extra-desc').value = '';
    document.getElementById('extra-valor').value = '';
    await carregarMensalidades();
    abrirFicha(state.filhoSendoEditado);
}

export async function pagarDebitoExtra(id_debito) {
    const extra = state.debitosExtrasLocal.find(e => e.id === id_debito);
    const filho = state.filhosDataLocal.find(f => f.id === state.filhoSendoEditado);
    if(confirm(`Confirmar pagamento?`)) {
        await supabase.from('debitos_extras').delete().eq('id', id_debito);
        await supabase.from('caixa').insert([{ tipo: 'entrada', valor: extra.valor, descricao: `Extra Quitado (${extra.descricao}) - ${filho.nome}` }]);
        await carregarMensalidades();
        abrirFicha(state.filhoSendoEditado);
    }
}

export function fecharFicha() {
    document.getElementById('modal-ficha').classList.add('hidden');
    state.filhoSendoEditado = null;
}

export async function carregarCaixa() {
    const { data } = await supabase.from('caixa').select('*').order('created_at', { ascending: false });
    let html = '', totalIn = 0, totalOut = 0;
    if(data) {
        data.forEach(mov => {
            const d = new Date(mov.created_at);
            if(mov.tipo === 'entrada') totalIn += mov.valor; else totalOut += mov.valor;
            html += `<tr class="border-b border-slate-100"><td class="px-6 py-4 text-xs">${d.toLocaleDateString('pt-BR')}</td><td class="px-6 py-4 font-semibold">${mov.descricao}</td><td class="px-6 py-4">${mov.tipo==='entrada'?'<span class="text-emerald-600 text-xs font-bold uppercase">Entrada</span>':'<span class="text-red-600 text-xs font-bold uppercase">Saída</span>'}</td><td class="px-6 py-4 text-right font-bold ${mov.tipo==='entrada'?'text-emerald-600':'text-red-600'}">R$ ${mov.valor.toFixed(2)}</td><td class="px-6 py-4 text-center"><button onclick="apagarItem('caixa', '${mov.id}')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    }
    document.getElementById('lista-caixa-limpa').innerHTML = html;
    document.getElementById('caixa-total-entradas').innerText = `R$ ${totalIn.toFixed(2).replace('.', ',')}`;
    document.getElementById('caixa-total-saidas').innerText = `R$ ${totalOut.toFixed(2).replace('.', ',')}`;
    document.getElementById('caixa-saldo-atual').innerText = `R$ ${(totalIn - totalOut).toFixed(2).replace('.', ',')}`;
}

export async function adicionarMovimentacaoCaixa(event) {
    event.preventDefault();
    await supabase.from('caixa').insert([{
        tipo: document.getElementById('nova-mov-tipo').value,
        descricao: document.getElementById('nova-mov-desc').value,
        valor: parseFloat(document.getElementById('nova-mov-valor').value)
    }]);
    document.getElementById('nova-mov-desc').value = '';
    document.getElementById('nova-mov-valor').value = '';
    carregarCaixa();
}

export async function carregarListaGeral() {
    const [g, a, f] = await Promise.all([
        supabase.from('giras').select('*').order('data', { ascending: false }),
        supabase.from('avisos').select('*').order('data_publicacao', { ascending: false }),
        supabase.from('filhos').select('*').order('nome')
    ]);
    
    document.getElementById('admin-lista-giras').innerHTML = (g.data || []).map(i => `<div class="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg"><span class="text-sm">${i.data.split('-').reverse().join('/')} &bull; ${i.linha_trabalho}</span><button onclick="apagarItem('giras', '${i.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button></div>`).join('');
    document.getElementById('admin-lista-avisos').innerHTML = (a.data || []).map(i => `<div class="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg"><span class="text-sm font-medium truncate">${i.titulo}</span><button onclick="apagarItem('avisos', '${i.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button></div>`).join('');
    document.getElementById('admin-lista-filhos').innerHTML = (f.data || []).map(i => `<div class="flex justify-between items-center p-3 bg-white border border-red-100 rounded-lg"><span class="text-sm font-bold capitalize">${i.nome}</span><button onclick="apagarItem('filhos', '${i.id}')" class="text-red-500 text-xs font-bold">Remover</button></div>`).join('');
}