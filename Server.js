const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const os = require('os');

const app = express();

// MIDDLEWARE ANTI-CACHE
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const PORT = 3000;

const { generateAllLoansPDF } = require('./Src/Pdf-Generator.js');
const dbPath = path.join(__dirname, 'database.json');

// Rota para gerar PDF de empréstimos
app.get('/api/relatorio/emprestimos/pdf', async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const filePath = path.join(os.tmpdir(), `relatorio_emprestimos_${Date.now()}.pdf`);
    const settings = { companyName: 'Ferramentaria' };
    await generateAllLoansPDF(data.loans || [], data.users || [], data.tools || [], settings, filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.download(filePath, 'relatorio_emprestimos.pdf', () => {
      try { fs.unlinkSync(filePath); } catch (e) {}
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Rotas de arquivos estáticos
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// ══════════════════════════════════════════════════
// INICIALIZAÇÃO DO BANCO
// ══════════════════════════════════════════════════
function initDatabase() {
    try {
        if (!fs.existsSync(dbPath)) {
            console.log('Criando database inicial...');
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync('admin123', salt);
            const initialData = {
                users: [
                    {
                        id: '1', username: 'admin', password: hashedPassword,
                        name: 'Administrador', companyCode: '000000',
                        role: 'ADMIN_GERAL', isAdmin: true, createdAt: new Date().toISOString()
                    },
                    {
                        id: '2', username: 'cnc',
                        password: bcrypt.hashSync('cnc123', bcrypt.genSaltSync(10)),
                        name: 'Lider CNC', companyCode: '111111',
                        role: 'LIDER_CNC', isAdmin: false, createdAt: new Date().toISOString()
                    }
                ],
                tools: [
                    { id: '1', code: 'F001', name: 'Martelo', category: 'Ferramenta Manual', totalQuantity: 5, availableQuantity: 5, status: 'disponivel', setor: 'GERAL' },
                    { id: '2', code: 'F002', name: 'Chave de Fenda', category: 'Ferramenta Manual', totalQuantity: 8, availableQuantity: 8, status: 'disponivel', setor: 'GERAL' },
                    { id: '3', code: 'F003', name: 'Alicate', category: 'Ferramenta Manual', totalQuantity: 4, availableQuantity: 4, status: 'disponivel', setor: 'CNC' }
                ],
                loans: [],
                materialRequests: [],
                ferramentalPessoal: [],   // ← NOVO
                fpHistorico: []           // ← NOVO
            };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
            console.log('✅ Database criado!');
        } else {
            migrateOldDatabase();
        }
    } catch (error) {
        console.error('Erro ao inicializar database:', error);
    }
}

function migrateOldDatabase() {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        let needsMigration = false;

        data.tools.forEach(tool => {
            if (tool.totalQuantity === undefined) {
                tool.totalQuantity = 1;
                tool.availableQuantity = tool.available ? 1 : 0;
                needsMigration = true;
            }
        });

        if (!Array.isArray(data.materialRequests)) { data.materialRequests = []; needsMigration = true; }

        // Migrar novas coleções de Ferramental Pessoal
        if (!Array.isArray(data.ferramentalPessoal)) { data.ferramentalPessoal = []; needsMigration = true; }
        if (!Array.isArray(data.fpHistorico)) { data.fpHistorico = []; needsMigration = true; }

        if (needsMigration) {
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            console.log('✅ Dados migrados com sucesso');
        }
    } catch (error) {
        console.error('Erro na migração:', error);
    }
}

initDatabase();

// ══════════════════════════════════════════════════
// API ROUTES — AUTH
// ══════════════════════════════════════════════════
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const user = data.users.find(u => u.username === username);
        if (user && bcrypt.compareSync(password, user.password)) {
            res.json({
                success: true,
                user: { id: user.id, name: user.name, role: user.role, companyCode: user.companyCode },
                redirect: user.role === 'ADMIN_GERAL' ? 'index_admin.html' :
                          user.role === 'LIDER_CNC'   ? 'index_cnc.html' : 'index_ferramenteiro.html'
            });
        } else {
            res.status(401).json({ success: false, message: 'Usuário ou senha incorretos' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

app.post('/api/register', (req, res) => {
    try {
        const { name, username, password, companyCode } = req.body;
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!name || !username || !password || !companyCode)
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
        if (data.users.some(u => u.username === username))
            return res.status(400).json({ success: false, message: 'Nome de usuário já existe' });
        if (data.users.some(u => u.companyCode === companyCode))
            return res.status(400).json({ success: false, message: 'Código da empresa já existe' });
        if (!/^\d{6}$/.test(companyCode))
            return res.status(400).json({ success: false, message: 'Código deve ter 6 números' });
        const salt = bcrypt.genSaltSync(10);
        const newUser = {
            id: Date.now().toString(), username,
            password: bcrypt.hashSync(password, salt),
            name, companyCode, role: 'USER', isAdmin: false,
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, message: 'Conta criada com sucesso! Faça login.',
            user: { id: newUser.id, name: newUser.name, username: newUser.username, companyCode: newUser.companyCode }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar conta' });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — DATABASE
// ══════════════════════════════════════════════════
app.get('/api/database', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler dados' });
    }
});

app.put('/api/database', (req, res) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — USUÁRIOS
// ══════════════════════════════════════════════════
app.get('/api/usuarios', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.users.map(({ password, ...rest }) => rest));
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler usuários' });
    }
});

app.post('/api/usuarios', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const { username, password, name, companyCode, role = 'USER' } = req.body;
        if (data.users.some(u => u.username === username))
            return res.status(400).json({ success: false, message: 'Usuário já existe' });
        const newUser = {
            id: Date.now().toString(), username,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
            name, companyCode, role,
            isAdmin: role === 'ADMIN_GERAL',
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        const { password: _, ...userResponse } = newUser;
        res.json({ success: true, user: userResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/usuarios/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (req.params.id === '1')
            return res.status(400).json({ success: false, message: 'Não pode excluir admin principal' });
        data.users = data.users.filter(u => u.id !== req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — FERRAMENTAS
// ══════════════════════════════════════════════════
app.get('/api/ferramentas', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.tools);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler ferramentas' });
    }
});

app.post('/api/ferramentas', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const { code, name, totalQuantity = 1, availableQuantity, category, description } = req.body;
        if (!code || !name || !category)
            return res.status(400).json({ success: false, message: 'Código, nome e categoria são obrigatórios' });
        if (data.tools.some(t => t.code === code))
            return res.status(400).json({ success: false, message: 'Já existe uma ferramenta com este código' });
        const qty = parseInt(totalQuantity) || 1;
        const availableQty = parseInt(availableQuantity) || qty;
        if (qty < 1)
            return res.status(400).json({ success: false, message: 'Quantidade deve ser maior que 0' });
        const newTool = {
            id: Date.now().toString(), code, name, category,
            description: description || '',
            totalQuantity: qty, availableQuantity: availableQty,
            status: availableQty > 0 ? 'disponivel' : 'indisponivel',
            setor: 'GERAL', createdAt: new Date().toISOString()
        };
        data.tools.push(newTool);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, tool: newTool });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/ferramentas/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const index = data.tools.findIndex(t => t.id === req.params.id);
        if (index === -1)
            return res.status(404).json({ success: false, message: 'Ferramenta não encontrada' });
        if (req.body.availableQuantity !== undefined) {
            const newQty = parseInt(req.body.availableQuantity);
            if (newQty < 0)
                return res.status(400).json({ success: false, message: 'Quantidade não pode ser negativa' });
            req.body.status = newQty <= 0 ? 'indisponivel' : 'disponivel';
        }
        data.tools[index] = { ...data.tools[index], ...req.body };
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, tool: data.tools[index] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/ferramentas/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const tool = data.tools.find(t => t.id === req.params.id);
        if (!tool)
            return res.status(404).json({ success: false, message: 'Ferramenta não encontrada' });
        const isBorrowed = data.loans.some(l => l.toolId === req.params.id && l.status === 'emprestado');
        if (isBorrowed)
            return res.status(400).json({ success: false, message: 'Não é possível excluir ferramenta que está emprestada' });
        data.tools = data.tools.filter(t => t.id !== req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/ferramentas/:id/quantidade', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const toolIndex = data.tools.findIndex(t => t.id === req.params.id);
        if (toolIndex === -1)
            return res.status(404).json({ success: false, message: 'Ferramenta não encontrada' });
        const { quantidade, tipo = 'disponivel' } = req.body;
        const qty = parseInt(quantidade);
        if (isNaN(qty) || qty < 0)
            return res.status(400).json({ success: false, message: 'Quantidade inválida' });
        if (tipo === 'disponivel') {
            data.tools[toolIndex].availableQuantity = qty;
            data.tools[toolIndex].status = qty > 0 ? 'disponivel' : 'indisponivel';
        } else if (tipo === 'total') {
            data.tools[toolIndex].totalQuantity = qty;
            if (data.tools[toolIndex].availableQuantity > qty)
                data.tools[toolIndex].availableQuantity = qty;
        }
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, tool: data.tools[toolIndex] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — EMPRÉSTIMOS
// ══════════════════════════════════════════════════
app.get('/api/emprestimos', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.loans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler empréstimos' });
    }
});

app.post('/api/emprestimos', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const { userId, toolId, notes } = req.body;
        if (!userId || !toolId)
            return res.status(400).json({ success: false, message: 'Usuário e ferramenta são obrigatórios' });
        const user = data.users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        const tool = data.tools.find(t => t.id === toolId);
        if (!tool) return res.status(404).json({ success: false, message: 'Ferramenta não encontrada' });
        const availableQty = tool.availableQuantity || (tool.available ? 1 : 0);
        if (availableQty <= 0)
            return res.status(400).json({ success: false, message: 'Esta ferramenta não está disponível no momento' });
        const newLoan = {
            id: Date.now().toString(), userId, toolId,
            borrowedAt: new Date().toISOString(),
            returnedAt: null, status: 'emprestado',
            notes: notes || '', returnedBy: null
        };
        data.loans.push(newLoan);
        const toolIndex = data.tools.findIndex(t => t.id === toolId);
        if (toolIndex !== -1) {
            const newAvailableQty = (data.tools[toolIndex].availableQuantity || 1) - 1;
            data.tools[toolIndex].availableQuantity = newAvailableQty;
            data.tools[toolIndex].status = newAvailableQty <= 0 ? 'indisponivel' : 'disponivel';
        }
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, loan: newLoan,
            user: { name: user.name, companyCode: user.companyCode },
            tool: { name: tool.name, code: tool.code }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno: ' + error.message });
    }
});

app.put('/api/emprestimos/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const loanIndex = data.loans.findIndex(l => l.id === req.params.id);
        if (loanIndex === -1)
            return res.status(404).json({ success: false, message: 'Empréstimo não encontrado' });
        const oldStatus = data.loans[loanIndex].status;
        const newStatus = req.body.status;
        data.loans[loanIndex] = {
            ...data.loans[loanIndex], ...req.body,
            returnedAt: newStatus !== 'emprestado' ? new Date().toISOString() : null
        };
        if (oldStatus === 'emprestado' && newStatus === 'devolvido') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                const newQty = (data.tools[toolIndex].availableQuantity || 0) + 1;
                data.tools[toolIndex].availableQuantity = newQty;
                if (newQty > 0) data.tools[toolIndex].status = 'disponivel';
            }
        } else if (oldStatus === 'emprestado' && newStatus === 'quebrado') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                const newTotalQty = (data.tools[toolIndex].totalQuantity || 1) - 1;
                data.tools[toolIndex].totalQuantity = Math.max(0, newTotalQty);
            }
        }
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, loan: data.loans[loanIndex] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — FERRAMENTAL PESSOAL
// ══════════════════════════════════════════════════

// Listar todos os itens de ferramental pessoal
app.get('/api/ferramental-pessoal', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json({
            itens: data.ferramentalPessoal || [],
            historico: data.fpHistorico || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar ferramental pessoal de um usuário específico
app.get('/api/ferramental-pessoal/usuario/:userId', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const fp = (data.ferramentalPessoal || []).filter(i => i.userId === req.params.userId);
        const hist = (data.fpHistorico || []).filter(h => h.userId === req.params.userId);
        res.json({ itens: fp, historico: hist });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Entregar ferramental a um funcionário
app.post('/api/ferramental-pessoal', (req, res) => {
    console.log('\n=== ENTREGANDO FERRAMENTAL PESSOAL ===');
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!Array.isArray(data.ferramentalPessoal)) data.ferramentalPessoal = [];
        if (!Array.isArray(data.fpHistorico)) data.fpHistorico = [];

        const { userId, toolId, quantidade = 1, condicao = 'boa', serie = '', obs = '', entregueBy = 'ADMIN' } = req.body;

        if (!userId || !toolId)
            return res.status(400).json({ success: false, message: 'Usuário e ferramenta são obrigatórios' });

        const user = data.users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

        const tool = data.tools.find(t => t.id === toolId);
        if (!tool) return res.status(404).json({ success: false, message: 'Ferramenta não encontrada' });

        const qty = parseInt(quantidade) || 1;
        if ((tool.availableQuantity || 0) < qty)
            return res.status(400).json({ success: false, message: `Estoque insuficiente. Disponível: ${tool.availableQuantity || 0}` });

        // Criar registro de posse
        const novoItem = {
            id: Date.now().toString(),
            userId, toolId,
            quantidade: qty,
            condicao,
            serie: serie || '',
            obs: obs || '',
            status: 'posse',   // posse | devolvida | perdida | danificada
            entregueEm: new Date().toISOString(),
            entregueBy,
            atualizadoEm: new Date().toISOString()
        };

        data.ferramentalPessoal.push(novoItem);

        // Deduzir do estoque disponível
        const toolIndex = data.tools.findIndex(t => t.id === toolId);
        if (toolIndex !== -1) {
            data.tools[toolIndex].availableQuantity = (data.tools[toolIndex].availableQuantity || 0) - qty;
            if (data.tools[toolIndex].availableQuantity <= 0) {
                data.tools[toolIndex].availableQuantity = 0;
                data.tools[toolIndex].status = 'indisponivel';
            }
        }

        // Registrar no histórico
        data.fpHistorico.push({
            id: Date.now().toString() + '_h',
            userId, toolId,
            acao: 'entrega',
            quantidade: qty,
            obs: obs || `Entrega inicial — condição: ${condicao}${serie ? ' — série: '+serie : ''}`,
            por: entregueBy,
            data: new Date().toISOString()
        });

        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`✅ Ferramental entregue: ${tool.name} → ${user.name} (${qty}x)`);
        res.json({ success: true, item: novoItem });

    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── Assinar termo digitalmente (Ferramenteiro) ──
app.post('/api/ferramental-pessoal/assinar-termo', (req, res) => {
    console.log('\n=== ASSINATURA DIGITAL DO TERMO ===');
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ success: false, message: 'userId é obrigatório' });

        const userIndex = data.users.findIndex(u => u.id === userId);
        if (userIndex === -1)
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

        const user = data.users[userIndex];
        const fp = (data.ferramentalPessoal || []).filter(i => i.userId === userId && i.status === 'posse');
        if (!fp.length)
            return res.status(400).json({ success: false, message: 'Nenhum item em posse para assinar' });

        const agora = new Date().toISOString();

        // Salvar assinatura no usuário
        data.users[userIndex].termoAssinado = true;
        data.users[userIndex].termoAssinadoEm = agora;
        data.users[userIndex].termoItensAssinados = fp.map(i => i.id); // IDs dos itens no momento da assinatura

        // Registrar no histórico de ferramental
        if (!Array.isArray(data.fpHistorico)) data.fpHistorico = [];
        data.fpHistorico.push({
            id: Date.now().toString() + '_assn',
            userId,
            toolId: null,
            acao: 'assinatura',
            quantidade: fp.reduce((s, i) => s + (i.quantidade || 1), 0),
            obs: `Termo de responsabilidade assinado digitalmente — ${fp.length} tipo(s) de ferramenta`,
            por: user.name,
            data: agora
        });

        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`✅ Termo assinado: ${user.name} em ${agora}`);

        // Retornar dados atualizados do usuário (sem senha)
        const { password: _, ...userSafe } = data.users[userIndex];
        res.json({ success: true, user: userSafe, assinadoEm: agora });

    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── Cancelar / resetar assinatura (Admin pode resetar se houver novos itens) ──
app.post('/api/ferramental-pessoal/resetar-termo/:userId', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const userIndex = data.users.findIndex(u => u.id === req.params.userId);
        if (userIndex === -1)
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

        data.users[userIndex].termoAssinado = false;
        data.users[userIndex].termoAssinadoEm = null;
        data.users[userIndex].termoItensAssinados = [];

        // Log no histórico
        if (!Array.isArray(data.fpHistorico)) data.fpHistorico = [];
        data.fpHistorico.push({
            id: Date.now().toString() + '_reset',
            userId: req.params.userId,
            toolId: null,
            acao: 'reset_termo',
            quantidade: 0,
            obs: 'Termo resetado pelo administrador — nova assinatura necessária',
            por: req.body.resetadoPor || 'ADMIN',
            data: new Date().toISOString()
        });

        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── Status dos termos para o Admin ──
app.get('/api/ferramental-pessoal/status-termos', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const fp = data.ferramentalPessoal || [];
        const users = data.users.filter(u => !u.isAdmin);

        const resultado = users.map(u => {
            const itensPosse = fp.filter(i => i.userId === u.id && i.status === 'posse');
            const itensAssinados = u.termoItensAssinados || [];
            // Novos itens entregues após a assinatura
            const novosItens = itensPosse.filter(i => !itensAssinados.includes(i.id));
            const precisaReassinatura = u.termoAssinado && novosItens.length > 0;

            return {
                userId: u.id,
                nome: u.name,
                companyCode: u.companyCode,
                termoAssinado: u.termoAssinado || false,
                termoAssinadoEm: u.termoAssinadoEm || null,
                itensEmPosse: itensPosse.length,
                novosItensSemAssinatura: novosItens.length,
                precisaReassinatura,
                status: !itensPosse.length ? 'sem_itens'
                    : !u.termoAssinado ? 'pendente'
                    : precisaReassinatura ? 'reassinatura'
                    : 'ok'
            };
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registrar ocorrência num item de ferramental pessoal
// tipos: devolvida | perdida | danificada | transferida
app.post('/api/ferramental-pessoal/:itemId/ocorrencia', (req, res) => {
    console.log('\n=== OCORRÊNCIA FERRAMENTAL PESSOAL ===');
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!Array.isArray(data.ferramentalPessoal)) data.ferramentalPessoal = [];
        if (!Array.isArray(data.fpHistorico)) data.fpHistorico = [];

        const itemIndex = data.ferramentalPessoal.findIndex(i => i.id === req.params.itemId);
        if (itemIndex === -1)
            return res.status(404).json({ success: false, message: 'Item de ferramental não encontrado' });

        const item = data.ferramentalPessoal[itemIndex];
        if (item.status !== 'posse')
            return res.status(400).json({ success: false, message: 'Este item não está mais em posse' });

        const { tipo, quantidade, obs = '', transfereUserId, registradoPor = 'ADMIN' } = req.body;
        const qty = parseInt(quantidade) || item.quantidade;

        if (!['devolvida', 'perdida', 'danificada', 'transferida'].includes(tipo))
            return res.status(400).json({ success: false, message: 'Tipo de ocorrência inválido' });

        if (tipo === 'transferida' && !transfereUserId)
            return res.status(400).json({ success: false, message: 'Destinatário da transferência é obrigatório' });

        const tool = data.tools.find(t => t.id === item.toolId);
        const toolIndex = data.tools.findIndex(t => t.id === item.toolId);
        const user = data.users.find(u => u.id === item.userId);

        // ── Atualizar status do item ──
        if (qty >= item.quantidade) {
            // Encerra totalmente o item
            data.ferramentalPessoal[itemIndex].status = tipo;
            data.ferramentalPessoal[itemIndex].atualizadoEm = new Date().toISOString();
        } else {
            // Devolução parcial — reduz quantidade
            data.ferramentalPessoal[itemIndex].quantidade = item.quantidade - qty;
            data.ferramentalPessoal[itemIndex].atualizadoEm = new Date().toISOString();
        }

        // ── Retornar ao estoque se devolvida ──
        if (tipo === 'devolvida') {
            if (toolIndex !== -1) {
                data.tools[toolIndex].availableQuantity = (data.tools[toolIndex].availableQuantity || 0) + qty;
                data.tools[toolIndex].status = 'disponivel';
            }
        }

        // ── Transferência — criar novo item para o destinatário ──
        if (tipo === 'transferida') {
            const destUser = data.users.find(u => u.id === transfereUserId);
            if (!destUser) return res.status(404).json({ success: false, message: 'Usuário destinatário não encontrado' });

            const novoItem = {
                id: (Date.now() + 1).toString(),
                userId: transfereUserId,
                toolId: item.toolId,
                quantidade: qty,
                condicao: item.condicao,
                serie: item.serie || '',
                obs: `Transferido de ${user?.name || '?'} — ${obs}`,
                status: 'posse',
                entregueEm: new Date().toISOString(),
                entregueBy: registradoPor,
                atualizadoEm: new Date().toISOString()
            };
            data.ferramentalPessoal.push(novoItem);

            // Registrar histórico para o destinatário
            data.fpHistorico.push({
                id: (Date.now() + 2).toString() + '_h',
                userId: transfereUserId,
                toolId: item.toolId,
                acao: 'entrega',
                quantidade: qty,
                obs: `Recebido por transferência de ${user?.name || '?'}`,
                por: registradoPor,
                data: new Date().toISOString()
            });
        }

        // ── Registrar no histórico do funcionário original ──
        const acaoMap = { devolvida: 'devolucao', perdida: 'perda', danificada: 'dano', transferida: 'transferencia' };
        data.fpHistorico.push({
            id: Date.now().toString() + '_hoc',
            userId: item.userId,
            toolId: item.toolId,
            acao: acaoMap[tipo],
            quantidade: qty,
            obs: obs || tipo,
            por: registradoPor,
            data: new Date().toISOString()
        });

        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`✅ Ocorrência registrada: ${tipo} — ${tool?.name || '?'} — ${user?.name || '?'}`);
        res.json({ success: true, item: data.ferramentalPessoal[itemIndex] });

    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — REQUISIÇÕES DE MATERIAL
// ══════════════════════════════════════════════════
app.post('/api/requisicoes-material', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!Array.isArray(data.materialRequests)) data.materialRequests = [];
        const { solicitanteNome, solicitanteCodigo, quantidade, unidade, codigoMaterial, material, aplicacao } = req.body;
        if (!solicitanteNome || !material)
            return res.status(400).json({ success: false, message: 'Nome do solicitante e material são obrigatórios' });
        const newReq = {
            id: Date.now().toString(),
            solicitanteNome: String(solicitanteNome).trim(),
            solicitanteCodigo: solicitanteCodigo ? String(solicitanteCodigo).trim() : '',
            quantidade: quantidade ? String(quantidade).trim() : '1',
            unidade: unidade ? String(unidade).trim() : 'UN',
            codigoMaterial: codigoMaterial ? String(codigoMaterial).trim() : '',
            material: String(material).trim(),
            aplicacao: aplicacao ? String(aplicacao).trim() : '',
            status: 'pendente',
            criadoEm: new Date().toISOString(),
            aprovadoPor: '', dataLiberacao: '', observacaoAlmox: '', atualizadoEm: null
        };
        data.materialRequests.push(newReq);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, request: newReq });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/requisicoes-material', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const list = Array.isArray(data.materialRequests) ? data.materialRequests : [];
        const { status } = req.query;
        res.json(status ? list.filter(r => r.status === status) : list);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler requisições de material' });
    }
});

app.put('/api/requisicoes-material/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!Array.isArray(data.materialRequests)) data.materialRequests = [];
        const idx = data.materialRequests.findIndex(r => r.id === req.params.id);
        if (idx === -1)
            return res.status(404).json({ success: false, message: 'Requisição não encontrada' });
        data.materialRequests[idx] = { ...data.materialRequests[idx], ...req.body, atualizadoEm: new Date().toISOString() };
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        res.json({ success: true, request: data.materialRequests[idx] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ══════════════════════════════════════════════════
// API ROUTES — RELATÓRIOS
// ══════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString(), version: '4.0', features: ['ferramental-pessoal', 'quantidade-ferramentas', 'estoque', 'multi-emprestimos'] });
});

app.get('/api/relatorio/estoque', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json({
            totalFerramentas: data.tools.length,
            totalUnidades: data.tools.reduce((s, t) => s + (t.totalQuantity || 1), 0),
            unidadesDisponiveis: data.tools.reduce((s, t) => s + (t.availableQuantity || 0), 0),
            unidadesEmprestadas: data.tools.reduce((s, t) => s + ((t.totalQuantity || 1) - (t.availableQuantity || 0)), 0),
            ferramentas: data.tools.map(t => ({
                nome: t.name, codigo: t.code,
                total: t.totalQuantity || 1,
                disponivel: t.availableQuantity || 0,
                emprestado: (t.totalQuantity || 1) - (t.availableQuantity || 0),
                status: t.status
            })),
            geradoEm: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Rota de relatório de ferramentas (usada pelo admin)
app.get('/api/relatorio-ferramentas', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json({
            ferramentas: data.tools.map(t => ({
                nome: t.name, codigo: t.code,
                total: t.totalQuantity || 1,
                disponivel: t.availableQuantity || 0,
                emprestado: (t.totalQuantity || 1) - (t.availableQuantity || 0),
                status: t.status
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Relatório de ferramental pessoal
app.get('/api/relatorio/ferramental-pessoal', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const fp = data.ferramentalPessoal || [];
        const users = data.users.filter(u => !u.isAdmin);
        const result = users.map(u => {
            const itens = fp.filter(i => i.userId === u.id);
            const emPosse = itens.filter(i => i.status === 'posse');
            const problemas = itens.filter(i => i.status === 'perdida' || i.status === 'danificada');
            return {
                usuario: { id: u.id, name: u.name, companyCode: u.companyCode },
                itensEmPosse: emPosse.map(i => {
                    const t = data.tools.find(t => t.id === i.toolId);
                    return { ...i, toolName: t?.name || '?', toolCode: t?.code || '?' };
                }),
                totalItens: emPosse.reduce((s, i) => s + (i.quantidade || 1), 0),
                pendencias: problemas.length,
                conformidade: problemas.length === 0 ? 'ok' : 'pendencia'
            };
        });
        res.json({ funcionarios: result, geradoEm: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ══════════════════════════════════════════════════
// SERVIR PÁGINAS
// ══════════════════════════════════════════════════
const allowedPages = ['index_admin.html', 'index_cnc.html', 'index_ferramenteiro.html'];
allowedPages.forEach(page => {
    app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, page)));
});

app.get('/shared.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'shared.js'), { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' } });
});

// ══════════════════════════════════════════════════
// INICIAR SERVIDOR
// ══════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const ifName in networkInterfaces) {
        for (const iface of networkInterfaces[ifName]) {
            if (iface.family === 'IPv4' && !iface.internal) { localIp = iface.address; break; }
        }
    }
    console.log('\n' + '='.repeat(60));
    console.log('🚀 SISTEMA FERRAMENTARIA ONLINE v4.0');
    console.log('='.repeat(60));
    console.log(`📍 Local:    http://localhost:${PORT}`);
    console.log(`🌐 Rede:     http://${localIp}:${PORT}`);
    console.log('👤 Login:    admin');
    console.log('🔒 Senha:    admin123');
    console.log('🧰 NOVO:     Ferramental Pessoal por funcionário');
    console.log('='.repeat(60));
    console.log('📊 API Endpoints novos:');
    console.log('   GET    /api/ferramental-pessoal');
    console.log('   GET    /api/ferramental-pessoal/usuario/:id');
    console.log('   POST   /api/ferramental-pessoal');
    console.log('   POST   /api/ferramental-pessoal/:itemId/ocorrencia');
    console.log('   GET    /api/relatorio/ferramental-pessoal');
    console.log('='.repeat(60) + '\n');
});
