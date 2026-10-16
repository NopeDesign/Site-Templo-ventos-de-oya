import { supabase, mesesNomesCompletos } from './config.js';

export function atualizarResumoGira() {
    const linha = document.getElementById('gira-template').value;
    const inputRoupa = document.getElementById('gira-roupa');
    const inputBanho = document.getElementById('gira-banho');
    const preceitoPadrao = "Proibido carne vermelha, bebida alcoólica e relação sexual 24h antes.";
    
    inputBanho.value = "";
    inputRoupa.value = "Branca";

    if (linha === "Exu e Pombagira") {
        inputRoupa.value = "Preta e Vermelha";
        inputBanho.value = preceitoPadrao;
    } else if (linha === "Malandros") {
        inputRoupa.value = "Branca e Vermelha";
        inputBanho.value = `Alecrim, Levante e Peregum Roxo | ${preceitoPadrao}`;
    } else if (linha === "Exu Mirim") {
        inputRoupa.value = "Branca (Outra cor apenas se a mãe liberar)";
        inputBanho.value = `Palha de alho, Hortelã e Alecrim | ${preceitoPadrao}`;
    } else {
        inputBanho.value = preceitoPadrao;
    }
}

export async function salvarGira(event) {
    event.preventDefault();
    const { error } = await supabase.from('giras').insert([{
        data: document.getElementById('gira-data').value, 
        linha_trabalho: document.getElementById('gira-template').value, 
        horario_abertura: document.getElementById('gira-abertura').value, 
        horario_fechamento: document.getElementById('gira-fechamento').value, 
        roupa: document.getElementById('gira-roupa').value, 
        banho_ervas: document.getElementById('gira-banho').value 
    }]);
    if(!error) { 
        alert('Gira agendada com sucesso!'); 
        document.getElementById('form-gira').querySelector('form').reset(); 
        carregarGiras(); 
    } 
}

export async function carregarGiras() {
    const hoje = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('giras').select('*').gte('data', hoje).order('data', { ascending: true });
    
    const containerUser = document.getElementById('container-giras');
    const containerAdmin = document.getElementById('container-giras-admin');

    if (!data || data.length === 0) { 
        const msg = `
            <div class="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <i class="fa-regular fa-calendar-xmark text-2xl text-slate-300 mb-2"></i>
                <p class="text-slate-400 text-sm font-medium">Nenhuma gira agendada para os próximos dias.</p>
            </div>`;
        if(containerUser) containerUser.innerHTML = msg;
        if(containerAdmin) containerAdmin.innerHTML = msg;
        return; 
    }
    
    let html = '<div class="space-y-4">';
    data.forEach((gira, index) => {
        const [ano, mes, dia] = gira.data.split('-');
        const isProx = index === 0;
        const horaAb = gira.horario_abertura ? gira.horario_abertura.substring(0, 5) : '19:00';
        const infoRoupa = gira.roupa || 'Branca';

        html += `
        <div class="pro-card pro-card-hover p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 ${isProx ? "ring-2 ring-blue-500/20 bg-gradient-to-r from-blue-50/40 to-white border-blue-200" : ""}">
            
            <!-- BLOCO DE DATA -->
            <div class="flex flex-col items-center justify-center ${isProx ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-800"} rounded-2xl p-3.5 min-w-[76px] text-center shrink-0">
                <span class="text-[10px] font-extrabold uppercase tracking-widest ${isProx ? "text-blue-200" : "text-slate-400"}">${mesesNomesCompletos[parseInt(mes)-1].substring(0,3)}</span>
                <span class="text-2xl font-black leading-none mt-1">${dia}</span>
            </div>

            <!-- DETALHES DA GIRA -->
            <div class="flex-grow space-y-2.5 w-full">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="font-extrabold text-lg text-slate-900 tracking-tight">${gira.linha_trabalho}</h3>
                    ${isProx ? `<span class="bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span> Próxima Gira</span>` : ''}
                </div>

                <!-- PÍLULAS DE INFORMAÇÃO -->
                <div class="flex flex-wrap items-center gap-2 pt-0.5">
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200/60">
                        <i class="fa-regular fa-clock text-slate-400"></i> ${horaAb}h
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200/60">
                        <i class="fa-solid fa-shirt text-slate-400"></i> Roupa: ${infoRoupa}
                    </span>
                </div>

                ${gira.banho_ervas ? `
                <div class="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
                    <i class="fa-solid fa-leaf text-emerald-600 mt-0.5"></i>
                    <p class="leading-relaxed"><strong class="text-slate-800 font-bold">Preceito & Ervas:</strong> ${gira.banho_ervas}</p>
                </div>` : ''}
            </div>
        </div>`;
    });
    html += '</div>';

    if(containerUser) containerUser.innerHTML = html;
    if(containerAdmin) containerAdmin.innerHTML = html;
}

export async function salvarAviso(event) {
    event.preventDefault();
    const { error } = await supabase.from('avisos').insert([{
        data_publicacao: new Date().toISOString().split('T')[0], 
        data_expiracao: document.getElementById('aviso-validade').value, 
        tipo: document.getElementById('aviso-tipo').value, 
        titulo: document.getElementById('aviso-titulo').value, 
        mensagem: document.getElementById('aviso-mensagem').value
    }]);
    if(!error) { alert('Aviso publicado!'); document.getElementById('form-aviso').querySelector('form').reset(); }
}