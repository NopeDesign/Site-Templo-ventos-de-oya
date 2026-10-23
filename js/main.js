import { supabase, dataHoje, state } from './config.js';
import { realizarLogin, realizarLogout, verificarSessao, mostrarEcra } from './auth.js';
import { atualizarResumoGira, salvarGira, carregarGiras, salvarAviso } from './girasAvisos.js';
import { carregarFaxinaAdmin, criarGrupoFaxina, atualizarAgendaGrupo, moverFilhoGrupo, removerFilhoDoGrupo } from './faxina.js';
import { 
    adicionarFilho, carregarMensalidades, abrirFicha, adiantarMensalidade, alterarPagamentoNaFicha, 
    adicionarDebitoExtra, pagarDebitoExtra, fecharFicha, carregarCaixa, 
    adicionarMovimentacaoCaixa, carregarListaGeral 
} from './financeiro.js';
import { carregarPainelDoFilho } from './painelFilho.js';

if(document.getElementById('novo-filho-data')) document.getElementById('novo-filho-data').value = dataHoje;
if(document.getElementById('gira-data')) document.getElementById('gira-data').value = dataHoje;
if(document.getElementById('faxina-data')) document.getElementById('faxina-data').value = dataHoje;

window.abrirAba = function(abaId) {
    const paineis = ['aba-bem-vindo', 'form-gira', 'form-aviso', 'form-faxina', 'form-mensalidade', 'form-financeiro', 'lista-geral'];
    paineis.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    const aba = document.getElementById(abaId);
    if(aba) aba.classList.remove('hidden');
    
    if(abaId === 'form-gira') carregarGiras();
    if(abaId === 'form-faxina') carregarFaxinaAdmin();
    if(abaId === 'form-mensalidade') carregarMensalidades();
    if(abaId === 'form-financeiro') carregarCaixa();
    if(abaId === 'lista-geral') carregarListaGeral();
};

window.apagarItem = async function(tabela, id) {
    let msg = "Tem certeza que deseja apagar este registo?";
    if(tabela === 'filhos') msg = "CRÍTICO: Remover este integrante apagará também o seu histórico financeiro. Confirmar?";
    if(tabela === 'grupos_faxina') msg = "Deseja apagar este grupo de faxina? Os integrantes ficarão sem grupo.";
    
    if(confirm(msg)) {
        await supabase.from(tabela).delete().eq('id', id);
        if(tabela === 'caixa') carregarCaixa();
        else if(tabela === 'grupos_faxina') carregarFaxinaAdmin();
        else {
            carregarListaGeral();
            if(tabela === 'giras') carregarGiras();
        }
    }
};

// --- SISTEMA DE NOTIFICAÇÕES NO TELEMÓVEL E REALTIME ---
const btnNotif = document.getElementById('btn-notificacoes');

function verificarBotaoNotificacao() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        if (btnNotif) btnNotif.classList.remove('hidden');
    } else {
        if (btnNotif) btnNotif.classList.add('hidden');
    }
}

window.pedirPermissaoNotificacao = async function() {
    if (!('Notification' in window)) {
        alert("O seu navegador não suporta notificações.");
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        if (btnNotif) btnNotif.classList.add('hidden');
        dispararNotificacaoNativa("Alertas Ativados!", "Você será avisado sempre que a direção publicar um novo comunicado ou gira.");
    }
};

export async function dispararNotificacaoNativa(titulo, corpo) {
    // 1. Mostra um Toast flutuante bonito dentro do app
    mostrarToast(titulo, corpo);

    // 2. Dispara a notificação nativa na barra do telemóvel / Windows
    if ('Notification' in window && Notification.permission === 'granted') {
        const opcoes = {
            body: corpo,
            icon: 'https://ui-avatars.com/api/?name=VO&background=e03131&color=fff&size=192&rounded=true&bold=true&format=png',
            badge: 'https://ui-avatars.com/api/?name=VO&background=e03131&color=fff&size=192&rounded=true&bold=true&format=png',
            vibrate: [200, 100, 200]
        };

        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                reg.showNotification(titulo, opcoes);
                return;
            }
        }
        new Notification(titulo, opcoes);
    }
}

function mostrarToast(titulo, mensagem) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-anim bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-700 max-w-sm flex items-start gap-3';
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <i class="fa-solid fa-bell text-xs"></i>
        </div>
        <div>
            <h4 class="font-extrabold text-xs uppercase tracking-wider text-red-400">${titulo}</h4>
            <p class="text-xs text-slate-200 mt-0.5 font-medium">${mensagem}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}

// Escuta novos Avisos e Giras em Tempo Real via Supabase
supabase.channel('notificacoes-terreiro')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, (payload) => {
        const novo = payload.new;
        dispararNotificacaoNativa(`📢 Novo Comunicado: ${novo.titulo}`, novo.mensagem);
        if (state.usuarioLogado && !state.usuarioLogado.is_admin) carregarPainelDoFilho();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'giras' }, (payload) => {
        const novaGira = payload.new;
        const dataBr = novaGira.data.split('-').reverse().join('/');
        dispararNotificacaoNativa(`📅 Nova Gira Agendada!`, `${novaGira.linha_trabalho} dia ${dataBr} às ${novaGira.horario_abertura.substring(0,5)}h`);
        carregarGiras();
    })
    .subscribe();

// --- LÓGICA DO PWA (APLICATIVO INSTALÁVEL) ---
let deferredPrompt;
const btnInstalar = document.getElementById('btn-instalar-app');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW erro:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstalar) btnInstalar.classList.remove('hidden');
});

window.instalarApp = async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        if (btnInstalar) btnInstalar.classList.add('hidden');
    }
    deferredPrompt = null;
};

window.addEventListener('appinstalled', () => {
    if (btnInstalar) btnInstalar.classList.add('hidden');
    deferredPrompt = null;
});

Object.assign(window, {
    mostrarEcra, realizarLogin, realizarLogout,
    atualizarResumoGira, salvarGira, salvarAviso,
    criarGrupoFaxina, atualizarAgendaGrupo, moverFilhoGrupo, removerFilhoDoGrupo,
    adicionarFilho, abrirFicha, adiantarMensalidade, alterarPagamentoNaFicha, 
    adicionarDebitoExtra, pagarDebitoExtra, fecharFicha, adicionarMovimentacaoCaixa
});

verificarBotaoNotificacao();
verificarSessao();