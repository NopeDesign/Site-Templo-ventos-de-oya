import { 
    supabase, state, dataHoje, 
    exigirSessao, realizarLogoutGlobal, mostrarToast 
} from '../shared/config.js';

const usuarioAtivo = exigirSessao(false);

let filhosCacheLocal = [];
let fichasCacheLocal = [];
let filhoIdFichaAtual = null;

// =========================================================================
// 1. INICIALIZAÇÃO POR CARGO (ADMIN VS FILHO)
// =========================================================================
function inicializarInterface() {
    if (!state.usuarioLogado) return;
    const isAdmin = state.usuarioLogado.is_admin === true;

    const navFilho = document.getElementById('nav-barra-filho');
    const navAdmin = document.getElementById('nav-barra-admin');
    const secAdmin = document.getElementById('form-fichas');
    const secStatusFilho = document.getElementById('filho-status-ficha');
    const linkVoltar = document.getElementById('link-voltar-portal');
    const subtituloCargo = document.getElementById('header-subtitulo-cargo');

    if (isAdmin) {
        navAdmin?.classList.remove('hidden');
        navFilho?.classList.add('hidden');
        secAdmin?.classList.remove('hidden');
        secStatusFilho?.classList.add('hidden');
        if (linkVoltar) linkVoltar.href = '../agendar-gira/index.html';
        if (subtituloCargo) subtituloCargo.innerText = 'Direção Espiritual';
        configurarPermissoesAssinaturaCanvas(true);
        carregarFichasAdmin();
    } else {
        navFilho?.classList.remove('hidden');
        navAdmin?.classList.add('hidden');
        secAdmin?.classList.add('hidden');
        secStatusFilho?.classList.remove('hidden');
        if (linkVoltar) linkVoltar.href = '../painel-filho/index.html';
        if (subtituloCargo) subtituloCargo.innerText = 'Portal da Corrente';
        configurarPermissoesAssinaturaCanvas(false);
        carregarEstadoFichaFilho();
    }

    inicializarCanvasAssinatura('canvas-assinatura-medium');
    inicializarCanvasAssinatura('canvas-assinatura-direcao');
}

function configurarPermissoesAssinaturaCanvas(isAdmin) {
    const canvasDirecao = document.getElementById('canvas-assinatura-direcao');
    const btnLimparDirecao = document.getElementById('btn-limpar-ass-direcao');
    const legendaDirecao = document.getElementById('legenda-ass-direcao');

    if (canvasDirecao) {
        canvasDirecao.style.pointerEvents = isAdmin ? 'auto' : 'none';
        canvasDirecao.style.opacity = isAdmin ? '1' : '0.75';
    }
    if (btnLimparDirecao) {
        btnLimparDirecao.classList.toggle('hidden', !isAdmin);
    }
    if (legendaDirecao) {
        legendaDirecao.innerText = isAdmin
            ? 'Assine no quadro acima como Direção Espiritual'
            : 'Assinatura reservada à Direção Espiritual';
    }
}

// =========================================================================
// 2. VISÃO DO FILHO: VERIFICAR LIBERAÇÃO E ABRIR FICHA
// =========================================================================
async function carregarEstadoFichaFilho() {
    if (!state.usuarioLogado) return;

    const { data: ficha } = await supabase
        .from('fichas_cadastrais')
        .select('*')
        .eq('filho_id', state.usuarioLogado.id)
        .maybeSingle();

    const tituloEl = document.getElementById('filho-ficha-titulo');
    const descEl = document.getElementById('filho-ficha-descricao');
    const btnAbrir = document.getElementById('btn-filho-abrir-ficha');
    const boxFicha = document.getElementById('box-ficha-oficial');

    if (ficha && ficha.liberada_para_preencher === true) {
        if (tituloEl) tituloEl.innerText = 'Sua Ficha Cadastral está Liberada';
        if (descEl) descEl.innerText = 'A direção espiritual liberou o preenchimento e a assinatura digital da sua ficha. Clique abaixo para abrir o documento.';
        if (btnAbrir) btnAbrir.classList.remove('hidden');
        await abrirFichaCadastral(state.usuarioLogado.id);
    } else if (ficha && ficha.assinatura_medium_base64) {
        if (tituloEl) tituloEl.innerText = 'Ficha Assinada e Arquivada com a Direção';
        if (descEl) descEl.innerText = 'A sua ficha cadastral já foi preenchida e assinada. Para alterar qualquer dado de Ori, saúde ou assinatura, solicite a liberação à direção.';
        if (btnAbrir) btnAbrir.classList.add('hidden');
        if (boxFicha) boxFicha.classList.add('hidden');
    } else {
        if (tituloEl) tituloEl.innerText = 'Ficha Reservada à Direção Espiritual';
        if (descEl) descEl.innerText = 'Assim que a direção liberar o seu acesso para preencher ou atualizar a sua ficha cadastral, o formulário ficará disponível aqui.';
        if (btnAbrir) btnAbrir.classList.add('hidden');
        if (boxFicha) boxFicha.classList.add('hidden');
    }
}

// =========================================================================
// 3. VISÃO DO ADMIN: LISTAR, FILTRAR E LIBERAR FICHAS
// =========================================================================
export async function carregarFichasAdmin() {
    const [resFilhos, resFichas] = await Promise.all([
        supabase.from('filhos').select('*').order('nome', { ascending: true }),
        supabase.from('fichas_cadastrais').select('*')
    ]);

    filhosCacheLocal = resFilhos.data || [];
    fichasCacheLocal = resFichas.data || [];

    filtrarFichasAdmin();
}

export function filtrarFichasAdmin() {
    const container = document.getElementById('lista-fichas-admin');
    if (!container) return;

    const termo = (document.getElementById('filtro-fichas-busca')?.value || '').toLowerCase().trim();

    const listaFiltrada = filhosCacheLocal.filter(f => {
        const ficha = fichasCacheLocal.find(fc => String(fc.filho_id) === String(f.id));
        const texto = `${f.nome || ''} ${ficha?.santo_ori || ''} ${ficha?.guias_mochila || ''}`.toLowerCase();
        return !termo || texto.includes(termo);
    });

    if (listaFiltrada.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-6 text-center col-span-2">Nenhum integrante encontrado.</p>`;
        return;
    }

    container.innerHTML = listaFiltrada.map(f => {
        const ficha = fichasCacheLocal.find(fc => String(fc.filho_id) === String(f.id));
        const estaLiberada = ficha && ficha.liberada_para_preencher === true;
        const jaAssinou = ficha && !!ficha.assinatura_medium_base64;

        let statusBadge = `<span class="bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">Pendente</span>`;
        if (estaLiberada) {
            statusBadge = `<span class="bg-[#A9D8E8]/45 text-[#1e4e5f] border border-[#A9D8E8] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">Liberada para o Filho</span>`;
        } else if (jaAssinou) {
            statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-check mr-1"></i>Assinada</span>`;
        }

        return `
            <article class="card-ficha-item space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            ${statusBadge}
                        </div>
                        <h4 class="text-lg font-extrabold text-slate-900 capitalize">${f.nome}</h4>
                        ${ficha?.santo_ori ? `<p class="text-xs font-bold text-[#8E2638] mt-0.5"><i class="fa-solid fa-crown mr-1"></i>Ori: ${ficha.santo_ori}</p>` : ''}
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button onclick="toggleLiberarFichaFilho('${f.id}', ${!estaLiberada})" type="button" class="${estaLiberada ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#F5F0E8] hover:bg-[#8E2638] text-[#8E2638] hover:text-white border border-[#8E2638]/25'} text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5">
                        <i class="fa-solid ${estaLiberada ? 'fa-lock' : 'fa-unlock'}"></i>
                        <span>${estaLiberada ? 'Bloquear Preenchimento' : 'Liberar ao Filho'}</span>
                    </button>

                    <button onclick="abrirFichaCadastral('${f.id}')" type="button" class="bg-[#8E2638] hover:bg-[#681927] text-white text-xs font-extrabold px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5">
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Abrir Ficha</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

export async function toggleLiberarFichaFilho(filhoId, liberar) {
    const { error } = await supabase
        .from('fichas_cadastrais')
        .upsert({
            filho_id: filhoId,
            liberada_para_preencher: liberar,
            updated_at: new Date().toISOString()
        }, { onConflict: 'filho_id' });

    if (!error) {
        mostrarToast(
            liberar ? "Ficha Liberada!" : "Acesso Bloqueado",
            liberar ? "O filho já pode preencher e assinar a ficha no portal." : "O preenchimento pelo filho foi encerrado."
        );
        carregarFichasAdmin();
    } else {
        alert("Erro ao atualizar permissão da ficha.");
    }
}

// =========================================================================
// 4. PREENCHIMENTO, CÁLCULO DE IDADE E SALVAMENTO DA FICHA OFICIAL
// =========================================================================
export async function abrirFichaCadastral(filhoId) {
    filhoIdFichaAtual = filhoId;
    const filho = filhosCacheLocal.find(f => String(f.id) === String(filhoId)) || state.usuarioLogado;

    const { data: ficha } = await supabase
        .from('fichas_cadastrais')
        .select('*')
        .eq('filho_id', filhoId)
        .maybeSingle();

    const form = document.getElementById('form-ficha-cadastral-completa');
    if (form) form.reset();

    document.getElementById('fc-nome').value = ficha?.nome_completo || filho?.nome || '';
    document.getElementById('fc-nascimento').value = ficha?.data_nascimento || filho?.data_nascimento || '';
    calcularIdadeFicha();

    document.getElementById('fc-cpf').value = ficha?.cpf || '';
    document.getElementById('fc-rg').value = ficha?.rg || '';
    document.getElementById('fc-telefone').value = ficha?.telefone || '';
    document.getElementById('fc-endereco').value = ficha?.endereco || '';
    document.getElementById('fc-bairro').value = ficha?.bairro || '';
    document.getElementById('fc-cidade').value = ficha?.cidade || '';
    document.getElementById('fc-email').value = ficha?.email || '';

    document.getElementById('fc-frequentou-outro').value = ficha?.frequentou_outro || 'nao';
    document.getElementById('fc-qual-terreiro').value = ficha?.qual_terreiro || '';
    document.getElementById('fc-tempo-umbanda').value = ficha?.tempo_umbanda || '';
    document.getElementById('fc-santo-ori').value = ficha?.santo_ori || '';
    document.getElementById('fc-possui-obrigacoes').value = ficha?.possui_obrigacoes || 'nao';
    document.getElementById('fc-quais-obrigacoes').value = ficha?.quais_obrigacoes || '';
    document.getElementById('fc-ja-incorporou').value = ficha?.ja_incorporou || 'nao';
    document.getElementById('fc-experiencia-incorporacao').value = ficha?.experiencia_incorporacao || '';
    document.getElementById('fc-ja-batizado').value = ficha?.ja_batizado || 'nao';
    document.getElementById('fc-guias-mochila').value = ficha?.guias_mochila || '';

    document.getElementById('fc-usa-medicacao').value = ficha?.usa_medicacao || 'nao';
    document.getElementById('fc-quais-medicacoes').value = ficha?.quais_medicacoes || '';
    document.getElementById('fc-limitacao-fisica').value = ficha?.limitacao_fisica || '';

    document.getElementById('fc-aceitou-compromisso').checked = ficha?.aceitou_compromisso === true;
    document.getElementById('fc-data-assinatura').value = ficha?.data_assinatura || dataHoje;

    const badgeStatus = document.getElementById('badge-status-ficha-aberta');
    if (badgeStatus) {
        badgeStatus.innerText = `Ficha de ${filho?.nome || 'Membro'}`;
    }

    const btnFechar = document.getElementById('btn-fechar-ficha-oficial');
    if (btnFechar && state.usuarioLogado?.is_admin) {
        btnFechar.classList.remove('hidden');
    }

    document.getElementById('box-ficha-oficial').classList.remove('hidden');

    // Carrega assinaturas salvas no Canvas após o elemento ficar visível
    setTimeout(() => {
        limparCanvasAssinatura('canvas-assinatura-medium');
        limparCanvasAssinatura('canvas-assinatura-direcao');
        if (ficha?.assinatura_medium_base64) {
            desenharImagemNoCanvas('canvas-assinatura-medium', ficha.assinatura_medium_base64);
        }
        if (ficha?.assinatura_direcao_base64) {
            desenharImagemNoCanvas('canvas-assinatura-direcao', ficha.assinatura_direcao_base64);
        }
    }, 60);

    document.getElementById('box-ficha-oficial').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function fecharFichaOficial() {
    document.getElementById('box-ficha-oficial').classList.add('hidden');
    filhoIdFichaAtual = null;
}

export function calcularIdadeFicha() {
    const nascVal = document.getElementById('fc-nascimento')?.value;
    const idadeInput = document.getElementById('fc-idade');
    if (!nascVal || !idadeInput) return;

    const [ano, mes, dia] = nascVal.split('-').map(Number);
    const hoje = new Date();
    let idade = hoje.getFullYear() - ano;
    const mesDiff = (hoje.getMonth() + 1) - mes;
    if (mesDiff < 0 || (mesDiff === 0 && hoje.getDate() < dia)) {
        idade--;
    }
    if (idade >= 0 && idade < 130) {
        idadeInput.value = idade;
    }
}

export async function salvarFichaCadastralCompleta(event) {
    event.preventDefault();
    if (!filhoIdFichaAtual) return;

    const btn = document.getElementById('btn-salvar-ficha-cadastral');
    if (btn) btn.disabled = true;

    const canvasMedium = document.getElementById('canvas-assinatura-medium');
    const canvasDirecao = document.getElementById('canvas-assinatura-direcao');

    const payload = {
        filho_id: filhoIdFichaAtual,
        nome_completo: document.getElementById('fc-nome').value.trim(),
        data_nascimento: document.getElementById('fc-nascimento').value || null,
        cpf: document.getElementById('fc-cpf').value.trim(),
        rg: document.getElementById('fc-rg').value.trim() || null,
        telefone: document.getElementById('fc-telefone').value.trim(),
        endereco: document.getElementById('fc-endereco').value.trim(),
        bairro: document.getElementById('fc-bairro').value.trim(),
        cidade: document.getElementById('fc-cidade').value.trim(),
        email: document.getElementById('fc-email').value.trim() || null,
        frequentou_outro: document.getElementById('fc-frequentou-outro').value,
        qual_terreiro: document.getElementById('fc-qual-terreiro').value.trim() || null,
        tempo_umbanda: document.getElementById('fc-tempo-umbanda').value.trim() || null,
        santo_ori: document.getElementById('fc-santo-ori').value.trim() || null,
        possui_obrigacoes: document.getElementById('fc-possui-obrigacoes').value,
        quais_obrigacoes: document.getElementById('fc-quais-obrigacoes').value.trim() || null,
        ja_incorporou: document.getElementById('fc-ja-incorporou').value,
        experiencia_incorporacao: document.getElementById('fc-experiencia-incorporacao').value.trim() || null,
        ja_batizado: document.getElementById('fc-ja-batizado').value,
        guias_mochila: document.getElementById('fc-guias-mochila').value.trim() || null,
        usa_medicacao: document.getElementById('fc-usa-medicacao').value,
        quais_medicacoes: document.getElementById('fc-quais-medicacoes').value.trim() || null,
        limitacao_fisica: document.getElementById('fc-limitacao-fisica').value.trim() || null,
        aceitou_compromisso: document.getElementById('fc-aceitou-compromisso').checked,
        data_assinatura: document.getElementById('fc-data-assinatura').value || dataHoje,
        assinatura_medium_base64: canvasMedium ? canvasMedium.toDataURL('image/png') : null,
        assinatura_direcao_base64: canvasDirecao ? canvasDirecao.toDataURL('image/png') : null,
        liberada_para_preencher: state.usuarioLogado?.is_admin ? true : false,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('fichas_cadastrais')
        .upsert(payload, { onConflict: 'filho_id' });

    if (btn) btn.disabled = false;

    if (!error) {
        mostrarToast("Ficha Salva!", "Os dados cadastrais, espirituais e assinaturas foram guardados com segurança.");
        if (state.usuarioLogado?.is_admin) {
            carregarFichasAdmin();
        } else {
            carregarEstadoFichaFilho();
        }
    } else {
        alert("Erro ao guardar a ficha cadastral.");
    }
}

// =========================================================================
// 5. ASSINATURA DIGITAL NO CANVAS (TOQUE E RATO)
// =========================================================================
function inicializarCanvasAssinatura(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas.dataset.init === '1') return;
    canvas.dataset.init = '1';

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let desenhando = false;

    const obterPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const iniciar = (e) => {
        if (canvas.style.pointerEvents === 'none') return;
        e.preventDefault();
        desenhando = true;
        const pos = obterPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const mover = (e) => {
        if (!desenhando || canvas.style.pointerEvents === 'none') return;
        e.preventDefault();
        const pos = obterPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const parar = () => {
        if (!desenhando) return;
        desenhando = false;
        ctx.closePath();
    };

    canvas.addEventListener('mousedown', iniciar);
    canvas.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', parar);

    canvas.addEventListener('touchstart', iniciar, { passive: false });
    canvas.addEventListener('touchmove', mover, { passive: false });
    window.addEventListener('touchend', parar);
}

export function limparCanvasAssinatura(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function desenharImagemNoCanvas(canvasId, base64Src) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !base64Src) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = base64Src;
}

// Expor funções para o HTML
Object.assign(window, {
    realizarLogout: realizarLogoutGlobal,
    filtrarFichasAdmin,
    toggleLiberarFichaFilho,
    abrirFichaCadastral,
    fecharFichaOficial,
    calcularIdadeFicha,
    salvarFichaCadastralCompleta,
    limparCanvasAssinatura
});

if (usuarioAtivo) {
    inicializarInterface();
}