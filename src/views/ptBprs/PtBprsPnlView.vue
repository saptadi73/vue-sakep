<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ReportTable from '@/components/ReportTable.vue'
import { fetchBprsProfitLoss } from '@/services/bprsService'
import type { ReportRow } from '@/types/report'
import type { BprsReportRequestParams } from '@/types/bprsReport'

const toIsoDate = (d: Date) => d.toISOString().substring(0, 10)
const toApiDate = (iso: string) => iso.replaceAll('-', '') // YYYYMMDD
const LAST_SUCCESS_DATE_KEY = 'bprs:last-success-date'
const DEFAULT_SEED_DATE = '2025-03-01'

const router = useRouter()

const today = toIsoDate(new Date())
const getInitialDate = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SEED_DATE
  }

  return localStorage.getItem(LAST_SUCCESS_DATE_KEY) ?? DEFAULT_SEED_DATE
}

const selectedDate = ref(getInitialDate())
const selectedUnit = ref('00')
const wizardOpen = ref(false)
const selectedAccount = ref<ReportRow | null>(null)
const wizardStartDate = ref(today)
const wizardEndDate = ref(today)

const loading = ref(false)
const source = ref<'live' | 'mock'>('mock')
const sourceNote = ref('')
const rows = ref<ReportRow[]>([])
const lastUpdated = ref('')

const headerNote = computed(() => {
  if (source.value === 'live') {
    return `Data terambil langsung dari API BPRS. ${sourceNote.value}`.trim()
  }

  return `Data contoh ditampilkan karena koneksi API gagal atau signature belum diset. ${sourceNote.value}`
})

const loadReport = async () => {
  loading.value = true

  const requestDate = selectedDate.value
  const buildParams = (isoDate: string): BprsReportRequestParams => ({
    unit: selectedUnit.value,
    tgl: toApiDate(isoDate),
  })

  let result = await fetchBprsProfitLoss(buildParams(requestDate))
  let autoFallbackNote = ''

  if (result.source === 'live' && result.data.length === 0) {
    const cachedDate = localStorage.getItem(LAST_SUCCESS_DATE_KEY)
    if (cachedDate && cachedDate !== requestDate) {
      const fallback = await fetchBprsProfitLoss(buildParams(cachedDate))
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

const openGlWizard = (row: ReportRow) => {
  selectedAccount.value = row
  wizardStartDate.value = selectedDate.value
  wizardEndDate.value = selectedDate.value
  wizardOpen.value = true
}

const closeGlWizard = () => {
  wizardOpen.value = false
}

const submitGlWizard = () => {
  if (!selectedAccount.value) return
  if (wizardStartDate.value > wizardEndDate.value) return

  router.push({
    name: 'pt-bprs-gl',
    query: {
      nosbb: selectedAccount.value.Account,
      description: selectedAccount.value.Description,
      unit: selectedUnit.value,
      tgl1: wizardStartDate.value,
      tgl2: wizardEndDate.value,
      from: 'pnl',
    },
  })
}

onMounted(loadReport)
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <p class="pill">PT. BPRS</p>
      <h1>Laba Rugi Harian (Profit and Loss)</h1>
      <p class="sub">Laporan laba rugi per tanggal – standarisasi menuju SAK EP.</p>
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

    <p class="updated">Update terakhir: {{ lastUpdated || '-' }}</p>

    <ReportTable
      :rows="rows"
      :enable-drilldown="true"
      empty-message="Data laba rugi belum tersedia."
      @row-click="openGlWizard"
    />

    <div v-if="wizardOpen" class="wizard-overlay" @click.self="closeGlWizard">
      <section class="wizard-panel">
        <h2>Wizard Drill-Down GL</h2>
        <p>
          Akun: <strong>{{ selectedAccount?.Account }}</strong> -
          {{ selectedAccount?.Description }}
        </p>

        <label>
          Tanggal Awal (tgl1)
          <input v-model="wizardStartDate" type="date" />
        </label>

        <label>
          Tanggal Akhir (tgl2)
          <input v-model="wizardEndDate" type="date" />
        </label>

        <p v-if="wizardStartDate > wizardEndDate" class="wizard-error">
          Tanggal awal harus lebih kecil atau sama dengan tanggal akhir.
        </p>

        <div class="wizard-actions">
          <button type="button" class="btn-ghost" @click="closeGlWizard">Batal</button>
          <button
            type="button"
            class="btn-primary"
            :disabled="wizardStartDate > wizardEndDate"
            @click="submitGlWizard"
          >
            Lanjut ke GL
          </button>
        </div>
      </section>
    </div>
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

.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 25, 45, 0.45);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 30;
}

.wizard-panel {
  width: min(520px, 100%);
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid var(--line-soft);
  box-shadow: 0 22px 50px rgba(9, 28, 57, 0.26);
  padding: 1rem;
  display: grid;
  gap: 0.65rem;
}

.wizard-panel h2,
.wizard-panel p {
  margin: 0;
}

.wizard-panel label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.84rem;
  color: #1a3354;
}

.wizard-panel input {
  min-height: 40px;
  padding: 0.4rem 0.7rem;
  border-radius: 10px;
  border: 1px solid #c3d4eb;
  font: inherit;
}

.wizard-error {
  color: #a01e2f;
  font-size: 0.82rem;
}

.wizard-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.btn-ghost,
.btn-primary {
  min-height: 38px;
  padding: 0.4rem 0.8rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn-ghost {
  border: 1px solid #b8cbe7;
  background: #fff;
  color: #1d3f6c;
}

.btn-primary {
  border: none;
  background: #0f4b96;
  color: #f8fbff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
