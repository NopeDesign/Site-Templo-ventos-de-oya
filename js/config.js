import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://rymlelvjpkdyhxaugywq.supabase.co';
const supabaseKey = 'sb_publishable_2bhMn9r5dYyDgLFtC7XMhQ_ij3i_IVl';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const mesesNomesCompletos = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const dataHoje = new Date().toISOString().split('T')[0];

// Estado global compartilhado entre os arquivos
export const state = {
    usuarioLogado: null,
    filhosDataLocal: [],
    pagamentosDataLocal: [],
    debitosExtrasLocal: [],
    filhoSendoEditado: null
};