/* ================= 0. FIREBASE CONFIGURAÇÃO ================= */
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

/* ================= 1. VARIÁVEIS GLOBAIS ================= */
let dividas = [];
let filtro = "todas";

function fazerLoginFirebase() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;

    if (!email || !senha) { alert("Preencha e-mail e senha!"); return; }

    auth.signInWithEmailAndPassword(email, senha).then(() => {
        entrarNoApp();
    }).catch((error) => {
        alert("Erro: E-mail ou senha incorretos!");
    });
}

// Ouvinte do Firebase (Puxa as dívidas e o perfil assim que loga)
auth.onAuthStateChanged(function(user) {
    if (user) {
        document.getElementById("lock").style.display = "none";
        document.getElementById("app").style.display = "block";
        
        // Puxa Dívidas
        db.collection("dados_limpanome").doc(user.uid)
          .onSnapshot(function(doc) {
              if (doc.exists) {
                  dividas = doc.data().dividas || [];
                  render();
              }
          });
          
        // Puxa Perfil (Foto e Nome)
        db.collection("usuarios_limpanome").doc(user.uid)
          .onSnapshot(function(doc) {
              if (doc.exists) {
                  const dados = doc.data();
                  if(dados.foto) {
                      document.getElementById("fotoPerfil").src = dados.foto;
                      document.getElementById("previewFotoPerfil").src = dados.foto;
                      localStorage.setItem("limpanome_foto", dados.foto);
                  }
                  if(dados.nome) {
                      document.getElementById("nomePerfil").innerText = dados.nome;
                      document.getElementById("inputNomePerfil").value = dados.nome;
                      localStorage.setItem("limpanome_nome", dados.nome);
                  }
              }
          });
    } else {
        document.getElementById("lock").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

function entrarNoApp() {
    document.getElementById("lock").style.display = "none";
    document.getElementById("app").style.display = "block";
    carregarPerfilLocal();
    render();
}

function sairDaConta() {
    if(confirm("Deseja realmente sair?")) {
        auth.signOut().then(() => {
            localStorage.removeItem("dividas_limpanome");
            location.reload();
        });
    }
}

function salvar() {
    localStorage.setItem("dividas_limpanome", JSON.stringify(dividas));
    if (auth.currentUser) {
        db.collection("dados_limpanome").doc(auth.currentUser.uid).set({
            dividas: dividas
        }).catch(e => console.error("Erro ao salvar:", e));
    }
    render();
}

/* ================= 2. PERFIL E FOTO ================= */
function abrirPerfil() { document.getElementById("modalPerfil").style.display = "flex"; }
function fecharModalPerfil() { document.getElementById("modalPerfil").style.display = "none"; }

function carregarPerfilLocal() {
    const foto = localStorage.getItem("limpanome_foto");
    const nome = localStorage.getItem("limpanome_nome");
    if(foto) {
        document.getElementById("fotoPerfil").src = foto;
        document.getElementById("previewFotoPerfil").src = foto;
    }
    if(nome) {
        document.getElementById("nomePerfil").innerText = nome;
        document.getElementById("inputNomePerfil").value = nome;
    }
}

function salvarNovaFoto(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        document.getElementById("fotoPerfil").src = base64;
        document.getElementById("previewFotoPerfil").src = base64;
        localStorage.setItem("limpanome_foto", base64);
        
        if(auth.currentUser) {
            db.collection("usuarios_limpanome").doc(auth.currentUser.uid)
              .set({ foto: base64 }, { merge: true });
        }
    };
    reader.readAsDataURL(file);
}

function salvarNomePerfil() {
    const nome = document.getElementById("inputNomePerfil").value;
    if(!nome) return;
    document.getElementById("nomePerfil").innerText = nome;
    localStorage.setItem("limpanome_nome", nome);
    
    if(auth.currentUser) {
        db.collection("usuarios_limpanome").doc(auth.currentUser.uid)
          .set({ nome: nome }, { merge: true });
    }
    alert("Nome atualizado!");
    fecharModalPerfil();
}


/* ================= 3. RENDERIZAÇÃO ================= */
function setFiltro(novoFiltro, btn) {
    filtro = novoFiltro;
    document.querySelectorAll('.filtros button').forEach(b => b.classList.remove('ativo'));
    if(btn) btn.classList.add('ativo');
    render();
}

const mesAno = d => d.split("-").slice(1, 0).reverse().join("/") || d.substring(5,7) + "/" + d.substring(0,4);
const isoParaBR = d => d.split("-").reverse().join("/");
const brParaISO = d => d.split("/").reverse().join("-");
const proximoMes = d => { const dt = new Date(d + "T12:00:00"); dt.setMonth(dt.getMonth() + 1); return dt.toISOString().split("T")[0]; };

function render() {
    const lista = document.getElementById("lista");
    if(!lista) return;
    lista.innerHTML = "";

    const grupos = {};
    [...dividas].sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(d => {
        const k = mesAno(d.vencimento);
        if(!grupos[k]) grupos[k] = [];
        grupos[k].push(d);
    });

    if (Object.keys(grupos).length === 0) {
        lista.innerHTML = `<div style="text-align:center; padding:30px; color:#666;">Nenhum acordo registrado.</div>`;
        return;
    }

    Object.keys(grupos).forEach(k => {
        const todasDoMes = grupos[k];
        let totalMes = 0, pagoMes = 0;
        
        todasDoMes.forEach(d => {
            totalMes += d.valor;
            if(d.paga) pagoMes += d.valor;
        });

        const faltaMes = totalMes - pagoMes;
        let pct = totalMes > 0 ? (pagoMes / totalMes) * 100 : 0;

        const visiveis = todasDoMes.filter(d => filtro === "pagas" ? d.paga : !d.paga);
        if (visiveis.length === 0 && filtro !== "todas") return;

        const bloco = document.createElement("div");
        bloco.className = "mes-container";
        bloco.innerHTML = `
          <div class="cabecalho-mes"><h3>📅 ${k}</h3></div>
          <div class="resumo-mes">
              <div class="resumo-item"><small>Total Acordos</small><strong class="texto-branco">R$ ${totalMes.toFixed(2)}</strong></div>
              <div class="resumo-item"><small>Quitado</small><strong class="texto-verde">R$ ${pagoMes.toFixed(2)}</strong></div>
              <div class="resumo-item"><small>Falta</small><strong style="color:#ef5350;">R$ ${faltaMes.toFixed(2)}</strong></div>
              <div class="barra-container"><div class="barra-fundo"><div class="barra-preenchimento" style="width: ${pct}%"></div></div><div class="barra-texto">${pct.toFixed(0)}% Pago neste mês</div></div>
          </div>
        `;

        visiveis.forEach(d => {
            const div = document.createElement("div");
            let classes = "conta";
            if (d.paga) classes += " verde";
            
            let descontoHtml = "";
            if(d.valorOriginalDica && d.valorOriginalDica > d.valorTotalOriginal) {
                const desc = d.valorOriginalDica - d.valorTotalOriginal;
                descontoHtml = `<span class="desconto-badge">Economia: R$ ${desc.toFixed(2)}</span>`;
            }

            let parcelasHtml = "";
            if (d.totalParcelas > 0) {
                parcelasHtml = `<div class="info-parcelas"><div>📦 Parcela ${d.parcelaAtual} de ${d.totalParcelas}</div></div>`;
            }

            div.className = classes;
            div.innerHTML = `
                <div style="font-size: 1.1em; margin-bottom: 5px;"><strong>🏦 ${d.nome}</strong> ${descontoHtml}</div>
                <div style="font-size: 1.2em; font-weight: bold; color: ${d.paga ? '#2ecc71' : '#fff'};">💰 R$ ${d.valor.toFixed(2)}</div>
                <div style="margin-top: 5px; color:#aaa;">📅 Vencimento: ${isoParaBR(d.vencimento)}</div>
                ${parcelasHtml}
                
                <div class="acoes-principal">
                    ${!d.paga ? 
                        `<button class="btn-pagar" onclick="pagarDivida('${d.id}')">✅ QUITAR PARCELA</button>` : 
                        `<button class="btn-reverter" onclick="desfazerPagamento('${d.id}')">↩️ DESFAZER</button>`
                    }
                    <button class="btn-expandir" onclick="toggleMenu('${d.id}')">🔻</button>
                </div>
                <div id="menu-${d.id}" class="menu-secundario">
                    <button onclick="editarDivida('${d.id}')">✏️ Editar (Ajustar Juros)</button>
                    <button onclick="copiarPix('${d.id}')">📋 Copiar Boleto/Pix</button>
                    <button onclick="compartilharWhatsApp('${d.id}')">📱 Enviar no WhatsApp</button>
                    <button onclick="excluirDivida('${d.id}')" style="color:#ef5350;">🗑️ Cancelar / Excluir</button>
                </div>
            `;
            bloco.appendChild(div);
        });
        lista.appendChild(bloco);
    });
}

function toggleMenu(id) {
    const menu = document.getElementById(`menu-${id}`);
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

/* ================= 4. CRUD ACORDOS E EDIÇÃO ================= */
function adicionarDivida() {
    document.getElementById("newNome").value = "";
    document.getElementById("newValorOriginal").value = "";
    document.getElementById("newValor").value = "";
    document.getElementById("newData").value = new Date().toISOString().split("T")[0];
    document.getElementById("newParcelado").checked = false;
    document.getElementById("newQtd").value = "";
    toggleParcelasInput();
    document.getElementById("modalNovaDivida").style.display = "flex";
}

function fecharModalAdicionar() { document.getElementById("modalNovaDivida").style.display = "none"; }

function toggleParcelasInput() {
    const check = document.getElementById("newParcelado").checked;
    document.getElementById("divParcelas").style.display = check ? "block" : "none";
    calcularPrevia();
}

function calcularPrevia() {
    const total = parseFloat(document.getElementById("newValor").value) || 0;
    const qtd = parseInt(document.getElementById("newQtd").value) || 0;
    const isParcelado = document.getElementById("newParcelado").checked;
    
    if (total > 0 && qtd > 0 && isParcelado) {
        document.getElementById("txtPrevia").innerText = `Serão ${qtd}x de R$ ${(total / qtd).toFixed(2)}`;
    } else {
        document.getElementById("txtPrevia").innerText = "";
    }
}

function salvarDividaFormulario() {
    const nome = document.getElementById("newNome").value;
    const vOriginalDica = parseFloat(document.getElementById("newValorOriginal").value) || 0;
    const vAcordo = parseFloat(document.getElementById("newValor").value);
    const data = document.getElementById("newData").value;
    const isParcelado = document.getElementById("newParcelado").checked;
    const qtd = isParcelado ? (parseInt(document.getElementById("newQtd").value) || 0) : 0;

    if (!nome || isNaN(vAcordo) || !data) { alert("Preencha o credor, valor do acordo e vencimento!"); return; }

    let valorParcela = vAcordo;
    if (isParcelado && qtd > 0) valorParcela = vAcordo / qtd;

    dividas.push({ 
      id: Date.now().toString(), 
      nome: nome, 
      valor: valorParcela,
      valorTotalOriginal: vAcordo,
      valorOriginalDica: vOriginalDica, 
      vencimento: data, 
      paga: false, 
      totalParcelas: qtd, 
      parcelaAtual: isParcelado ? 1 : 0, 
      codigoPix: ""
    });
  
    salvar();
    fecharModalAdicionar();
}

// NOVA FUNÇÃO: Editar Parcela (juros, nome, data)
function editarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if(!d) return;

    const n = prompt("Nome do Credor:", d.nome);
    if(n === null) return; 

    const v = prompt("Valor da Parcela (Atualize se houver juros):", d.valor);
    if(v === null) return;

    const data = prompt("Data de Vencimento (DD/MM/AAAA):", isoParaBR(d.vencimento));
    if(data === null) return;

    d.nome = n;
    d.valor = parseFloat(v.replace(",", "."));
    d.vencimento = brParaISO(data);
    
    salvar();
}

function pagarDivida(id) {
    if(!confirm("Confirmar quitação desta parcela?")) return;
    const d = dividas.find(x => x.id === id);
    if(!d) return;

    d.paga = true;
    
    if(d.totalParcelas > 0 && d.parcelaAtual < d.totalParcelas) {
        dividas.push({
            ...d, 
            id: Date.now().toString(), 
            paga: false, 
            vencimento: proximoMes(d.vencimento), 
            parcelaAtual: d.parcelaAtual + 1 
        });
    }
    salvar();
}

function desfazerPagamento(id) {
    if(!confirm("Desfazer pagamento?")) return;
    const d = dividas.find(x => x.id === id);
    if(d) { d.paga = false; salvar(); }
}

function excluirDivida(id) {
    if(confirm("Tem certeza que deseja apagar este acordo?")) {
        dividas = dividas.filter(x => x.id !== id);
        salvar();
    }
}

function copiarPix(id) {
    const d = dividas.find(x => x.id === id);
    if(d.codigoPix) {
        navigator.clipboard.writeText(d.codigoPix);
        alert("Código copiado!");
    } else {
        const novo = prompt("Cole a linha digitável do boleto ou Pix:");
        if(novo) { d.codigoPix = novo; salvar(); }
    }
}

function compartilharWhatsApp(id) {
    const d = dividas.find(x => x.id === id);
    let texto = `🤝 *Acordo Serasa: ${d.nome}*\n\n`;
    texto += `💰 Valor a pagar: R$ ${d.valor.toFixed(2)}\n`;
    texto += `📅 Vencimento: ${isoParaBR(d.vencimento)}\n`;
    
    if(d.totalParcelas > 0) {
        texto += `📦 Parcela: ${d.parcelaAtual}/${d.totalParcelas}\n`;
    }
    texto += `\nStatus: ${d.paga ? "✅ QUITADO" : "⭕ PENDENTE"}`;
    
    if(d.codigoPix) texto += `\n\nBoleto/Pix: ${d.codigoPix}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`);
}

/* ================= CALCULADORA ================= */
let calcExp = "";
function abrirCalculadora() { document.getElementById("modalCalc").style.display = "flex"; }
function fecharCalculadora() { document.getElementById("modalCalc").style.display = "none"; }
function calcAdd(v) { calcExp += v; document.getElementById("calcDisplay").value = calcExp; }
function calcLimpar() { calcExp = ""; document.getElementById("calcDisplay").value = ""; }
function calcCalcular() { try { document.getElementById("calcDisplay").value = eval(calcExp); } catch { alert("Erro"); } }

document.addEventListener("DOMContentLoaded", () => {
    const dados = localStorage.getItem("dividas_limpanome");
    if(dados) { dividas = JSON.parse(dados); render(); }
    carregarPerfilLocal();
});
