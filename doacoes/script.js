import { 
    supabase, state, dataHoje, FINANCEIRO_CONFIG, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

const usuarioAtivo = exigirSessao(false);
let modoVisaoAtual = (usuarioAtivo && usuarioAtivo.is_admin) ? 'admin' : 'filho';

let campanhasCacheLocal = [];
let doacoesCacheLocal = [];

function inicializarInterfacePorCargo() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secFilho = document.getElementById('filho-aba-doacoes');
    const secAdmin = document.getElementById('form-doacoes');
    const btnAlternar = document.getElementById('btn-alternar-visao');
    const labelAlternar = document.getElementById('label-alternar-visao');
    const subtituloCargo = document.getElementById('header-subtitulo-cargo');

    const elPix = document.getElementById('pix-chave-doacao');
    if (elPix) elPix.innerText = FINANCEIRO_CONFIG.chavePix;

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

export function alternarModoVisaoDoacoes() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;
    modoVisaoAtual = modoVisaoAtual === 'admin' ? 'filho' : 'admin';
    inicializarInterfacePorCargo();
    carregarModuloDoacoes();
}

export function copiarChavePix() {
    navigator.clipboard.writeText(FINANCEIRO_CONFIG.chavePix).then(() => {
        mostrarToast("Chave PIX Copiada!", `Chave copiada: ${FINANCEIRO_CONFIG.chavePix}`);
    });
}

export async function carregarModuloDoacoes() {
    if (!state.usuarioLogado) return;

    const [resCampanhas, resDoacoes] = await Promise.all([
        supabase.from('campanhas_doacao').select('*').order('created_at', { ascending: false }),
        supabase.from('doacoes').select('*').order('created_at', { ascending: false })
    ]);

    campanhasCacheLocal = resCampanhas.data || [];
    doacoesCacheLocal = resDoacoes.data || [];

    const pendentesCount = doacoesCacheLocal.filter(d => d.status === 'pendente').length;
    const badgeDoacoes = document.getElementById('badge-doacoes-admin');
    if (badgeDoacoes) {
        badgeDoacoes.innerText = pendentesCount;
        badgeDoacoes.classList.toggle('hidden', pendentesCount === 0);
    }

    popularSelectCampanhasFilho(campanhasCacheLocal);
    renderizarHistoricoFilho(doacoesCacheLocal);
    renderizarCampanhasFilho(campanhasCacheLocal);

    if (state.usuarioLogado.is_admin) {
        renderizarDoacoesRecebidasAdmin(doacoesCacheLocal);
        renderizarCampanhasAdmin(campanhasCacheLocal);
    }
}

export function alternarCamposTipoDoacaoFilho() {
    const tipo = document.getElementById('doacao-filho-tipo').value;
    const labelValor = document.getElementById('label-doacao-valor-qtd');
    const inputValor = document.getElementById('doacao-filho-valor');
    const boxComprovante = document.getElementById('box-comprovante-doacao-filho');

    if (tipo === 'material') {
        if (labelValor) labelValor.innerText = 'Quantidade de Itens:';
        if (inputValor) {
            inputValor.step = '1';
            inputValor.placeholder = 'Ex: 2';
        }
        if (boxComprovante) boxComprovante.classList.add('hidden');
    } else {
        if (labelValor) labelValor.innerText = 'Valor Doado (R$):';
        if (inputValor) {
            inputValor.step = '0.01';
            inputValor.placeholder = 'Ex: 50,00';
        }
        if (boxComprovante) boxComprovante.classList.remove('hidden');
    }
}

function popularSelectCampanhasFilho(campanhas) {
    const select = document.getElementById('doacao-filho-campanha');
    if (!select) return;

    const valorAtual = select.value;
    let html = `<option value="">🌟 Doação Livre (Manutenção do Templo)</option>`;
    campanhas.forEach(c => {
        html += `<option value="${c.id}">🎯 ${c.titulo}</option>`;
    });
    select.innerHTML = html;
    if (valorAtual) select.value = valorAtual;
}

export async function registrarDoacaoFilho(event) {
    event.preventDefault();
    if (!state.usuarioLogado) return;

    const campanhaId = document.getElementById('doacao-filho-campanha').value || null;
    const tipo = document.getElementById('doacao-filho-tipo').value;
    const valorNum = parseFloat(document.getElementById('doacao-filho-valor').value) || 0;
    const desc = document.getElementById('doacao-filho-desc').value.trim();
    const inputFile = document.getElementById('doacao-filho-arquivo');
    const btn = document.getElementById('btn-enviar-doacao-filho');

    const campanhaObj = campanhasCacheLocal.find(c => String(c.id) === String(campanhaId));
    const campanhaTitulo = campanhaObj ? campanhaObj.titulo : 'Manutenção Geral do Templo';

    const enviarParaBanco = async (base64Data = null, fileType = null) => {
        if (btn) btn.disabled = true;

        const { error } = await supabase.from('doacoes').insert([{
            filho_id: state.usuarioLogado.id,
            doador_nome: state.usuarioLogado.nome,
            campanha_id: campanhaId,
            campanha_titulo: campanhaTitulo,
            tipo_doacao: tipo,
            valor: tipo === 'pix' ? valorNum : 0,
            quantidade_itens: tipo === 'material' ? Math.round(valorNum) : 0,
            descricao_item: desc,
            comprovante_base64: base64Data,
            comprovante_tipo: fileType,
            status: 'pendente'
        }]);

        if (btn) btn.disabled = false;

        if (!error) {
            mostrarToast("Doação Registada!", "Que Oyá e os Guias da casa abençoem a sua generosidade!");
            document.getElementById('form-doacao-filho').reset();
            alternarCamposTipoDoacaoFilho();
            carregarModuloDoacoes();
        } else {
            alert("Erro ao registar a sua doação.");
        }
    };

    if (tipo === 'pix' && inputFile && inputFile.files && inputFile.files.length > 0) {
        const file = inputFile.files[0];
        if (file.size > 6 * 1024 * 1024) {
            alert("O ficheiro é muito grande! Escolha uma imagem ou PDF de até 6MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => enviarParaBanco(e.target.result, file.type);
        reader.readAsDataURL(file);
    } else {
        await enviarParaBanco(null, null);
    }
}

function renderizarHistoricoFilho(todasDoacoes) {
    const container = document.getElementById('lista-minhas-doacoes-filho');
    if (!container || !state.usuarioLogado) return;

    const minhas = todasDoacoes.filter(d => String(d.filho_id) === String(state.usuarioLogado.id));

    if (minhas.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Nenhuma doação registada ainda.</p>`;
        return;
    }

    container.innerHTML = minhas.map(d => {
        const isConfirmada = d.status === 'confirmada';
        const valorFormatado = d.tipo_doacao === 'pix'
            ? `R$ ${Number(d.valor || 0).toFixed(2).replace('.', ',')}`
            : `${d.quantidade_itens || 0} un.`;

        return `
            <div class="flex items-center justify-between p-3 rounded-xl border ${isConfirmada ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#F5F0E8]/70 border-[#8E2638]/15'} text-xs gap-2">
                <div class="min-w-0">
                    <p class="font-extrabold text-slate-900 truncate">${d.descricao_item}</p>
                    <p class="text-[10px] font-semibold text-slate-500 truncate">${d.campanha_titulo || 'Doação Livre'} &bull; <strong>${valorFormatado}</strong></p>
                </div>
                <span class="shrink-0 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${isConfirmada ? 'bg-emerald-700 text-white' : 'bg-[#A9D8E8]/50 text-[#1e4e5f]'}">
                    ${isConfirmada ? 'Confirmada' : 'Em Análise'}
                </span>
            </div>
        `;
    }).join('');
}

function renderizarCampanhasFilho(campanhas) {
    const container = document.getElementById('container-campanhas-doacao-filho');
    if (!container) return;

    if (campanhas.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 bg-[#F5F0E8]/60 p-8 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <p class="text-xs text-slate-500 font-medium">Nenhuma campanha específica ativa no momento. Você pode realizar doações livres acima.</p>
            </div>`;
        return;
    }

    container.innerHTML = campanhas.map(c => criarCardCampanhaHtml(c, false)).join('');
}

function criarCardCampanhaHtml(c, isAdmin = false) {
    const meta = Number(c.meta_total || 1);
    const atual = Number(c.arrecadado_atual || 0);
    const pct = Math.min(100, Math.round((atual / meta) * 100));
    const isValor = c.tipo_meta === 'valor';

    const labelAtual = isValor ? `R$ ${atual.toFixed(2).replace('.', ',')}` : `${atual} itens`;
    const labelMeta = isValor ? `R$ ${meta.toFixed(2).replace('.', ',')}` : `${meta} itens`;

    return `
        <div class="bg-[#F5F0E8]/70 border border-[#8E2638]/15 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div>
                <div class="flex items-start justify-between gap-2">
                    <span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-white text-[#8E2638] border border-[#8E2638]/20 px-2.5 py-0.5 rounded-full">
                        <i class="fa-solid ${isValor ? 'fa-coins' : 'fa-box-open'}"></i> ${isValor ? 'Meta Financeira' : 'Meta de Itens'}
                    </span>
                    ${isAdmin ? `
                        <button onclick="apagarCampanhaAdmin('${c.id}')" type="button" title="Encerrar/Apagar Campanha" class="text-slate-400 hover:text-[#8E2638] w-7 h-7 rounded-lg hover:bg-[#8E2638]/10 flex items-center justify-center transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : ''}
                </div>
                <h4 class="text-base font-extrabold text-slate-900 mt-2">${c.titulo}</h4>
                ${c.descricao ? `<p class="text-xs text-slate-600 font-medium mt-1 leading-relaxed">${c.descricao}</p>` : ''}
            </div>

            <div class="bg-white p-3.5 rounded-xl border border-[#8E2638]/10 space-y-2">
                <div class="flex justify-between items-center text-xs font-extrabold">
                    <span class="text-[#8E2638]">Arrecadado: ${labelAtual}</span>
                    <span class="text-slate-500">Meta: ${labelMeta} (${pct}%)</span>
                </div>
                <div class="barra-progresso-trilho">
                    <div class="barra-progresso-preenchimento" style="width: ${pct}%"></div>
                </div>
            </div>
        </div>
    `;
}

function renderizarDoacoesRecebidasAdmin(doacoes) {
    const container = document.getElementById('lista-doacoes-admin');
    if (!container) return;

    if (doacoes.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Nenhum registo de doação enviado pelos filhos ainda.</p>`;
        return;
    }

    container.innerHTML = doacoes.map(d => {
        const isConfirmada = d.status === 'confirmada';
        const valorFmt = d.tipo_doacao === 'pix'
            ? `R$ ${Number(d.valor || 0).toFixed(2).replace('.', ',')}`
            : `${d.quantidade_itens || 0} un.`;

        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border ${isConfirmada ? 'bg-white border-slate-200/80' : 'bg-[#F5F0E8] border-[#8E2638]/30 shadow-sm'} gap-4">
                <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-extrabold text-sm text-slate-900 capitalize">${d.doador_nome}</span>
                        <span class="bg-[#8E2638] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">${valorFmt}</span>
                        <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${isConfirmada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                            ${isConfirmada ? 'Confirmada' : 'Pendente'}
                        </span>
                    </div>
                    <p class="text-xs font-bold text-slate-700">${d.descricao_item}</p>
                    <p class="text-[11px] font-semibold text-[#2b677a]">
                        <i class="fa-solid fa-bullseye mr-1"></i>Destino: ${d.campanha_titulo || 'Manutenção Geral do Templo'}
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2 shrink-0">
                    ${d.comprovante_base64 ? `
                        <button onclick="abrirModalComprovanteDoacao('${d.id}')" type="button" class="bg-white hover:bg-[#A9D8E8]/30 text-slate-700 border border-[#8E2638]/20 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5">
                            <i class="fa-regular fa-eye text-[#8E2638]"></i> Ver Comprovante
                        </button>
                    ` : ''}
                    ${!isConfirmada ? `
                        <button onclick="confirmarDoacaoAdmin('${d.id}')" type="button" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-check"></i> Confirmar Recebimento
                        </button>
                    ` : ''}
                    <button onclick="apagarDoacaoAdmin('${d.id}')" type="button" title="Apagar registo" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-2 rounded-xl hover:bg-[#8E2638]/10 transition">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarCampanhasAdmin(campanhas) {
    const container = document.getElementById('lista-campanhas-admin');
    if (!container) return;

    if (campanhas.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center col-span-2">Nenhuma campanha criada ainda.</p>`;
        return;
    }

    container.innerHTML = campanhas.map(c => criarCardCampanhaHtml(c, true)).join('');
}

export async function confirmarDoacaoAdmin(doacaoId) {
    const doacao = doacoesCacheLocal.find(d => String(d.id) === String(doacaoId));
    if (!doacao) return;

    const { error } = await supabase
        .from('doacoes')
        .update({ status: 'confirmada' })
        .eq('id', doacaoId);

    if (error) {
        alert("Erro ao confirmar doação.");
        return;
    }

    if (doacao.campanha_id) {
        const camp = campanhasCacheLocal.find(c => String(c.id) === String(doacao.campanha_id));
        if (camp) {
            const incremento = camp.tipo_meta === 'valor' ? Number(doacao.valor || 0) : Number(doacao.quantidade_itens || 0);
            const novoTotal = Number(camp.arrecadado_atual || 0) + incremento;
            await supabase
                .from('campanhas_doacao')
                .update({ arrecadado_atual: novoTotal })
                .eq('id', camp.id);
        }
    }

    mostrarToast("Doação Confirmada!", `A doação de ${doacao.doador_nome} foi validada com sucesso.`);
    carregarModuloDoacoes();
}

export async function apagarDoacaoAdmin(doacaoId) {
    if (confirm("Deseja remover este registo de doação?")) {
        const { error } = await supabase.from('doacoes').delete().eq('id', doacaoId);
        if (!error) {
            mostrarToast("Registo Removido", "A doação foi apagada da lista.");
            carregarModuloDoacoes();
        }
    }
}

export async function criarCampanhaDoacaoAdmin(event) {
    event.preventDefault();
    const titulo = document.getElementById('campanha-titulo').value.trim();
    const tipoMeta = document.getElementById('campanha-tipo').value;
    const metaValor = parseFloat(document.getElementById('campanha-meta').value) || 1;
    const desc = document.getElementById('campanha-desc').value.trim();
    const btn = document.getElementById('btn-criar-campanha');

    if (btn) btn.disabled = true;

    const { error } = await supabase.from('campanhas_doacao').insert([{
        titulo,
        tipo_meta: tipoMeta,
        meta_total: metaValor,
        arrecadado_atual: 0,
        descricao: desc || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Campanha Publicada!", `A campanha "${titulo}" já está visível para toda a corrente.`);
        document.getElementById('campanha-titulo').value = '';
        document.getElementById('campanha-meta').value = '';
        document.getElementById('campanha-desc').value = '';
        carregarModuloDoacoes();
    } else {
        alert("Erro ao criar campanha de arrecadação.");
    }
}

export async function apagarCampanhaAdmin(id) {
    if (confirm("Deseja encerrar e remover esta campanha de arrecadação?")) {
        const { error } = await supabase.from('campanhas_doacao').delete().eq('id', id);
        if (!error) {
            mostrarToast("Campanha Encerrada", "A campanha foi removida do mural.");
            carregarModuloDoacoes();
        }
    }
}

export function abrirModalComprovanteDoacao(doacaoId) {
    const doacao = doacoesCacheLocal.find(d => String(d.id) === String(doacaoId));
    if (!doacao || !doacao.comprovante_base64) return;

    document.getElementById('modal-comp-titulo').innerText = `Doação: ${doacao.doador_nome}`;
    document.getElementById('modal-comp-subtitulo').innerText = `${doacao.descricao_item} (R$ ${Number(doacao.valor || 0).toFixed(2).replace('.', ',')})`;

    const corpo = document.getElementById('modal-comp-corpo');
    if ((doacao.comprovante_tipo || '').includes('pdf')) {
        corpo.innerHTML = `<iframe src="${doacao.comprovante_base64}" class="w-full h-[500px] rounded-xl border border-slate-300"></iframe>`;
    } else {
        corpo.innerHTML = `<img src="${doacao.comprovante_base64}" alt="Comprovante" class="max-h-[70vh] w-auto object-contain rounded-2xl shadow-md">`;
    }

    document.getElementById('modal-comprovante').classList.remove('hidden');
}

export function fecharModalComprovante() {
    document.getElementById('modal-comprovante').classList.add('hidden');
}

async function atualizarBadgesComplementares() {
    if (!state.usuarioLogado) return;

    if (state.usuarioLogado.is_admin) {
        const [resOracao, resComps] = await Promise.all([
            supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
            supabase.from('comprovantes').select('id', { count: 'exact', head: true })
        ]);

        const elOracao = document.getElementById('badge-oracao-admin');
        if (elOracao) {
            elOracao.innerText = resOracao.count || 0;
            elOracao.classList.toggle('hidden', !(resOracao.count > 0));
        }

        const elComps = document.getElementById('badge-comprovantes-menu');
        if (elComps) {
            elComps.innerText = resComps.count || 0;
            elComps.classList.toggle('hidden', !(resComps.count > 0));
        }
    } else {
        const [resFestas, resItens] = await Promise.all([
            supabase.from('festas').select('id').gte('data_festa', dataHoje),
            supabase.from('festa_itens').select('id, festa_id, filho_id')
        ]);
        const idsFestas = (resFestas.data || []).map(f => f.id);
        const disponiveis = (resItens.data || []).filter(i => idsFestas.includes(i.festa_id) && !i.filho_id);
        const badgeFestas = document.getElementById('badge-festas-filho');
        if (badgeFestas) {
            badgeFestas.innerText = disponiveis.length;
            badgeFestas.classList.toggle('hidden', disponiveis.length === 0);
        }
    }
}

supabase.channel('doacoes-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campanhas_doacao' }, () => carregarModuloDoacoes())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'doacoes' }, () => carregarModuloDoacoes())
    .subscribe();

Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    alternarModoVisaoDoacoes,
    copiarChavePix,
    alternarCamposTipoDoacaoFilho,
    registrarDoacaoFilho,
    confirmarDoacaoAdmin,
    apagarDoacaoAdmin,
    criarCampanhaDoacaoAdmin,
    apagarCampanhaAdmin,
    abrirModalComprovanteDoacao,
    fecharModalComprovante
});

if (usuarioAtivo) {
    inicializarInterfacePorCargo();
    carregarModuloDoacoes();
    atualizarBadgesComplementares();
}