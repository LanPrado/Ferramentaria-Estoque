const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const os = require('os');

const app = express();
const PORT = 3004;

// Configurar caminhos
const dbPath = path.join(__dirname, 'database.json');

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware para prevenir cache
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Rotas de arquivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Inicialização do banco COM QUANTIDADE
function initDatabase() {
    try {
        if (!fs.existsSync(dbPath)) {
            console.log('Criando database inicial...');
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync('admin123', salt);
            const initialData = {
                users: [{
                    id: '1',
                    username: 'admin',
                    password: hashedPassword,
                    name: 'Administrador',
                    companyCode: '000000',
                    role: 'ADMIN_GERAL',
                    isAdmin: true,
                    createdAt: new Date().toISOString()
                }],
                tools: [
                    { 
                        id: '1', 
                        code: 'F001', 
                        name: 'Martelo', 
                        category: 'Ferramenta Manual', 
                        totalQuantity: 5,
                        availableQuantity: 5,
                        status: 'disponivel', 
                        setor: 'GERAL' 
                    },
                    { 
                        id: '2', 
                        code: 'F002', 
                        name: 'Chave de Fenda', 
                        category: 'Ferramenta Manual', 
                        totalQuantity: 8,
                        availableQuantity: 8,
                        status: 'disponivel', 
                        setor: 'GERAL' 
                    },
                    { 
                        id: '3', 
                        code: 'F003', 
                        name: 'Alicate', 
                        category: 'Ferramenta Manual', 
                        totalQuantity: 4,
                        availableQuantity: 4,
                        status: 'disponivel', 
                        setor: 'CNC' 
                    }
                ],
                loans: []
            };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
            console.log('✅ Database criado!');
        } else {
            // Verificar se precisa migrar dados antigos
            migrateOldDatabase();
        }
    } catch (error) {
        console.error('Erro ao inicializar database:', error);
    }
}

// Migrar dados antigos para novo formato com quantidade
function migrateOldDatabase() {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        let needsMigration = false;
        
        // Verificar se há ferramentas sem quantidade
        data.tools.forEach(tool => {
            if (tool.totalQuantity === undefined) {
                tool.totalQuantity = 1;
                tool.availableQuantity = tool.available ? 1 : 0;
                needsMigration = true;
            }
        });
        
        if (needsMigration) {
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            console.log('✅ Dados migrados para novo formato com quantidade');
        }
    } catch (error) {
        console.error('Erro na migração:', error);
    }
}

initDatabase();

// ========== API ROUTES ==========

// Login
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const user = data.users.find(u => u.username === username);

        if (user && bcrypt.compareSync(password, user.password)) {
            res.json({ 
                success: true, 
                user: { 
                    id: user.id,
                    name: user.name, 
                    role: user.role,
                    companyCode: user.companyCode
                },
                redirect: user.role === 'ADMIN_GERAL' ? 'index_admin.html' : 
                         user.role === 'LIDER_CNC' ? 'index_cnc.html' : 'index_ferramenteiro.html'
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Usuário ou senha incorretos' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Erro no servidor' 
        });
    }
});

// Criar conta
app.post('/api/register', (req, res) => {
    try {
        const { name, username, password, companyCode } = req.body;
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // Validações
        if (!name || !username || !password || !companyCode) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos os campos são obrigatórios' 
            });
        }
        
        if (data.users.some(u => u.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nome de usuário já existe' 
            });
        }
        
        if (data.users.some(u => u.companyCode === companyCode)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código da empresa já existe' 
            });
        }
        
        if (!/^\d{6}$/.test(companyCode)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código deve ter 6 números' 
            });
        }
        
        // Criar usuário
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            name,
            companyCode,
            role: 'USER',
            isAdmin: false,
            createdAt: new Date().toISOString()
        };
        
        data.users.push(newUser);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Conta criada com sucesso! Faça login.',
            user: {
                id: newUser.id,
                name: newUser.name,
                username: newUser.username,
                companyCode: newUser.companyCode
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao criar conta' 
        });
    }
});

// Database
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

// Usuários
app.get('/api/usuarios', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const safeUsers = data.users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler usuários' });
    }
});

app.post('/api/usuarios', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const { username, password, name, companyCode, role = 'USER' } = req.body;
        
        if (data.users.some(u => u.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Usuário já existe' 
            });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            name,
            companyCode,
            role,
            isAdmin: role === 'ADMIN_GERAL',
            createdAt: new Date().toISOString()
        };
        
        data.users.push(newUser);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        const { password: _, ...userResponse } = newUser;
        
        res.json({ 
            success: true, 
            user: userResponse 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.delete('/api/usuarios/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        if (req.params.id === '1') {
            return res.status(400).json({ 
                success: false, 
                message: 'Não pode excluir admin principal' 
            });
        }
        
        data.users = data.users.filter(u => u.id !== req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Ferramentas (ATUALIZADO COM QUANTIDADE)
app.get('/api/ferramentas', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.tools);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler ferramentas' });
    }
});

app.post('/api/ferramentas', (req, res) => {
    console.log('\n=== CADASTRANDO NOVA FERRAMENTA ===');
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        const { code, name, totalQuantity = 1, availableQuantity, category, description } = req.body;
        
        // Validações
        if (!code || !name || !category) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código, nome e categoria são obrigatórios' 
            });
        }
        
        // Verificar se código já existe
        if (data.tools.some(t => t.code === code)) {
            console.log('❌ Código já existe:', code);
            return res.status(400).json({ 
                success: false, 
                message: 'Já existe uma ferramenta com este código' 
            });
        }
        
        const qty = parseInt(totalQuantity) || 1;
        const availableQty = parseInt(availableQuantity) || qty;
        
        if (qty < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quantidade deve ser maior que 0' 
            });
        }
        
        console.log('✅ Validações passadas');
        
        const newTool = {
            id: Date.now().toString(),
            code,
            name,
            category,
            description: description || '',
            totalQuantity: qty,
            availableQuantity: availableQty,
            status: availableQty > 0 ? 'disponivel' : 'indisponivel',
            setor: 'GERAL',
            createdAt: new Date().toISOString()
        };
        
        console.log('🛠️ Nova ferramenta:', newTool.name);
        console.log('📦 Quantidade:', newTool.totalQuantity);
        
        data.tools.push(newTool);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        console.log('✅ Ferramenta cadastrada com sucesso!');
        
        res.json({ 
            success: true, 
            tool: newTool 
        });
        
    } catch (error) {
        console.error('❌ Erro ao cadastrar ferramenta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor: ' + error.message 
        });
    }
});

app.put('/api/ferramentas/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const index = data.tools.findIndex(tool => tool.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Ferramenta não encontrada' 
            });
        }
        
        // Atualizar quantidade disponível se fornecida
        if (req.body.availableQuantity !== undefined) {
            const newQty = parseInt(req.body.availableQuantity);
            if (newQty < 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Quantidade não pode ser negativa' 
                });
            }
            
            // Atualizar status baseado na quantidade
            if (newQty <= 0) {
                req.body.status = 'indisponivel';
            } else {
                req.body.status = 'disponivel';
            }
        }
        
        data.tools[index] = { ...data.tools[index], ...req.body };
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        res.json({ 
            success: true, 
            tool: data.tools[index] 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.delete('/api/ferramentas/:id', (req, res) => {
    console.log('\n=== EXCLUINDO FERRAMENTA ===');
    console.log('ID da ferramenta:', req.params.id);
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // Verificar se ferramenta existe
        const tool = data.tools.find(t => t.id === req.params.id);
        if (!tool) {
            console.log('❌ Ferramenta não encontrada');
            return res.status(404).json({ 
                success: false, 
                message: 'Ferramenta não encontrada' 
            });
        }
        
        console.log('🛠️ Ferramenta encontrada:', tool.name);
        
        // Verificar se está emprestada (alguma unidade)
        const isBorrowed = data.loans.some(loan => 
            loan.toolId === req.params.id && loan.status === 'emprestado'
        );
        
        if (isBorrowed) {
            console.log('❌ Ferramenta está emprestada');
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível excluir ferramenta que está emprestada' 
            });
        }
        
        data.tools = data.tools.filter(t => t.id !== req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        console.log('✅ Ferramenta excluída com sucesso!');
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Erro ao excluir ferramenta:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Empréstimos (ATUALIZADO PARA CONTROLE DE QUANTIDADE)
app.get('/api/emprestimos', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.loans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler empréstimos' });
    }
});

app.post('/api/emprestimos', (req, res) => {
    console.log('\n=== REGISTRANDO EMPRÉSTIMO ===');
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        const { userId, toolId, notes } = req.body;
        
        // Validações
        if (!userId || !toolId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Usuário e ferramenta são obrigatórios' 
            });
        }
        
        // Verificar se usuário existe
        const user = data.users.find(u => u.id === userId);
        if (!user) {
            console.log('❌ Usuário não encontrado');
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado' 
            });
        }
        
        // Verificar se ferramenta existe
        const tool = data.tools.find(t => t.id === toolId);
        if (!tool) {
            console.log('❌ Ferramenta não encontrada');
            return res.status(404).json({ 
                success: false, 
                message: 'Ferramenta não encontrada' 
            });
        }
        
        // Verificar se há quantidade disponível
        const availableQty = tool.availableQuantity || (tool.available ? 1 : 0);
        if (availableQty <= 0) {
            console.log('❌ Ferramenta sem estoque');
            return res.status(400).json({ 
                success: false, 
                message: 'Esta ferramenta não está disponível no momento' 
            });
        }
        
        console.log('✅ Validações passadas');
        console.log('👤 Usuário:', user.name);
        console.log('🛠️ Ferramenta:', tool.name);
        console.log('📦 Quantidade disponível:', availableQty);
        
        const newLoan = {
            id: Date.now().toString(),
            userId: userId,
            toolId: toolId,
            borrowedAt: new Date().toISOString(),
            returnedAt: null,
            status: 'emprestado',
            notes: notes || '',
            returnedBy: null
        };
        
        data.loans.push(newLoan);
        
        // Atualizar quantidade da ferramenta
        const toolIndex = data.tools.findIndex(t => t.id === toolId);
        if (toolIndex !== -1) {
            const newAvailableQty = (data.tools[toolIndex].availableQuantity || 1) - 1;
            data.tools[toolIndex].availableQuantity = newAvailableQty;
            
            // Atualizar status baseado na quantidade
            if (newAvailableQty <= 0) {
                data.tools[toolIndex].status = 'indisponivel';
            } else {
                data.tools[toolIndex].status = 'disponivel';
            }
            
            console.log('📉 Nova quantidade disponível:', newAvailableQty);
        }
        
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        console.log('✅ Empréstimo registrado com sucesso!');
        
        res.json({ 
            success: true, 
            loan: newLoan,
            user: { name: user.name, companyCode: user.companyCode },
            tool: { name: tool.name, code: tool.code }
        });
        
    } catch (error) {
        console.error('❌ Erro ao registrar empréstimo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor: ' + error.message 
        });
    }
});

app.put('/api/emprestimos/:id', (req, res) => {
    console.log('\n=== ATUALIZANDO EMPRÉSTIMO ===');
    console.log('ID do empréstimo:', req.params.id);
    console.log('Novo status:', req.body.status);
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const loanIndex = data.loans.findIndex(loan => loan.id === req.params.id);
        
        if (loanIndex === -1) {
            console.log('❌ Empréstimo não encontrado');
            return res.status(404).json({ 
                success: false, 
                message: 'Empréstimo não encontrado' 
            });
        }
        
        const oldStatus = data.loans[loanIndex].status;
        const newStatus = req.body.status;
        
        data.loans[loanIndex] = { 
            ...data.loans[loanIndex], 
            ...req.body,
            returnedAt: newStatus !== 'emprestado' ? new Date().toISOString() : null
        };
        
        console.log('📝 Status alterado:', oldStatus, '→', newStatus);
        
        // Se devolvido, incrementar quantidade da ferramenta
        if (oldStatus === 'emprestado' && newStatus === 'devolvido') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                const newAvailableQty = (data.tools[toolIndex].availableQuantity || 0) + 1;
                data.tools[toolIndex].availableQuantity = newAvailableQty;
                
                // Atualizar status baseado na quantidade
                if (newAvailableQty > 0) {
                    data.tools[toolIndex].status = 'disponivel';
                }
                
                console.log('✅ Ferramenta devolvida. Nova quantidade:', newAvailableQty);
            }
        }
        // Se quebrado, não devolve ao estoque
        else if (oldStatus === 'emprestado' && newStatus === 'quebrado') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                // Reduzir quantidade total (ferramenta quebrada)
                const newTotalQty = (data.tools[toolIndex].totalQuantity || 1) - 1;
                data.tools[toolIndex].totalQuantity = Math.max(0, newTotalQty);
                
                console.log('⚠️ Ferramenta quebrada. Nova quantidade total:', newTotalQty);
            }
        }
        
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        console.log('✅ Empréstimo atualizado com sucesso!');
        
        res.json({ 
            success: true, 
            loan: data.loans[loanIndex] 
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar empréstimo:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Nova rota: Ajustar quantidade de ferramenta
app.put('/api/ferramentas/:id/quantidade', (req, res) => {
    console.log('\n=== AJUSTANDO QUANTIDADE ===');
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const toolIndex = data.tools.findIndex(t => t.id === req.params.id);
        
        if (toolIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Ferramenta não encontrada' 
            });
        }
        
        const { quantidade, tipo = 'disponivel' } = req.body;
        const qty = parseInt(quantidade);
        
        if (isNaN(qty) || qty < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quantidade inválida' 
            });
        }
        
        if (tipo === 'disponivel') {
            data.tools[toolIndex].availableQuantity = qty;
            
            // Atualizar status
            if (qty > 0) {
                data.tools[toolIndex].status = 'disponivel';
            } else {
                data.tools[toolIndex].status = 'indisponivel';
            }
            
            console.log(`📦 Quantidade disponível ajustada para: ${qty}`);
        } else if (tipo === 'total') {
            data.tools[toolIndex].totalQuantity = qty;
            
            // Ajustar quantidade disponível se necessário
            if (data.tools[toolIndex].availableQuantity > qty) {
                data.tools[toolIndex].availableQuantity = qty;
            }
            
            console.log(`📊 Quantidade total ajustada para: ${qty}`);
        }
        
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        res.json({ 
            success: true, 
            tool: data.tools[toolIndex] 
        });
        
    } catch (error) {
        console.error('❌ Erro ao ajustar quantidade:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        version: '3.0',
        features: ['quantidade-ferramentas', 'estoque', 'multi-emprestimos']
    });
});

// Nova rota: Relatório de estoque
app.get('/api/relatorio/estoque', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        const relatorio = {
            totalFerramentas: data.tools.length,
            totalUnidades: data.tools.reduce((sum, tool) => sum + (tool.totalQuantity || 1), 0),
            unidadesDisponiveis: data.tools.reduce((sum, tool) => sum + (tool.availableQuantity || 0), 0),
            unidadesEmprestadas: data.tools.reduce((sum, tool) => {
                const total = tool.totalQuantity || 1;
                const disponivel = tool.availableQuantity || 0;
                return sum + (total - disponivel);
            }, 0),
            ferramentas: data.tools.map(tool => ({
                nome: tool.name,
                codigo: tool.code,
                total: tool.totalQuantity || 1,
                disponivel: tool.availableQuantity || 0,
                emprestado: (tool.totalQuantity || 1) - (tool.availableQuantity || 0),
                status: tool.status
            })),
            geradoEm: new Date().toISOString()
        };
        
        res.json(relatorio);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Servir páginas
const allowedPages = ['index_admin.html', 'index_cnc.html', 'index_ferramenteiro.html'];
allowedPages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, page));
    });
});

// Rota para servir shared.js
app.get('/shared.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'shared.js'), {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache'
        }
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const interfaceName in networkInterfaces) {
        for (const interface of networkInterfaces[interfaceName]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                localIp = interface.address;
                break;
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 SISTEMA FERRAMENTARIA ONLINE v3.0');
    console.log('='.repeat(60));
    console.log(`📍 Local:    http://localhost:${PORT}`);
    console.log(`🌐 Rede:     http://${localIp}:${PORT}`);
    console.log('👤 Login:    admin');
    console.log('🔑 Senha:    admin123');
    console.log('📦 Sistema:  Controle de quantidade por ferramenta');
    console.log('='.repeat(60));
    console.log('📊 API Endpoints:');
    console.log('   POST   /api/ferramentas          (com quantidade)');
    console.log('   PUT    /api/ferramentas/:id/quantidade');
    console.log('   GET    /api/relatorio/estoque');
    console.log('='.repeat(60) + '\n');
});