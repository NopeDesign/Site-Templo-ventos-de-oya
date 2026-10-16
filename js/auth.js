import { supabase, state } from './config.js';
import { carregarPainelDoFilho } from './painelFilho.js';

export function mostrarEcra(ecraId) {
    document.getElementById('login-view').classList.add('hidden'); 
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('user-dashboard-view').classList.add('hidden');
    document.getElementById(ecraId).classList.remove('hidden');
    
    const btnLogoutHead = document.getElementById('btn-logout-header');
    if (ecraId === 'login-view') btnLogoutHead.classList.add('hidden');
    else btnLogoutHead.classList.remove('hidden');
}

export async function realizarLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-login');
    btn.innerHTML = '<div class="loader w-4 h-4 border-2 mr-2"></div> Verificando...';
    
    const nomeInput = document.getElementById('login-nome').value.trim();
    const senhaInput = document.getElementById('login-senha').value.trim();
    const erroDiv = document.getElementById('login-error');
    
    const { data, error } = await supabase
        .from('filhos')
        .select('*')
        .ilike('nome', nomeInput)
        .eq('senha', senhaInput)
        .maybeSingle();

    btn.innerHTML = 'Entrar';

    if (error || !data) {
        erroDiv.classList.remove('hidden');
    } else {
        erroDiv.classList.add('hidden');
        document.getElementById('login-form').reset();
        state.usuarioLogado = data;
        localStorage.setItem('umbanda_user_session', JSON.stringify(data));
        direcionarUsuarioLogado();
    }
}

export function direcionarUsuarioLogado() {
    if (!state.usuarioLogado) {
        mostrarEcra('login-view');
        return;
    }
    if (state.usuarioLogado.is_admin === true) {
        mostrarEcra('admin-dashboard-view');
        window.abrirAba('aba-bem-vindo');
    } else {
        mostrarEcra('user-dashboard-view');
        carregarPainelDoFilho();
    }
}

export function realizarLogout() { 
    localStorage.removeItem('umbanda_user_session');
    state.usuarioLogado = null;
    mostrarEcra('login-view'); 
}

export function verificarSessao() { 
    const session = localStorage.getItem('umbanda_user_session');
    if (session) {
        state.usuarioLogado = JSON.parse(session);
        direcionarUsuarioLogado();
    } else {
        mostrarEcra('login-view');
    }
}