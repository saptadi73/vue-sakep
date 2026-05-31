<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ReportTable from '@/components/ReportTable.vue'
import { fetchKanjabungBalanceSheet } from '@/services/kanjabungService'
import { exportMultiSheetExcel } from '@/utils/excelExport'
import type { ReportRow } from '@/types/report'
import type { KanjabungReportRequestParams } from '@/types/kanjabungReport'

const toIsoDate = (d: Date) => d.toISOString().substring(0, 10)
const toApiDate = (iso: string) => iso.replaceAll('-', '') // YYYYMMDD
const LAST_SUCCESS_DATE_KEY = 'kanjabung:last-success-date'
const DEFAULT_SEED_DATE = '2025-03-01'

const today = toIsoDate(new Date())
const getInitialDate = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SEED_DATE
  }

  return localStorage.getItem(LAST_SUCCESS_DATE_KEY) ?? DEFAULT_SEED_DATE
}

const selectedDate = ref(getInitialDate())
const selectedUnit = ref('00')

const loading = ref(false)
const source = ref<'live' | 'mock'>('mock')
const sourceNote = ref('')
const rows = ref<ReportRow[]>([])
const lastUpdated = ref('')

const headerNote = computed(() => {
  if (source.value === 'live') {
    return `Data terambil langsung dari API USPPS. ${sourceNote.value}`.trim()
  }

  return `Data contoh ditampilkan karena koneksi API gagal atau kredensial belum diset. ${sourceNote.value}`
})

const loadReport = async () => {
  loading.value = true

  const requestDate = selectedDate.value
  const buildParams = (isoDate: string): KanjabungReportRequestParams => ({
    unit: selectedUnit.value,
    tgl: toApiDate(isoDate),
  })

  let result = await fetchKanjabungBalanceSheet(buildParams(requestDate))
  let autoFallbackNote = ''

  if (result.source === 'live' && result.data.length === 0) {
    const cachedDate = localStorage.getItem(LAST_SUCCESS_DATE_KEY)
    if (cachedDate && cachedDate !== requestDate) {
      const fallback = await fetchKanjabungBalanceSheet(buildParams(cachedDate))
      if (fallback.source === 'live' && fallback.data.length > 0) {
        result = fallback
        selectedDate.value = cachedDate
        autoFallbackNote = `Data tanggal ${requestDate} kosong. Otomatis pakai tanggal terakhir yang tersedia (${cachedDate}).`
      }
    }
  }

  rows.value = result.data
  source.value = result.source
  sourceNote.value = [autoFallbackNote, result.note ?? ''].filter(Boolean).join(' ')

  if (result.source === 'live' && result.data.length > 0) {
    localStorage.setItem(LAST_SUCCESS_DATE_KEY, selectedDate.value)
  }

  lastUpdated.value = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  loading.value = false
}

onMounted(loadReport)

const exportReport = () => {
  if (!rows.value.length) return
  exportMultiSheetExcel(
    [
      {
        name: 'Balance Sheet',
        columns: ['Account', 'Description', 'Amount'],
        rows: rows.value.map((r) => [r.Account ?? '', r.Description ?? '', r.Amount ?? '']),
      },
    ],
    `KANJABUNG_Neraca_${selectedDate.value}_Unit${selectedUnit.value}`,
  )
}
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <p class="pill">USPPS PT. KANJABUNG</p>
      <h1>Neraca Harian (Balance Sheet)</h1>
      <p class="sub">Neraca per tanggal – standarisasi menuju SAK EP.</p>
      <p class="status-note">{{ headerNote }}</p>
    </header>

    <form class="filters" @submit.prevent="loadReport">
      <label>
        Tanggal
        <input v-model="selectedDate" type="date" :max="today" />
      </label>

      <label>
        Unit / Cabang
        <input v-model="selectedUnit" placeholder="00" />
      </label>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Memuat...' : 'Muat Laporan' }}
      </button>
    </form>

    <div class="report-actions">
      <button
        type="button"
        class="export-btn"
        :disabled="!rows.length || loading"
        @click="exportReport"
      >
        ⬇ Export Excel
      </button>
    </div>

    <p class="updated">Update terakhir: {{ lastUpdated || '-' }}</p>

    <ReportTable
      :rows="rows"
      :enable-drilldown="false"
      empty-message="Data neraca belum tersedia."
    />
  </section>
</template>

<style scoped>
.report-page {
  display: grid;
  gap: 1rem;
}

.report-header h1 {
  margin: 0.2rem 0;
  font-size: clamp(1.7rem, 2.2vw, 2.2rem);
  font-family: var(--font-display);
}

.pill {
  display: inline-block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #1b4b86;
  margin: 0;
}

.sub {
  color: #415575;
  margin: 0;
}

.status-note {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  color: #4b5f7f;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.8rem;
  align-items: end;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: #ffffff;
  padding: 0.9rem;
}

.filters label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: #1a3354;
}

.filters input,
.filters button {
  min-height: 40px;
  padding: 0.4rem 0.7rem;
  border-radius: 10px;
  border: 1px solid #c3d4eb;
  font: inherit;
}

.filters button {
  background: #0f4b96;
  color: #f8fbff;
  border: none;
  font-weight: 700;
  cursor: pointer;
}

.filters button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.updated {
  margin: 0;
  font-size: 0.84rem;
  color: #5a6c89;
}

.report-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.export-btn {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid #91aed1;
  background: #f3f8ff;
  color: #1d3f6c;
  padding: 0.35rem 0.9rem;
  cursor: pointer;
  font-weight: 600;
  font: inherit;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
