import { supabase, state, mesesNomesCompletos, dataHoje, FINANCEIRO_CONFIG } from './config.js';
import { carregarEscalaDoFilho } from './faxina.js';
import { carregarGiras, carregarEscalaGiraFilho } from './girasAvisos.js';

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
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${a.isHoje ? 'bg-pink-50 border-pink-300 shadow-sm' : 'bg-white border-slate-200/80'}">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${a.isHoje ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-600'} font-black text-xs flex items-center justify-center shrink-0">
                        ${a.dia.toString().padStart(2, '0')}
                    </span>
                    <span class="font-bold text-slate-800 text-xs capitalize">${a.nome}</span>
                </div>
                ${a.isHoje 
                    ? `<span class="bg-pink-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-bounce">🎉 É Hoje!</span>` 
                    : `<span class="text-[11px] font-bold text-slate-400">Dia ${a.dia.toString().padStart(2, '0')}/${a.mes.toString().padStart(2, '0')}</span>`}
            </div>
        `).join('');

    const htmlTerreiro = anivTerreiro.length === 0
        ? `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum aniversário de corrente neste mês.</p>`
        : anivTerreiro.map(t => `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${t.isHoje ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-slate-200/80'}">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${t.isHoje ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'} font-black text-xs flex items-center justify-center shrink-0">
                        ${t.dia.toString().padStart(2, '0')}
                    </span>
                    <div>
                        <p class="font-bold text-slate-800 text-xs capitalize leading-tight">${t.nome}</p>
                        <p class="text-[10px] font-semibold text-amber-700">${t.anos} ${t.anos === 1 ? 'ano de casa' : 'anos de casa'}</p>
                    </div>
                </div>
                ${t.isHoje 
                    ? `<span class="bg-amber-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">🕊️ Hoje!</span>` 
                    : `<span class="bg-amber-100/80 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">${t.anos} ${t.anos === 1 ? 'Ano' : 'Anos'}</span>`}
            </div>
        `).join('');

    return `
        <div class="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 space-y-2.5">
            <h4 class="text-xs font-extrabold text-pink-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-cake-candles"></i> Aniversários de Vida
            </h4>
            <div class="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">${htmlVida}</div>
        </div>
        <div class="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 space-y-2.5">
            <h4 class="text-xs font-extrabold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-dove"></i> Tempo de Corrente
            </h4>
            <div class="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">${htmlTerreiro}</div>
        </div>
    `;
}

export async function carregarPainelDoFilho() {
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
    document.getElementById('user-nome-display').innerText = user.nome.trim().split(' ')[0];
    
    const elPixDisplay = document.getElementById('pix-chave-display');
    if (elPixDisplay) elPixDisplay.innerText = FINANCEIRO_CONFIG.chavePix;

    // Carrega os Postos da Próxima Gira e a Escala de Faxina
    await Promise.all([
        carregarEscalaGiraFilho(),
        carregarEscalaDoFilho()
    ]);

    // 1. Avisos
    const hoje = new Date().toISOString().split('T')[0];
    const resAvisos = await supabase.from('avisos').select('*').gte('data_expiracao', hoje).order('data_publicacao', { ascending: false });
    const containerAvisos = document.getElementById('user-mural-avisos');
    
    if (!resAvisos.data || resAvisos.data.length === 0) {
        containerAvisos.innerHTML = `
            <div class="flex items-center gap-3 bg-slate-50/80 p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <i class="fa-regular fa-bell-slash text-lg ml-1"></i>
                <p class="text-xs font-semibold">Nenhum comunicado importante publicado no momento.</p>
            </div>`;
    } else {
        containerAvisos.innerHTML = resAvisos.data.map(aviso => {
            const isUrgente = aviso.tipo === 'urgente';
            const estiloCard = isUrgente 
                ? 'border-red-200 bg-red-50/60 text-red-900' 
                : 'border-amber-200/80 bg-amber-50/40 text-slate-800';
            const badge = isUrgente
                ? '<span class="bg-red-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">Urgente</span>'
                : '<span class="bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">Comunicado</span>';

            return `
                <div class="border ${estiloCard} p-4 rounded-2xl shadow-sm transition-all">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <h3 class="font-extrabold text-sm">${aviso.titulo}</h3>
                        ${badge}
                    </div>
                    <p class="text-xs leading-relaxed text-slate-600 font-medium">${aviso.mensagem}</p>
                </div>`;
        }).join('');
    }

    // 2. Financeiro Pessoal + Comprovantes Enviados
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
            <div class="flex items-center justify-between bg-slate-800/90 border border-slate-700 px-3 py-2 rounded-xl text-[11px]">
                <span class="text-slate-200 font-semibold truncate pr-2"><i class="fa-regular fa-clock text-amber-400 mr-1.5"></i>${c.observacao}</span>
                <span class="text-amber-400 font-extrabold uppercase text-[9px] shrink-0">Em Análise</span>
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
                <div class="flex justify-between items-center p-3 border border-red-200 bg-red-50/40 rounded-xl text-xs">
                    <span class="font-bold text-slate-800">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                    <span class="bg-red-100 text-red-700 font-extrabold px-2.5 py-1 rounded-lg">R$ 100,00</span>
                </div>`;
        } else if (isPago) {
            const labelPago = m.isFuturo ? 'Adiantado' : 'Pago';
            const corBadge = m.isFuturo ? 'text-teal-700 bg-teal-100/80' : 'text-emerald-700 bg-emerald-100/80';
            htmlMeses += `
                <div class="flex justify-between items-center p-3 border border-slate-200/80 bg-slate-50/50 rounded-xl text-xs">
                    <span class="font-bold text-slate-700">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                    <span class="inline-flex items-center gap-1 ${corBadge} px-2.5 py-1 rounded-lg font-extrabold text-[11px] uppercase">
                        <i class="fa-solid fa-circle-check"></i> ${labelPago}
                    </span>
                </div>`;
        }
    });

    document.getElementById('user-lista-mensalidades').innerHTML = htmlMeses || `
        <div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-bold text-center">
            <i class="fa-solid fa-check mr-1"></i> Sem mensalidades pendentes!
        </div>`;

    let valorDevidoExtras = 0;
    const htmlExt = extras.map(e => {
        valorDevidoExtras += e.valor;
        return `
            <div class="flex justify-between items-center p-3 border border-orange-200 bg-orange-50/40 rounded-xl text-xs">
                <span class="font-bold text-slate-800 truncate pr-2">${e.descricao}</span>
                <span class="bg-orange-100 text-orange-800 font-extrabold px-2.5 py-1 rounded-lg whitespace-nowrap">R$ ${e.valor.toFixed(2).replace('.', ',')}</span>
            </div>`;
    }).join('');

    document.getElementById('user-lista-extras').innerHTML = htmlExt || `
        <div class="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium text-center">
            Nenhum consumo extra registado.
        </div>`;

    const total = valorDevidoMeses + valorDevidoExtras;
    state.totalDividaUsuarioLogado = total;

    const elTotal = document.getElementById('user-total-divida');
    const boxSaldo = document.getElementById('box-saldo-user');
    
    elTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    elTotal.className = `text-3xl font-black tracking-tight ${total === 0 ? 'text-emerald-600' : 'text-red-600'}`;
    
    if (boxSaldo) {
        boxSaldo.className = total === 0 
            ? 'bg-emerald-50/50 rounded-2xl p-5 border border-emerald-200/80 mb-5 text-center transition-colors'
            : 'bg-red-50/50 rounded-2xl p-5 border border-red-200/80 mb-5 text-center transition-colors';
    }

    // 3. Calendário de Giras
    carregarGiras();
}

export function copiarChavePix() {
    navigator.clipboard.writeText(FINANCEIRO_CONFIG.chavePix).then(() => {
        if (window.mostrarToast) {
            window.mostrarToast("Chave PIX Copiada!", `Chave copiada: ${FINANCEIRO_CONFIG.chavePix}`);
        } else {
            alert(`Chave PIX copiada: ${FINANCEIRO_CONFIG.chavePix}`);
        }
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
        alert("O arquivo é muito grande! Escolha uma imagem ou PDF de até 6MB.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="loader w-3.5 h-3.5 border-2 mr-2"></div> Salvando no sistema...`;

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
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-teal-600"></i> Enviar Comprovante pelo Site`;
            alert("Erro ao salvar comprovante. Verifique se criou a tabela 'comprovantes' no SQL Editor do Supabase.");
        } else {
            btn.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i> Comprovante Recebido!`;
            document.getElementById('form-comprovante-supabase').reset();
            if (window.mostrarToast) {
                window.mostrarToast("Comprovante Salvo!", "A direção já recebeu o seu comprovante para dar baixa.");
            }
            carregarPainelDoFilho();
            setTimeout(() => {
                btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-teal-600"></i> Enviar Comprovante pelo Site`;
            }, 3500);
        }
    };
    reader.readAsDataURL(file);
}

export function enviarComprovanteWhatsApp() {
    const user = state.usuarioLogado;
    const valorFormatado = (state.totalDividaUsuarioLogado || 0).toFixed(2).replace('.', ',');
    const msg = `Olá! Sou o(a) *${user.nome}*, enviei no site o comprovante referente à minha ficha financeira (Saldo: *R$ ${valorFormatado}*).`;
    const url = `https://wa.me/${FINANCEIRO_CONFIG.whatsappNumero}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}