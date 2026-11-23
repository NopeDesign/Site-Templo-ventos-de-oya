import { 
    supabase, state, dataHoje, exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

// Verifica se o utilizador está autenticado (permite Filho e Admin)
const usuarioAtivo = exigirSessao(false);
let modoVisaoAtual = (usuarioAtivo && usuarioAtivo.is_admin) ? 'admin' : 'filho';

let doutrinaCacheLocal = [];
let tipoDoutrinaSelecionado = 'TODOS';

// =========================================================================
// 1. CONFIGURAÇÃO VISUAL POR CARGO (FILHO VS ADMIN)
// =========================================================================
function inicializarInterfacePorCargo() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secFilho = document.getElementById('filho-aba-doutrina');
    const secAdmin = document.getElementById('form-doutrina');
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
            if (labelAlternar) labelAlternar.innerText = 'Caderno do Filho';
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

export function alternarModoVisaoDoutrina() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;
    modoVisaoAtual = modoVisaoAtual === 'admin' ? 'filho' : 'admin';
    inicializarInterfacePorCargo();
    renderizarTudoDoutrina();
}

// =========================================================================
// 2. CARREGAR ACERVO DE PONTOS E DOUTRINA DO SUPABASE
// =========================================================================
export async function carregarDoutrina() {
    const { data } = await supabase
        .from('pontos_doutrina')
        .select('*')
        .order('created_at', { ascending: false });

    doutrinaCacheLocal = data || [];
    renderizarTudoDoutrina();
}

function renderizarTudoDoutrina() {
    filtrarDoutrinaFilho();
    if (state.usuarioLogado && state.usuarioLogado.is_admin) {
        renderizarListaDoutrinaAdmin(doutrinaCacheLocal);
    }
}

// =========================================================================
// 3. FILTROS INTERATIVOS E RENDERIZAÇÃO NA VISÃO DO FILHO
// =========================================================================
export function selecionarTipoDoutrina(tipo) {
    tipoDoutrinaSelecionado = tipo;

    const mapaBotoes = {
        'TODOS': 'tab-tipo-TODOS',
        'Ponto Cantado': 'tab-tipo-Ponto',
        'Reza / Prece': 'tab-tipo-Reza',
        'Regra / Doutrina': 'tab-tipo-Regra'
    };

    Object.entries(mapaBotoes).forEach(([chave, idBtn]) => {
        const btn = document.getElementById(idBtn);
        if (!btn) return;
        btn.className = (chave === tipo) ? 'filtro-doutrina-ativo' : 'filtro-doutrina-inativo';
    });

    filtrarDoutrinaFilho();
}

export function filtrarDoutrinaFilho() {
    const container = document.getElementById('container-doutrina-filho');
    if (!container) return;

    const termoBusca = (document.getElementById('filtro-doutrina-busca')?.value || '').toLowerCase().trim();
    const linhaFiltro = document.getElementById('filtro-doutrina-linha')?.value || 'TODAS';

    const filtrados = doutrinaCacheLocal.filter(item => {
        const bateLinha = linhaFiltro === 'TODAS' || (item.linha && item.linha.toLowerCase() === linhaFiltro.toLowerCase());
        const bateTipo = tipoDoutrinaSelecionado === 'TODOS' || (item.tipo && item.tipo.toLowerCase() === tipoDoutrinaSelecionado.toLowerCase());
        const textoTotal = `${item.titulo || ''} ${item.linha || ''} ${item.letra || ''} ${item.tipo || ''}`.toLowerCase();
        const bateBusca = !termoBusca || textoTotal.includes(termoBusca);

        return bateLinha && bateTipo && bateBusca;
    });

    if (filtrados.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 bg-[#F5F0E8]/60 p-10 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <i class="fa-solid fa-drum text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhum ponto, reza ou fundamento encontrado com estes filtros.</p>
                <p class="text-xs text-slate-500 mt-1">Experimente limpar o campo de pesquisa ou selecionar "Todas as Linhas".</p>
            </div>`;
        return;
    }

    container.innerHTML = filtrados.map(item => criarCardDoutrinaHtml(item, false)).join('');
}

// Extrai o ID do YouTube caso o link seja do YouTube para embutir o player direto no card
function extrairYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function renderizarBlocoMidia(midiaUrl) {
    if (!midiaUrl) return '';
    const ytId = extrairYoutubeId(midiaUrl);

    if (ytId) {
        return `
            <div class="mt-3 rounded-2xl overflow-hidden border border-[#8E2638]/20 shadow-sm bg-black aspect-video">
                <iframe 
                    class="w-full h-full"
                    src="https://www.youtube.com/embed/${ytId}" 
                    title="Ponto Cantado" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
        `;
    }

    if (midiaUrl.match(/\.(mp3|wav|ogg|m4a)(\?.*)?$/i)) {
        return `
            <div class="mt-3 bg-[#F5F0E8] p-3 rounded-2xl border border-[#8E2638]/20">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#8E2638] block mb-1.5">
                    <i class="fa-solid fa-headphones mr-1"></i> Áudio de Estudo da Curimba:
                </span>
                <audio controls class="w-full h-9">
                    <source src="${midiaUrl}">
                    O seu navegador não suporta o elemento de áudio.
                </audio>
            </div>
        `;
    }

    return `
        <div class="mt-3">
            <a href="${midiaUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-[#8E2638]/10 hover:bg-[#8E2638] text-[#8E2638] hover:text-white border border-[#8E2638]/25 text-xs font-extrabold px-4 py-2.5 rounded-xl transition">
                <i class="fa-solid fa-circle-play"></i>
                <span>Ouvir Mídia Externa / Referência</span>
            </a>
        </div>
    `;
}

function obterEstiloTipoDoutrina(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('reza') || t.includes('prece')) {
        return {
            barra: 'bg-amber-600',
            badge: 'bg-amber-50 text-amber-900 border border-amber-200',
            icone: 'fa-hands-praying'
        };
    }
    if (t.includes('regra') || t.includes('doutrina')) {
        return {
            barra: 'bg-[#2b677a]',
            badge: 'bg-[#A9D8E8]/45 text-[#1e4e5f] border border-[#2b677a]/25',
            icone: 'fa-scale-balanced'
        };
    }
    return {
        barra: 'bg-[#8E2638]',
        badge: 'bg-[#8E2638] text-white',
        icone: 'fa-drum'
    };
}

function criarCardDoutrinaHtml(item, isAdminCard = false) {
    const est = obterEstiloTipoDoutrina(item.tipo);

    return `
        <article class="card-doutrina-editorial space-y-4">
            <div class="barra-topo-card ${est.barra}"></div>

            <div class="space-y-3">
                <!-- Etiquetas Superiores -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#F5F0E8] text-[#8E2638] border border-[#8E2638]/20 px-3 py-1 rounded-full">
                        <i class="fa-solid fa-bookmark text-[9px]"></i> ${item.linha || 'Geral'}
                    </span>

                    <div class="flex items-center gap-1.5">
                        <span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${est.badge}">
                            <i class="fa-solid ${est.icone}"></i> ${item.tipo || 'Ponto Cantado'}
                        </span>
                        ${isAdminCard ? `
                            <button onclick="apagarDoutrina('${item.id}')" type="button" title="Apagar registo" class="text-slate-400 hover:text-[#8E2638] w-7 h-7 rounded-lg hover:bg-[#8E2638]/10 flex items-center justify-center transition">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Título -->
                <h4 class="text-lg font-extrabold text-slate-900 leading-snug">${item.titulo}</h4>

                <!-- Letra do Ponto ou Texto da Doutrina -->
                <div class="bloco-letra-ponto">${item.letra}</div>

                <!-- Player Integrado (YouTube ou MP3) -->
                ${renderizarBlocoMidia(item.midia_url)}
            </div>
        </article>
    `;
}

// =========================================================================
// 4. GESTÃO DO ADMIN: SALVAR, APAGAR E POPULAR PONTOS E REGRAS BASE
// =========================================================================
function renderizarListaDoutrinaAdmin(lista) {
    const containerAdmin = document.getElementById('lista-doutrina-admin');
    if (!containerAdmin) return;

    if (lista.length === 0) {
        containerAdmin.innerHTML = `
            <div class="col-span-2 pro-card p-10 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-book-open text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-sm font-bold text-slate-700">Nenhum ponto ou regra publicado ainda</p>
                <p class="text-xs text-slate-500 mt-1">Clique em "Inserir Pontos & Regras Base" acima para carregar o acervo inicial da casa.</p>
            </div>`;
        return;
    }

    containerAdmin.innerHTML = lista.map(item => criarCardDoutrinaHtml(item, true)).join('');
}

export async function salvarDoutrina(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-doutrina');
    if (btn) btn.disabled = true;

    const novoItem = {
        tipo: document.getElementById('doutrina-tipo').value,
        linha: document.getElementById('doutrina-linha').value.trim(),
        titulo: document.getElementById('doutrina-titulo').value.trim(),
        midia_url: document.getElementById('doutrina-midia').value.trim() || null,
        letra: document.getElementById('doutrina-letra').value.trim()
    };

    const { error } = await supabase.from('pontos_doutrina').insert([novoItem]);
    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Publicado no Caderno!", `"${novoItem.titulo}" já está disponível para estudo dos filhos.`);
        document.getElementById('form-doutrina').querySelector('form').reset();
        carregarDoutrina();
    } else {
        alert("Erro ao publicar no Caderno de Pontos & Doutrina.");
    }
}

export async function apagarDoutrina(id) {
    if (confirm("Deseja remover este item do Caderno de Pontos & Doutrina?")) {
        const { error } = await supabase.from('pontos_doutrina').delete().eq('id', id);
        if (!error) {
            mostrarToast("Item Removido", "O registo foi retirado do caderno.");
            carregarDoutrina();
        }
    }
}

export async function popularDoutrinaPadrao() {
    if (!confirm("Deseja inserir os Pontos Cantados de Abertura, Saudação a Oyá e Regras de Conduta base no sistema?")) return;

    const acervoInicial = [
        {
            tipo: "Ponto Cantado",
            linha: "Abertura / Defumação",
            titulo: "Defuma com as Ervas da Jurema",
            midia_url: null,
            letra: "Defuma com as ervas da Jurema\nDefuma com arruda e guiné\nAlecrins, benjoim e alfazema\nVamos defumar filhos de fé!"
        },
        {
            tipo: "Ponto Cantado",
            linha: "Oyá / Iansã",
            titulo: "Eparrey Oyá — Rainha dos Ventos",
            midia_url: null,
            letra: "Oyá é moça rica, ela é filha de Pai Xangô\nIansã venceu demanda com seu cálice e seu tambor\nEparrey, Eparrey Oyá!\nDona dos ventos, venha nos abençoar!"
        },
        {
            tipo: "Ponto Cantado",
            linha: "Caboclos",
            titulo: "Saudação ao Caboclo Pena Branca",
            midia_url: null,
            letra: "Seu Pena Branca a sua banda chama\nSeu Pena Branca a sua aldeia clama\nEle é caboclo, ele é flecheiro\nVem trazer paz e firmeza no terreiro!\nOke Caboclo!"
        },
        {
            tipo: "Ponto Cantado",
            linha: "Pretos Velhos",
            titulo: "Firmeza de Mãe Benedita",
            midia_url: null,
            letra: "Lá vem Vovó descendo a serra com sua sacola\nCom seu rosário, com seu patuá, ela vem de Angola\nEu quero ver, Vovó, eu quero ver\nEu quero ver se filho de Pemba tem querer!\nAdorei as Almas!"
        },
        {
            tipo: "Regra / Doutrina",
            linha: "Regras & Conduta",
            titulo: "Preceito de 24h e Postura no Terreiro",
            midia_url: null,
            letra: "1. Respeitar o preceito de 24 horas antes da gira: abstinência de carne vermelha, bebidas alcoólicas e relações sexuais.\n2. Chegar com antecedência para o banho de ervas, troca de roupa branca limpa e concentração no Congá.\n3. Manter o silêncio e a elevação de pensamento dentro do espaço sagrado.\n4. O telemóvel deve permanecer desligado ou no modo silencioso durante todo o trabalho espiritual."
        }
    ];

    const { error } = await supabase.from('pontos_doutrina').insert(acervoInicial);
    if (!error) {
        mostrarToast("Acervo Base Inserido!", "Os pontos e regras iniciais foram publicados com sucesso.");
        carregarDoutrina();
    } else {
        alert("Erro ao inserir o acervo base de doutrina.");
    }
}

// =========================================================================
// 5. BADGES COMPLEMENTARES E ATUALIZAÇÃO EM TEMPO REAL
// =========================================================================
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

supabase.channel('pontos-doutrina-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pontos_doutrina' }, () => carregarDoutrina())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    alternarModoVisaoDoutrina,
    filtrarDoutrinaFilho,
    selecionarTipoDoutrina,
    salvarDoutrina,
    apagarDoutrina,
    popularDoutrinaPadrao
});

if (usuarioAtivo) {
    inicializarInterfacePorCargo();
    carregarDoutrina();
    atualizarBadgesComplementares();
}