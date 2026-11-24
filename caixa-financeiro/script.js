import { 
    supabase, dataHoje, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

const adminAtivo = exigirSessao(true);

export async function carregarFluxoCaixa() {
    const tbody = document.getElementById('lista-caixa-limpa');
    const elEntradas = document.getElementById('caixa-total-entradas');
    const elSaidas = document.getElementById('caixa-total-saidas');
    const elSaldo = document.getElementById('caixa-saldo-atual');

    const [resCaixa, resMens, resFilhos, resDoacoes] = await Promise.all([
        supabase.from('caixa').select('*').order('created_at', { ascending: false }),
        supabase.from('mensalidades').select('*').order('data_pagamento', { ascending: false }),
        supabase.from('filhos').select('id, nome, valor_mensalidade'),
        supabase.from('doacoes').select('*').eq('status', 'confirmada').eq('tipo_doacao', 'pix').order('created_at', { ascending: false })
    ]);

    const movs = resCaixa.data || [];
    const mens = resMens.data || [];
    const filhos = resFilhos.data || [];
    const doacoesPix = resDoacoes.data || [];

    const mapaFilhos = {};
    filhos.forEach(f => { mapaFilhos[f.id] = f; });

    let totalEntradas = 0;
    let totalSaidas = 0;
    const linhasTabela = [];

    movs.forEach(m => {
        const val = Number(m.valor || 0);
        if (m.tipo === 'entrada') totalEntradas += val;
        else totalSaidas += val;

        const dataFmt = m.created_at ? new Date(m.created_at).toLocaleDateString('pt-PT') : '-';
        linhasTabela.push({
            timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
            dataFmt,
            descricao: m.descricao,
            tipo: m.tipo,
            valor: val,
            podeApagar: true,
            id: m.id
        });
    });

    mens.forEach(pg => {
        const filho = mapaFilhos[pg.filho_id];
        const val = Number(filho?.valor_mensalidade || 100);
        totalEntradas += val;
        const nomeFilho = filho?.nome || 'Integrante';
        const dataFmt = pg.data_pagamento ? new Date(pg.data_pagamento).toLocaleDateString('pt-PT') : pg.mes_ano;

        linhasTabela.push({
            timestamp: pg.data_pagamento ? new Date(pg.data_pagamento).getTime() : 0,
            dataFmt,
            descricao: `Mensalidade (${pg.mes_ano}) — ${nomeFilho}`,
            tipo: 'entrada',
            valor: val,
            podeApagar: false,
            id: null
        });
    });

    doacoesPix.forEach(d => {
        const val = Number(d.valor || 0);
        totalEntradas += val;
        const dataFmt = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-PT') : '-';

        linhasTabela.push({
            timestamp: d.created_at ? new Date(d.created_at).getTime() : 0,
            dataFmt,
            descricao: `Doação PIX: ${d.descricao_item || d.campanha_titulo || 'Doação'} — ${d.doador_nome}`,
            tipo: 'entrada',
            valor: val,
            podeApagar: false,
            id: null
        });
    });

    const saldoAtual = totalEntradas - totalSaidas;

    if (elEntradas) elEntradas.innerText = `R$ ${totalEntradas.toFixed(2).replace('.', ',')}`;
    if (elSaidas) elSaidas.innerText = `R$ ${totalSaidas.toFixed(2).replace('.', ',')}`;
    if (elSaldo) {
        elSaldo.innerText = `R$ ${saldoAtual.toFixed(2).replace('.', ',')}`;
        elSaldo.className = `text-3xl sm:text-4xl font-black tracking-tight ${saldoAtual >= 0 ? 'text-[#A9D8E8]' : 'text-rose-200'}`;
    }

    if (!tbody) return;
    linhasTabela.sort((a, b) => b.timestamp - a.timestamp);

    if (linhasTabela.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-400 text-xs italic">Nenhuma movimentação registada no caixa até ao momento.</td></tr>`;
        return;
    }

    tbody.innerHTML = linhasTabela.map(item => {
        const isEntrada = item.tipo === 'entrada';
        return `
            <tr class="hover:bg-[#F5F0E8]/40 transition">
                <td class="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">${item.dataFmt}</td>
                <td class="px-6 py-4 text-xs font-extrabold text-slate-900">${item.descricao}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${isEntrada ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#8E2638]/10 text-[#8E2638] border border-[#8E2638]/25'}">
                        <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        ${isEntrada ? 'Entrada' : 'Saída'}
                    </span>
                </td>
                <td class="px-6 py-4 text-xs font-black text-right whitespace-nowrap ${isEntrada ? 'text-emerald-700' : 'text-[#8E2638]'}">
                    ${isEntrada ? '+' : '-'} R$ ${item.valor.toFixed(2).replace('.', ',')}
                </td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    ${item.podeApagar ? `
                        <button onclick="apagarMovimentacaoCaixa('${item.id}')" type="button" title="Apagar lançamento manual" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-1.5 rounded-lg hover:bg-[#8E2638]/10 transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : `
                        <span class="text-[10px] font-bold text-slate-400 italic">Automático</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

export async function adicionarMovimentacaoCaixa(event) {
    event.preventDefault();
    const tipo = document.getElementById('nova-mov-tipo').value;
    const desc = document.getElementById('nova-mov-desc').value.trim();
    const valor = parseFloat(document.getElementById('nova-mov-valor').value) || 0;
    const btn = document.getElementById('btn-registrar-mov');

    if (!desc || valor <= 0) return;
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('caixa').insert([{
        tipo,
        descricao: desc,
        valor
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Lançamento Registado!", `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de R$ ${valor.toFixed(2).replace('.', ',')} adicionada ao caixa.`);
        document.getElementById('nova-mov-desc').value = '';
        document.getElementById('nova-mov-valor').value = '';
        carregarFluxoCaixa();
    } else {
        alert("Erro ao registar movimentação no caixa.");
    }
}

export async function apagarMovimentacaoCaixa(id) {
    if (confirm("Deseja remover este lançamento manual do fluxo de caixa?")) {
        const { error } = await supabase.from('caixa').delete().eq('id', id);
        if (!error) {
            mostrarToast("Lançamento Removido", "O registo foi apagado do caixa.");
            carregarFluxoCaixa();
        }
    }
}

export async function carregarBaseDadosGeral() {
    const divGiras = document.getElementById('admin-lista-giras');
    const divAvisos = document.getElementById('admin-lista-avisos');
    const divFilhos = document.getElementById('admin-lista-filhos');

    const [resGiras, resAvisos, resFilhos] = await Promise.all([
        supabase.from('giras').select('*').gte('data', dataHoje).order('data', { ascending: true }),
        supabase.from('avisos').select('*').gte('data_expiracao', dataHoje).order('data_publicacao', { ascending: false }),
        supabase.from('filhos').select('*').order('nome', { ascending: true })
    ]);

    const giras = resGiras.data || [];
    const avisos = resAvisos.data || [];
    const filhos = resFilhos.data || [];

    if (divGiras) {
        divGiras.innerHTML = giras.length === 0
            ? `<p class="text-xs text-slate-400 italic py-2">Nenhuma gira futura agendada.</p>`
            : giras.map(g => {
                const dataBr = g.data.split('-').reverse().join('/');
                return `
                    <div class="flex items-center justify-between p-3 bg-[#F5F0E8]/70 border border-[#8E2638]/15 rounded-xl text-xs">
                        <div>
                            <span class="font-extrabold text-slate-900">${g.linha_trabalho}</span>
                            <span class="text-slate-500 font-semibold ml-2">&bull; ${dataBr}</span>
                        </div>
                        <button onclick="removerGiraBase('${g.id}')" type="button" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-1 rounded-lg hover:bg-[#8E2638]/10 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
            }).join('');
    }

    if (divAvisos) {
        divAvisos.innerHTML = avisos.length === 0
            ? `<p class="text-xs text-slate-400 italic py-2">Nenhum aviso ativo.</p>`
            : avisos.map(a => `
                <div class="flex items-center justify-between p-3 bg-[#F5F0E8]/70 border border-[#8E2638]/15 rounded-xl text-xs">
                    <div>
                        <span class="font-extrabold text-slate-900">${a.titulo}</span>
                        <span class="text-slate-500 font-semibold ml-2">&bull; Válido até ${a.data_expiracao.split('-').reverse().join('/')}</span>
                    </div>
                    <button onclick="removerAvisoBase('${a.id}')" type="button" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-1 rounded-lg hover:bg-[#8E2638]/10 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `).join('');
    }

    if (divFilhos) {
        divFilhos.innerHTML = filhos.length === 0
            ? `<p class="text-xs text-slate-400 italic py-2">Nenhum integrante registado.</p>`
            : filhos.map(f => `
                <div class="flex items-center justify-between p-3 bg-[#F5F0E8]/70 border border-[#8E2638]/15 rounded-xl text-xs">
                    <div>
                        <span class="font-extrabold text-slate-900 capitalize">${f.nome}</span>
                        <span class="text-[10px] font-bold uppercase ml-2 px-2 py-0.5 rounded-full ${f.is_admin ? 'bg-[#8E2638] text-white' : 'bg-[#A9D8E8]/40 text-[#1e4e5f]'}">
                            ${f.is_admin ? 'Admin' : 'Filho'}
                        </span>
                    </div>
                    <button onclick="removerFilhoBase('${f.id}', '${f.nome.replace(/'/g, "\\'")}')" type="button" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-1 rounded-lg hover:bg-[#8E2638]/10 transition">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </div>
            `).join('');
    }
}

export async function removerGiraBase(id) {
    if (confirm("Deseja remover esta gira da base de dados?")) {
        await supabase.from('giras').delete().eq('id', id);
        mostrarToast("Gira Removida", "O agendamento foi retirado.");
        carregarBaseDadosGeral();
    }
}

export async function removerAvisoBase(id) {
    if (confirm("Deseja remover este aviso da base de dados?")) {
        await supabase.from('avisos').delete().eq('id', id);
        mostrarToast("Aviso Removido", "O comunicado foi retirado.");
        carregarBaseDadosGeral();
    }
}

export async function removerFilhoBase(id, nome) {
    if (confirm(`Deseja desligar ${nome} da corrente?`)) {
        await supabase.from('mensalidades').delete().eq('filho_id', id);
        await supabase.from('debitos_extras').delete().eq('filho_id', id);
        await supabase.from('filhos').delete().eq('id', id);
        mostrarToast("Integrante Removido", `${nome} foi retirado da corrente.`);
        carregarBaseDadosGeral();
    }
}

async function atualizarBadgesMenuAdmin() {
    const [resOracao, resDoacoes, resComps] = await Promise.all([
        supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
        supabase.from('doacoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
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

supabase.channel('admin-caixa-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'caixa' }, () => carregarFluxoCaixa())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensalidades' }, () => carregarFluxoCaixa())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'doacoes' }, () => {
        carregarFluxoCaixa();
        atualizarBadgesMenuAdmin();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_oracao' }, () => atualizarBadgesMenuAdmin())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comprovantes' }, () => atualizarBadgesMenuAdmin())
    .subscribe();

Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    adicionarMovimentacaoCaixa,
    apagarMovimentacaoCaixa,
    removerGiraBase,
    removerAvisoBase,
    removerFilhoBase
});

if (adminAtivo) {
    carregarFluxoCaixa();
    carregarBaseDadosGeral();
    atualizarBadgesMenuAdmin();
}