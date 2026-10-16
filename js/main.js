import { supabase, dataHoje } from './config.js';
import { realizarLogin, realizarLogout, verificarSessao, mostrarEcra } from './auth.js';
import { atualizarResumoGira, salvarGira, carregarGiras, salvarAviso } from './girasAvisos.js';
import { carregarFaxinaAdmin, criarGrupoFaxina, atualizarAgendaGrupo, moverFilhoGrupo, removerFilhoDoGrupo } from './faxina.js';
import { 
    adicionarFilho, carregarMensalidades, abrirFicha, adiantarMensalidade, alterarPagamentoNaFicha, 
    adicionarDebitoExtra, pagarDebitoExtra, fecharFicha, carregarCaixa, 
    adicionarMovimentacaoCaixa, carregarListaGeral 
} from './financeiro.js';

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

// --- LÓGICA DO PWA (APLICATIVO INSTALÁVEL) ---
let deferredPrompt;
const btnInstalar = document.getElementById('btn-instalar-app');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW erro:', err));
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

verificarSessao();