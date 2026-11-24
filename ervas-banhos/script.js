import { 
    supabase, state, dataHoje, exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

const usuarioAtivo = exigirSessao(false);
let modoVisaoAtual = (usuarioAtivo && usuarioAtivo.is_admin) ? 'admin' : 'filho';

let ervasCacheLocal = [];
let objetivoErvaSelecionado = 'TODOS';

function limparTextoCampo(valor) {
    if (valor === null || valor === undefined) return '';
    const txt = String(valor).trim();
    if (!txt || txt.toLowerCase() === 'null' || txt.toLowerCase() === 'undefined') return '';
    return txt;
}

function inicializarInterfacePorCargo() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secFilho = document.getElementById('filho-aba-ervas');
    const secAdmin = document.getElementById('form-ervas');
    const btnAlternar = document.getElementById('btn-alternar-visao');
    const labelAlternar = document.getElementById('label-alternar-visao');
    const subtituloCargo = document.getElementById('header-subtitulo-cargo');

    if (isAdmin) {
        if (btnAlternar) btnAlternar.classList.remove('hidden');
        if (modoVisaoAtual === 'admin') {
            navAdmin?.classList.remove('hidden');
            navFilho?.classList.add('hidden');
            secAdmin?.classList.remove('hidden');
            secFilho?.classList.add('hidden');
            if (subtituloCargo) subtituloCargo.innerText = 'Direção Espiritual';
            if (labelAlternar) labelAlternar.innerText = 'Guia do Filho';
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

export function alternarModoVisaoErvas() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;
    modoVisaoAtual = modoVisaoAtual === 'admin' ? 'filho' : 'admin';
    inicializarInterfacePorCargo();
    renderizarTudoErvas();
}

export async function carregarErvasBanhos() {
    const { data, error } = await supabase
        .from('ervas_banhos')
        .select('*')
        .order('orixa', { ascending: true });

    if (error) {
        console.error('Erro ao carregar ervas_banhos:', error);
        mostrarToast('Erro ao Carregar', error.message || 'Falha ao consultar ervas.');
        return;
    }

    ervasCacheLocal = data || [];
    renderizarTudoErvas();
}

function renderizarTudoErvas() {
    filtrarErvasFilho();
    if (state.usuarioLogado && state.usuarioLogado.is_admin) {
        renderizarListaErvasAdmin(ervasCacheLocal);
    }
}

export function selecionarObjetivoErva(objetivo) {
    objetivoErvaSelecionado = objetivo;

    const mapaBotoes = {
        'TODOS': 'tab-erva-TODOS',
        'Descarrego': 'tab-erva-Descarrego',
        'Equilíbrio': 'tab-erva-Equilibrio',
        'Abertura de Caminhos': 'tab-erva-Abertura',
        'Calmante / Paz': 'tab-erva-Calmante'
    };

    Object.entries(mapaBotoes).forEach(([chave, idBtn]) => {
        const btn = document.getElementById(idBtn);
        if (!btn) return;
        btn.className = (chave === objetivo) ? 'filtro-objetivo-ativo' : 'filtro-objetivo-inativo';
    });

    filtrarErvasFilho();
}

export function filtrarErvasFilho() {
    const container = document.getElementById('container-ervas-filho');
    if (!container) return;

    const termoBusca = (document.getElementById('filtro-ervas-busca')?.value || '').toLowerCase().trim();
    const orixaFiltro = document.getElementById('filtro-ervas-orixa')?.value || 'TODOS';

    const filtradas = ervasCacheLocal.filter(item => {
        const preparoTexto = limparTextoCampo(item.ervas_preparo) || limparTextoCampo(item.preparo);
        const bateOrixa = orixaFiltro === 'TODOS' || (item.orixa && item.orixa.toLowerCase() === orixaFiltro.toLowerCase());
        const bateObjetivo = objetivoErvaSelecionado === 'TODOS' || (item.objetivo && item.objetivo.toLowerCase() === objetivoErvaSelecionado.toLowerCase());
        const textoCompleto = `${item.nome || ''} ${item.orixa || ''} ${preparoTexto} ${item.objetivo || ''}`.toLowerCase();
        const bateBusca = !termoBusca || textoCompleto.includes(termoBusca);

        return bateOrixa && bateObjetivo && bateBusca;
    });

    if (filtradas.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 bg-[#F5F0E8]/60 p-10 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <i class="fa-solid fa-leaf text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhum banho ou erva encontrado com estes filtros.</p>
                <p class="text-xs text-slate-500 mt-1">Experimente limpar o campo de pesquisa ou selecionar "Todos os Orixás".</p>
            </div>`;
        return;
    }

    container.innerHTML = filtradas.map(erva => criarCardErvaHtml(erva, false)).join('');
}

function obterEstiloClassificacao(classificacao) {
    const c = (classificacao || '').toLowerCase();
    if (c.includes('quente')) {
        return {
            barra: 'bg-[#8E2638]',
            badgeTemp: 'bg-[#8E2638] text-white',
            iconeTemp: 'fa-fire',
            labelTemp: 'Erva Quente (Agressiva)'
        };
    }
    if (c.includes('fria')) {
        return {
            barra: 'bg-[#2b677a]',
            badgeTemp: 'bg-[#A9D8E8]/55 text-[#1e4e5f] border border-[#2b677a]/25',
            iconeTemp: 'fa-snowflake',
            labelTemp: 'Erva Fria (Específica)'
        };
    }
    return {
        barra: 'bg-emerald-700',
        badgeTemp: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
        iconeTemp: 'fa-seedling',
        labelTemp: 'Erva Morna (Equilibradora)'
    };
}

function criarCardErvaHtml(erva, isAdminCard = false) {
    const est = obterEstiloClassificacao(erva.classificacao);
    const isPescocoAbaixo = (erva.modo_uso || '').toLowerCase().includes('pescoço');
    const preparoTexto = limparTextoCampo(erva.ervas_preparo) || limparTextoCampo(erva.preparo) || 'Modo de preparo não informado.';
    const evitarTexto = limparTextoCampo(erva.cuidados_evitar) || limparTextoCampo(erva.evitar);

    return `
        <article class="card-erva-editorial space-y-4">
            <div class="barra-topo-card ${est.barra}"></div>

            <div class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#F5F0E8] text-[#8E2638] border border-[#8E2638]/20 px-3 py-1 rounded-full">
                        <i class="fa-solid fa-crown text-[9px]"></i> ${erva.orixa || 'Uso Geral'}
                    </span>

                    <div class="flex items-center gap-1.5">
                        <span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${est.badgeTemp}">
                            <i class="fa-solid ${est.iconeTemp}"></i> ${erva.classificacao || 'Morna'}
                        </span>
                        ${isAdminCard ? `
                            <button onclick="apagarErvaBanho('${erva.id}')" type="button" title="Apagar este banho" class="text-slate-400 hover:text-[#8E2638] w-7 h-7 rounded-lg hover:bg-[#8E2638]/10 flex items-center justify-center transition">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div>
                    <h4 class="text-lg font-extrabold text-slate-900 leading-snug">${erva.nome}</h4>
                    <p class="text-[11px] font-bold text-[#2b677a] uppercase tracking-wider mt-0.5">
                        Finalidade: ${erva.objetivo || 'Equilíbrio'}
                    </p>
                </div>

                <div class="bg-[#F5F0E8]/70 p-3.5 rounded-2xl border border-[#8E2638]/12 text-xs text-slate-700 leading-relaxed">
                    <strong class="text-[10px] font-extrabold uppercase tracking-wider text-[#8E2638] block mb-1">
                        <i class="fa-solid fa-mortar-pestle mr-1"></i>Ervas &amp; Modo de Preparo:
                    </strong>
                    ${preparoTexto}
                </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-slate-100">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-slate-500">Regra de Uso:</span>
                    <span class="font-extrabold ${isPescocoAbaixo ? 'text-[#8E2638]' : 'text-emerald-800'} flex items-center gap-1">
                        <i class="fa-solid ${isPescocoAbaixo ? 'fa-shower' : 'fa-user-check'}"></i>
                        ${erva.modo_uso || 'Do pescoço para baixo'}
                    </span>
                </div>

                ${evitarTexto ? `
                    <div class="bg-[#8E2638]/5 border border-[#8E2638]/20 rounded-xl p-2.5 text-[11px] text-[#8E2638] font-semibold flex items-start gap-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
                        <span><strong>Atenção:</strong> ${evitarTexto}</span>
                    </div>
                ` : ''}
            </div>
        </article>
    `;
}

function renderizarListaErvasAdmin(lista) {
    const containerAdmin = document.getElementById('lista-ervas-admin');
    if (!containerAdmin) return;

    if (lista.length === 0) {
        containerAdmin.innerHTML = `
            <div class="col-span-2 pro-card p-10 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-seedling text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhum banho cadastrado ainda</p>
                <p class="text-xs text-slate-500 mt-1">Clique em "Inserir Guia Base de Ervas" no topo para carregar automaticamente os banhos tradicionais da casa.</p>
            </div>`;
        return;
    }

    containerAdmin.innerHTML = lista.map(erva => criarCardErvaHtml(erva, true)).join('');
}

export async function salvarErvaBanho(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-erva');
    if (btn) btn.disabled = true;

    const preparoVal = limparTextoCampo(document.getElementById('erva-preparo').value);
    const evitarVal = limparTextoCampo(document.getElementById('erva-evitar').value) || null;

    if (!preparoVal) {
        if (btn) btn.disabled = false;
        mostrarToast("Campo Obrigatório", "Preencha as ervas e o modo de preparo antes de salvar.");
        return;
    }

    const novoRegisto = {
        nome: document.getElementById('erva-nome').value.trim(),
        orixa: document.getElementById('erva-orixa').value.trim(),
        objetivo: document.getElementById('erva-objetivo').value,
        classificacao: document.getElementById('erva-classificacao').value,
        modo_uso: document.getElementById('erva-modo-uso').value,
        ervas_preparo: preparoVal,
        cuidados_evitar: evitarVal
    };

    const { error } = await supabase.from('ervas_banhos').insert([novoRegisto]);
    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Banho Publicado!", `"${novoRegisto.nome}" foi adicionado ao Guia de Ervas da corrente.`);
        document.getElementById('form-ervas').querySelector('form').reset();
        carregarErvasBanhos();
    } else {
        console.error('Erro ao salvar banho:', error);
        mostrarToast("Erro ao Salvar Banho", error.message || "Verifique as colunas e permissões da tabela ervas_banhos.");
    }
}

export async function apagarErvaBanho(id) {
    if (confirm("Deseja remover este banho/erva do guia?")) {
        const { error } = await supabase.from('ervas_banhos').delete().eq('id', id);
        if (!error) {
            mostrarToast("Registo Removido", "O banho foi retirado do guia.");
            carregarErvasBanhos();
        } else {
            console.error('Erro ao apagar banho:', error);
            mostrarToast("Erro ao Remover", error.message || "Não foi possível remover o banho.");
        }
    }
}

export async function popularErvasPadrao() {
    if (!confirm("Deseja inserir o Guia Base de Ervas e Banhos tradicionais no sistema?")) return;

    const guiaBase = [
        {
            nome: "Banho de Força e Movimento de Oyá",
            orixa: "Oyá / Iansã",
            objetivo: "Abertura de Caminhos",
            classificacao: "Morna",
            modo_uso: "Do pescoço para baixo",
            ervas_preparo: "Macerar folhas frescas de Bambu, Espada de Santa Bárbara e pétalas de Rosa Vermelha ou Coral em água morna. Coar após o banho de higiene.",
            cuidados_evitar: "Não jogar na coroa sem autorização direta da mãe/pai de santo. Filhos de Oxum devem substituir a Espada por Folha de Pitanga."
        },
        {
            nome: "Banho de Paz e Alinhamento de Oxalá",
            orixa: "Oxalá",
            objetivo: "Calmante / Paz",
            classificacao: "Fria",
            modo_uso: "Coroa liberada (Cabeça aos pés)",
            ervas_preparo: "Quinchar folhas frescas de Boldo (Tapete de Oxalá), Manjericão Branco e pétalas de Rosa Branca em água mineral fria ou levemente morna.",
            cuidados_evitar: "Evitar fazer este banho em dias de gira de Exu sem orientação prévia."
        },
        {
            nome: "Banho de Harmonia e Serenidade das Águas",
            orixa: "Iemanjá",
            objetivo: "Equilíbrio",
            classificacao: "Morna",
            modo_uso: "Coroa liberada (Cabeça aos pés)",
            ervas_preparo: "Infusão leve ou maceração de Alfazema, Colônia, Manjericão e Rosas Brancas. Excelente para acalmar o emocional e limpar a aura.",
            cuidados_evitar: "Nenhuma contraindicação geral; respeitar apenas eventuais alergias de pele."
        },
        {
            nome: "Descarrego Forte de Quebra-Demanda",
            orixa: "Exu & Pombagira",
            objetivo: "Descarrego",
            classificacao: "Quente",
            modo_uso: "Do pescoço para baixo",
            ervas_preparo: "Ferver água, desligar o lume e abafar folhas de Arruda, Guiné, Aroeira e Casca de Alho. Coar e jogar estritamente do pescoço para baixo.",
            cuidados_evitar: "PROIBIDO jogar na cabeça (coroa). Após um banho quente de Aroeira, tome no dia seguinte um banho morno de Manjericão ou Alecrim para repor a energia."
        },
        {
            nome: "Banho de Limpeza e Sabedoria dos Pretos Velhos",
            orixa: "Pretos Velhos",
            objetivo: "Descarrego",
            classificacao: "Morna",
            modo_uso: "Do pescoço para baixo",
            ervas_preparo: "Infusão de Alecrim, Arruda, Guiné e Alfazema. Limpa larvas astrais mantendo o equilíbrio magnético do médium antes da gira.",
            cuidados_evitar: "Sempre do pescoço para baixo por conter Arruda e Guiné."
        },
        {
            nome: "Banho de Prosperidade e Doçura de Oxum",
            orixa: "Oxum",
            objetivo: "Abertura de Caminhos",
            classificacao: "Morna",
            modo_uso: "Do pescoço para baixo",
            ervas_preparo: "Infusão de Camomila, Erva-Doce, Calêndula e pétalas de Rosa Amarela.",
            cuidados_evitar: "Não utilizar ervas agressivas na mesma preparação."
        },
        {
            nome: "Banho de Firmeza e Corte de Ogum",
            orixa: "Ogum",
            objetivo: "Equilíbrio",
            classificacao: "Morna",
            modo_uso: "Do pescoço para baixo",
            ervas_preparo: "Macerar folhas de Abre-Caminho, Levante e Peregum Verde em água morna.",
            cuidados_evitar: "Jogar apenas dos ombros para baixo."
        }
    ];

    const { error } = await supabase.from('ervas_banhos').insert(guiaBase);
    if (!error) {
        mostrarToast("Guia Base Inserido!", "Os banhos tradicionais foram adicionados com sucesso.");
        carregarErvasBanhos();
    } else {
        console.error('Erro ao inserir guia base:', error);
        mostrarToast("Erro ao Inserir Guia Base", error.message || "Falha ao inserir banhos padrão.");
    }
}

async function atualizarBadgesComplementares() {
    if (!state.usuarioLogado) return;

    if (state.usuarioLogado.is_admin) {
        const [resOracao, resDoacoes, resComps] = await Promise.all([
            supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
            supabase.from('doacoes_registros').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
            supabase.from('comprovantes').select('id', { count: 'exact', head: true })
        ]);

        const setBadge = (id, count) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerText = count || 0;
            el.classList.toggle('hidden', !(count > 0));
        };

        setBadge('badge-oracao-admin', resOracao.count);
        setBadge('badge-doacoes-admin', resDoacoes.count);
        setBadge('badge-comprovantes-menu', resComps.count);
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

supabase.channel('ervas-banhos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ervas_banhos' }, () => carregarErvasBanhos())
    .subscribe();

Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    alternarModoVisaoErvas,
    filtrarErvasFilho,
    selecionarObjetivoErva,
    salvarErvaBanho,
    apagarErvaBanho,
    popularErvasPadrao
});

if (usuarioAtivo) {
    inicializarInterfacePorCargo();
    carregarErvasBanhos();
    atualizarBadgesComplementares();
}