const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Configurar caminhos (agora salvando na pasta do projeto para facilitar)
const dbPath = path.join(__dirname, 'database.json');

// Middleware para processar JSON e arquivos estáticos
app.use(express.json());
app.use(express.static(__dirname)); // Serve seus HTMLs e CSS

// 1. Lógica de Inicialização (Mantida do seu original)
function initDatabase() {
    if (!fs.existsSync(dbPath)) {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('admin123', salt);
        const initialData = {
            users: [{
                id: '1',
                username: 'admin',
                password: hashedPassword,
                name: 'Administrador',
                companyCode: '000000',
                role: 'ADMIN_GERAL', // Adicione o campo de perfil aqui
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
    }
}

initDatabase();

// 2. Rotas que substituem os "ipcMain.handle"
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const user = data.users.find(u => u.username === username);

        if (user && bcrypt.compareSync(password, user.password)) {
            // Retorna os dados do usuário e qual tela ele deve abrir
            res.json({ 
                success: true, 
                user: { name: user.name, role: user.role },
                redirect: user.role === 'ADMIN_GERAL' ? 'index_admin.html' : 
                          user.role === 'LIDER_CNC' ? 'index_cnc.html' : 'index_ferramenteiro.html'
            });
        } else {
            res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// Rota para ler o banco (Substitui 'read-database')
app.get('/api/database', (req, res) => {
    const data = fs.readFileSync(dbPath, 'utf8');
    res.json(JSON.parse(data));
});

// 3. Iniciar o servidor para acesso via IP
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sistema online!`);
    console.log(`Acesse no PC: http://localhost:${PORT}`);
    console.log(`Acesse no Mobile: http://SEU-IP-AQUI:${PORT}`);
});