// =====================================================
//  Inova Isnack - site do aluno (conectado ao servidor)
// =====================================================

const CHAVE_MEUS = 'meus_pedidos_inovaisnack';  // códigos dos pedidos feitos neste navegador

let produtos = [];
let carrinho = [];            // { id, nome, preco, qtd }
let categoriaAtual = 'todos';

const ROTULO_STATUS = { novo: 'Pendente', preparando: 'Em preparo', pronto: 'Pronto para Retirada', entregue: 'Entregue' };
const COR_STATUS = { novo: '#d32f2f', preparando: '#ef6c00', pronto: '#2e7d32', entregue: '#555555' };

// ---------- Utilidades ----------

const reais = v => Number(v).toFixed(2).replace('.', ',');
const visivel = id => !document.getElementById(id).classList.contains('hidden');

// Evita que um nome com <tags> quebre a página
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

let temporizadorAviso;
function aviso(texto, erro = false) {
    const el = document.getElementById('aviso');
    el.textContent = texto;
    el.className = 'aviso' + (erro ? ' erro' : '');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => el.classList.add('hidden'), 3500);
}

async function api(url, { method = 'GET', json } = {}) {
    const cab = {};
    let body;
    if (json) {
        cab['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    }
    const res = await fetch(url, { method, headers: cab, body });
    let dados = null;
    try { dados = await res.json(); } catch (e) { /* resposta sem JSON */ }
    if (!res.ok) throw new Error((dados && dados.erro) || 'Erro inesperado.');
    return dados;
}

function lerMeusCodigos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_MEUS)) || []; } catch (e) { return []; }
}
function guardarCodigo(codigo) {
    const lista = [codigo, ...lerMeusCodigos()].slice(0, 20);
    localStorage.setItem(CHAVE_MEUS, JSON.stringify(lista));
}

// ---------- Início ----------

document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    atualizarContadorCarrinho();

    // Atualização automática
    setInterval(() => {
        if (visivel('tela-perfil')) carregarMeusPedidos();
    }, 5000);
    setInterval(() => {
        if (visivel('tela-menu')) carregarProdutos(true);   // mantém o estoque disponível em dia
    }, 15000);
});

// ---------- Navegação ----------

function mostrarTela(nomeTela, event) {
    document.querySelectorAll('.section-page').forEach(s => s.classList.add('hidden'));
    const alvo = document.getElementById(`tela-${nomeTela}`);
    if (alvo) alvo.classList.remove('hidden');

    if (event && event.currentTarget) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    if (nomeTela === 'menu') carregarProdutos();
    if (nomeTela === 'perfil') carregarMeusPedidos();
}

// ---------- Menu (cardápio) ----------

async function carregarProdutos(silencioso = false) {
    try {
        produtos = await api('/api/produtos');
    } catch (e) {
        if (!silencioso) aviso('Não foi possível carregar o cardápio.', true);
        return;
    }
    renderizarMenu();
}

function filtrarMenu(categoria, event) {
    categoriaAtual = categoria;

    document.querySelectorAll('#tela-menu .subnav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = '#64748b';
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
        event.currentTarget.style.backgroundColor = '#0b1e4f';
    }
    renderizarMenu();
}

function renderizarMenu() {
    const container = document.getElementById('lista-menu-produtos');
    if (!container) return;

    const lista = categoriaAtual === 'todos' ? produtos : produtos.filter(p => p.categoria === categoriaAtual);

    if (lista.length === 0) {
        container.innerHTML = '<p>Nenhum produto encontrado nesta categoria.</p>';
        return;
    }

    container.innerHTML = lista.map(p => {
        const imagem = p.foto
            ? `<div class="item-img-container"><img class="item-img-real" src="${esc(p.foto)}" alt="${esc(p.nome)}"></div>`
            : '<div class="item-img-placeholder">ITEM</div>';

        // disponivel === null significa "sem controle de estoque"
        const esgotado = p.disponivel !== null && p.disponivel <= 0;
        const poucos = p.disponivel !== null && p.disponivel > 0 && p.disponivel <= 5;
        const aviso_estoque = esgotado
            ? '<p class="estoque-aviso">Esgotado</p>'
            : pocos ? `<p class="estoque-aviso">Restam apenas ${p.disponivel}</p>` : '';
        const botao = esgotado
            ? '<button class="btn-primary" disabled>Esgotado</button>'
            : `<button class="btn-primary" onclick="adicionarAoCarrinho(${p.id})">Adicionar ao Pedido</button>`;

        return `
            <div class="menu-card" style="margin-bottom: 15px;">
                ${imagem}
                <div class="item-info">
                    <h3>${esc(p.nome)}</h3>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 2px;">Categoria: <strong>${esc(p.categoria)}</strong></p>
                    <p class="item-desc">${esc(p.descricao)}</p>
                    <span class="item-price">R$ ${reais(p.preco)}</span>
                    ${aviso_estoque}
                    ${botao}
                </div>
            </div>
        `;
    }).join('');
}

// ---------- Carrinho ----------

function adicionarAoCarrinho(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;

    const existente = carrinho.find(i => i.id === id);
    const qtdAtual = existente ? existente.qtd : 0;

    if (p.disponivel !== null && qtdAtual + 1 > p.disponivel) {
        aviso(`Só há ${p.disponivel} unidade(s) de "${p.nome}" disponível(is).`, true);
        return;
    }

    if (existente) {
        existente.qtd += 1;
    } else {
        carrinho.push({ id: p.id, nome: p.nome, preco: p.preco, qtd: 1 });
    }
    atualizarContadorCarrinho();
    aviso(`"${p.nome}" adicionado ao pedido!`);
}

function atualizarContadorCarrinho() {
    const totalItens = carrinho.reduce((acc, i) => acc + i.qtd, 0);
    const counter = document.getElementById('cart-counter');
    if (counter) counter.innerText = totalItens;
}

function abrirCarrinho() {
    const modal = document.getElementById('modal-carrinho');
    const lista = document.getElementById('itens-carrinho-lista');
    const totalSpan = document.getElementById('total-carrinho');
    if (!modal) return;

    if (carrinho.length === 0) {
        lista.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px 0;">Seu carrinho está vazio.</p>';
        totalSpan.innerText = '0,00';
    } else {
        let valorTotal = 0;
        lista.innerHTML = carrinho.map((item, index) => {
            const subtotal = item.preco * item.qtd;
            valorTotal += subtotal;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                    <span>${esc(item.nome)} (<strong>x${item.qtd}</strong>)</span>
                    <span style="font-weight: bold; color: #0b1e4f;">R$ ${reais(subtotal)} <button onclick="removerItemCarrinho(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:8px; font-weight:bold;">✕</button></span>
                </div>
            `;
        }).join('');
        totalSpan.innerText = reais(valorTotal);
    }

    modal.classList.remove('hidden');
}

function fecharCarrinho() {
    const modal = document.getElementById('modal-carrinho');
    if (modal) modal.classList.add('hidden');
}

function removerItemCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarContadorCarrinho();
    abrirCarrinho();
}

function esvaziarCarrinho() {
    if (carrinho.length === 0) return;
    if (confirm('Tem certeza que deseja limpar todos os itens do carrinho?')) {
        carrinho = [];
        atualizarContadorCarrinho();
        abrirCarrinho();
    }
}

async function finalizarPedido(event) {
    event.preventDefault();
    if (carrinho.length === 0) {
        aviso('Adicione ao menos um item ao seu pedido.', true);
        return;
    }

    const form = event.target;
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
        const resposta = await api('/api/pedidos', {
            method: 'POST',
            json: {
                aluno: document.getElementById('nome-aluno').value,
                turma: document.getElementById('turma-aluno').value,
                pagamento: document.getElementById('forma-pagamento').value,
                itens: carrinho.map(i => ({ produto_id: i.id, quantidade: i.qtd }))
            }
        });
        guardarCodigo(resposta.codigo);
        carrinho = [];
        atualizarContadorCarrinho();
        form.reset();
        fecharCarrinho();
        aviso(`Pedido nº ${resposta.id} enviado à cantina com sucesso!`);
    } catch (e) {
        aviso(e.message, true);
    } finally {
        botao.disabled = false;
        carregarProdutos(true);   // atualiza o estoque disponível mostrado no menu
    }
}

// ---------- Perfil (Meus Pedidos) ----------

async function carregarMeusPedidos() {
    const container = document.getElementById('lista-meus-pedidos');
    if (!container) return;

    const codigos = lerMeusCodigos();
    if (codigos.length === 0) {
        container.innerHTML = '<p style="color: #64748b;">Nenhum pedido encontrado. Faça um pedido pelo Menu!</p>';
        return;
    }

    try {
        const lista = await api('/api/meus-pedidos?codigos=' + codigos.join(','));
        if (lista.length === 0) {
            container.innerHTML = '<p style="color: #64748b;">Nenhum pedido encontrado. Faça um pedido pelo Menu!</p>';
            return;
        }
        container.innerHTML = lista.map(p => {
            const isPronto = p.status === 'pronto';
            const statusBg = isPronto ? '#dcfce7' : '#fef3c7';
            const statusColor = isPronto ? '#166534' : '#92400e';
            const pagoBadge = p.pago
                ? '<span style="background-color: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 5px;">Pago</span>'
                : '<span style="background-color: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 5px;">Pendente de Pagamento</span>';

            // Botão de cancelar aparece apenas se o pedido estiver como 'novo' (Pendente)
            const botaoCancelar = p.status === 'novo'
                ? `<button onclick="cancelarPedido('${p.codigo}')" class="btn-danger-custom" style="padding: 6px 12px; font-size: 12px; margin-top: 10px;">❌ Cancelar Pedido</button>`
                : '';

            return `
                <div style="background-color: #ffffff; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <h4 style="color: #0b1e4f; font-size: 16px;">Pedido nº ${p.id} <span style="font-weight: normal; color: #64748b; font-size: 13px;">(${esc(p.aluno)} - ${esc(p.turma)})</span></h4>
                        </div>
                        <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">${ROTULO_STATUS[p.status]}</span>
                    </div>
                    <p style="font-size: 14px; color: #333; margin-bottom: 6px;"><strong>Itens:</strong> ${p.itens.map(i => `${i.quantidade}x ${esc(i.nome)}`).join(', ')}</p>
                    <p style="font-size: 14px; color: #333; margin-bottom: 6px;"><strong>Pagamento:</strong> ${esc(p.pagamento || 'PIX')} ${pagoBadge}</p>
                    <p style="font-size: 14px; color: #0b1e4f; font-weight: bold;">Total: R$ ${reais(p.total)}</p>
                    ${botaoCancelar}
                </div>
            `;
        }).join('');
    } catch (e) {
        /* se falhar, mantém o que já estava na tela */
    }
}

// Função para o aluno cancelar um pedido pendente
function cancelarPedido(codigo) {
    if (confirm('Tem certeza de que deseja cancelar este pedido?')) {
        let codigos = lerMeusCodigos();
        codigos = codigos.filter(c => c !== codigo);
        localStorage.setItem(CHAVE_MEUS, JSON.stringify(codigos));

        aviso('Pedido cancelado com sucesso.');
        carregarMeusPedidos();
    }
}