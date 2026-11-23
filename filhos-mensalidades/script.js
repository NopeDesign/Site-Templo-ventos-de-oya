import { 
    supabase, dataHoje, mesesNomesCompletos, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

// Garante que apenas administradores acedam a esta pasta
const adminAtivo = exigirSessao(true);

let filhosCacheLocal = [];
let comprovantesCacheLocal = [];
let mensalidadesCacheLocal = [];
let debitosCacheLocal = [];
let filhoIdSendoEditado = null;

const inputIngresso = document.getElementById('novo-filho-data');
if (inputIngresso) inputIngresso.value = dataHoje;

// =========================================================================
// 1. CARREGAMENTO GERAL DE FILHOS, COMPROVANTES E MENSALIDADES
// =========================================================================
export async function carregarGestaoFilhosMensalidades() {
    const [resFilhos, resComps, resMens, resDebs] = await Promise.all([
        supabase.from('filhos').select('*').order('nome', { ascending: true }),
        supabase.from('comprovantes').select('*').order('created_at', { ascending: false }),
        supabase.from('mensalidades').select('*'),
        supabase.from('debitos_extras').select('*')
    ]);

    filhosCacheLocal = resFilhos.data || [];
    comprovantesCacheLocal = resComps.data || [];
    mensalidadesCacheLocal = resMens.data || [];
    debitosCacheLocal = resDebs.data || [];

    // Atualiza badges do menu
    const badgeComps = document.getElementById('badge-comprovantes-menu');
    if (badgeComps) {
        badgeComps.innerText = comprovantesCacheLocal.length;
        badgeComps.classList.toggle('hidden', comprovantesCacheLocal.length === 0);
    }

    renderizarRadarAniversariantesAdmin(filhosCacheLocal);
    renderizarComprovantesAdmin(comprovantesCacheLocal);
    renderizarListaFilhosAdmin(filhosCacheLocal, mensalidadesCacheLocal, debitosCacheLocal);
}

// =========================================================================
// 2. RADAR DE ANIVERSARIANTES (VIDA E TEMPO DE CORRENTE) NO ADMIN
// =========================================================================
function renderizarRadarAniversariantesAdmin(filhos) {
    const container = document.getElementById('admin-radar-aniversariantes');
    if (!container) return;

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();
    const anoAtual = hoje.getFullYear();

    const anivVida = filhos
        .filter(f => f.data_nascimento && parseInt(f.data_nascimento.split('-')[1]) === mesAtual)
        .map(f => {
            const [ano, mes, dia] = f.data_nascimento.split('-').map(Number);
            return { nome: f.nome, dia, mes, isHoje: dia === diaAtual };
        })
        .sort((a, b) => a.dia - b.dia);

    const anivTerreiro = filhos
        .filter(f => f.data_entrada && parseInt(f.data_entrada.split('-')[1]) === mesAtual)
        .map(f => {
            const [ano, mes, dia] = f.data_entrada.split('-').map(Number);
            const anos = anoAtual - ano;
            return { nome: f.nome, dia, mes, anos, isHoje: dia === diaAtual };
        })
        .filter(item => item.anos >= 1)
        .sort((a, b) => a.dia - b.dia);

    const htmlVida = anivVida.length === 0
        ? `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum aniversariante de vida neste mês.</p>`
        : anivVida.map(a => `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${a.isHoje ? 'bg-[#8E2638]/10 border-[#8E2638]/40 shadow-sm' : 'bg-white border-slate-200/80'} text-xs">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${a.isHoje ? 'bg-[#8E2638] text-white' : 'bg-[#F5F0E8] text-[#8E2638]'} font-black flex items-center justify-center shrink-0">
                        ${a.dia.toString().padStart(2, '0')}
                    </span>
                    <span class="font-bold text-slate-800 capitalize">${a.nome}</span>
                </div>
                ${a.isHoje ? `<span class="bg-[#8E2638] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-bounce">🎉 É Hoje!</span>` : `<span class="font-bold text-slate-400">Dia ${a.dia.toString().padStart(2, '0')}/${a.mes.toString().padStart(2, '0')}</span>`}
            </div>
        `).join('');

    const htmlTerreiro = anivTerreiro.length === 0
        ? `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum aniversário de corrente neste mês.</p>`
        : anivTerreiro.map(t => `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${t.isHoje ? 'bg-[#A9D8E8]/35 border-[#2b677a]/40 shadow-sm' : 'bg-white border-slate-200/80'} text-xs">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg ${t.isHoje ? 'bg-[#2b677a] text-white' : 'bg-[#A9D8E8]/30 text-[#1e4e5f]'} font-black flex items-center justify-center shrink-0">
                        ${t.dia.toString().padStart(2, '0')}
                    </span>
                    <div>
                        <p class="font-bold text-slate-800 capitalize leading-tight">${t.nome}</p>
                        <p class="text-[10px] font-semibold text-[#2b677a]">${t.anos} ${t.anos === 1 ? 'ano de casa' : 'anos de casa'}</p>
                    </div>
                </div>
                ${t.isHoje ? `<span class="bg-[#2b677a] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">🕊️ Hoje!</span>` : `<span class="bg-[#A9D8E8]/40 text-[#1e4e5f] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg">${t.anos} ${t.anos === 1 ? 'Ano' : 'Anos'}</span>`}
            </div>
        `).join('');

    container.innerHTML = `
        <div class="bg-[#F5F0E8]/60 p-4 rounded-2xl border border-[#8E2638]/15 space-y-2.5">
            <h4 class="text-xs font-extrabold text-[#8E2638] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-cake-candles"></i> Aniversários de Vida (${mesesNomesCompletos[mesAtual-1]})
            </h4>
            <div class="space-y-2 max-h-[190px] overflow-y-auto custom-scroll pr-1">${htmlVida}</div>
        </div>
        <div class="bg-[#F5F0E8]/60 p-4 rounded-2xl border border-[#8E2638]/15 space-y-2.5">
            <h4 class="text-xs font-extrabold text-[#2b677a] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <i class="fa-solid fa-dove"></i> Aniversários de Corrente (${mesesNomesCompletos[mesAtual-1]})
            </h4>
            <div class="space-y-2 max-h-[190px] overflow-y-auto custom-scroll pr-1">${htmlTerreiro}</div>
        </div>
    `;
}

// =========================================================================
// 3. CAIXA DE ENTRADA DE COMPROVANTES ENVIADOS PELOS FILHOS
// =========================================================================
function renderizarComprovantesAdmin(comps) {
    const container = document.getElementById('lista-comprovantes-admin');
    if (!container) return;

    if (comps.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-3 text-center">Nenhum comprovante pendente no momento.</p>`;
        return;
    }

    container.innerHTML = comps.map(c => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-teal-200 rounded-2xl shadow-sm gap-3">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="font-extrabold text-sm text-slate-900 capitalize">${c.filho_nome}</span>
                    <span class="bg-teal-700 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">${c.valor_pendente || 'PIX'}</span>
                </div>
                <p class="text-xs font-bold text-slate-700"><i class="fa-solid fa-file-invoice text-teal-600 mr-1.5"></i>${c.observacao}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button onclick="abrirModalComprovante('${c.id}')" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5">
                    <i class="fa-regular fa-eye text-teal-600"></i> Ver
                </button>
                <button onclick="baixarComprovanteAdmin('${c.id}', '${c.filho_id}', '${c.observacao.replace(/'/g, "\\'")}')" type="button" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm">
                    <i class="fa-solid fa-check"></i> Dar Baixa na Ficha
                </button>
                <button onclick="apagarComprovanteAdmin('${c.id}')" type="button" title="Apagar comprovante" class="text-slate-400 hover:text-[#8E2638] px-2 py-2 rounded-xl hover:bg-[#8E2638]/10 transition">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

export async function baixarComprovanteAdmin(compId, filhoId, observacao) {
    // Tenta detetar o mês/ano no texto do comprovante (ex: "Janeiro", "Nov", etc.)
    const textoObs = observacao.toLowerCase();
    let mesAlvo = null;
    let anoAlvo = new Date().getFullYear();

    const mapaMeses = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
        'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6, 'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
    };

    for (const [nomeM, numM] of Object.entries(mapaMeses)) {
        if (textoObs.includes(nomeM)) {
            mesAlvo = numM;
            break;
        }
    }

    if (mesAlvo) {
        const mesStr = `${anoAlvo}-${mesAlvo.toString().padStart(2, '0')}`;
        await supabase.from('mensalidades').upsert({
            filho_id: filhoId,
            mes_ano: mesStr
        }, { onConflict: 'filho_id,mes_ano' });
    }

    await supabase.from('comprovantes').delete().eq('id', compId);
    mostrarToast("Baixa Efetuada!", "O comprovante foi validado e removido da caixa de entrada.");
    carregarGestaoFilhosMensalidades();
}

export async function apagarComprovanteAdmin(compId) {
    if (confirm("Deseja apagar este comprovante sem dar baixa?")) {
        await supabase.from('comprovantes').delete().eq('id', compId);
        carregarGestaoFilhosMensalidades();
    }
}

export function abrirModalComprovante(compId) {
    const comp = comprovantesCacheLocal.find(c => String(c.id) === String(compId));
    if (!comp || !comp.arquivo_base64) return;

    document.getElementById('modal-comp-titulo').innerText = `Comprovante: ${comp.filho_nome}`;
    document.getElementById('modal-comp-subtitulo').innerText = comp.observacao;

    const corpo = document.getElementById('modal-comp-corpo');
    if ((comp.arquivo_tipo || '').includes('pdf')) {
        corpo.innerHTML = `<iframe src="${comp.arquivo_base64}" class="w-full h-[500px] rounded-xl border border-slate-300"></iframe>`;
    } else {
        corpo.innerHTML = `<img src="${comp.arquivo_base64}" alt="Comprovante" class="max-h-[70vh] w-auto object-contain rounded-2xl shadow-md">`;
    }

    document.getElementById('modal-comprovante').classList.remove('hidden');
}

export function fecharModalComprovante() {
    document.getElementById('modal-comprovante').classList.add('hidden');
}

// =========================================================================
// 4. CORRENTE ATIVA E REGISTO DE NOVOS INTEGRANTES
// =========================================================================
export async function adicionarFilho(event) {
    event.preventDefault();
    const nome = document.getElementById('novo-filho-nome').value.trim();
    const nascimento = document.getElementById('novo-filho-nascimento').value || null;
    const entrada = document.getElementById('novo-filho-data').value;
    const senha = document.getElementById('novo-filho-senha').value.trim();
    const isAdmin = document.getElementById('novo-filho-admin').checked;

    const { error } = await supabase.from('filhos').insert([{
        nome: nome,
        data_nascimento: nascimento,
        data_entrada: entrada,
        senha: senha,
        is_admin: isAdmin
    }]);

    if (!error) {
        mostrarToast("Integrante Adicionado!", `${nome} foi registado na corrente.`);
        document.getElementById('novo-filho-nome').value = '';
        document.getElementById('novo-filho-nascimento').value = '';
        document.getElementById('novo-filho-senha').value = '';
        document.getElementById('novo-filho-admin').checked = false;
        if (inputIngresso) inputIngresso.value = dataHoje;
        carregarGestaoFilhosMensalidades();
    } else {
        alert("Erro ao adicionar filho à corrente.");
    }
}

function renderizarListaFilhosAdmin(filhos, mensalidades, debitos) {
    const container = document.getElementById('lista-filhos-limpa');
    if (!container) return;

    if (filhos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-6 text-center col-span-2">Nenhum filho registado.</p>`;
        return;
    }

    container.innerHTML = filhos.map(f => {
        const pagas = mensalidades.filter(m => String(m.filho_id) === String(f.id)).length;
        const exts = debitos.filter(d => String(d.filho_id) === String(f.id));
        const totalExtras = exts.reduce((acc, x) => acc + x.valor, 0);

        return `
            <article class="card-filho-admin space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${f.is_admin ? 'bg-[#8E2638] text-white' : 'bg-[#A9D8E8]/45 text-[#1e4e5f]'}">
                                ${f.is_admin ? 'Direção / Admin' : 'Médium / Filho'}
                            </span>
                        </div>
                        <h4 class="text-lg font-extrabold text-slate-900 capitalize">${f.nome}</h4>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="abrirFicha('${f.id}')" type="button" class="bg-[#8E2638] hover:bg-[#681927] text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5">
                            <i class="fa-solid fa-file-invoice-dollar"></i> Ficha Financeira
                        </button>
                        <button onclick="apagarFilhoAdmin('${f.id}', '${f.nome.replace(/'/g, "\\'")}')" type="button" title="Desligar/Apagar filho" class="text-slate-400 hover:text-[#8E2638] w-8 h-8 rounded-xl hover:bg-[#8E2638]/10 flex items-center justify-center transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 font-medium text-slate-600">
                    <div><strong>Mensalidades pagas:</strong> ${pagas} meses</div>
                    <div><strong>Extras lançados:</strong> R$ ${totalExtras.toFixed(2).replace('.', ',')}</div>
                </div>
            </article>
        `;
    }).join('');
}

export async function apagarFilhoAdmin(filhoId, filhoNome) {
    if (confirm(`Deseja realmente desligar e remover ${filhoNome} da corrente e apagar o seu histórico?`)) {
        await supabase.from('mensalidades').delete().eq('filho_id', filhoId);
        await supabase.from('debitos_extras').delete().eq('filho_id', filhoId);
        const { error } = await supabase.from('filhos').delete().eq('id', filhoId);

        if (!error) {
            mostrarToast("Integrante Desligado", `${filhoNome} foi removido da corrente.`);
            carregarGestaoFilhosMensalidades();
        } else {
            alert("Erro ao remover filho.");
        }
    }
}

// =========================================================================
// 5. MODAL DE FICHA FINANCEIRA INDIVIDUAL (ADMIN)
// =========================================================================
export async function abrirFicha(filhoId) {
    filhoIdSendoEditado = filhoId;
    const filho = filhosCacheLocal.find(f => String(f.id) === String(filhoId));
    if (!filho) return;

    document.getElementById('ficha-nome').innerText = filho.nome;
    document.getElementById('edit-filho-nascimento').value = filho.data_nascimento || '';
    document.getElementById('edit-filho-entrada').value = filho.data_entrada || dataHoje;

    const [resPagos, resExtras] = await Promise.all([
        supabase.from('mensalidades').select('*').eq('filho_id', filhoId),
        supabase.from('debitos_extras').select('*').eq('filho_id', filhoId)
    ]);

    const pagamentos = (resPagos.data || []).map(p => p.mes_ano);
    const extras = resExtras.data || [];

    const dataInicio = new Date(filho.data_entrada || filho.data_cadastro || dataHoje);
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
    while (cursorData <= dataLimite) {
        const isFuturo = cursorData > hojeData;
        mesesList.unshift({ ano: cursorData.getFullYear(), mes: cursorData.getMonth() + 1, isFuturo });
        cursorData.setMonth(cursorData.getMonth() + 1);
    }

    let htmlMeses = '';
    let qtdMesesDevidos = 0;
    let valorDevidoMeses = 0;

    mesesList.forEach(m => {
        let mesStr = `${m.ano}-${m.mes.toString().padStart(2, '0')}`;
        let isPago = pagamentos.includes(mesStr);

        if (!isPago && !m.isFuturo) {
            qtdMesesDevidos++;
            valorDevidoMeses += 100;
            htmlMeses += `
                <div class="flex justify-between items-center p-3 border border-[#8E2638]/25 bg-[#8E2638]/5 rounded-xl text-xs">
                    <div>
                        <span class="font-extrabold text-slate-900 block">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                        <span class="text-[10px] font-bold text-[#8E2638]">Pendente (R$ 100,00)</span>
                    </div>
                    <button onclick="marcarMensalidadePago('${filhoId}', '${mesStr}')" type="button" class="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm">
                        Marcar Pago
                    </button>
                </div>`;
        } else if (isPago) {
            const labelPago = m.isFuturo ? 'Adiantado' : 'Pago';
            htmlMeses += `
                <div class="flex justify-between items-center p-3 border border-slate-200/80 bg-[#F5F0E8]/40 rounded-xl text-xs">
                    <div>
                        <span class="font-extrabold text-slate-700 block">${mesesNomesCompletos[m.mes-1]} ${m.ano}</span>
                        <span class="text-[10px] font-extrabold text-emerald-700 uppercase">${labelPago}</span>
                    </div>
                    <button onclick="reverterMensalidadePago('${filhoId}', '${mesStr}')" type="button" class="text-slate-400 hover:text-[#8E2638] text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 transition">
                        Desfazer
                    </button>
                </div>`;
        }
    });

    document.getElementById('ficha-lista-meses').innerHTML = htmlMeses;

    let valorDevidoExtras = 0;
    const htmlExt = extras.map(e => {
        valorDevidoExtras += e.valor;
        return `
            <div class="flex justify-between items-center p-3 border border-[#8E2638]/20 bg-[#F5F0E8]/70 rounded-xl text-xs">
                <div>
                    <span class="font-bold text-slate-900 block">${e.descricao}</span>
                    <span class="text-[10px] font-extrabold text-[#8E2638]">R$ ${e.valor.toFixed(2).replace('.', ',')}</span>
                </div>
                <button onclick="reverterDebitoExtra('${e.id}', '${filhoId}')" type="button" class="text-slate-400 hover:text-[#8E2638] px-2.5 py-1 rounded-lg hover:bg-red-50 transition">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>`;
    }).join('');

    document.getElementById('ficha-lista-extras').innerHTML = htmlExt || `<p class="text-xs text-slate-400 italic py-2">Nenhum débito extra lançado.</p>`;

    const totalDevido = valorDevidoMeses + valorDevidoExtras;
    document.getElementById('ficha-divida-valor').innerText = `R$ ${totalDevido.toFixed(2).replace('.', ',')}`;
    document.getElementById('ficha-divida-meses').innerText = qtdMesesDevidos;
    document.getElementById('ficha-divida-extras').innerText = extras.length;

    document.getElementById('modal-ficha').classList.remove('hidden');
}

export function fecharFicha() {
    document.getElementById('modal-ficha').classList.add('hidden');
    filhoIdSendoEditado = null;
    carregarGestaoFilhosMensalidades();
}

export async function salvarDatasFilho() {
    if (!filhoIdSendoEditado) return;
    const nascimento = document.getElementById('edit-filho-nascimento').value || null;
    const entrada = document.getElementById('edit-filho-entrada').value || null;

    const { error } = await supabase
        .from('filhos')
        .update({ data_nascimento: nascimento, data_entrada: entrada })
        .eq('id', filhoIdSendoEditado);

    if (!error) {
        mostrarToast("Datas Atualizadas!", "As informações do integrante foram salvas.");
        // Atualiza cache local
        const f = filhosCacheLocal.find(x => String(x.id) === String(filhoIdSendoEditado));
        if (f) { f.data_nascimento = nascimento; f.data_entrada = entrada; }
        renderizarRadarAniversariantesAdmin(filhosCacheLocal);
    } else {
        alert("Erro ao salvar datas.");
    }
}

export async function marcarMensalidadePago(filhoId, mesAno) {
    const { error } = await supabase.from('mensalidades').upsert({
        filho_id: filhoId,
        mes_ano: mesAno
    }, { onConflict: 'filho_id,mes_ano' });

    if (!error) abrirFicha(filhoId);
}

export async function reverterMensalidadePago(filhoId, mesAno) {
    const { error } = await supabase
        .from('mensalidades')
        .delete()
        .eq('filho_id', filhoId)
        .eq('mes_ano', mesAno);

    if (!error) abrirFicha(filhoId);
}

export async function adiantarMensalidade() {
    if (!filhoIdSendoEditado) return;
    const dataAtual = new Date();
    dataAtual.setMonth(dataAtual.getMonth() + 1);
    const mesStr = `${dataAtual.getFullYear()}-${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}`;
    await marcarMensalidadePago(filhoIdSendoEditado, mesStr);
}

export async function adicionarDebitoExtra(event) {
    event.preventDefault();
    if (!filhoIdSendoEditado) return;

    const desc = document.getElementById('extra-desc').value.trim();
    const valor = parseFloat(document.getElementById('extra-valor').value) || 0;

    const { error } = await supabase.from('debitos_extras').insert([{
        filho_id: filhoIdSendoEditado,
        descricao: desc,
        valor: valor
    }]);

    if (!error) {
        document.getElementById('extra-desc').value = '';
        document.getElementById('extra-valor').value = '';
        abrirFicha(filhoIdSendoEditado);
    }
}

export async function reverterDebitoExtra(debitoId, filhoId) {
    const { error } = await supabase.from('debitos_extras').delete().eq('id', debitoId);
    if (!error) abrirFicha(filhoId);
}

// =========================================================================
// 6. BADGES COMPLEMENTARES E TEMPO REAL
// =========================================================================
async function atualizarBadgesMenuAdmin() {
    const [resOracao, resDoacoes] = await Promise.all([
        supabase.from('pedidos_oracao').select('id', { count: 'exact', head: true }),
        supabase.from('doacoes_registros').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
    ]);

    const configurarBadge = (idElemento, total) => {
        const el = document.getElementById(idElemento);
        if (!el) return;
        el.innerText = total || 0;
        el.classList.toggle('hidden', !(total > 0));
    };

    configurarBadge('badge-oracao-admin', resOracao.count);
    configurarBadge('badge-doacoes-admin', resDoacoes.count);
}

supabase.channel('admin-filhos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'filhos' }, () => carregarGestaoFilhosMensalidades())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comprovantes' }, () => carregarGestaoFilhosMensalidades())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensalidades' }, () => carregarGestaoFilhosMensalidades())
    .subscribe();

// Expor funções para os botões do HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    adicionarFilho,
    apagarFilhoAdmin,
    abrirFicha,
    fecharFicha,
    salvarDatasFilho,
    marcarMensalidadePago,
    reverterMensalidadePago,
    adiantarMensalidade,
    adicionarDebitoExtra,
    reverterDebitoExtra,
    baixarComprovanteAdmin,
    apagarComprovanteAdmin,
    abrirModalComprovante,
    fecharModalComprovante
});

if (adminAtivo) {
    carregarGestaoFilhosMensalidades();
    atualizarBadgesMenuAdmin();
}