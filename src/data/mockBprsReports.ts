import type { ReportRow } from '@/types/report'

export const mockBprsBalanceSheet: ReportRow[] = [
  // AKTIVA
  { Account: '1', Description: 'AKTIVA', Amount: null, PadLeft: 0 },
  { Account: '11', Description: 'Kas dan Setara Kas', Amount: null, PadLeft: 1 },
  { Account: '1101', Description: 'Kas', Amount: '245,800,000.00', PadLeft: 2 },
  {
    Account: '1102',
    Description: 'Penempatan pada Bank Indonesia',
    Amount: '1,580,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '1103',
    Description: 'Penempatan pada Bank Lain',
    Amount: '820,500,000.00',
    PadLeft: 2,
  },
  { Account: '12', Description: 'Pembiayaan', Amount: null, PadLeft: 1 },
  { Account: '1201', Description: 'Murabahah', Amount: '12,485,000,000.00', PadLeft: 2 },
  { Account: '1202', Description: 'Mudharabah', Amount: '3,125,000,000.00', PadLeft: 2 },
  { Account: '1203', Description: 'Musyarakah', Amount: '4,250,000,000.00', PadLeft: 2 },
  {
    Account: '1204',
    Description: 'PPAP - Cadangan Kerugian',
    Amount: '-315,000,000.00',
    PadLeft: 2,
  },
  { Account: '13', Description: 'Aset Lainnya', Amount: null, PadLeft: 1 },
  {
    Account: '1301',
    Description: 'Agunan yang Diambil Alih',
    Amount: '450,000,000.00',
    PadLeft: 2,
  },
  { Account: '1302', Description: 'Aset Tetap (Neto)', Amount: '2,180,000,000.00', PadLeft: 2 },
  { Account: '1303', Description: 'Aset Lain-Lain', Amount: '124,500,000.00', PadLeft: 2 },
  // PASIVA
  { Account: '2', Description: 'PASIVA', Amount: null, PadLeft: 0 },
  { Account: '21', Description: 'Dana Pihak Ketiga', Amount: null, PadLeft: 1 },
  { Account: '2101', Description: 'Tabungan Wadiah', Amount: '5,820,000,000.00', PadLeft: 2 },
  { Account: '2102', Description: 'Tabungan Mudharabah', Amount: '4,250,000,000.00', PadLeft: 2 },
  { Account: '2103', Description: 'Deposito Mudharabah', Amount: '9,100,000,000.00', PadLeft: 2 },
  { Account: '22', Description: 'Kewajiban Lainnya', Amount: null, PadLeft: 1 },
  { Account: '2201', Description: 'Kewajiban Segera', Amount: '345,000,000.00', PadLeft: 2 },
  {
    Account: '2202',
    Description: 'Simpanan dari Bank Lain',
    Amount: '1,230,000,000.00',
    PadLeft: 2,
  },
  { Account: '2203', Description: 'Kewajiban Lain-Lain', Amount: '89,500,000.00', PadLeft: 2 },
  // MODAL
  { Account: '3', Description: 'MODAL', Amount: null, PadLeft: 0 },
  { Account: '3101', Description: 'Modal Disetor', Amount: '3,000,000,000.00', PadLeft: 1 },
  { Account: '3102', Description: 'Cadangan Umum', Amount: '350,000,000.00', PadLeft: 1 },
  { Account: '3103', Description: 'Laba Ditahan', Amount: '1,080,300,000.00', PadLeft: 1 },
]

export const mockBprsProfitLoss: ReportRow[] = [
  // PENDAPATAN OPERASIONAL
  { Account: '4', Description: 'PENDAPATAN OPERASIONAL', Amount: null, PadLeft: 0 },
  { Account: '41', Description: 'Pendapatan dari Pembiayaan', Amount: null, PadLeft: 1 },
  {
    Account: '4101',
    Description: 'Pendapatan Margin Murabahah',
    Amount: '1,485,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '4102',
    Description: 'Pendapatan Bagi Hasil Mudharabah',
    Amount: '325,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '4103',
    Description: 'Pendapatan Bagi Hasil Musyarakah',
    Amount: '480,000,000.00',
    PadLeft: 2,
  },
  { Account: '42', Description: 'Pendapatan Operasional Lainnya', Amount: null, PadLeft: 1 },
  { Account: '4201', Description: 'Pendapatan Administrasi', Amount: '86,500,000.00', PadLeft: 2 },
  { Account: '4202', Description: 'Pendapatan Jasa Lainnya', Amount: '42,200,000.00', PadLeft: 2 },
  // BEBAN
  { Account: '5', Description: 'BEBAN OPERASIONAL', Amount: null, PadLeft: 0 },
  { Account: '51', Description: 'Beban Bagi Hasil DPK', Amount: null, PadLeft: 1 },
  {
    Account: '5101',
    Description: 'Beban Bonus Tabungan Wadiah',
    Amount: '125,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '5102',
    Description: 'Beban Bagi Hasil Tabungan Mudharabah',
    Amount: '185,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '5103',
    Description: 'Beban Bagi Hasil Deposito Mudharabah',
    Amount: '520,000,000.00',
    PadLeft: 2,
  },
  { Account: '52', Description: 'Beban Overhead', Amount: null, PadLeft: 1 },
  { Account: '5201', Description: 'Beban Personalia', Amount: '345,000,000.00', PadLeft: 2 },
  {
    Account: '5202',
    Description: 'Beban Administrasi dan Umum',
    Amount: '78,500,000.00',
    PadLeft: 2,
  },
  {
    Account: '5203',
    Description: 'Beban Penyusutan Aset Tetap',
    Amount: '54,000,000.00',
    PadLeft: 2,
  },
  {
    Account: '5204',
    Description: 'Beban Cadangan Kerugian Pembiayaan',
    Amount: '68,000,000.00',
    PadLeft: 2,
  },
  // HASIL
  {
    Account: '9',
    Description: 'LABA BERSIH SEBELUM PAJAK',
    Amount: '1,143,200,000.00',
    PadLeft: 0,
  },
  { Account: '9101', Description: 'Pajak Penghasilan', Amount: '285,800,000.00', PadLeft: 1 },
  {
    Account: '9999',
    Description: 'LABA BERSIH SETELAH PAJAK',
    Amount: '857,400,000.00',
    PadLeft: 0,
  },
]
