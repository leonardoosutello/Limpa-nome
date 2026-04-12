/* ================= CONFIGURAÇÃO FIREBASE ================= */
const firebaseConfig = {
    apiKey: "AIzaSyDDguzJOP5GKqlqf8GW-xdsTCxh1Ha7C7k",
    authDomain: "sutello-financeiro.firebaseapp.com",
    projectId: "sutello-financeiro",
    storageBucket: "sutello-financeiro.firebasestorage.app",
    messagingSenderId: "460447549653",
    appId: "1:460447549653:web:a36b0c7d2c2919ff633a5c"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let dividas = []; 
let contasFinanceiras = []; 
let filtro = "todas"; 

/* ================= LOGIN E ESTADO ================= */
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById("lock").style.display = "none";
        document.getElementById("app").style.display = "block";
        db.collection("dados_limpanome").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) { dividas = doc.data().dividas || []; render(); }
        });
        db.collection("dados_financeiros").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) { contasFinanceiras = doc.data().contas || []; }
        });
        db.collection("usuarios_limpanome").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) {
                const d = doc.data();
                if(d.foto) { document.getElementById("fotoPerfil").src = d.foto; document.getElementById("previewFotoPerfil").src = d.foto; }
                if(d.nome) { document.getElementById("nomePerfil").innerText = d.nome; document.getElementById("inputNomePerfil").value = d.nome; }
            }
        });
    } else {
        document.getElementById("lock").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

function fazerLoginFirebase() {
    const e = document.getElementById("loginEmail").value, s = document.getElementById("loginSenha").value;
    if(e && s) auth.signInWithEmailAndPassword(e, s).catch(() => alert("Erro no login"));
}

/* ================= FUNÇÃO DE EDIÇÃO ================= */
function editarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if(!d) return;

    const novoNome = prompt("Nome do Credor:", d.nome);
    if(novoNome === null) return; 

    const novoValor = prompt("Valor da Parcela:", d.valor);
    if(novoValor === null) return;

    const novaData = prompt("Vencimento (AAAA-MM-DD):", d.vencimento);
    if(novaData === null) return;

    d.nome = novoNome;
    d.valor = parseFloat(novoValor.replace(",", "."));
    d.vencimento = novaData;
    
    salvar();
    alert("Atualizado com sucesso!");
}

/* ================= RENDERIZAÇÃO (RESTAURADA CONFORME PRINT) ================= */
function render() {
    const lista = document.getElementById("lista");
    if(!lista) return;
    lista.innerHTML = "";

    const grupos = {};
    [...dividas].sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(d => {
        const dt = new Date(d.vencimento + "T12:00:00");
        const k = (dt.getMonth() + 1).toString().padStart(2, '0') + "/" + dt.getFullYear();
        if(!grupos[k]) grupos[k] = [];
        grupos[k].push(d);
    });

    Object.keys(grupos).forEach(k => {
        const todasDoMes = grupos[k];
        const visiveis = todasDoMes.filter(d => filtro === "pagas" ? d.paga : !d.paga);

        if (visiveis.length === 0) return;

        let totalMes = 0, pagoMes = 0;
        todasDoMes.forEach(d => { totalMes += d.valor; if(d.paga) pagoMes += d.valor; });
        const falta = totalMes - pagoMes;

        const bloco = document.createElement("div");
        bloco.className = "mes-container";
        bloco.innerHTML = `
          <div class="cabecalho-mes"><h3>📅 ${k}</h3></div>
          <div class="resumo-mes">
              <div class="resumo-item"><small>Total Acordos</small><strong>R$ ${totalMes.toFixed(2)}</strong></div>
              <div class="resumo-item"><small>Quitado</small><strong style="color:#2ecc71;">R$ ${pagoMes.toFixed(2)}</strong></div>
              <div class="resumo-item"><small>Falta</small><strong style="color:#ef5350;">R$ ${falta.toFixed(2)}</strong></div>
              <div class="barra-container" style="grid-column: span 3;"><div class="barra-fundo"><div class="barra-preenchimento" style="width: ${(pagoMes/totalMes)*100}%"></div></div><small style="display:block; text-align:center; margin-top:5px;">${((pagoMes/totalMes)*100).toFixed(0)}% Pago neste mês</small></div>
          </div>
        `;

        visiveis.forEach(d => {
            const div = document.createElement("div");
            div.className = d.paga ? "conta verde" : "conta";
            div.innerHTML = `
                <div style="font-size: 1.1em; margin-bottom: 5px;"><strong>🏦 ${d.nome}</strong></div>
                <div style="font-size: 1.2em; font-weight: bold;">💰 R$ ${d.valor.toFixed(2)}</div>
                <div style="margin-top: 5px; color:#aaa;">📅 Vencimento: ${d.vencimento.split("-").reverse().join("/")}</div>
                <div class="info-parcelas" style="background:#222; padding:8px; border-radius:8px; margin-top:10px;">📦 Parcela ${d.parcelaAtual || 1} de ${d.totalParcelas || 1}</div>
                
                <div class="acoes-principal" style="display:flex; gap:10px; margin-top:15px;">
                    <button class="btn-pagar" onclick="pagarDivida('${d.id}')" style="flex:3; background:#2ecc71; border:none; padding:12px; border-radius:8px; color:white; font-weight:bold;">✅ QUITAR PARCELA</button>
                    <button class="btn-expandir" onclick="toggleMenu('${d.id}')" style="flex:1; background:white; border:none; border-radius:8px; color:#ef5350;">▼</button>
                </div>

                <div id="menu-${d.id}" class="menu-secundario" style="display:none; flex-direction:column; gap:8px; margin-top:10px; border: 1px solid #333; padding:10px; border-radius:8px;">
                    <button onclick="editarDivida('${d.id}')" style="background:none; border: 1px solid #444; color:white; padding:10px; border-radius:6px; text-align:left;">✏️ Editar (Ajustar Juros)</button>
                    <button onclick="alert('Funcionalidade em breve!')" style="background:none; border: 1px solid #444; color:white; padding:10px; border-radius:6px; text-align:left;">📋 Copiar Boleto/Pix</button>
                    <button onclick="alert('Abrindo WhatsApp...')" style="background:none; border: 1px solid #444; color:white; padding:10px; border-radius:6px; text-align:left;">📱 Enviar no WhatsApp</button>
                    <button onclick="excluirDivida('${d.id}')" style="background:none; border: 1px solid #444; color:#ef5350; padding:10px; border-radius:6px; text-align:left;">🗑️ Cancelar / Excluir</button>
                </div>
            `;
            bloco.appendChild(div);
        });
        lista.appendChild(bloco);
    });
}

/* ================= FLUXO DIÁRIO INTEGRADO (CORRIGIDO) ================= */
function gerarAnaliseDiaria() {
    const selecao = document.getElementById("mesFiltroAnalise").value; // Pega "2026-04"
    const corpo = document.getElementById("corpoAnalise");
    
    if (!selecao) {
        alert("Por favor, selecione o mês e o ano no calendário.");
        return;
    }

    const [anoAlvo, mesAlvo] = selecao.split("-").map(Number);
    const totais = {};

    // Função auxiliar para processar itens (Removido o filtro !paga)
    const processarItem = (item, tipo) => {
        const dt = new Date(item.vencimento + "T12:00:00");
        if ((dt.getMonth() + 1) === mesAlvo && dt.getFullYear() === anoAlvo) {
            const dia = dt.getDate().toString().padStart(2, '0');
            if (!totais[dia]) totais[dia] = { total: 0, itens: [] };
            
            totais[dia].total += item.valor;
            const status = item.paga ? "✅ " : "⏳ ";
            const info = tipo === "Acordo" ? `${status}${item.nome} (Serasa)` : `${status}${item.nome} [Por: ${item.pagador || 'N/A'}]`;
            totais[dia].itens.push(info);
        }
    };

    dividas.forEach(d => processarItem(d, "Acordo"));
    contasFinanceiras.forEach(c => processarItem(c, "Financeiro"));

    let h = "";
    const dias = Object.keys(totais).sort();
    
    dias.forEach(d => {
        h += `
            <div style="background:#2a2a36; padding:12px; border-radius:10px; margin-bottom:10px; border-left:4px solid #7b2ff7;">
                <div style="display:flex; justify-content:space-between; color:white; font-weight:bold;">
                    <span>Dia ${d}/${mesAlvo.toString().padStart(2,'0')}</span>
                    <span>R$ ${totais[d].total.toFixed(2)}</span>
                </div>
                <div style="font-size:12px; color:#aaa; margin-top:8px; line-height:1.6;">
                    ${totais[d].itens.join("<br>")}
                </div>
            </div>`;
    });

    corpo.innerHTML = h || `<p style="text-align:center; color:#888; padding:20px;">Nenhuma conta encontrada para ${mesAlvo}/${anoAlvo}.</p>`;
}



/* ================= OUTRAS FUNÇÕES ================= */
function salvar() { if(auth.currentUser) db.collection("dados_limpanome").doc(auth.currentUser.uid).set({dividas}); render(); }
function pagarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if(!d) return;
    d.paga = true;
    if(d.totalParcelas > 0 && d.parcelaAtual < d.totalParcelas) {
        const dt = new Date(d.vencimento + "T12:00:00"); dt.setMonth(dt.getMonth() + 1);
        dividas.push({...d, id: Date.now().toString(), paga: false, parcelaAtual: (d.parcelaAtual || 1) + 1, vencimento: dt.toISOString().split("T")[0]});
    }
    salvar();
}
function toggleMenu(id) { const m = document.getElementById(`menu-${id}`); m.style.display = (m.style.display === "none" || m.style.display === "") ? "flex" : "none"; }
function setFiltro(f, b) { filtro = f; document.querySelectorAll('.filtros button').forEach(x => x.classList.remove('ativo')); b.classList.add('ativo'); render(); }
function excluirDivida(id) { if(confirm("Excluir definitivamente?")) { dividas = dividas.filter(x => x.id !== id); salvar(); } }
function desfazerPagamento(id) { const d = dividas.find(x => x.id === id); if(d) { d.paga = false; salvar(); } }
function calcAdd(v) { document.getElementById("calcDisplay").value += v; }
function calcLimpar() { document.getElementById("calcDisplay").value = ""; }
function calcCalcular() { try { const d = document.getElementById("calcDisplay"); d.value = eval(d.value); } catch(e) { alert("Erro no cálculo"); } }
function abrirCalculadora() { document.getElementById("modalCalc").style.display = "flex"; }
function fecharCalculadora() { document.getElementById("modalCalc").style.display = "none"; }
function fecharAnaliseDiaria() { document.getElementById("modalAnalise").style.display = "none"; }
function abrirAnaliseDiaria() { document.getElementById("modalAnalise").style.display = "flex"; }
function abrirPerfil() { document.getElementById("modalPerfil").style.display = "flex"; }
function fecharModalPerfil() { document.getElementById("modalPerfil").style.display = "none"; }
function fecharModalAdicionar() { document.getElementById("modalNovaDivida").style.display = "none"; }
function adicionarDivida() { document.getElementById("modalNovaDivida").style.display = "flex"; document.getElementById("newData").value=new Date().toISOString().split("T")[0]; }
function toggleParcelasInput() { document.getElementById("divParcelas").style.display = document.getElementById("newParcelado").checked ? "block" : "none"; calcularPrevia(); }
function sairDaConta() { auth.signOut().then(() => location.reload()); }
function salvarNomePerfil() { const n = document.getElementById("inputNomePerfil").value; if(n && auth.currentUser) { db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({nome:n}, {merge:true}); fecharModalPerfil(); } }
function salvarNovaFoto(e) { const f = e.target.files[0]; if(f) { const r = new FileReader(); r.onload = x => { if(auth.currentUser) db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({foto:x.target.result}, {merge:true}); }; r.readAsDataURL(f); } }
function calcularPrevia() {
    const total = parseFloat(document.getElementById("newValor").value) || 0;
    const qtd = parseInt(document.getElementById("newQtd").value) || 0;
    const isParcelado = document.getElementById("newParcelado").checked;
    if (total > 0 && qtd > 0 && isParcelado) {
        document.getElementById("txtPrevia").innerText = `Serão ${qtd}x de R$ ${(total / qtd).toFixed(2)}`;
    } else { document.getElementById("txtPrevia").innerText = ""; }
}
function salvarDividaFormulario() {
    const n = document.getElementById("newNome").value;
    const vOrDica = parseFloat(document.getElementById("newValorOriginal").value) || 0;
    const vAcordo = parseFloat(document.getElementById("newValor").value);
    const dt = document.getElementById("newData").value;
    const isParc = document.getElementById("newParcelado").checked;
    const qtd = isParc ? (parseInt(document.getElementById("newQtd").value) || 0) : 0;
    if (!n || isNaN(vAcordo) || !dt) { alert("Preencha os campos obrigatórios!"); return; }
    dividas.push({
        id: Date.now().toString(), nome: n, valor: isParc && qtd > 0 ? vAcordo / qtd : vAcordo,
        valorTotalOriginal: vAcordo, valorOriginalDica: vOrDica, vencimento: dt, paga: false,
        totalParcelas: qtd, parcelaAtual: isParc ? 1 : 0
    });
    salvar(); fecharModalAdicionar();
}
