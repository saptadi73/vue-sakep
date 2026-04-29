<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import JurnalTable from '@/components/JurnalTable.vue'
import LedgerTable from '@/components/LedgerTable.vue'
import { fetchJarJurnal, fetchJarLedger } from '@/services/jabMartService'
import { exportToExcel } from '@/utils/excelExport'
import type {
  JarJurnalRequestParams,
  JarJurnalRow,
  JarLedgerRequestParams,
  JarLedgerRow,
} from '@/types/report'

const route = useRoute()
const router = useRouter()

const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const account = String(route.query.account ?? '')
const description = String(route.query.description ?? '')
const selectedMonth = String(
  route.query.month ?? new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
)
const selectedYear = String(route.query.year ?? new Date().getFullYear())
const selectedJenis = String(route.query.jenis ?? 'Lokasi')
const selectedLokasi = String(route.query.lokasi ?? '')
const fromPage = String(route.query.from ?? 'balance-sheet')

const ledgerRows = ref<JarLedgerRow[]>([])
const selectedLedgerLocation = ref('ALL')
const ledgerLoading = ref(false)
const ledgerPage = ref(1)
const ledgerPageCount = ref(1)
const ledgerMaxRecord = ref(1000)

const selectedLedgerEntry = ref<JarLedgerRow | null>(null)
const jurnalRows = ref<JarJurnalRow[]>([])
const jurnalLoading = ref(false)
const jurnalPage = ref(1)
const jurnalPageCount = ref(1)
const jurnalMaxRecord = ref(1000)
const jurnalSearch = ref('')

const ledgerLocationOptions = computed(() => {
  const uniqueLocations = new Set(
    ledgerRows.value
      .map((row) => String(row.Location ?? '').trim())
      .filter((location) => location.length > 0),
  )

  return ['ALL', ...Array.from(uniqueLocations).sort()]
})

const filteredLedgerRows = computed(() => {
  if (selectedLedgerLocation.value === 'ALL') {
    return ledgerRows.value
  }

  return ledgerRows.value.filter(
    (row) => String(row.Location ?? '').trim() === selectedLedgerLocation.value,
  )
})

const filteredJurnalRows = computed(() => {
  const query = jurnalSearch.value.trim().toLowerCase()
  if (!query) return jurnalRows.value
  return jurnalRows.value.filter((row) => {
    const searchable = [row.jNumber, row.Remarks, row.Description, row.Notes, row.Account]
      .map((item) => String(item ?? '').toLowerCase())
      .join(' ')
    return searchable.includes(query)
  })
})

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

const getDateRange = (month: string, year: string) => {
  const monthIndex = monthOptions.indexOf(month)
  const safeMonth = monthIndex >= 0 ? monthIndex : new Date().getMonth()
  const safeYear = Number(year)
  const finalYear = Number.isFinite(safeYear) ? safeYear : new Date().getFullYear()

  const start = new Date(finalYear, safeMonth, 1)
  const end = new Date(finalYear, safeMonth + 1, 0)

  const toApiDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  return { startDate: toApiDate(start), endDate: toApiDate(end) }
}

const loadLedger = async (page = 1) => {
  ledgerLoading.value = true
  selectedLedgerEntry.value = null
  jurnalRows.value = []
  jurnalSearch.value = ''
  selectedLedgerLocation.value = 'ALL'

  const range = getDateRange(selectedMonth, selectedYear)
  const params: JarLedgerRequestParams = {
    jenis: 'Semua',
    lokasi: '',
    account,
    startDate: range.startDate,
    endDate: range.endDate,
    page,
    maxRecord: ledgerMaxRecord.value,
  }

  const result = await fetchJarLedger(params)
  ledgerRows.value = result.data
  ledgerPage.value = parsePositiveInt(result.header.Page, page)
  ledgerPageCount.value = parsePositiveInt(result.header.PageCount, 1)
  ledgerLoading.value = false
}

const goToLedgerPage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > ledgerPageCount.value) return
  await loadLedger(nextPage)
}

const loadJurnal = async (ledgerRow: JarLedgerRow, page = 1) => {
  selectedLedgerEntry.value = ledgerRow
  jurnalLoading.value = true

  const range = getDateRange(selectedMonth, selectedYear)
  const params: JarJurnalRequestParams = {
    jenis: selectedJenis,
    lokasi: selectedLokasi,
    startDate: range.startDate,
    endDate: range.endDate,
    page,
    maxRecord: jurnalMaxRecord.value,
    accountFilter: account,
  }

  const result = await fetchJarJurnal(params)

  const targetDate = String(ledgerRow.jDate ?? '').slice(0, 10)
  const filteredByDate = result.data.filter(
    (row) => String(row.jDate ?? '').slice(0, 10) === targetDate,
  )

  jurnalRows.value = filteredByDate.length ? filteredByDate : result.data
  jurnalPage.value = parsePositiveInt(result.header.Page, page)
  jurnalPageCount.value = parsePositiveInt(result.header.PageCount, 1)
  jurnalLoading.value = false
}

const goToJurnalPage = async (nextPage: number) => {
  if (!selectedLedgerEntry.value) return
  if (nextPage < 1 || nextPage > jurnalPageCount.value) return
  await loadJurnal(selectedLedgerEntry.value, nextPage)
}

const exportLedgerExcel = () => {
  if (!filteredLedgerRows.value.length) return
  const data = filteredLedgerRows.value.map((row) => ({
    Date: row.jDate ?? '-',
    Location: row.Location ?? '-',
    Account: row.Account ?? '-',
    Description: row.Description ?? '-',
    Note: row.Note ?? '-',
    Remarks: row.Remarks ?? '-',
    Beginning: row.Beginning ?? 0,
    Debit: row.Debit ?? 0,
    Credit: row.Credit ?? 0,
    Balance: row.Balance ?? 0,
  }))
  exportToExcel(data, 'Ledger', `PTJAR_Ledger_${account}_${selectedMonth}_${selectedYear}`)
}

const exportJurnalExcel = () => {
  if (!filteredJurnalRows.value.length) return
  const data = filteredJurnalRows.value.map((row) => ({
    Date: row.jDate ?? '-',
    JournalNo: row.jNumber ?? '-',
    Location: row.Location ?? '-',
    Account: row.Account ?? '-',
    Description: row.Description ?? row.Notes ?? '-',
    Remarks: row.Remarks ?? '-',
    Debit: row.Debit ?? 0,
    Credit: row.Credit ?? 0,
  }))
  exportToExcel(data, 'Jurnal', `PTJAR_Jurnal_${account}_${selectedMonth}_${selectedYear}`)
}

const goBack = () => {
  if (fromPage === 'pnl') {
    router.push({ name: 'pt-jar-pnl' })
  } else {
    router.push({ name: 'pt-jar-balance-sheet' })
  }
}

onMounted(() => loadLedger())

watch(selectedLedgerLocation, (nextLocation) => {
  if (nextLocation === 'ALL') {
    return
  }

  const existsInCurrentRows = ledgerRows.value.some(
    (row) => String(row.Location ?? '').trim() === nextLocation,
  )

  if (!existsInCurrentRows) {
    selectedLedgerLocation.value = 'ALL'
    selectedLedgerEntry.value = null
    jurnalRows.value = []
    jurnalSearch.value = ''
    return
  }

  if (
    selectedLedgerEntry.value &&
    String(selectedLedgerEntry.value.Location ?? '').trim() !== nextLocation
  ) {
    selectedLedgerEntry.value = null
    jurnalRows.value = []
    jurnalSearch.value = ''
  }
})
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <button class="back-btn" type="button" @click="goBack">← Kembali ke Laporan</button>
      <p class="pill">PT. JAR (JAB Mart)</p>
      <h1>Ledger: {{ account }} – {{ description }}</h1>
      <p class="sub">
        {{ selectedMonth }} {{ selectedYear }} · Jenis: {{ selectedJenis
        }}<span v-if="selectedLokasi"> · Lokasi: {{ selectedLokasi }}</span>
      </p>
    </header>

    <div class="ledger-toolbar">
      <label class="location-filter">
        Filter Lokasi
        <select v-model="selectedLedgerLocation">
          <option v-for="location in ledgerLocationOptions" :key="location" :value="location">
            {{ location === 'ALL' ? 'Semua Lokasi' : location }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="export-btn"
        :disabled="!filteredLedgerRows.length"
        @click="exportLedgerExcel"
      >
        Export Ledger (Excel)
      </button>
    </div>

    <p v-if="ledgerLoading" class="loading-msg">Memuat ledger...</p>
    <div v-else class="drilldown-stack">
      <div class="pager-row">
        <button :disabled="ledgerPage <= 1" @click="goToLedgerPage(ledgerPage - 1)">Prev</button>
        <span>Halaman {{ ledgerPage }} / {{ ledgerPageCount }}</span>
        <button :disabled="ledgerPage >= ledgerPageCount" @click="goToLedgerPage(ledgerPage + 1)">
          Next
        </button>
      </div>

      <LedgerTable :rows="filteredLedgerRows" :enable-drilldown="true" @row-click="loadJurnal" />

      <section v-if="selectedLedgerEntry" class="jurnal-panel">
        <div class="jurnal-header">
          <h2>
            Jurnal: {{ selectedLedgerEntry.Account ?? '-' }} –
            {{ String(selectedLedgerEntry.jDate ?? '').slice(0, 10) }}
          </h2>
          <div class="jurnal-tools">
            <input
              v-model="jurnalSearch"
              type="text"
              placeholder="Cari nomor jurnal / remarks / deskripsi"
            />
            <button
              type="button"
              class="export-btn"
              :disabled="!filteredJurnalRows.length"
              @click="exportJurnalExcel"
            >
              Export Jurnal (Excel)
            </button>
          </div>
        </div>

        <p v-if="jurnalLoading" class="loading-msg">Memuat jurnal...</p>
        <div v-else class="drilldown-stack">
          <div class="pager-row">
            <button :disabled="jurnalPage <= 1" @click="goToJurnalPage(jurnalPage - 1)">
              Prev
            </button>
            <span>Halaman {{ jurnalPage }} / {{ jurnalPageCount }}</span>
            <button
              :disabled="jurnalPage >= jurnalPageCount"
              @click="goToJurnalPage(jurnalPage + 1)"
            >
              Next
            </button>
          </div>
          <JurnalTable :rows="filteredJurnalRows" />
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

.back-btn {
  background: none;
  border: none;
  color: #1b4b86;
  font-size: 0.88rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.back-btn:hover {
  text-decoration: underline;
}

.report-header h1 {
  margin: 0.2rem 0;
  font-size: clamp(1.4rem, 2vw, 1.9rem);
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
  font-size: 0.9rem;
}

.ledger-toolbar {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: end;
}

.location-filter {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #1a3354;
}

.location-filter select {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid #bfd2ec;
  padding: 0.35rem 0.55rem;
  font: inherit;
}

.export-btn {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid #91aed1;
  background: #f3f8ff;
  color: #1d3f6c;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
  font-weight: 600;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-msg {
  margin: 0;
  color: #36537f;
  font-size: 0.9rem;
}

.drilldown-stack {
  display: grid;
  gap: 0.7rem;
}

.pager-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.pager-row button {
  min-width: 80px;
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid #b9cdea;
  background: #ffffff;
  cursor: pointer;
}

.pager-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pager-row span {
  font-size: 0.84rem;
  color: #4f6384;
}

.jurnal-panel {
  border: 1px solid #d8e5f5;
  border-radius: 14px;
  background: #fdfefe;
  padding: 0.75rem;
  display: grid;
  gap: 0.65rem;
}

.jurnal-header h2 {
  margin: 0;
  font-size: 1rem;
}

.jurnal-tools {
  margin-top: 0.4rem;
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.jurnal-tools input {
  min-height: 34px;
  min-width: min(360px, 100%);
  padding: 0.4rem 0.6rem;
  border: 1px solid #bfd2ec;
  border-radius: 8px;
  font: inherit;
}
</style>
