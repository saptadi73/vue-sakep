<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TrialBalanceTable from '@/components/TrialBalanceTable.vue'
import { fetchJarTrialBalance } from '@/services/jabMartService'
import type { JarReportRequestParams, ReportRow } from '@/types/report'

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

const lokasiOptions = [
  { value: '620001,620002', label: 'Semua Lokasi' },
  { value: '620001', label: '620001' },
  { value: '620002', label: '620002' },
]

const selectedMonth = ref(new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()))
const selectedYear = ref(String(new Date().getFullYear()))
const selectedJenis = ref('Lokasi')
const selectedLokasi = ref('620001,620002')

const loading = ref(false)
const source = ref<'live' | 'mock'>('mock')
const sourceNote = ref('')
const rows = ref<ReportRow[]>([])
const lastUpdated = ref('')

const headerNote = computed(() => {
  if (source.value === 'live') {
    return 'Data terambil langsung dari API Jab Mart.'
  }
  return `Data contoh ditampilkan karena koneksi API gagal atau kredensial belum diset. ${sourceNote.value}`
})

const lokasiFilterLabel = computed(() => {
  return (
    lokasiOptions.find((item) => item.value === selectedLokasi.value)?.label ?? selectedLokasi.value
  )
})

const loadReport = async () => {
  loading.value = true

  const params: JarReportRequestParams = {
    reqMonth: selectedMonth.value,
    reqYear: selectedYear.value,
    jenis: selectedJenis.value,
    lokasi: selectedLokasi.value,
  }

  const result = await fetchJarTrialBalance(params)

  rows.value = result.data
  source.value = result.source
  sourceNote.value = result.note ?? ''
  lastUpdated.value = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  loading.value = false
}

const navigateToLedger = (row: ReportRow) => {
  router.push({
    name: 'pt-jar-ledger',
    query: {
      account: row.Account,
      description: row.Description,
      month: selectedMonth.value,
      year: selectedYear.value,
      jenis: selectedJenis.value,
      lokasi: selectedLokasi.value,
      from: 'trial-balance',
    },
  })
}

onMounted(loadReport)

watch(selectedLokasi, () => {
  loadReport()
})
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <p class="pill">PT. JAR (JAB Mart)</p>
      <h1>Trial Balance (Neraca Percobaan)</h1>
      <p class="sub">Saldo debit dan kredit seluruh akun per periode pelaporan.</p>
      <p class="filter-note">Filter lokasi: {{ lokasiFilterLabel }}</p>
      <p class="status-note">{{ headerNote }}</p>
    </header>

    <form class="filters" @submit.prevent="loadReport">
      <label>
        Bulan
        <select v-model="selectedMonth">
          <option v-for="month in monthOptions" :key="month" :value="month">{{ month }}</option>
        </select>
      </label>

      <label>
        Tahun
        <input v-model="selectedYear" type="number" min="2000" max="2100" />
      </label>

      <label>
        Jenis
        <select v-model="selectedJenis">
          <option value="Lokasi">Lokasi</option>
          <option value="Consolidated">Consolidated</option>
        </select>
      </label>

      <label>
        Filter Lokasi
        <select v-model="selectedLokasi">
          <option v-for="lokasi in lokasiOptions" :key="lokasi.value" :value="lokasi.value">
            {{ lokasi.label }}
          </option>
        </select>
      </label>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Memuat...' : 'Muat Laporan' }}
      </button>
    </form>

    <p class="updated">Update terakhir: {{ lastUpdated || '-' }}</p>

    <TrialBalanceTable
      :rows="rows"
      :enable-drilldown="true"
      empty-message="Data trial balance belum tersedia."
      @row-click="navigateToLedger"
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

.filter-note {
  margin: 0.2rem 0 0;
  font-size: 0.84rem;
  color: #1f487e;
}

.status-note {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  color: #4b5f7f;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.8rem;
  align-items: end;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.7);
}

.filters label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: #415575;
  font-weight: 600;
}

.filters input,
.filters select {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font-size: 0.93rem;
}

.filters button {
  padding: 0.5rem 1.1rem;
  background: #1b4b86;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.93rem;
  cursor: pointer;
}

.filters button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.updated {
  font-size: 0.8rem;
  color: #8a9ab5;
  margin: 0;
}
</style>
