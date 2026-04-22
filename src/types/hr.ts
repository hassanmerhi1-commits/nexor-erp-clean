// Kwanza ERP - HR Module Types

export interface Employee {
  id: string;
  employeeNumber: string;  // EMP-001
  firstName: string;
  lastName: string;
  fullName: string;
  nif: string;
  bi: string;              // Bilhete de Identidade
  gender: 'M' | 'F';
  dateOfBirth: string;
  nationality: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Contact
  phone: string;
  email?: string;
  address: string;
  city: string;
  
  // Employment
  branchId: string;
  branchName: string;
  department: string;
  position: string;
  contractType: 'permanent' | 'fixed_term' | 'temporary' | 'intern';
  startDate: string;
  endDate?: string;
  
  // Salary
  baseSalary: number;
  currency: 'AOA' | 'USD';
  salaryFrequency: 'monthly' | 'biweekly';
  bankName?: string;
  bankAccount?: string;
  iban?: string;
  
  // Deductions & Benefits
  socialSecurityNumber?: string;
  irtRate: number;          // Imposto sobre o Rendimento do Trabalho
  socialSecurityRate: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  
  // Status
  status: 'active' | 'on_leave' | 'suspended' | 'terminated';
  terminationDate?: string;
  terminationReason?: string;
  
  // Photo
  photoUrl?: string;
  
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked: number;
  overtime: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'leave';
  leaveType?: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid';
  notes?: string;
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  payrollNumber: string;    // PAY-202603-001
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  branchId: string;
  period: string;           // 2026-03
  
  // Earnings
  baseSalary: number;
  overtime: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  
  // Deductions
  irtAmount: number;        // Income tax
  socialSecurity: number;   // INSS
  otherDeductions: number;
  totalDeductions: number;
  
  // Net
  netSalary: number;
  
  // Payment
  paymentMethod: 'bank_transfer' | 'cash' | 'cheque';
  paymentDate?: string;
  paymentReference?: string;
  status: 'draft' | 'approved' | 'paid';
  
  // Journal
  journalEntryId?: string;
  
  // Audit
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

// Angola IRT tax brackets (2026)
export const IRT_BRACKETS = [
  { min: 0, max: 100000, rate: 0 },
  { min: 100001, max: 150000, rate: 0.10 },
  { min: 150001, max: 200000, rate: 0.13 },
  { min: 200001, max: 300000, rate: 0.16 },
  { min: 300001, max: 500000, rate: 0.18 },
  { min: 500001, max: 1000000, rate: 0.19 },
  { min: 1000001, max: 1500000, rate: 0.20 },
  { min: 1500001, max: 2000000, rate: 0.21 },
  { min: 2000001, max: 2500000, rate: 0.22 },
  { min: 2500001, max: 5000000, rate: 0.23 },
  { min: 5000001, max: 10000000, rate: 0.24 },
  { min: 10000001, max: Infinity, rate: 0.25 },
];

export const INSS_EMPLOYEE_RATE = 0.03;  // 3% employee contribution
export const INSS_EMPLOYER_RATE = 0.08;  // 8% employer contribution

export function calculateIRT(grossSalary: number): number {
  let tax = 0;
  for (const bracket of IRT_BRACKETS) {
    if (grossSalary > bracket.min) {
      const taxable = Math.min(grossSalary, bracket.max) - bracket.min;
      tax += taxable * bracket.rate;
    }
  }
  return Math.round(tax);
}

export function calculatePayroll(employee: Employee, overtime: number = 0, bonus: number = 0): Omit<PayrollEntry, 'id' | 'payrollNumber' | 'period' | 'status' | 'createdBy' | 'createdAt' | 'paymentMethod'> {
  const grossSalary = employee.baseSalary + employee.mealAllowance + employee.transportAllowance + employee.otherAllowances + overtime + bonus;
  const irtAmount = calculateIRT(grossSalary);
  const socialSecurity = Math.round(grossSalary * INSS_EMPLOYEE_RATE);
  const totalDeductions = irtAmount + socialSecurity;
  const netSalary = grossSalary - totalDeductions;

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    branchId: employee.branchId,
    baseSalary: employee.baseSalary,
    overtime,
    mealAllowance: employee.mealAllowance,
    transportAllowance: employee.transportAllowance,
    otherAllowances: employee.otherAllowances,
    bonus,
    grossSalary,
    irtAmount,
    socialSecurity,
    otherDeductions: 0,
    totalDeductions,
    netSalary,
  };
}

export const DEPARTMENTS = [
  'Administração', 'Contabilidade', 'Vendas', 'Compras', 'Armazém',
  'Logística', 'TI', 'Recursos Humanos', 'Marketing', 'Produção', 'Segurança'
];
