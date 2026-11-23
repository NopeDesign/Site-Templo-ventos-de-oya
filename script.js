import { supabase } from './shared/config.js';

export async function realizarLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-login');
    const htmlOriginal = btn.innerHTML;
    btn.innerHTML = '<span>Verificando...</span> <div class="loader w-4 h-4 border-2"></div>';
    btn.disabled = true;
    
    const nomeInput = document.getElementById('login-nome').value.trim();
    const senhaInput = document.getElementById('login-senha').value.trim();
    const erroDiv = document.getElementById('login-error');
    
    const { data, error } = await supabase
        .from('filhos')
        .select('*')
        .ilike('nome', nomeInput)
        .eq('senha', senhaInput)
        .maybeSingle();

    btn.innerHTML = htmlOriginal;
    btn.disabled = false;

    if (error || !data) {
        erroDiv.classList.remove('hidden');
    } else {
        erroDiv.classList.add('hidden');
        localStorage.setItem('umbanda_user_session', JSON.stringify(data));
        redirecionarPorCargo(data);
    }
}

function redirecionarPorCargo(usuario) {
    if (usuario.is_admin === true) {
        window.location.href = './agendar-gira/index.html';
    } else {
        window.location.href = './painel-filho/index.html';
    }
}

function verificarSessaoExistente() {
    const session = localStorage.getItem('umbanda_user_session');
    if (session) {
        try {
            const usuario = JSON.parse(session);
            if (usuario && usuario.id) {
                redirecionarPorCargo(usuario);
            }
        } catch (e) {
            localStorage.removeItem('umbanda_user_session');
        }
    }
}

// --- LÓGICA DO PWA (INSTALAR APLICATIVO) ---
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
    if (outcome === 'accepted' && btnInstalar) {
        btnInstalar.classList.add('hidden');
    }
    deferredPrompt = null;
};

window.realizarLogin = realizarLogin;
verificarSessaoExistente();