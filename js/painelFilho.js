import { supabase, state, mesesNomesCompletos, dataHoje } from './config.js';
import { carregarEscalaDoFilho } from './faxina.js';
import { carregarGiras } from './girasAvisos.js';

export async function carregarPainelDoFilho() {
    const { data: userFresh } = await supabase.from('filhos').select('*').eq('id', state.usuarioLogado.id).maybeSingle();
    if (userFresh) {
        state.usuarioLogado = userFresh;
        localStorage.setItem('umbanda_user_session', JSON.stringify(userFresh));
    }

    const user = state.usuarioLogado;
    document.getElementById('user-nome-display').innerText = user.nome.trim().split(' ')[0];
    
    await carregarEscalaDoFilho();

    // 1. Avisos (Mural de Comunicados)
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

    // 2. Financeiro Pessoal
    const [resPagos, resExtras] = await Promise.all([
        supabase.from('mensalidades').select('*').eq('filho_id', user.id),
        supabase.from('debitos_extras').select('*').eq('filho_id', user.id)
    ]);

    const pagamentos = (resPagos.data || []).map(p => p.mes_ano);
    const extras = resExtras.data || [];

    const dataInicio = new Date(user.data_entrada || user.data_cadastro || dataHoje);
    const dataAtual = new Date();
    let cursorData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
    let hojeData = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
    
    // Estende a visualização caso o filho tenha meses futuros adiantados
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
    const elTotal = document.getElementById('user-total-divida');
    const boxSaldo = document.getElementById('box-saldo-user');
    
    elTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    elTotal.className = `text-3xl font-black tracking-tight ${total === 0 ? 'text-emerald-600' : 'text-red-600'}`;
    
    if (boxSaldo) {
        boxSaldo.className = total === 0 
            ? 'bg-emerald-50/50 rounded-2xl p-5 border border-emerald-200/80 mb-6 text-center transition-colors'
            : 'bg-red-50/50 rounded-2xl p-5 border border-red-200/80 mb-6 text-center transition-colors';
    }

    // 3. Calendário de Giras
    carregarGiras();
}