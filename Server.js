const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const os = require('os');

const app = express();
const PORT = 3000;

// Configurar caminhos
const dbPath = path.join(__dirname, 'database.json');

// Middleware CORS (IMPORTANTE!)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware para processar JSON
app.use(express.json());
app.use(express.static(__dirname)); // Serve arquivos estáticos

// 1. Rota raiz - redireciona para login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 2. Rota explícita para login.html
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 3. Inicialização do banco de dados
function initDatabase() {
    try {
        if (!fs.existsSync(dbPath)) {
            console.log('Criando database.json inicial...');
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
                    { id: '1', code: 'F001', name: 'Martelo', category: 'Ferramenta Manual', available: true, status: 'disponivel', setor: 'GERAL' },
                    { id: '2', code: 'F002', name: 'Chave de Fenda', category: 'Ferramenta Manual', available: true, status: 'disponivel', setor: 'GERAL' },
                    { id: '3', code: 'F003', name: 'Alicate', category: 'Ferramenta Manual', available: true, status: 'disponivel', setor: 'CNC' }
                ],
                loans: []
            };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
            console.log('✅ Database criado com sucesso!');
        } else {
            // Verificar se o arquivo é válido
            const content = fs.readFileSync(dbPath, 'utf8');
            JSON.parse(content); // Testa se é JSON válido
            console.log('✅ Database carregado com sucesso!');
        }
    } catch (error) {
        console.error('❌ ERRO CRÍTICO no database:', error.message);
        // Criar um novo se o atual estiver corrompido
        try {
            fs.unlinkSync(dbPath); // Remove arquivo corrompido
        } catch {}
        initDatabase(); // Recria
    }
}

initDatabase();

// 4. ROTA DE LOGIN
app.post('/api/login', (req, res) => {
    console.log('\n=== TENTATIVA DE LOGIN ===');
    console.log('Usuário recebido:', req.body.username);
    
    if (!req.body.username || !req.body.password) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ 
            success: false, 
            message: 'Usuário e senha são obrigatórios' 
        });
    }
    
    const { username, password } = req.body;
    
    try {
        console.log('📖 Lendo database.json...');
        const rawData = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(rawData);
        
        const user = data.users.find(u => u.username === username);
        
        if (!user) {
            console.log('❌ Usuário não encontrado:', username);
            return res.status(401).json({ 
                success: false, 
                message: 'Usuário não encontrado' 
            });
        }
        
        console.log('✅ Usuário encontrado:', user.username);
        console.log('🔐 Comparando senha...');
        
        const passwordMatch = bcrypt.compareSync(password, user.password);
        
        if (passwordMatch) {
            console.log('✅ SENHA CORRETA!');
            console.log('👤 Perfil do usuário:', user.role);
            
            // Determinar para qual página redirecionar
            let redirectPage = 'index_ferramenteiro.html'; // padrão
            
            if (user.role === 'ADMIN_GERAL') {
                redirectPage = 'index_admin.html';
            } else if (user.role === 'LIDER_CNC') {
                redirectPage = 'index_cnc.html';
            }
            
            console.log('↪️ Redirecionando para:', redirectPage);
            
            res.json({ 
                success: true, 
                user: { 
                    id: user.id,
                    username: user.username,
                    name: user.name, 
                    role: user.role,
                    companyCode: user.companyCode,
                    isAdmin: user.isAdmin
                },
                redirect: redirectPage
            });
        } else {
            console.log('❌ SENHA INCORRETA');
            res.status(401).json({ 
                success: false, 
                message: 'Senha incorreta' 
            });
        }
        
    } catch (error) {
        console.error('❌ ERRO NO PROCESSO DE LOGIN:', error);
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
    
    console.log('=== FIM DO LOGIN ===\n');
});

// 5. ROTA: Ler banco de dados completo
app.get('/api/database', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler banco de dados' });
    }
});

// 6. ROTA: Atualizar banco de dados completo
app.put('/api/database', (req, res) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. ROTA: Listar usuários
app.get('/api/usuarios', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // Remover senhas dos usuários para segurança
        const safeUsers = data.users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler usuários' });
    }
});

// 8. ROTA: Adicionar novo usuário
app.post('/api/usuarios', (req, res) => {
    console.log('\n=== CADASTRANDO NOVO USUÁRIO ===');
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        const { username, password, name, companyCode, role = 'USER' } = req.body;
        
        // Validações
        if (!username || !password || !name || !companyCode) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos os campos são obrigatórios' 
            });
        }
        
        // Verificar se usuário já existe
        if (data.users.some(u => u.username === username)) {
            console.log('❌ Usuário já existe:', username);
            return res.status(400).json({ 
                success: false, 
                message: 'Nome de usuário já existe' 
            });
        }
        
        // Verificar se código já existe
        if (data.users.some(u => u.companyCode === companyCode)) {
            console.log('❌ Código já existe:', companyCode);
            return res.status(400).json({ 
                success: false, 
                message: 'Código da empresa já existe' 
            });
        }
        
        // Validar código da empresa (6 dígitos)
        if (!/^\d{6}$/.test(companyCode)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código da empresa deve ter exatamente 6 números' 
            });
        }
        
        console.log('✅ Validações passadas');
        
        // Criptografar senha
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        const newUser = {
            id: Date.now().toString(),
            username: username,
            password: hashedPassword,
            name: name,
            companyCode: companyCode,
            role: role,
            isAdmin: role === 'ADMIN_GERAL',
            createdAt: new Date().toISOString()
        };
        
        console.log('👤 Novo usuário:', newUser.name);
        console.log('📝 Tipo:', newUser.role);
        
        data.users.push(newUser);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        // Não retornar a senha
        const userResponse = { ...newUser };
        delete userResponse.password;
        
        console.log('✅ Usuário cadastrado com sucesso!');
        
        res.json({ 
            success: true, 
            user: userResponse 
        });
        
    } catch (error) {
        console.error('❌ Erro ao cadastrar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor: ' + error.message 
        });
    }
    
    console.log('=== FIM DO CADASTRO ===\n');
});

// 9. ROTA: Deletar usuário
app.delete('/api/usuarios/:id', (req, res) => {
    console.log('\n=== EXCLUINDO USUÁRIO ===');
    console.log('ID do usuário:', req.params.id);
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // Não permitir deletar o admin principal
        if (req.params.id === '1') {
            console.log('❌ Tentativa de excluir admin principal');
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível excluir o administrador principal' 
            });
        }
        
        // Verificar se usuário existe
        const user = data.users.find(u => u.id === req.params.id);
        if (!user) {
            console.log('❌ Usuário não encontrado');
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado' 
            });
        }
        
        console.log('👤 Usuário encontrado:', user.name);
        
        // Verificar se tem empréstimos ativos
        const hasActiveLoans = data.loans.some(loan => 
            loan.userId === req.params.id && loan.status === 'emprestado'
        );
        
        if (hasActiveLoans) {
            console.log('❌ Usuário tem empréstimos ativos');
            return res.status(400).json({ 
                success: false, 
                message: 'Usuário tem empréstimos ativos' 
            });
        }
        
        data.users = data.users.filter(user => user.id !== req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        
        console.log('✅ Usuário excluído com sucesso!');
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Erro ao excluir usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
    
    console.log('=== FIM DA EXCLUSÃO ===\n');
});

// 10. ROTA: Listar ferramentas
app.get('/api/ferramentas', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.tools);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler ferramentas' });
    }
});

// 11. ROTA: Adicionar nova ferramenta
app.post('/api/ferramentas', (req, res) => {
    console.log('\n=== CADASTRANDO NOVA FERRAMENTA ===');
    
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        const { code, name, category, description } = req.body;
        
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
        
        console.log('✅ Validações passadas');
        
        const newTool = {
            id: Date.now().toString(),
            code: code,
            name: name,
            category: category,
            description: description || '',
            available: true,
            status: 'disponivel',
            setor: 'GERAL',
            createdAt: new Date().toISOString()
        };
        
        console.log('🛠️ Nova ferramenta:', newTool.name);
        console.log('📝 Código:', newTool.code);
        
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
    
    console.log('=== FIM DO CADASTRO ===\n');
});

// 12. ROTA: Atualizar ferramenta
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

// 13. ROTA: Deletar ferramenta
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
        
        // Verificar se está emprestada
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
    
    console.log('=== FIM DA EXCLUSÃO ===\n');
});

// 14. ROTA: Listar empréstimos
app.get('/api/emprestimos', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.loans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler empréstimos' });
    }
});

// 15. ROTA: Adicionar empréstimo
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
        
        // Verificar se ferramenta está disponível
        if (!tool.available) {
            console.log('❌ Ferramenta não disponível');
            return res.status(400).json({ 
                success: false, 
                message: 'Esta ferramenta não está disponível no momento' 
            });
        }
        
        console.log('✅ Validações passadas');
        console.log('👤 Usuário:', user.name);
        console.log('🛠️ Ferramenta:', tool.name);
        
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
        
        // Atualizar status da ferramenta
        const toolIndex = data.tools.findIndex(t => t.id === toolId);
        data.tools[toolIndex].available = false;
        data.tools[toolIndex].status = 'emprestado';
        
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
    
    console.log('=== FIM DO EMPRÉSTIMO ===\n');
});

// 16. ROTA: Atualizar empréstimo (devolução)
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
        data.loans[loanIndex] = { 
            ...data.loans[loanIndex], 
            ...req.body,
            returnedAt: req.body.status !== 'emprestado' ? new Date().toISOString() : null
        };
        
        console.log('📝 Status alterado:', oldStatus, '→', req.body.status);
        
        // Se devolvido, marcar ferramenta como disponível
        if (req.body.status === 'devolvido') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                data.tools[toolIndex].available = true;
                data.tools[toolIndex].status = 'disponivel';
                console.log('✅ Ferramenta marcada como disponível');
            }
        }
        // Se quebrado, marcar ferramenta como indisponível
        else if (req.body.status === 'quebrado') {
            const toolId = data.loans[loanIndex].toolId;
            const toolIndex = data.tools.findIndex(t => t.id === toolId);
            if (toolIndex !== -1) {
                data.tools[toolIndex].available = false;
                data.tools[toolIndex].status = 'quebrado';
                console.log('⚠️ Ferramenta marcada como quebrada');
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
    
    console.log('=== FIM DA ATUALIZAÇÃO ===\n');
});

// 17. Rota para testar se o servidor está vivo
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        database: fs.existsSync(dbPath) ? 'OK' : 'MISSING'
    });
});

// 18. Rota para visualizar o database (apenas para debug)
app.get('/api/debug/database', (req, res) => {
    try {
        const rawData = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(rawData);
        
        // Esconder senhas por segurança
        const safeData = {
            ...data,
            users: data.users.map(user => ({
                ...user,
                password: user.password ? '********' : null
            }))
        };
        
        res.json(safeData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 19. Servir outras páginas HTML
app.get('/:page', (req, res) => {
    const page = req.params.page;
    const allowedPages = ['index_admin.html', 'index_cnc.html', 'index_ferramenteiro.html'];
    
    if (allowedPages.includes(page)) {
        const filePath = path.join(__dirname, page);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send(`Arquivo ${page} não encontrado no servidor`);
        }
    } else {
        res.status(404).send('Página não encontrada');
    }
});

// 20. Rota para servir arquivos CSS, JS, etc
app.get('/Assets/:type/:file', (req, res) => {
    const filePath = path.join(__dirname, 'Assets', req.params.type, req.params.file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

// 21. Rota para servir arquivos CSS, JS na raiz
app.get('/:file', (req, res) => {
    const file = req.params.file;
    if (file.endsWith('.css') || file.endsWith('.js')) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send('Arquivo não encontrado');
        }
    }
});

// 22. Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    // Encontra o IP local
    for (const interfaceName in networkInterfaces) {
        for (const interface of networkInterfaces[interfaceName]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                localIp = interface.address;
                break;
            }
        }
    }
    
    console.log(`╔══════════════════════════════════════════════════════╗`);
    console.log(`║          SISTEMA FERRAMENTARIA v2.0                ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║ 📍 Local:    http://localhost:${PORT}               ║`);
    console.log(`║ 🌐 Rede:     http://${localIp}:${PORT}              ║`);
    console.log(`║ 🔐 Credenciais:                                     ║`);
    console.log(`║    👤 admin                                         ║`);
    console.log(`║    🔑 admin123                                      ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║ 📊 API Endpoints:                                   ║`);
    console.log(`║   POST   /api/login                                 ║`);
    console.log(`║   GET    /api/usuarios                              ║`);
    console.log(`║   POST   /api/usuarios                              ║`);
    console.log(`║   DELETE /api/usuarios/:id                          ║`);
    console.log(`║   GET    /api/ferramentas                           ║`);
    console.log(`║   POST   /api/ferramentas                           ║`);
    console.log(`║   PUT    /api/ferramentas/:id                       ║`);
    console.log(`║   DELETE /api/ferramentas/:id                       ║`);
    console.log(`║   GET    /api/emprestimos                           ║`);
    console.log(`║   POST   /api/emprestimos                           ║`);
    console.log(`║   PUT    /api/emprestimos/:id                       ║`);
    console.log(`╚══════════════════════════════════════════════════════╝`);
    console.log(`\n📁 Database: ${dbPath}`);
    console.log(`✅ Servidor rodando! Pressione Ctrl+C para parar.\n`);
});