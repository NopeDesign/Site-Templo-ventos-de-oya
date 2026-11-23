import { 
    supabase, state, dataHoje, exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

// Verifica se o utilizador está autenticado (permite Filho e Admin)
const usuarioAtivo = exigirSessao(false);
let modoVisaoAtual = (usuarioAtivo && usuarioAtivo.is_admin) ? 'admin' : 'filho';

// =========================================================================
// 1. CONFIGURAÇÃO VISUAL POR CARGO (FILHO VS ADMIN)
// =========================================================================
function inicializarInterfacePorCargo() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secFilho = document.getElementById('filho-aba-oracao');
    const secAdmin = document.getElementById('form-oracao');
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
            if (labelAlternar) labelAlternar.innerText = 'Meus Pedidos (Filho)';
        } else {
            navFilho?.classList.remove('hidden');
            navAdmin?.classList.add('hidden');
            secFilho?.classList.remove('hidden');
            secAdmin?.classList.add('hidden');
            if (subtituloCargo) subtituloCargo.innerText = 'Portal da Corrente';
            if (labelAlternar) labelAlternar.innerText = 'Livro do Congá (Admin)';
        }
    } else {
        navFilho?.classList.remove('hidden');
        navAdmin?.classList.add('hidden');
        secFilho?.classList.remove('hidden');
        secAdmin?.classList.add('hidden');
        if (subtituloCargo) subtituloCargo.innerText = 'Portal da Corrente';
    }
}

export function alternarModoVisaoIrradiacao() {
    if (!state.usuarioLogado || !state.usuarioLogado.is_admin) return;
    modoVisaoAtual = modoVisaoAtual === 'admin' ? 'filho' : 'admin';
    inicializarInterfacePorCargo();
    carregarPedidosOracao();
}

// =========================================================================
// 2. CARREGAR PEDIDOS DE ORAÇÃO (FILHO E LIVRO DO CONGÁ ADMIN)
// =========================================================================
export async function carregarPedidosOracao() {
    if (!state.usuarioLogado) return;

    const { data, error } = await supabase
        .from('pedidos_oracao')
        .select('*')
        .order('created_at', { ascending: false });

    const todosPedidos = data || [];

    // Atualiza o badge de contagem no menu Admin
    const badgeOracao = document.getElementById('badge-oracao-admin');
    if (badgeOracao) {
        if (todosPedidos.length > 0) {
            badgeOracao.innerText = todosPedidos.length;
            badgeOracao.classList.remove('hidden');
        } else {
            badgeOracao.classList.add('hidden');
        }
    }

    // 1. Renderizar lista pessoal do Filho logado
    renderizarMeusPedidosFilho(todosPedidos);

    // 2. Renderizar Livro de Irradiação agrupado para o Admin ler no Congá
    if (state.usuarioLogado.is_admin) {
        renderizarLivroCongaAdmin(todosPedidos);
    }
}

function renderizarMeusPedidosFilho(todosPedidos) {
    const containerFilho = document.getElementById('lista-meus-pedidos-oracao');
    if (!containerFilho || !state.usuarioLogado) return;

    const meusPedidos = todosPedidos.filter(p => String(p.filho_id) === String(state.usuarioLogado.id));

    if (meusPedidos.length === 0) {
        containerFilho.innerHTML = `
            <div class="bg-[#F5F0E8]/70 p-6 rounded-2xl border border-dashed border-[#8E2638]/20 text-center">
                <i class="fa-solid fa-hands-praying text-2xl text-[#8E2638]/40 mb-2"></i>
                <p class="text-xs text-slate-500 font-medium">Você ainda não adicionou nenhum nome para a próxima gira.</p>
            </div>`;
        return;
    }

    containerFilho.innerHTML = meusPedidos.map(p => {
        const estiloCat = obterEstiloCategoria(p.categoria);
        return `
            <div class="card-nome-conga flex items-start justify-between gap-3">
                <div class="space-y-1">
                    <span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${estiloCat.badge}">
                        <i class="fa-solid ${estiloCat.icone}"></i> ${p.categoria}
                    </span>
                    <h4 class="text-sm font-black text-slate-900 capitalize pt-0.5">${p.nome_irradiado}</h4>
                    ${p.motivo ? `<p class="text-xs text-slate-600 font-medium leading-relaxed"><strong class="text-[#8E2638]">Motivo:</strong> ${p.motivo}</p>` : ''}
                </div>
                <button onclick="apagarPedidoOracao('${p.id}')" type="button" title="Retirar nome" class="text-slate-400 hover:text-[#8E2638] w-8 h-8 rounded-xl hover:bg-[#8E2638]/10 flex items-center justify-center transition shrink-0">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
}

function renderizarLivroCongaAdmin(todosPedidos) {
    const containerAdmin = document.getElementById('lista-oracao-admin');
    if (!containerAdmin) return;

    if (todosPedidos.length === 0) {
        containerAdmin.innerHTML = `
            <div class="pro-card p-12 text-center bg-[#F5F0E8]/50 border border-dashed border-[#8E2638]/20">
                <i class="fa-solid fa-dove text-3xl text-[#8E2638]/40 mb-3"></i>
                <h4 class="text-base font-extrabold text-slate-800">A Caixa de Irradiação está vazia</h4>
                <p class="text-xs text-slate-500 mt-1">Nenhum nome foi enviado ainda para a prece desta semana.</p>
            </div>`;
        return;
    }

    const categoriasOrdem = [
        "Saúde Física / Recuperação",
        "Equilíbrio Espiritual / Emocional",
        "Harmonia Familiar / Abertura",
        "Desencarnado (Luz e Encaminhamento)"
    ];

    // Inclui eventuais categorias personalizadas caso existam no banco
    todosPedidos.forEach(p => {
        if (p.categoria && !categoriasOrdem.includes(p.categoria)) {
            categoriasOrdem.push(p.categoria);
        }
    });

    let htmlGrupos = '';

    categoriasOrdem.forEach(cat => {
        const itensDaCategoria = todosPedidos.filter(p => p.categoria === cat);
        if (itensDaCategoria.length === 0) return;

        const estilo = obterEstiloCategoria(cat);

        htmlGrupos += `
            <div class="pro-card p-6 sm:p-8 relative overflow-hidden">
                <div class="barra-topo-card ${estilo.barra}"></div>
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-[#8E2638]/10 pb-4">
                    <div class="flex items-center gap-3">
                        <div class="${estilo.iconeBox}">
                            <i class="fa-solid ${estilo.icone} text-base"></i>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8E2638] block">Corrente de Preces</span>
                            <h4 class="text-lg sm:text-xl font-extrabold text-slate-900">${cat}</h4>
                        </div>
                    </div>
                    <span class="text-xs font-extrabold px-3 py-1 rounded-full w-fit ${estilo.badge}">
                        ${itensDaCategoria.length} ${itensDaCategoria.length === 1 ? 'Nome' : 'Nomes'}
                    </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${itensDaCategoria.map(item => `
                        <div class="card-nome-conga flex items-start justify-between gap-3 bg-[#F5F0E8]/40">
                            <div class="space-y-1">
                                <p class="text-base sm:text-lg font-black text-slate-900 capitalize leading-snug">
                                    ${item.nome_irradiado}
                                </p>
                                ${item.motivo ? `
                                    <p class="text-xs sm:text-sm text-slate-700 font-semibold bg-white px-3 py-1.5 rounded-xl border border-[#8E2638]/15 mt-1">
                                        <span class="text-[#8E2638] font-extrabold">Motivo:</span> ${item.motivo}
                                    </p>
                                ` : ''}
                                <p class="text-[11px] font-bold text-slate-400 pt-1">
                                    <i class="fa-regular fa-user mr-1 text-[#8E2638]/70"></i>Pedido por: <span class="text-slate-600 capitalize">${item.filho_nome || 'Direção'}</span>
                                </p>
                            </div>
                            <button onclick="apagarPedidoOracao('${item.id}')" type="button" title="Remover nome" class="text-slate-400 hover:text-[#8E2638] w-8 h-8 rounded-xl hover:bg-[#8E2638]/10 flex items-center justify-center transition shrink-0 no-print">
                                <i class="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    containerAdmin.innerHTML = htmlGrupos;
}

function obterEstiloCategoria(categoria) {
    const c = (categoria || '').toLowerCase();
    if (c.includes('saúde') || c.includes('saude')) {
        return {
            icone: 'fa-heart-pulse',
            iconeBox: 'icone-editorial-grena',
            barra: 'bg-[#8E2638]',
            badge: 'bg-[#8E2638]/10 text-[#8E2638] border border-[#8E2638]/25'
        };
    }
    if (c.includes('desencarnado')) {
        return {
            icone: 'fa-star-of-life',
            iconeBox: 'icone-editorial-azul',
            barra: 'bg-[#A9D8E8]',
            badge: 'bg-[#A9D8E8]/40 text-[#1e4e5f] border border-[#A9D8E8]'
        };
    }
    if (c.includes('harmonia') || c.includes('caminhos')) {
        return {
            icone: 'fa-house-chimney-heart',
            iconeBox: 'icone-editorial-grena',
            barra: 'bg-[#8E2638]',
            badge: 'bg-[#F5F0E8] text-[#8E2638] border border-[#8E2638]/25'
        };
    }
    return {
        icone: 'fa-dove',
        iconeBox: 'icone-editorial-azul',
        barra: 'bg-[#A9D8E8]',
        badge: 'bg-[#A9D8E8]/35 text-[#1e4e5f] border border-[#A9D8E8]'
    };
}

// =========================================================================
// 3. SALVAR E APAGAR PEDIDOS DE ORAÇÃO (FILHO & ADMIN)
// =========================================================================
export async function salvarPedidoOracaoFilho(event) {
    event.preventDefault();
    if (!state.usuarioLogado) return;

    const nomeIrradiado = document.getElementById('oracao-nome-irradiado').value.trim();
    const categoria = document.getElementById('oracao-categoria').value;
    const motivo = document.getElementById('oracao-motivo').value.trim();
    const btn = document.getElementById('btn-salvar-oracao-filho');

    if (!nomeIrradiado) return;
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('pedidos_oracao').insert([{
        filho_id: state.usuarioLogado.id,
        filho_nome: state.usuarioLogado.nome,
        nome_irradiado: nomeIrradiado,
        categoria: categoria,
        motivo: motivo || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Nome Incluído na Irradiação!", `${nomeIrradiado} foi adicionado(a) ao Livro de Preces da próxima gira.`);
        document.getElementById('form-pedido-oracao').reset();
        carregarPedidosOracao();
    } else {
        alert("Erro ao enviar o nome para a corrente de oração.");
    }
}

export async function salvarPedidoOracaoAdmin(event) {
    event.preventDefault();
    if (!state.usuarioLogado) return;

    const nomeIrradiado = document.getElementById('admin-oracao-nome').value.trim();
    const categoria = document.getElementById('admin-oracao-categoria').value;
    const motivo = document.getElementById('admin-oracao-motivo').value.trim();
    const btn = document.getElementById('btn-salvar-oracao-admin');

    if (!nomeIrradiado) return;
    if (btn) btn.disabled = true;

    const { error } = await supabase.from('pedidos_oracao').insert([{
        filho_id: state.usuarioLogado.id,
        filho_nome: `${state.usuarioLogado.nome.split(' ')[0]} (Direção)`,
        nome_irradiado: nomeIrradiado,
        categoria: categoria,
        motivo: motivo || null
    }]);

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Nome Adicionado!", `${nomeIrradiado} foi incluído(a) no Livro do Congá.`);
        document.getElementById('admin-oracao-nome').value = '';
        document.getElementById('admin-oracao-motivo').value = '';
        carregarPedidosOracao();
    } else {
        alert("Erro ao incluir nome na lista de irradiação.");
    }
}

export async function apagarPedidoOracao(id) {
    if (confirm("Deseja retirar este nome da lista de irradiação?")) {
        const { error } = await supabase.from('pedidos_oracao').delete().eq('id', id);
        if (!error) {
            mostrarToast("Nome Retirado", "O registo foi removido da lista de preces.");
            carregarPedidosOracao();
        }
    }
}

export async function limparTodosPedidosOracaoAdmin() {
    if (confirm("Deseja limpar todos os nomes da Caixa de Irradiação após o término da gira?")) {
        const { error } = await supabase.from('pedidos_oracao').delete().not('id', 'is', null);
        if (!error) {
            mostrarToast("Caixa de Irradiação Limpa!", "O Livro de Preces está pronto para os pedidos da próxima semana.");
            carregarPedidosOracao();
        } else {
            alert("Erro ao limpar a caixa de irradiação.");
        }
    }
}

// =========================================================================
// 4. BADGES COMPLEMENTARES E ATUALIZAÇÃO EM TEMPO REAL
// =========================================================================
async function atualizarBadgesComplementares() {
    if (!state.usuarioLogado) return;

    if (state.usuarioLogado.is_admin) {
        const [resDoacoes, resComps] = await Promise.all([
            supabase.from('doacoes_registros').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
            supabase.from('comprovantes').select('id', { count: 'exact', head: true })
        ]);

        const elDoacoes = document.getElementById('badge-doacoes-admin');
        if (elDoacoes) {
            elDoacoes.innerText = resDoacoes.count || 0;
            elDoacoes.classList.toggle('hidden', !(resDoacoes.count > 0));
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

supabase.channel('ponto-irradiacao-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_oracao' }, () => carregarPedidosOracao())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    alternarModoVisaoIrradiacao,
    salvarPedidoOracaoFilho,
    salvarPedidoOracaoAdmin,
    apagarPedidoOracao,
    limparTodosPedidosOracaoAdmin
});

if (usuarioAtivo) {
    inicializarInterfacePorCargo();
    carregarPedidosOracao();
    atualizarBadgesComplementares();
}