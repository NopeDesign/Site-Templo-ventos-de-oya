import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://rymlelvjpkdyhxaugywq.supabase.co';
const supabaseKey = 'sb_publishable_2bhMn9r5dYyDgLFtC7XMhQ_ij3i_IVl';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const FINANCEIRO_CONFIG = {
    chavePix: "temploventosdeoya@gmail.com",
    favorecido: "Ricardo Ambrosio da Silva - Banco: Picpay",
    whatsappNumero: "55119955304251"
};

export const mesesNomesCompletos = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const dataHoje = new Date().toISOString().split('T')[0];

export const state = {
    usuarioLogado: JSON.parse(localStorage.getItem('umbanda_user_session') || 'null'),
    filhosDataLocal: [],
    pagamentosDataLocal: [],
    debitosExtrasLocal: [],
    comprovantesLocal: [],
    filhoSendoEditado: null,
    totalDividaUsuarioLogado: 0
};

export function exigirSessao(apenasAdmin = false) {
    const sessao = localStorage.getItem('umbanda_user_session');
    if (!sessao) {
        window.location.href = '../index.html';
        return null;
    }
    const user = JSON.parse(sessao);
    state.usuarioLogado = user;
    if (apenasAdmin && !user.is_admin) {
        window.location.href = '../painel-filho/index.html';
        return null;
    }
    return user;
}

export function realizarLogoutGlobal() {
    localStorage.removeItem('umbanda_user_session');
    window.location.href = '../index.html';
}

export function mostrarToast(titulo, mensagem) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-anim bg-[#8E2638] text-[#F5F0E8] p-4 rounded-2xl shadow-xl border border-[#A9D8E8]/40 max-w-sm flex items-start gap-3';
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-[#A9D8E8] text-[#8E2638] flex items-center justify-center shrink-0 mt-0.5">
            <i class="fa-solid fa-check text-xs"></i>
        </div>
        <div>
            <h4 class="font-extrabold text-xs uppercase tracking-wider text-[#A9D8E8]">${titulo}</h4>
            <p class="text-xs text-[#F5F0E8] mt-0.5 font-medium">${mensagem}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}

window.mostrarToast = mostrarToast;
window.realizarLogout = realizarLogoutGlobal;