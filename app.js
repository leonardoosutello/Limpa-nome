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

// IDs de contas ocultadas no fluxo (persiste só na sessão; não apaga do banco)
let fluxoOcultos = new Set();

/* ================= AUTH ================= */
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
                if (d.foto) { document.getElementById("fotoPerfil").src = d.foto; document.getElementById("previewFotoPerfil").src = d.foto; }
                if (d.nome) { document.getElementById("nomePerfil").innerText = d.nome; document.getElementById("inputNomePerfil").value = d.nome; }
            }
        });
    } else {
        document.getElementById("lock").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

function fazerLoginFirebase() {
    const e = document.getElementById("loginEmail").value;
    const s = document.getElementById("loginSenha").value;
    if (e && s) auth.signInWithEmailAndPassword(e, s).catch(() => alert("E-mail ou senha incorretos."));
}

/* ================= RENDERIZAÇÃO ================= */
function render() {
    const lista = document.getElementById("lista");
    if (!lista) return;
    lista.innerHTML = "";

    const grupos = {};
    [...dividas].sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(d => {
        const dt = new Date(d.vencimento + "T12:00:00");
        const k = (dt.getMonth() + 1).toString().padStart(2, '0') + "/" + dt.getFullYear();
        if (!grupos[k]) grupos[k] = [];
        grupos[k].push(d);
    });

    const meses = {
        "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
        "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
        "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };

    Object.keys(grupos).forEach(k => {
        const todasDoMes = grupos[k];
        const visiveis = todasDoMes.filter(d => filtro === "pagas" ? d.paga : !d.paga);
        if (visiveis.length === 0) return;

        let totalMes = 0, pagoMes = 0;
        todasDoMes.forEach(d => { totalMes += d.valor; if (d.paga) pagoMes += d.valor; });
        const falta = totalMes - pagoMes;
        const pct = totalMes > 0 ? (pagoMes / totalMes) * 100 : 0;

        const [mm, yyyy] = k.split("/");
        const nomeMes = (meses[mm] || mm) + " " + yyyy;

        const bloco = document.createElement("div");
        bloco.className = "mes-container";
        bloco.innerHTML = `
          <div class="cabecalho-mes"><h3>${nomeMes}</h3></div>
          <div class="resumo-mes">
            <div class="resumo-item">
              <small>Total</small>
              <strong style="color:var(--text);">R$ ${totalMes.toFixed(2)}</strong>
            </div>
            <div class="resumo-item">
              <small>Quitado</small>
              <strong style="color:var(--green);">R$ ${pagoMes.toFixed(2)}</strong>
            </div>
            <div class="resumo-item">
              <small>Pendente</small>
              <strong style="color:var(--red);">R$ ${falta.toFixed(2)}</strong>
            </div>
            <div class="barra-row">
              <div class="barra-fundo"><div class="barra-preenchimento" style="width:${pct}%"></div></div>
              <div class="barra-label">${pct.toFixed(0)}% pago neste mês</div>
            </div>
          </div>`;

        visiveis.forEach(d => {
            const div = document.createElement("div");
            div.className = d.paga ? "conta verde" : "conta";
            div.innerHTML = `
              <div class="conta-header">
                <span class="conta-nome">🏦 ${d.nome}</span>
                ${d.paga ? '<span class="badge-pago">✓ Quitado</span>' : ''}
              </div>
              <div class="conta-valor">R$ ${d.valor.toFixed(2)}</div>
              <div class="conta-vencimento">📅 Vence em ${d.vencimento.split("-").reverse().join("/")}</div>
              <div class="conta-parcela">📦 Parcela ${d.parcelaAtual || 1} de ${d.totalParcelas || 1}</div>

              <div class="acoes-principal">
                <button class="btn-pagar" onclick="pagarDivida('${d.id}')">✅ Quitar parcela</button>
                <button class="btn-expandir" onclick="toggleMenu('${d.id}')">⋯</button>
              </div>

              <div id="menu-${d.id}" class="menu-secundario">
                <button onclick="editarDivida('${d.id}')">✏️ Editar (ajustar juros)</button>
                <button onclick="alert('Em breve!')">📋 Copiar boleto / Pix</button>
                <button onclick="alert('Abrindo WhatsApp...')">📱 Enviar no WhatsApp</button>
                <button class="menu-btn-danger" onclick="excluirDivida('${d.id}')">🗑️ Cancelar / Excluir</button>
              </div>`;
            bloco.appendChild(div);
        });

        lista.appendChild(bloco);
    });

    if (!Object.keys(grupos).length) {
        lista.innerHTML = '<div class="vazio">Nenhum acordo encontrado.</div>';
    }
}

/* ================= FLUXO DIÁRIO (só dados_financeiros) ================= */
function gerarAnaliseDiaria() {
    const selecao = document.getElementById("mesFiltroAnalise").value;
    const corpo = document.getElementById("corpoAnalise");

    if (!selecao) {
        alert("Selecione o mês e o ano.");
        return;
    }

    const [anoAlvo, mesAlvo] = selecao.split("-").map(Number);
    const totais = {};

    // Só usa contasFinanceiras (dados_financeiros) — não mistura dívidas do limpanome
    contasFinanceiras.forEach(c => {
        const dt = new Date(c.vencimento + "T12:00:00");
        if ((dt.getMonth() + 1) === mesAlvo && dt.getFullYear() === anoAlvo) {
            const dia = dt.getDate().toString().padStart(2, '0');
            if (!totais[dia]) totais[dia] = { itens: [] };
            totais[dia].itens.push(c);
        }
    });

    const dias = Object.keys(totais).sort();
    if (!dias.length) {
        corpo.innerHTML = `<p class="vazio">Nenhuma conta encontrada para ${mesAlvo.toString().padStart(2,'0')}/${anoAlvo}.</p>`;
        return;
    }

    let h = "";
    dias.forEach(dia => {
        const itens = totais[dia].itens;

        // Gera uid único e seguro para cada item (sem espaços/aspas que quebram o onclick)
        const itensComUid = itens.map((c, idx) => ({
            c,
            uid: (c.id && String(c.id) !== "undefined")
                ? String(c.id)
                : "item_" + dia + "_" + idx
        }));

        // Só conta nos totais os itens não ocultos
        let totalDia = 0, pagoDia = 0;
        itensComUid.forEach(({ c, uid }) => {
            if (!fluxoOcultos.has(uid)) {
                totalDia += c.valor || 0;
                if (c.paga) pagoDia += c.valor || 0;
            }
        });
        const pendenteDia = totalDia - pagoDia;

        let itensHTML = "";
        itensComUid.forEach(({ c, uid }) => {
            const oculto = fluxoOcultos.has(uid);
            if (oculto) {
                // Mostra riscado com botão Desfazer
                itensHTML += `
                  <div class="fluxo-item" style="opacity:0.45;">
                    <div class="fluxo-item-info">
                      <div class="fluxo-item-nome" style="text-decoration:line-through;">${c.nome || 'Sem nome'}</div>
                      <div class="fluxo-item-tipo" style="font-style:italic;">Ocultada</div>
                    </div>
                    <div class="fluxo-item-right">
                      <span class="fluxo-item-valor" style="text-decoration:line-through; color:#888;">
                        R$ ${(c.valor || 0).toFixed(2)}
                      </span>
                      <button class="btn-ocultar-fluxo" style="border-color:#2ecc71; color:#2ecc71;" onclick="mostrarFluxoItem('${uid}')">Desfazer</button>
                    </div>
                  </div>`;
            } else {
                itensHTML += `
                  <div class="fluxo-item">
                    <div class="fluxo-item-info">
                      <div class="fluxo-item-nome">${c.nome || 'Sem nome'}</div>
                      <div class="fluxo-item-tipo">Pagador: ${c.pagador || 'N/A'}</div>
                    </div>
                    <div class="fluxo-item-right">
                      <span class="fluxo-item-valor ${c.paga ? 'valor-pago' : 'valor-pendente'}">
                        R$ ${(c.valor || 0).toFixed(2)}
                      </span>
                      <button class="btn-ocultar-fluxo" onclick="ocultarFluxoItem('${uid}')">Ocultar</button>
                    </div>
                  </div>`;
            }
        });

        h += `
          <div class="fluxo-dia">
            <div class="fluxo-dia-header">
              <span class="fluxo-dia-data">Dia ${dia}/${mesAlvo.toString().padStart(2,'0')}</span>
              <span class="fluxo-dia-total">R$ ${totalDia.toFixed(2)}</span>
            </div>
            ${itensHTML}
            ${(pagoDia > 0 || pendenteDia > 0) ? `
            <div class="fluxo-totais">
              ${pagoDia > 0 ? `<div class="fluxo-tag tag-pago">✓ Pago R$ ${pagoDia.toFixed(2)}</div>` : ''}
              ${pendenteDia > 0 ? `<div class="fluxo-tag tag-falta">⏳ Falta R$ ${pendenteDia.toFixed(2)}</div>` : ''}
            </div>` : ''}
          </div>`;
    });

    corpo.innerHTML = h || `<p class="vazio">Nenhuma conta visível para ${mesAlvo.toString().padStart(2,'0')}/${anoAlvo}.</p>`;
}

function ocultarFluxoItem(uid) {
    fluxoOcultos.add(uid);
    const selecao = document.getElementById("mesFiltroAnalise").value;
    if (selecao) gerarAnaliseDiaria();
}

function mostrarFluxoItem(uid) {
    fluxoOcultos.delete(uid);
    const selecao = document.getElementById("mesFiltroAnalise").value;
    if (selecao) gerarAnaliseDiaria();
}

/* ================= EDIÇÃO ================= */
function editarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if (!d) return;
    const novoNome = prompt("Nome do Credor:", d.nome);
    if (novoNome === null) return;
    const novoValor = prompt("Valor da Parcela:", d.valor);
    if (novoValor === null) return;
    const novaData = prompt("Vencimento (AAAA-MM-DD):", d.vencimento);
    if (novaData === null) return;
    d.nome = novoNome;
    d.valor = parseFloat(novoValor.replace(",", "."));
    d.vencimento = novaData;
    salvar();
    alert("Atualizado com sucesso!");
}

/* ================= OUTRAS FUNÇÕES ================= */
function salvar() {
    if (auth.currentUser) db.collection("dados_limpanome").doc(auth.currentUser.uid).set({ dividas });
    render();
}

function pagarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if (!d) return;
    d.paga = true;
    if (d.totalParcelas > 0 && d.parcelaAtual < d.totalParcelas) {
        const dt = new Date(d.vencimento + "T12:00:00");
        dt.setMonth(dt.getMonth() + 1);
        dividas.push({
            ...d,
            id: Date.now().toString(),
            paga: false,
            parcelaAtual: (d.parcelaAtual || 1) + 1,
            vencimento: dt.toISOString().split("T")[0]
        });
    }
    salvar();
}

function toggleMenu(id) {
    const m = document.getElementById(`menu-${id}`);
    m.style.display = (m.style.display === "none" || m.style.display === "") ? "flex" : "none";
}

function setFiltro(f, b) {
    filtro = f;
    document.querySelectorAll('.filtros button').forEach(x => x.classList.remove('ativo'));
    b.classList.add('ativo');
    render();
}

function excluirDivida(id) {
    if (confirm("Excluir definitivamente?")) {
        dividas = dividas.filter(x => x.id !== id);
        salvar();
    }
}

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

function adicionarDivida() {
    document.getElementById("modalNovaDivida").style.display = "flex";
    document.getElementById("newData").value = new Date().toISOString().split("T")[0];
}

function toggleParcelasInput() {
    document.getElementById("divParcelas").style.display =
        document.getElementById("newParcelado").checked ? "block" : "none";
    calcularPrevia();
}

function sairDaConta() { auth.signOut().then(() => location.reload()); }

function salvarNomePerfil() {
    const n = document.getElementById("inputNomePerfil").value;
    if (n && auth.currentUser) {
        db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({ nome: n }, { merge: true });
        fecharModalPerfil();
    }
}

function salvarNovaFoto(e) {
    const f = e.target.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = x => {
            if (auth.currentUser)
                db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({ foto: x.target.result }, { merge: true });
        };
        r.readAsDataURL(f);
    }
}

function calcularPrevia() {
    const total = parseFloat(document.getElementById("newValor").value) || 0;
    const qtd = parseInt(document.getElementById("newQtd").value) || 0;
    const isParcelado = document.getElementById("newParcelado").checked;
    if (total > 0 && qtd > 0 && isParcelado) {
        document.getElementById("txtPrevia").innerText = `${qtd}x de R$ ${(total / qtd).toFixed(2)}`;
    } else {
        document.getElementById("txtPrevia").innerText = "";
    }
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
        id: Date.now().toString(),
        nome: n,
        valor: isParc && qtd > 0 ? vAcordo / qtd : vAcordo,
        valorTotalOriginal: vAcordo,
        valorOriginalDica: vOrDica,
        vencimento: dt,
        paga: false,
        totalParcelas: qtd,
        parcelaAtual: isParc ? 1 : 0
    });
    salvar();
    fecharModalAdicionar();
}
