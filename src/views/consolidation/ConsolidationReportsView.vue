<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildConsolidationPreview } from '@/services/consolidationEngineService'
import {
  getDefaultConsolidationConfig,
  loadConsolidationConfig,
  loadConsolidationConfigFromFile,
} from '@/services/consolidationConfigService'
import {
  fetchOdooCompaniesForConsolidation,
  loadConsolidationSourceData,
} from '@/services/consolidationSourceService'
import { useOdooAuthStore } from '@/stores/odooAuth'
import { exportMultiSheetExcel } from '@/utils/excelExport'
import type { ConsolidationConfig } from '@/types/consolidationConfig'
import type { ConsolidationPreviewResult } from '@/types/consolidationResult'
import type { ConsolidationLineType } from '@/types/consolidationConfig'

// ── Period wizard ─────────────────────────────────────────────────────────────
const today = new Date()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth() + 1 // 1-based

const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
const months = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
]

const authStore = useOdooAuthStore()
const selectedYear = ref(currentYear)
const selectedMonth = ref(currentMonth)
const periodLabel = computed(() => {
  const m = months.find((x) => x.value === selectedMonth.value)
  return `${m?.label ?? ''} ${selectedYear.value}`
})

// ── Report data ───────────────────────────────────────────────────────────────
const isGenerated = ref(false)
const isGenerating = ref(false)
const generationStatus = ref('')
const activeConfig = ref<ConsolidationConfig>(getDefaultConsolidationConfig())

const pnlResult = ref<ConsolidationPreviewResult | null>(null)
const bsResult = ref<ConsolidationPreviewResult | null>(null)
const tbResult = ref<ConsolidationPreviewResult | null>(null)

const activeTab = ref<'balance-sheet' | 'pnl' | 'trial-balance'>('balance-sheet')

const getReportPeriodParams = () => {
  const lastDayOfMonth = new Date(selectedYear.value, selectedMonth.value, 0).getDate()
  const month = String(selectedMonth.value).padStart(2, '0')

  return {
    date_from: `${selectedYear.value}-01-01`,
    date_to: `${selectedYear.value}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`,
    target_move: 'posted' as const,
  }
}

const generateReports = async () => {
  isGenerating.value = true

  try {
    const fromBackend = await loadConsolidationConfigFromFile()
    activeConfig.value = fromBackend ?? loadConsolidationConfig()
    await authStore.ensureCompanies()
    const companies =
      authStore.companies.length > 0
        ? authStore.companies
        : await fetchOdooCompaniesForConsolidation()

    const sourceData = await loadConsolidationSourceData(
      activeConfig.value,
      companies,
      ['pnl', 'balance-sheet', 'trial-balance'],
      getReportPeriodParams(),
    )

    pnlResult.value = buildConsolidationPreview('pnl', activeConfig.value, sourceData)
    bsResult.value = buildConsolidationPreview('balance-sheet', activeConfig.value, sourceData)
    tbResult.value = buildConsolidationPreview('trial-balance', activeConfig.value, sourceData)
    generationStatus.value = fromBackend
      ? 'Laporan dihitung dari config backend Odoo yang aktif dan source data terverifikasi per entity.'
      : 'Backend Odoo tidak tersedia. Laporan dihitung dari template default dan source data terverifikasi per entity.'
    isGenerated.value = true
    activeTab.value = 'balance-sheet'
  } catch (error) {
    pnlResult.value = buildConsolidationPreview('pnl', activeConfig.value, {})
    bsResult.value = buildConsolidationPreview('balance-sheet', activeConfig.value, {})
    tbResult.value = buildConsolidationPreview('trial-balance', activeConfig.value, {})
    generationStatus.value = `Laporan gagal memuat source live. Data mock tidak dipakai otomatis. ${
      error instanceof Error ? error.message : ''
    }`.trim()
    isGenerated.value = true
    activeTab.value = 'balance-sheet'
  } finally {
    isGenerating.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatMoney = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const rowClass = (lineType: ConsolidationLineType) => ({
  'row-header': lineType === 'header',
  'row-detail': lineType === 'detail',
  'row-subtotal': lineType === 'subtotal',
  'row-total': lineType === 'total',
  'row-derived': lineType === 'derived',
})

const activeRows = computed(() => {
  if (activeTab.value === 'balance-sheet') return bsResult.value?.rows ?? []
  if (activeTab.value === 'pnl') return pnlResult.value?.rows ?? []
  return tbResult.value?.rows ?? []
})

const activeResult = computed(() => {
  if (activeTab.value === 'balance-sheet') return bsResult.value
  if (activeTab.value === 'pnl') return pnlResult.value
  return tbResult.value
})

const activeSourceIssues = computed(() =>
  (activeResult.value?.sourceSummary ?? []).filter((source) => source.status !== 'live'),
)

const activeTitle = computed(() => {
  if (activeTab.value === 'balance-sheet') return 'Neraca (Balance Sheet)'
  if (activeTab.value === 'pnl') return 'Laba Rugi (Profit & Loss)'
  return 'Neraca Percobaan (Trial Balance)'
})

const grandTotal = computed(() =>
  activeRows.value
    .filter((r) => r.lineType === 'total' || r.lineType === 'derived')
    .reduce((sum, r) => sum + r.amountAfter, 0),
)

// ── Print ────────────────────────────────────────────────────────────────────
const printReport = () => window.print()

// ── Export XLS ───────────────────────────────────────────────────────────────
const buildSheetRows = (result: ConsolidationPreviewResult | null) =>
  (result?.rows ?? []).map((r) => [
    r.label,
    r.amountBefore,
    r.eliminationAmount !== 0 ? r.eliminationAmount : '',
    r.amountAfter,
  ])

const exportXls = () => {
  const period = periodLabel.value
  const cols = ['Uraian', 'Sebelum Eliminasi', 'Eliminasi', 'Setelah Eliminasi']

  exportMultiSheetExcel(
    [
      {
        name: 'Balance Sheet',
        headerRows: [['Neraca (Balance Sheet)'], [`Periode: ${period}`], []],
        columns: cols,
        rows: buildSheetRows(bsResult.value),
      },
      {
        name: 'Profit & Loss',
        headerRows: [['Laba Rugi (Profit & Loss)'], [`Periode: ${period}`], []],
        columns: cols,
        rows: buildSheetRows(pnlResult.value),
      },
      {
        name: 'Trial Balance',
        headerRows: [['Neraca Percobaan (Trial Balance)'], [`Periode: ${period}`], []],
        columns: cols,
        rows: buildSheetRows(tbResult.value),
      },
    ],
    `Laporan-Konsolidasi-${period.replace(/\s+/g, '-')}`,
  )
}
</script>

<template>
  <section class="consol-reports-page">
    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <header class="page-hero">
      <p class="eyebrow">Konsolidasi</p>
      <h1>Laporan Keuangan Konsolidasi</h1>
      <p class="subtitle">
        Hasil agregasi multi-entitas setelah eliminasi, per periode pelaporan yang dipilih.
      </p>
    </header>

    <!-- ── Period Wizard ────────────────────────────────────────────────────── -->
    <article class="wizard-card">
      <h2 class="section-title">Pilih Periode Laporan</h2>
      <div class="wizard-row">
        <label class="wizard-field">
          <span>Bulan</span>
          <select v-model="selectedMonth">
            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </label>
        <label class="wizard-field">
          <span>Tahun</span>
          <select v-model="selectedYear">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
        <div class="wizard-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="isGenerating"
            @click="generateReports"
          >
            {{ isGenerating ? 'Memproses Laporan...' : 'Tampilkan Laporan' }}
          </button>
        </div>
      </div>
      <div v-if="isGenerating" class="loading-inline" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span>Sedang memproses laporan konsolidasi. Mohon tunggu...</span>
      </div>
      <p v-if="generationStatus" class="period-badge">{{ generationStatus }}</p>
      <p v-if="isGenerated" class="period-badge">
        Periode Aktif: <strong>{{ periodLabel }}</strong>
      </p>
    </article>

    <!-- ── Report panel ─────────────────────────────────────────────────────── -->
    <template v-if="isGenerated">
      <!-- Tab switcher -->
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          :disabled="isGenerating"
          :class="{ active: activeTab === 'balance-sheet' }"
          @click="activeTab = 'balance-sheet'"
        >
          Balance Sheet
        </button>
        <button
          type="button"
          class="tab-btn"
          :disabled="isGenerating"
          :class="{ active: activeTab === 'pnl' }"
          @click="activeTab = 'pnl'"
        >
          Profit &amp; Loss
        </button>
        <button
          type="button"
          class="tab-btn"
          :disabled="isGenerating"
          :class="{ active: activeTab === 'trial-balance' }"
          @click="activeTab = 'trial-balance'"
        >
          Trial Balance
        </button>
        <div class="tab-bar-actions">
          <button
            type="button"
            class="btn-outline print-btn"
            :disabled="isGenerating"
            @click="printReport"
          >
            Cetak
          </button>
          <button type="button" class="btn-xls" :disabled="isGenerating" @click="exportXls">
            Export XLS
          </button>
        </div>
      </div>

      <!-- Report table -->
      <article class="report-card" id="print-area">
        <div class="report-header">
          <div>
            <p class="report-period">Periode: {{ periodLabel }}</p>
            <h2 class="report-title">{{ activeTitle }}</h2>
          </div>
          <p class="report-subtitle">Laporan Konsolidasi — Multi-Entitas (Setelah Eliminasi)</p>
        </div>

        <div v-if="activeSourceIssues.length > 0" class="source-alert">
          <strong>Source data belum sepenuhnya live.</strong>
          <div
            v-for="source in activeSourceIssues"
            :key="source.entityId"
            class="source-alert-line"
          >
            {{ source.entityId }}: {{ source.status }} | {{ source.sourceLabel }} |
            {{ source.periodLabel ?? '-' }} | {{ source.note ?? '-' }}
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th class="col-label">Uraian</th>
              <th class="col-amount">Sebelum Eliminasi</th>
              <th class="col-amount">Eliminasi</th>
              <th class="col-amount">Setelah Eliminasi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in activeRows" :key="row.key" :class="rowClass(row.lineType)">
              <td class="col-label" :data-indent="row.parentKey ? '1' : '0'">{{ row.label }}</td>
              <td class="col-amount">{{ formatMoney(row.amountBefore) }}</td>
              <td class="col-amount elim-col">
                <span v-if="row.eliminationAmount !== 0">{{
                  formatMoney(row.eliminationAmount)
                }}</span>
                <span v-else class="zero-dash">—</span>
              </td>
              <td class="col-amount strong">{{ formatMoney(row.amountAfter) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="grandTotal !== 0">
            <tr class="foot-total">
              <td>Grand Total</td>
              <td></td>
              <td></td>
              <td class="col-amount strong">{{ formatMoney(grandTotal) }}</td>
            </tr>
          </tfoot>
        </table>

        <p class="report-note">
          * Nilai dihasilkan dari config konsolidasi aktif. Untuk melihat detail source data, buka
          halaman Preview Agregasi &amp; Eliminasi.
        </p>
      </article>
    </template>

    <div v-else class="empty-state">
      <p>Pilih bulan dan tahun lalu klik <strong>Tampilkan Laporan</strong> untuk memulai.</p>
    </div>
  </section>
</template>

<style scoped>
.consol-reports-page {
  display: grid;
  gap: 1rem;
}

/* ── Hero ── */
.page-hero {
  border-radius: 18px;
  padding: 1.1rem 1.3rem;
  background: linear-gradient(130deg, rgba(20, 52, 94, 0.95), rgba(30, 100, 80, 0.88));
  color: #f1f7ff;
}
.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
  color: #8dd4c0;
}
.page-hero h1 {
  margin: 0.2rem 0;
  font-size: clamp(1.3rem, 2vw, 1.8rem);
}
.subtitle {
  margin: 0;
  color: #d7f0ea;
  font-size: 0.9rem;
}

/* ── Wizard ── */
.wizard-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(14, 55, 93, 0.14);
  padding: 1rem 1.1rem;
}
.section-title {
  margin: 0 0 0.7rem;
  font-size: 1rem;
  color: #173d64;
}
.wizard-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: flex-end;
}
.wizard-field {
  display: grid;
  gap: 0.3rem;
  font-size: 0.88rem;
  color: #2f465f;
}
.wizard-field select {
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  border: 1px solid #c7d9ec;
  font: inherit;
  font-size: 0.9rem;
  background: #f4f8fd;
  color: #173d64;
  cursor: pointer;
}
.wizard-actions {
  display: flex;
  align-items: flex-end;
}
.btn-primary {
  padding: 0.5rem 1.1rem;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, #1a5ca8, #0e8c72);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  transition: opacity 180ms;
}
.btn-primary:hover {
  opacity: 0.85;
}
.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-inline {
  margin: 0.7rem 0 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: #1f4f7c;
  background: #eef6ff;
  border: 1px solid #c7d9ec;
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
}

.spinner {
  width: 0.92rem;
  height: 0.92rem;
  border-radius: 50%;
  border: 2px solid #b7cce4;
  border-top-color: #1a5ca8;
  animation: spin 0.9s linear infinite;
  flex: 0 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.period-badge {
  margin: 0.7rem 0 0;
  font-size: 0.87rem;
  color: #2a5f4a;
  background: #e6f9f3;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  display: inline-block;
}

/* ── Tabs ── */
.tab-bar {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: wrap;
}
.tab-btn {
  padding: 0.48rem 0.95rem;
  border-radius: 9px;
  border: 1px solid rgba(14, 55, 93, 0.22);
  background: #f0f5fb;
  color: #2f465f;
  font: inherit;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 160ms;
}
.tab-btn:hover {
  background: #daeaf8;
}
.tab-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.tab-btn.active {
  background: #11325b;
  color: #fff;
  border-color: #11325b;
  font-weight: 700;
}
.tab-bar-actions {
  margin-left: auto;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.print-btn {
  padding: 0.48rem 0.95rem;
  border-radius: 9px;
  border: 1px solid #c7d9ec;
  background: #fff;
  color: #173d64;
  font: inherit;
  font-size: 0.86rem;
  cursor: pointer;
}
.print-btn:hover {
  background: #f0f5fb;
}
.print-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.btn-xls {
  padding: 0.48rem 0.95rem;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, #1d6e32, #2ea84b);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  transition: opacity 180ms;
}
.btn-xls:hover {
  opacity: 0.85;
}
.btn-xls:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* ── Report card ── */
.report-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(14, 55, 93, 0.14);
  padding: 1.1rem;
  overflow-x: auto;
}
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}
.report-period {
  margin: 0;
  font-size: 0.8rem;
  color: #6a88aa;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.report-title {
  margin: 0.15rem 0 0;
  font-size: 1.1rem;
  color: #0e2b52;
}
.report-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: #7a96b4;
  align-self: flex-end;
}
.report-note {
  margin: 0.7rem 0 0;
  font-size: 0.78rem;
  color: #8ba5c2;
}

/* ── Table ── */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.source-alert {
  margin: 0 0 0.8rem;
  border: 1px solid #f2b8a0;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  padding: 0.65rem 0.75rem;
  font-size: 0.82rem;
}

.source-alert-line {
  margin-top: 0.25rem;
}

.report-table thead th {
  padding: 0.55rem 0.7rem;
  background: #0e2b52;
  color: #c9dfff;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}
.col-amount {
  text-align: right;
}
.col-label {
  text-align: left;
}

.report-table tbody tr td {
  padding: 0.42rem 0.7rem;
  border-bottom: 1px solid #eaf1f9;
}

/* Row variants */
.row-header td {
  font-weight: 700;
  color: #0e2b52;
  background: #f0f5fb;
  border-top: 2px solid #c9dfff;
}
.row-header td.col-label {
  padding-left: 0.7rem;
}

.row-detail td.col-label[data-indent='1'] {
  padding-left: 1.6rem;
}

.row-subtotal td {
  font-weight: 600;
  color: #1a4f7c;
  border-top: 1px solid #c9dfff;
  background: #f7fafd;
}

.row-total td {
  font-weight: 700;
  color: #0a3d1f;
  background: #e6f4ef;
  border-top: 2px solid #7ec7ae;
}

.row-derived td {
  font-style: italic;
  color: #5a3e00;
  background: #fdf8ec;
  border-top: 1px dashed #e8d080;
}

.strong {
  font-weight: 700;
}
.elim-col {
  color: #b84444;
}
.zero-dash {
  color: #bbb;
}

.foot-total td {
  font-weight: 700;
  color: #0a3d1f;
  background: #d5f0e6;
  border-top: 2px solid #4caf85;
  padding: 0.55rem 0.7rem;
}

/* ── Empty state ── */
.empty-state {
  background: #f7fafd;
  border-radius: 12px;
  border: 1px dashed #c7d9ec;
  padding: 2rem;
  text-align: center;
  color: #4e6e8e;
}

/* ── Print ── */
@media print {
  .wizard-card,
  .tab-bar,
  .report-note,
  aside {
    display: none !important;
  }
  #print-area {
    border: none;
    box-shadow: none;
  }
}
</style>
