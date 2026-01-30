const fs = require('fs');
const path = require('path');

let jsPDF, autoTable;
try {
  jsPDF = require('jspdf');
  autoTable = require('jspdf-autotable');
} catch (error) {
  console.error('Erro ao carregar bibliotecas PDF:', error);
}

function generateUserReportPDF(userLoans, user, allTools, settings, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('RELATÓRIO DE USUÁRIO', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.companyName || 'Empresa', 105, 30, { align: 'center' });
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 36, { align: 'center' });
      
      // Informações do Usuário
      doc.setFontSize(14);
      doc.setTextColor(30, 60, 114);
      doc.text('INFORMAÇÕES DO USUÁRIO', 20, 50);
      
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(`Nome: ${user.name}`, 20, 60);
      doc.text(`Código: ${user.companyCode}`, 20, 67);
      doc.text(`Turno: ${user.shift}`, 20, 74);
      
      // Tabela de Empréstimos
      const tableData = userLoans.map(loan => {
        const tool = allTools.find(t => t.id === loan.toolId);
        const borrowedDate = new Date(loan.borrowedAt);
        const returnedDate = loan.returnedAt ? new Date(loan.returnedAt) : null;
        
        return [
          tool ? tool.name : 'N/A',
          tool ? tool.code : 'N/A',
          borrowedDate.toLocaleDateString('pt-BR'),
          borrowedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          returnedDate ? returnedDate.toLocaleDateString('pt-BR') : 'Não devolvido',
          returnedDate ? returnedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
          formatStatus(loan.status)
        ];
      });
      
      autoTable(doc, {
        startY: 85,
        head: [['Ferramenta', 'Código', 'Data Retirada', 'Hora', 'Data Devolução', 'Hora', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 60, 114] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 30 }
        }
      });
      
      // Estatísticas
      const finalY = doc.lastAutoTable.finalY + 10;
      const totalLoans = userLoans.length;
      const returnedLoans = userLoans.filter(l => l.status === 'devolvido').length;
      const pendingLoans = userLoans.filter(l => l.status === 'emprestado').length;
      const brokenTools = userLoans.filter(l => l.status === 'quebrado').length;
      
      doc.setFontSize(12);
      doc.setTextColor(30, 60, 114);
      doc.text('ESTATÍSTICAS', 20, finalY);
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Total de empréstimos: ${totalLoans}`, 20, finalY + 8);
      doc.text(`Devolvidos: ${returnedLoans}`, 20, finalY + 16);
      doc.text(`Pendentes: ${pendingLoans}`, 20, finalY + 24);
      doc.text(`Quebrados: ${brokenTools}`, 20, finalY + 32);
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        doc.text(`Sistema de Controle de Ferramentas - ${settings.companyName || 'Empresa'}`, 105, 290, { align: 'center' });
      }
      
      doc.save(filePath);
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

function generateShiftReportPDF(shiftLoans, shift, shiftUsers, allTools, settings, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text(`RELATÓRIO DO ${shift.toUpperCase()}`, 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.companyName || 'Empresa', 105, 30, { align: 'center' });
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 36, { align: 'center' });
      
      // Informações do Turno
      doc.setFontSize(14);
      doc.setTextColor(30, 60, 114);
      doc.text('INFORMAÇÕES DO TURNO', 20, 50);
      
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(`Turno: ${shift}`, 20, 60);
      doc.text(`Total de Usuários: ${shiftUsers.length}`, 20, 67);
      doc.text(`Total de Movimentações: ${shiftLoans.length}`, 20, 74);
      
      // Lista de Usuários
      doc.setFontSize(12);
      doc.setTextColor(30, 60, 114);
      doc.text('USUÁRIOS DO TURNO', 20, 85);
      
      const usersList = shiftUsers.map(user => `${user.name} (${user.companyCode})`).join(', ');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const splitText = doc.splitTextToSize(usersList, 170);
      doc.text(splitText, 20, 95);
      
      // Tabela de Movimentações
      const startY = 95 + (splitText.length * 5) + 10;
      const tableData = shiftLoans.map(loan => {
        const tool = allTools.find(t => t.id === loan.toolId);
        const user = shiftUsers.find(u => u.id === loan.userId);
        const borrowedDate = new Date(loan.borrowedAt);
        const returnedDate = loan.returnedAt ? new Date(loan.returnedAt) : null;
        
        return [
          user ? user.name : 'N/A',
          tool ? tool.name : 'N/A',
          tool ? tool.code : 'N/A',
          borrowedDate.toLocaleDateString('pt-BR'),
          borrowedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          formatStatus(loan.status)
        ];
      });
      
      autoTable(doc, {
        startY: startY,
        head: [['Usuário', 'Ferramenta', 'Código', 'Data', 'Hora', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 60, 114] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 30 }
        }
      });
      
      // Estatísticas
      const finalY = doc.lastAutoTable.finalY + 10;
      const activeLoans = shiftLoans.filter(l => l.status === 'emprestado').length;
      const returnedLoans = shiftLoans.filter(l => l.status === 'devolvido').length;
      const brokenTools = shiftLoans.filter(l => l.status === 'quebrado').length;
      
      doc.setFontSize(12);
      doc.setTextColor(30, 60, 114);
      doc.text('ESTATÍSTICAS DO TURNO', 20, finalY);
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Empréstimos ativos: ${activeLoans}`, 20, finalY + 8);
      doc.text(`Devolvidos: ${returnedLoans}`, 20, finalY + 16);
      doc.text(`Quebrados: ${brokenTools}`, 20, finalY + 24);
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        doc.text(`Sistema de Controle de Ferramentas - ${settings.companyName || 'Empresa'}`, 105, 290, { align: 'center' });
      }
      
      doc.save(filePath);
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

function generateAllLoansPDF(allLoans, allUsers, allTools, settings, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF('landscape');
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('RELATÓRIO COMPLETO DE EMPRÉSTIMOS', 148, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.companyName || 'Empresa', 148, 30, { align: 'center' });
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 148, 36, { align: 'center' });
      
      // Tabela Completa
      const tableData = allLoans.map(loan => {
        const tool = allTools.find(t => t.id === loan.toolId);
        const user = allUsers.find(u => u.id === loan.userId);
        const borrowedDate = new Date(loan.borrowedAt);
        const returnedDate = loan.returnedAt ? new Date(loan.returnedAt) : null;
        
        return [
          user ? user.name : 'N/A',
          user ? user.companyCode : 'N/A',
          user ? user.shift : 'N/A',
          tool ? tool.name : 'N/A',
          tool ? tool.code : 'N/A',
          borrowedDate.toLocaleDateString('pt-BR'),
          borrowedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          returnedDate ? returnedDate.toLocaleDateString('pt-BR') : '-',
          returnedDate ? returnedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
          formatStatus(loan.status)
        ];
      });
      
      autoTable(doc, {
        startY: 45,
        head: [['Usuário', 'Código', 'Turno', 'Ferramenta', 'Código', 'Data Ret.', 'Hora Ret.', 'Data Dev.', 'Hora Dev.', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 60, 114] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 20 },
          7: { cellWidth: 25 },
          8: { cellWidth: 20 },
          9: { cellWidth: 25 }
        }
      });
      
      // Estatísticas Gerais
      const finalY = doc.lastAutoTable.finalY + 10;
      const activeLoans = allLoans.filter(l => l.status === 'emprestado').length;
      const returnedLoans = allLoans.filter(l => l.status === 'devolvido').length;
      const brokenTools = allLoans.filter(l => l.status === 'quebrado').length;
      const notDelivered = allLoans.filter(l => l.status === 'nao-entregue').length;
      
      doc.setFontSize(12);
      doc.setTextColor(30, 60, 114);
      doc.text('ESTATÍSTICAS GERAIS', 20, finalY);
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Total de registros: ${allLoans.length}`, 20, finalY + 8);
      doc.text(`Empréstimos ativos: ${activeLoans}`, 20, finalY + 16);
      doc.text(`Devolvidos: ${returnedLoans}`, 20, finalY + 24);
      doc.text(`Quebrados: ${brokenTools}`, 20, finalY + 32);
      doc.text(`Não entregues: ${notDelivered}`, 20, finalY + 40);
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 148, 200, { align: 'center' });
        doc.text(`Sistema de Controle de Ferramentas - ${settings.companyName || 'Empresa'}`, 148, 205, { align: 'center' });
      }
      
      doc.save(filePath);
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

function formatStatus(status) {
  const statusMap = {
    'emprestado': 'EMPRESTADO',
    'devolvido': 'DEVOLVIDO',
    'nao-entregue': 'NÃO ENTREGUE',
    'quebrado': 'QUEBRADO',
    'disponivel': 'DISPONÍVEL'
  };
  return statusMap[status] || status;
}

module.exports = {
  generateUserReportPDF,
  generateShiftReportPDF,
  generateAllLoansPDF
};