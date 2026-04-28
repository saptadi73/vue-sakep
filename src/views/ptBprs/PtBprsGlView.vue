<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBprsGlHistory } from '@/services/bprsService'
import type { BprsGlRequestParams, BprsGlRow } from '@/types/bprsReport'

const route = useRoute()
const router = useRouter()

const toIsoDate = (d: Date) => d.toISOString().substring(0, 10)
const toApiDate = (iso: string) => iso.replaceAll('-', '')

const account = String(route.query.nosbb ?? '')
const description = String(route.query.description ?? '')
const unit = String(route.query.unit ?? '00')
const fromPage = String(route.query.from ?? 'balance-sheet')

const tgl1 = String(route.query.tgl1 ?? toIsoDate(new Date()))
const tgl2 = String(route.query.tgl2 ?? toIsoDate(new Date()))

const loading = ref(false)
const source = ref<'live' | 'mock'>('mock')
const sourceNote = ref('')
const rows = ref<BprsGlRow[]>([])
const lastUpdated = ref('')

const headerNote = computed(() =>
  source.value === 'live'
    ? 'Data GL terambil langsung dari API BPRS.'
    : `Data GL tidak tersedia dari API. ${sourceNote.value}`,
)

const columns = computed(() => {
  const keySet = new Set<string>()
  for (const row of rows.value) {
    Object.keys(row).forEach((key) => keySet.add(key))
  }
  return Array.from(keySet)
})

const formatCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return String(value)
}

const loadGl = async () => {
  if (!account) return

  loading.value = true

  const params: BprsGlRequestParams = {
    unit,
    tgl1: toApiDate(tgl1),
    tgl2: toApiDate(tgl2),
    nosbb: account,
  }

  const result = await fetchBprsGlHistory(params)
  rows.value = result.data
  source.value = result.source
  sourceNote.value = result.note ?? ''
  lastUpdated.value = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  loading.value = false
}

const goBack = () => {
  if (fromPage === 'pnl') {
    router.push({ name: 'pt-bprs-pnl' })
  } else {
    router.push({ name: 'pt-bprs-balance-sheet' })
  }
}

onMounted(loadGl)
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <button class="back-btn" type="button" @click="goBack">← Kembali ke Laporan</button>
      <p class="pill">PT. BPRS</p>
      <h1>GL Drill-Down: {{ account }} – {{ description || '-' }}</h1>
      <p class="sub">Unit {{ unit }} · Periode {{ tgl1 }} s/d {{ tgl2 }}</p>
      <p class="status-note">{{ headerNote }}</p>
    </header>

    <p class="updated">Update terakhir: {{ lastUpdated || '-' }}</p>

    <p v-if="!account" class="empty-state">
      Nomor akun (nosbb) tidak ditemukan dari halaman laporan.
    </p>
    <p v-else-if="loading" class="loading-msg">Memuat histori GL...</p>

    <div v-else class="table-shell">
      <table v-if="rows.length && columns.length" class="gl-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in rows" :key="`gl-${rowIndex}`">
            <td v-for="column in columns" :key="`gl-${rowIndex}-${column}`">
              {{ formatCell(row[column]) }}
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty-state">Data GL tidak tersedia untuk akun dan periode yang dipilih.</p>
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

.status-note,
.updated,
.loading-msg,
.empty-state {
  margin: 0;
  color: #4f6384;
}

.table-shell {
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  overflow: auto;
  background: #fff;
}

.gl-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
}

.gl-table th,
.gl-table td {
  padding: 0.72rem 0.8rem;
  border-bottom: 1px solid var(--line-soft);
  font-size: 0.88rem;
  white-space: nowrap;
}

.gl-table th {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #415575;
  background: #e5edf8;
}
</style>
