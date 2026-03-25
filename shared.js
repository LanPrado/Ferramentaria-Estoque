// shared.js - Funções compartilhadas entre todas as páginas
class SistemaFerramentaria {
    constructor() {
        this.currentUser = null;
        this.database = { users: [], tools: [], loans: [] };
        this.apiBase = '';
    }
    
    // Inicializar
    async init() {
        await this.loadCurrentUser();
        await this.loadDatabase();
        return this;
    }
    
    // Carregar usuário atual
    async loadCurrentUser() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        } else {
            // Redirecionar para login se não tiver usuário
            window.location.href = '/';
        }
        return this.currentUser;
    }
    
    // Carregar banco de dados da API
    async loadDatabase() {
        try {
            const response = await fetch('/api/database?_=' + Date.now());
            if (response.ok) {
                this.database = await response.json();
                console.log('✅ Database carregado:', this.database);
            } else {
                console.error('Erro ao carregar database');
            }
        } catch (error) {
            console.error('Erro de conexão:', error);
        }
        return this.database;
    }
    
    // Salvar alterações no banco
    async saveDatabase() {
        try {
            const response = await fetch('/api/database', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.database)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao salvar:', error);
            return false;
        }
    }
    
    // Fazer logout
    logout() {
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    }
    
    // Obter ferramentas disponíveis
    getAvailableTools() {
        return this.database.tools.filter(tool => tool.available);
    }
    
    // Obter empréstimos do usuário atual
    getUserLoans() {
        if (!this.currentUser) return [];
        return this.database.loans.filter(loan => loan.userId === this.currentUser.id);
    }
    
    // Obter empréstimos ativos do usuário
    getUserActiveLoans() {
        return this.getUserLoans().filter(loan => loan.status === 'emprestado');
    }
    
    // Obter todas as ferramentas
    getAllTools() {
        return this.database.tools;
    }
    
    // Obter todos os usuários
    getAllUsers() {
        return this.database.users;
    }
    
    // Obter todos os empréstimos
    getAllLoans() {
        return this.database.loans;
    }
    
    // Buscar ferramenta por ID
    getToolById(id) {
        return this.database.tools.find(tool => tool.id === id);
    }
    
    // Buscar usuário por ID
    getUserById(id) {
        return this.database.users.find(user => user.id === id);
    }
    
    // Criar novo empréstimo
    async createLoan(toolId, notes = '') {
        if (!this.currentUser) return null;
        
        try {
            const response = await fetch('/api/emprestimos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    toolId: toolId,
                    notes: notes
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                await this.loadDatabase(); // Recarregar dados
                return result;
            }
            return null;
        } catch (error) {
            console.error('Erro ao criar empréstimo:', error);
            return null;
        }
    }
    
    // Devolver ferramenta
    async returnTool(loanId, status = 'devolvido') {
        try {
            const response = await fetch(`/api/emprestimos/${loanId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status })
            });
            
            if (response.ok) {
                await this.loadDatabase(); // Recarregar dados
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao devolver ferramenta:', error);
            return false;
        }
    }
    
    // Criar nova ferramenta (apenas admin)
    async createTool(toolData) {
        try {
            const response = await fetch('/api/ferramentas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toolData)
            });
            
            if (response.ok) {
                await this.loadDatabase();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao criar ferramenta:', error);
            return false;
        }
    }
    
    // Criar novo usuário (apenas admin)
    async createUser(userData) {
        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                await this.loadDatabase();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            return false;
        }
    }
    
    // Helper: Obter badge de status
    getStatusBadge(status) {
        const statusMap = {
            'emprestado': { class: 'badge-warning', text: 'EMPRESTADO' },
            'devolvido': { class: 'badge-success', text: 'DEVOLVIDO' },
            'nao-entregue': { class: 'badge-danger', text: 'NÃO ENTREGUE' },
            'quebrado': { class: 'badge-danger', text: 'QUEBRADO' },
            'disponivel': { class: 'badge-success', text: 'DISPONÍVEL' },
            'manutencao': { class: 'badge-info', text: 'MANUTENÇÃO' }
        };
        
        const statusInfo = statusMap[status] || { class: 'badge-secondary', text: status };
        return `<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`;
    }
    
    // Helper: Formatar data
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').slice(0,5);
    }
    
    // Helper: Mostrar mensagem
    showMessage(message, type = 'info') {
        // Remove mensagens antigas
        const oldMessage = document.getElementById('system-message');
        if (oldMessage) oldMessage.remove();
        
        // Cria nova mensagem
        const messageDiv = document.createElement('div');
        messageDiv.id = 'system-message';
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'success') {
            messageDiv.style.backgroundColor = '#28a745';
        } else if (type === 'error') {
            messageDiv.style.backgroundColor = '#dc3545';
        } else if (type === 'warning') {
            messageDiv.style.backgroundColor = '#ffc107';
            messageDiv.style.color = '#333';
        } else {
            messageDiv.style.backgroundColor = '#17a2b8';
        }
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        // Remove após 3 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }
        }, 3000);
        
        // Adicionar CSS para animação se não existir
        if (!document.querySelector('#message-styles')) {
            const style = document.createElement('style');
            style.id = 'message-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Exportar instância global
window.sistema = new SistemaFerramentaria();