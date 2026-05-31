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

// Chave do Gemini - ambiente autogerencia o token
const apiKey = "AQ.Ab8RN6L0R00-GdFKydBTO7fPeoyGU2ahRHJ2TMNLKMFEDK0R5A"; 

let dividas = []; 
let contasFinanceiras = []; 
let filtro = "todas"; 
let usuarioNomeAtual = "Usuário";

// Histórico local de mensagens do chat do Sutello AI
let sutelloChatMessages = [];

/* ================= LOGIN E ESTADO ================= */
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById("lock").style.display = "none";
        document.getElementById("app").style.display = "block";
        db.collection("dados_limpanome").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) { dividas = doc.data().dividas || []; render(); }
        }, err => console.error("Erro dados_limpanome:", err));
        
        db.collection("dados_financeiros").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) { contasFinanceiras = doc.data().contas || []; }
        }, err => console.error("Erro dados_financeiros:", err));
        
        db.collection("usuarios_limpanome").doc(user.uid).onSnapshot(doc => {
            if (doc.exists) {
                const d = doc.data();
                if(d.foto) { document.getElementById("fotoPerfil").src = d.foto; document.getElementById("previewFotoPerfil").src = d.foto; }
                if(d.nome) { 
                    usuarioNomeAtual = d.nome;
                    document.getElementById("nomePerfil").innerText = d.nome; 
                    document.getElementById("inputNomePerfil").value = d.nome; 
                }
            }
        }, err => console.error("Erro usuarios_limpanome:", err));
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

/* ================= RENDERIZAÇÃO PRINCIPAL ================= */
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

/* ================= CHAT DO SUTELLO AI ================= */

// Abre o Modal do Chat do Sutello AI
function abrirSutelloChat() {
    document.getElementById("modalSutelloChat").style.display = "flex";
    
    // Se o chat estiver vazio, envia a mensagem de boas-vindas do Sutello
    const container = document.getElementById("chatHistoryContainer");
    if (container && container.innerHTML.trim() === "") {
        const d = new Date();
        const saudacao = d.getHours() < 12 ? "Bom dia" : (d.getHours() < 18 ? "Boa tarde" : "Boa noite");
        
        const textoBoasVindas = `Olá, **${usuarioNomeAtual}**! ${saudacao}! 🤝 

Sou o **Sutello Ai**, seu assistente inteligente de organização financeira. Consigo ver todos os seus acordos de dívidas cadastrados aqui, além das contas correntes do seu outro app de finanças.

**Como posso te ajudar hoje?** Você pode me perguntar coisas como:
* *"Me mostre o resumo de junho de 2026"*
* *"O que tenho pendente para pagar no dia 15?"*
* *"Quanto eu já paguei esse mês?"*
* *"Quais contas vencem hoje?"*

Escolha uma das sugestões abaixo ou digite sua pergunta! 📈`;

        adicionarMensagemUI("sutello", textoBoasVindas);
    }
}

// Fecha o Modal do Chat do Sutello AI
function fecharSutelloChat() {
    document.getElementById("modalSutelloChat").style.display = "none";
}

// Insere uma mensagem visualmente no chat
function adicionarMensagemUI(remetente, texto) {
    const container = document.getElementById("chatHistoryContainer");
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.className = "chat-bubble-wrapper";
    
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${remetente}`;
    bubble.innerHTML = formatarMarkdown(texto);
    
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// Formata texto markdown recebido da IA de maneira segura e estilizada
function formatarMarkdown(texto) {
    if (!texto) return "";
    
    // Escapa tags perigosas de injeção mantendo quebras de linha e estruturação
    let html = texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Negritos (**texto**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Itálicos (*texto*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Listas com bullets (- ou *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<div style="display:flex; align-items:flex-start; gap:6px; margin: 5px 0 5px 12px;"><span style="color:#7b2ff7; font-weight:bold;">•</span><span>$1</span></div>');

    // Quebras de linha normais
    html = html.replace(/\n/g, '<br>');

    // Badges customizadas de visualização rica
    html = html
        .replace(/🟢 PAGO/gi, '<span style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">🟢 PAGO</span>')
        .replace(/🔴 PENDENTE/gi, '<span style="background: rgba(239, 83, 80, 0.2); color: #ef5350; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">🔴 PENDENTE</span>')
        .replace(/⏳ PENDENTE/gi, '<span style="background: rgba(241, 196, 15, 0.2); color: #f1c40f; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">⏳ PENDENTE</span>')
        .replace(/\[ACORDO\]/gi, '<span style="background: rgba(123, 47, 247, 0.2); color: #7b2ff7; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">🏦 ACORDO</span>')
        .replace(/\[FINANCEIRO\]/gi, '<span style="background: rgba(52, 152, 219, 0.2); color: #3498db; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">💳 FINANCEIRO</span>');

    return html;
}

// Dispara mensagem através dos botões de sugestões rápidas
function enviarTextoSugerido(texto) {
    document.getElementById("chatInputField").value = texto;
    enviarMensagemSutello();
}

// Constrói o Prompt de Sistema com as informações reais consolidadas de ambos os apps
function obterPromptSutello() {
    const hoje = new Date();
    const dataHojeStr = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;
    
    // Serializa todos os acordos cadastrados neste app
    const acordosFormatados = dividas.map(d => {
        return `- ${d.nome}: R$ ${d.valor.toFixed(2)} | Vencimento original: ${d.vencimento.split("-").reverse().join("/")} | Status: ${d.paga ? 'PAGO' : 'PENDENTE'} | Parcela: ${d.parcelaAtual || 1}/${d.totalParcelas || 1} [ACORDO]`;
    }).join('\n');

    // Serializa todas as contas de finanças recebidas em tempo real do outro app
    const contasFormatadas = contasFinanceiras.map(c => {
        return `- ${c.nome}: R$ ${c.valor.toFixed(2)} | Vencimento original: ${c.vencimento.split("-").reverse().join("/")} | Status: ${c.paga ? 'PAGO' : 'PENDENTE'} | Pagador: ${c.pagador || 'Não informado'} [FINANCEIRO]`;
    }).join('\n');

    return `Você é o "Sutello", um assistente de Inteligência Artificial amigável, inteligente e altamente focado em organização financeira e controle de dívidas, perfeitamente integrado no aplicativo "Limpa Nome". 
Sua personalidade é prestativa, transparente, motivadora e muito clara. Trate o usuário com carinho, chamando-o pelo nome dele, que é: ${usuarioNomeAtual}.

Data de Referência Atual do Dispositivo do Usuário: Hoje é dia ${dataHojeStr}.

Abaixo está o banco de dados em tempo real do usuário, sincronizado do Firestore:

=== ACORDOS CADASTRADOS NESTE APP (Limpa Nome) ===
${acordosFormatados || "Nenhum acordo de dívida cadastrado no momento."}

=== CONTAS DO OUTRO APP DE FINANÇAS ===
${contasFormatadas || "Nenhuma conta corrente financeira encontrada no momento."}

DIRETRIZES DE RESPOSTA (IMPORTANTÍSSIMAS):
1. Sempre responda em português brasileiro (pt-BR).
2. Quando o usuário perguntar sobre um mês específico (ex: "me mostre o mês de junho de 2026"):
   - Filtre todos os Acordos e Contas Financeiras com vencimento no mês e ano selecionados.
   - Apresente primeiro um painel resumo: Valor total somado do mês, Valor total já pago (PAGO), Valor total restante pendente (PENDENTE) e percentual quitado.
   - Em seguida, liste os itens do mês de forma cronológica, agrupados por dia, destacando se é do tipo [ACORDO] ou [FINANCEIRO] e se o status é 🟢 PAGO ou 🔴 PENDENTE de forma clara.
3. Se o usuário pedir para analisar apenas um dia específico (ex: "dia 15 de junho de 2026"):
   - Filtre as contas e acordos desse dia.
   - Faça a soma total de vencimentos daquele dia.
   - Faça a soma do que já foi pago e o que está pendente no dia.
   - Liste detalhadamente as contas com os marcadores [ACORDO], [FINANCEIRO], 🟢 PAGO ou 🔴 PENDENTE.
4. Se ele pedir filtros específicos como "penas contas que faltam pagar no dia 15" ou "contas pendentes desse mês", filtre e exiba apenas as que têm o status de PENDENTE.
5. Se ele pedir o valor total pago em um período, faça a soma matemática estritamente dos itens marcados como PAGO e forneça o total formatado como "R$ XX,XX".
6. Sempre que falar de valores monetários, formate como "R$ XX,XX" (com vírgula para centavos).
7. Mantenha os cálculos matemáticos 100% precisos e baseados unicamente nas listas acima. Não invente dívidas ou transações que não estejam descritas ali.
8. Seja um parceiro conversador! Se ele mandar "oi", "bom dia" ou quiser conversar sobre economia, dê conselhos financeiros encorajadores, cite que você tem acesso aos acordos dele e mostre que ele pode perguntar sobre vencimentos específicos.`;
}

// Faz a requisição à API do Gemini com suporte a Exponential Backoff
async function callGeminiWithRetry(systemPrompt, userText, attempt = 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        if (attempt < 5) {
            // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return callGeminiWithRetry(systemPrompt, userText, attempt + 1);
        } else {
            throw error;
        }
    }
}

// Envia a mensagem digitada pelo usuário e gerencia a IA
async function enviarMensagemSutello() {
    const inputField = document.getElementById("chatInputField");
    if (!inputField) return;

    const textoUsuario = inputField.value.trim();
    if (textoUsuario === "") return;

    // Adiciona o texto do usuário na tela e limpa o input
    adicionarMensagemUI("user", textoUsuario);
    inputField.value = "";

    // Adiciona o balão de "Digitando..." com 3 pontinhos animados
    const container = document.getElementById("chatHistoryContainer");
    const wrapperTyping = document.createElement("div");
    wrapperTyping.className = "chat-bubble-wrapper";
    wrapperTyping.id = "sutello-typing-wrapper";
    
    const typingIndicator = document.createElement("div");
    typingIndicator.className = "chat-typing-indicator";
    typingIndicator.innerHTML = `
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
    `;
    wrapperTyping.appendChild(typingIndicator);
    container.appendChild(wrapperTyping);
    container.scrollTop = container.scrollHeight;

    try {
        const systemPrompt = obterPromptSutello();
        const apiResponse = await callGeminiWithRetry(systemPrompt, textoUsuario);
        
        // Remove indicador de digitando
        const typingEl = document.getElementById("sutello-typing-wrapper");
        if (typingEl) typingEl.remove();

        // Extrai a resposta de texto retornada pela IA
        const textoIA = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textoIA) {
            adicionarMensagemUI("sutello", textoIA);
        } else {
            adicionarMensagemUI("sutello", "Desculpe, tive um probleminha para entender a resposta. Você poderia tentar novamente?");
        }
    } catch (e) {
        // Trata erro removendo indicador e mostrando aviso amigável do Sutello
        const typingEl = document.getElementById("sutello-typing-wrapper");
        if (typingEl) typingEl.remove();
        
        adicionarMensagemUI("sutello", "⚠️ **Desculpe!** Parece que estou temporariamente sem conexão com meus servidores de IA. Vamos tentar novamente em alguns segundos?");
    }
}


/* ================= OUTRAS FUNÇÕES DO APP ================= */
function salvar() { 
    if(auth.currentUser) {
        db.collection("dados_limpanome").doc(auth.currentUser.uid).set({dividas})
            .catch(err => console.error("Erro ao salvar:", err));
    } 
    render(); 
}

function pagarDivida(id) {
    const d = dividas.find(x => x.id === id);
    if(!d) return;
    d.paga = true;
    if(d.totalParcelas > 0 && d.parcelaAtual < d.totalParcelas) {
        const dt = new Date(d.vencimento + "T12:00:00"); dt.setMonth(dt.getMonth() + 1);
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
    if(confirm("Excluir definitivamente?")) { 
        dividas = dividas.filter(x => x.id !== id); 
        salvar(); 
    } 
}

function desfazerPagamento(id) { 
    const d = dividas.find(x => x.id === id); 
    if(d) { d.paga = false; salvar(); } 
}

function calcAdd(v) { document.getElementById("calcDisplay").value += v; }
function calcLimpar() { document.getElementById("calcDisplay").value = ""; }
function calcCalcular() { 
    try { 
        const d = document.getElementById("calcDisplay"); 
        d.value = eval(d.value); 
    } catch(e) { 
        alert("Erro no cálculo"); 
    } 
}

function abrirCalculadora() { document.getElementById("modalCalc").style.display = "flex"; }
function fecharCalculadora() { document.getElementById("modalCalc").style.display = "none"; }

function abrirPerfil() { document.getElementById("modalPerfil").style.display = "flex"; }
function fecharModalPerfil() { document.getElementById("modalPerfil").style.display = "none"; }
function fecharModalAdicionar() { document.getElementById("modalNovaDivida").style.display = "none"; }
function adicionarDivida() { 
    document.getElementById("modalNovaDivida").style.display = "flex"; 
    document.getElementById("newData").value = new Date().toISOString().split("T")[0]; 
}

function toggleParcelasInput() { 
    document.getElementById("divParcelas").style.display = document.getElementById("newParcelado").checked ? "block" : "none"; 
    calcularPrevia(); 
}

function sairDaConta() { auth.signOut().then(() => location.reload()); }

function salvarNomePerfil() { 
    const n = document.getElementById("inputNomePerfil").value; 
    if(n && auth.currentUser) { 
        db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({nome:n}, {merge:true}); 
        fecharModalPerfil(); 
    } 
}

function salvarNovaFoto(e) { 
    const f = e.target.files[0]; 
    if(f) { 
        const r = new FileReader(); 
        r.onload = x => { 
            if(auth.currentUser) db.collection("usuarios_limpanome").doc(auth.currentUser.uid).set({foto:x.target.result}, {merge:true}); 
        }; 
        r.readAsDataURL(f); 
    } 
}

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