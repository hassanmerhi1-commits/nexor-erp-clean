/**
 * Payroll Slip PDF Generator
 * Generates professional A4 payslips with IRT/INSS deductions
 */

import { PayrollEntry, Employee } from '@/types/hr';
import { getCompanySettings } from './companySettings';

export function generatePayslipHTML(entry: PayrollEntry, employee?: Employee): string {
  const company = getCompanySettings();
  const fmt = (v: number) => v.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const periodLabel = entry.period ? (() => {
    const [y, m] = entry.period.split('-');
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${months[parseInt(m) - 1]} ${y}`;
  })() : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; }
  .slip { max-width: 210mm; margin: 0 auto; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 15px; }
  .company-name { font-size: 20px; font-weight: 800; color: #1e40af; }
  .company-info { font-size: 9px; color: #555; margin-top: 4px; }
  .slip-title { font-size: 16px; font-weight: 800; color: #1e40af; text-align: right; }
  .slip-period { font-size: 11px; color: #555; text-align: right; margin-top: 2px; }
  .slip-number { font-size: 10px; color: #777; text-align: right; }
  .employee-box { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 12px; margin-bottom: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .emp-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .emp-value { font-size: 11px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  th:last-child { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  td:last-child { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
  .section-title { font-size: 12px; font-weight: 700; color: #1e40af; margin: 15px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #c7d2fe; }
  .total-row { background: #f0f4ff; font-weight: 700; }
  .total-row td { border-bottom: 2px solid #1e40af; }
  .net-box { background: #1e40af; color: white; border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
  .net-label { font-size: 14px; font-weight: 700; }
  .net-value { font-size: 24px; font-weight: 800; }
  .footer { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sign-box { border-top: 1px solid #999; padding-top: 5px; text-align: center; font-size: 9px; color: #666; margin-top: 50px; }
  .legal { text-align: center; font-size: 8px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="slip">
  <div class="header">
    <div>
      <div class="company-name">${company.name || 'Kwanza ERP'}</div>
      <div class="company-info">
        ${company.address ? company.address + '<br>' : ''}
        ${company.nif ? 'NIF: ' + company.nif : ''} ${company.phone ? ' | Tel: ' + company.phone : ''}
      </div>
    </div>
    <div>
      <div class="slip-title">RECIBO DE VENCIMENTO</div>
      <div class="slip-period">${periodLabel}</div>
      <div class="slip-number">${entry.payrollNumber}</div>
    </div>
  </div>

  <div class="employee-box">
    <div><span class="emp-label">Funcionário</span><div class="emp-value">${entry.employeeName}</div></div>
    <div><span class="emp-label">Nº Funcionário</span><div class="emp-value">${entry.employeeNumber}</div></div>
    <div><span class="emp-label">Departamento</span><div class="emp-value">${employee?.department || '-'}</div></div>
    <div><span class="emp-label">Cargo</span><div class="emp-value">${employee?.position || '-'}</div></div>
    <div><span class="emp-label">NIF</span><div class="emp-value">${employee?.nif || '-'}</div></div>
    <div><span class="emp-label">Seg. Social</span><div class="emp-value">${employee?.socialSecurityNumber || '-'}</div></div>
  </div>

  <div class="section-title">Abonos</div>
  <table>
    <thead><tr><th>Descrição</th><th>Valor (Kz)</th></tr></thead>
    <tbody>
      <tr><td>Salário Base</td><td>${fmt(entry.baseSalary)}</td></tr>
      ${entry.mealAllowance > 0 ? `<tr><td>Subsídio de Alimentação</td><td>${fmt(entry.mealAllowance)}</td></tr>` : ''}
      ${entry.transportAllowance > 0 ? `<tr><td>Subsídio de Transporte</td><td>${fmt(entry.transportAllowance)}</td></tr>` : ''}
      ${entry.otherAllowances > 0 ? `<tr><td>Outros Subsídios</td><td>${fmt(entry.otherAllowances)}</td></tr>` : ''}
      ${entry.overtime > 0 ? `<tr><td>Horas Extra</td><td>${fmt(entry.overtime)}</td></tr>` : ''}
      ${entry.bonus > 0 ? `<tr><td>Bónus</td><td>${fmt(entry.bonus)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Bruto</td><td>${fmt(entry.grossSalary)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Descontos</div>
  <table>
    <thead><tr><th>Descrição</th><th>Valor (Kz)</th></tr></thead>
    <tbody>
      <tr><td>IRT - Imposto s/ Rendimento do Trabalho</td><td>${fmt(entry.irtAmount)}</td></tr>
      <tr><td>INSS - Segurança Social (3%)</td><td>${fmt(entry.socialSecurity)}</td></tr>
      ${entry.otherDeductions > 0 ? `<tr><td>Outros Descontos</td><td>${fmt(entry.otherDeductions)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Descontos</td><td>${fmt(entry.totalDeductions)}</td></tr>
    </tbody>
  </table>

  <div class="net-box">
    <span class="net-label">SALÁRIO LÍQUIDO</span>
    <span class="net-value">${fmt(entry.netSalary)} Kz</span>
  </div>

  ${employee?.bankName ? `<div style="font-size:10px;color:#555;margin-bottom:15px;">
    <strong>Dados Bancários:</strong> ${employee.bankName} ${employee.iban ? '| IBAN: ' + employee.iban : employee.bankAccount ? '| Conta: ' + employee.bankAccount : ''}
  </div>` : ''}

  <div class="footer">
    <div><div class="sign-box">O Empregador</div></div>
    <div><div class="sign-box">O Funcionário</div></div>
  </div>

  <div class="legal">
    Documento processado por ${company.name || 'Kwanza ERP'} • Este recibo é válido como comprovativo de pagamento
  </div>
</div>
</body></html>`;
}

export function printPayslip(entry: PayrollEntry, employee?: Employee): void {
  const html = generatePayslipHTML(entry, employee);
  const win = window.open('', '_blank', 'width=800,height=1100');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}
