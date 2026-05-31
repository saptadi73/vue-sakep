<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ReportTable from '@/components/ReportTable.vue'
import TrialBalanceTable from '@/components/TrialBalanceTable.vue'
import {
  fetchOdooBalanceSheet,
  fetchOdooProfitLoss,
  fetchOdooTrialBalance,
} from '@/services/odooService'
import { exportMultiSheetExcel } from '@/utils/excelExport'
import odooEntitiesConfigJson from '@/reference/odoo-entities-config.json'
import { useOdooAuthStore } from '@/stores/odooAuth'
import type { OdooCompany, OdooReportRequestParams } from '@/types/odoo'
import type { ReportRow } from '@/types/report'

type OdooReportKind = 'balance-sheet' | 'profit-loss' | 'trial-balance'
type CompanyRouteCode = 'kan-jabung' | 'pt-jgi'

const route = useRoute()
const router = useRouter()
const authStore = useOdooAuthStore()

const reportKind = ref<OdooReportKind>('balance-sheet')
const loading = ref(false)
const errorMessage = ref('')
const companyMetaName = ref('-')
const rows = ref<ReportRow[]>([])
const lastUpdated = ref('')

const today = new Date().toISOString().slice(0, 10)
const year = new Date().getFullYear()

const filters = ref({
  date_from: `${year}-01-01`,
  date_to: today,
  target_move: 'posted' as 'posted' | 'all',
})

const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[\s._-]/g, '')

interface OdooEntityConfig {
  routeCode: CompanyRouteCode
  displayName: string
  roleLabel: string
  nameKeywords: string[]
}

const odooEntitiesConfig = odooEntitiesConfigJson as { entities: OdooEntityConfig[] }

const defaultEntityConfigs: OdooEntityConfig[] = [
  {
    routeCode: 'kan-jabung',
    displayName: 'KAN JABUNG',
    roleLabel: 'Company Utama',
    nameKeywords: ['kan jabung', 'kanjabung'],
  },
  {
    routeCode: 'pt-jgi',
    displayName: 'PT. JGI',
    roleLabel: 'Company Tambahan',
    nameKeywords: ['pt jgi', 'pt. jgi', 'jgi'],
  },
]

const defaultEntityConfigMap: Record<CompanyRouteCode, OdooEntityConfig> = {
  'kan-jabung': defaultEntityConfigs[0] as OdooEntityConfig,
  'pt-jgi': defaultEntityConfigs[1] as OdooEntityConfig,
}

const entityConfigs =
  Array.isArray(odooEntitiesConfig.entities) && odooEntitiesConfig.entities.length > 0
    ? odooEntitiesConfig.entities
    : defaultEntityConfigs

const findEntityConfig = (routeCode: CompanyRouteCode): OdooEntityConfig => {
  return (
    entityConfigs.find((entity) => entity.routeCode === routeCode) ??
    defaultEntityConfigs.find((entity) => entity.routeCode === routeCode) ??
    defaultEntityConfigMap[routeCode]
  )
}

const findByKeywords = (companies: OdooCompany[], keywords: string[]) => {
  return companies.find((company) => {
    const normalizedName = normalizeName(company.name)
    return keywords.some((keyword) => normalizedName.includes(normalizeName(keyword)))
  })
}

const mappedCompanies = computed(() => {
  const allCompanies = authStore.companies
  const kanJabungConfig = findEntityConfig('kan-jabung')
  const ptJgiConfig = findEntityConfig('pt-jgi')

  const kanJabung = findByKeywords(allCompanies, kanJabungConfig.nameKeywords) ?? allCompanies[0]

  const fallbackForPtJgi = allCompanies.find((company) => company.id !== kanJabung?.id)
  const ptJgi = findByKeywords(allCompanies, ptJgiConfig.nameKeywords) ?? fallbackForPtJgi

  return {
    kanJabung,
    ptJgi,
  }
})

const currentCompanyCode = computed<CompanyRouteCode>(() => {
  const value = route.params.companyCode
  return value === 'pt-jgi' ? 'pt-jgi' : 'kan-jabung'
})

const selectedCompany = computed(() => {
  if (currentCompanyCode.value === 'kan-jabung') {
    return mappedCompanies.value.kanJabung
  }

  return mappedCompanies.value.ptJgi
})

const companyRoleLabel = computed(() => {
  return findEntityConfig(currentCompanyCode.value).roleLabel
})

const companyWarning = computed(() => {
  const company = selectedCompany.value

  if (!company) {
    return 'Company belum ditemukan dari response /api/accounting/companies.'
  }

  const config = findEntityConfig(currentCompanyCode.value)
  const normalizedCompanyName = normalizeName(company.name)
  const isNameMatched = config.nameKeywords.some((keyword) =>
    normalizedCompanyName.includes(normalizeName(keyword)),
  )

  if (!isNameMatched) {
    return `${config.roleLabel} belum terdeteksi sebagai ${config.displayName}. Periksa nama company di Odoo atau update src/reference/odoo-entities-config.json.`
  }

  return ''
})

const activeTitle = computed(() => {
  if (reportKind.value === 'balance-sheet') {
    return 'Balance Sheet'
  }

  if (reportKind.value === 'profit-loss') {
    return 'Profit and Loss'
  }

  return 'Trial Balance'
})

const loadReport = async () => {
  const company = selectedCompany.value
  if (!company) {
    rows.value = []
    errorMessage.value = 'Company yang dipilih belum tersedia.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  const payload: OdooReportRequestParams = {
    company_ids: [company.id],
    date_from: filters.value.date_from,
    date_to: filters.value.date_to,
    target_move: filters.value.target_move,
  }

  try {
    if (reportKind.value === 'balance-sheet') {
      const result = await fetchOdooBalanceSheet(payload)
      rows.value = result.rows
      companyMetaName.value = result.metaCompanyName
    } else if (reportKind.value === 'profit-loss') {
      const result = await fetchOdooProfitLoss(payload)
      rows.value = result.rows
      companyMetaName.value = result.metaCompanyName
    } else {
      const result = await fetchOdooTrialBalance({
        ...payload,
        display_accounts: 'balance_not_zero',
      })
      rows.value = result.rows
      companyMetaName.value = result.metaCompanyName
    }

    lastUpdated.value = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
  } catch (error) {
    rows.value = []
    const message = error instanceof Error ? error.message : 'Gagal memuat laporan Odoo.'
    errorMessage.value = message

    if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
      authStore.logout()
      await router.push('/odoo/login')
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await authStore.ensureCompanies()
  await loadReport()
})

const exportReport = () => {
  if (!rows.value.length) return
  const isTrialBalance = reportKind.value === 'trial-balance'
  const columns = isTrialBalance
    ? ['Account', 'Description', 'Debit', 'Kredit']
    : ['Account', 'Description', 'Amount']
  const exportRows = isTrialBalance
    ? rows.value.map((r) => [r.Account ?? '', r.Description ?? '', r.Amount ?? '', r.Amount1 ?? ''])
    : rows.value.map((r) => [r.Account ?? '', r.Description ?? '', r.Amount ?? ''])
  const companySlug = (selectedCompany.value?.name ?? currentCompanyCode.value).replace(/\s+/g, '_')
  const titleSlug = activeTitle.value.replace(/\s+/g, '_')
  exportMultiSheetExcel(
    [{ name: activeTitle.value, columns, rows: exportRows }],
    `${companySlug}_${titleSlug}_${filters.value.date_from}_${filters.value.date_to}`,
  )
}
</script>

<template>
  <section class="report-page">
    <header class="report-header">
      <p class="pill">Odoo Multi-Company</p>
      <h1>{{ activeTitle }}: {{ selectedCompany?.name ?? '-' }}</h1>
      <p class="sub">{{ companyRoleLabel }} | Company API: {{ companyMetaName }}</p>
      <p v-if="companyWarning" class="warning-note">{{ companyWarning }}</p>
    </header>

    <div class="company-switcher">
      <RouterLink
        v-for="entity in entityConfigs"
        :key="entity.routeCode"
        :to="`/odoo/reports/${entity.routeCode}`"
        class="switch-link"
      >
        {{ entity.displayName }}
      </RouterLink>
    </div>

    <form class="filters" @submit.prevent="loadReport">
      <label>
        Jenis Report
        <select v-model="reportKind">
          <option value="balance-sheet">Balance Sheet</option>
          <option value="profit-loss">Profit and Loss</option>
          <option value="trial-balance">Trial Balance</option>
        </select>
      </label>

      <label>
        Tanggal Awal
        <input v-model="filters.date_from" type="date" :max="filters.date_to" />
      </label>

      <label>
        Tanggal Akhir
        <input v-model="filters.date_to" type="date" :min="filters.date_from" :max="today" />
      </label>

      <label>
        Target Move
        <select v-model="filters.target_move">
          <option value="posted">Posted</option>
          <option value="all">All Entries</option>
        </select>
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

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    <p class="updated">Update terakhir: {{ lastUpdated || '-' }}</p>

    <TrialBalanceTable
      v-if="reportKind === 'trial-balance'"
      :rows="rows"
      empty-message="Data trial balance tidak tersedia."
    />

    <ReportTable
      v-else
      :rows="rows"
      :enable-drilldown="false"
      empty-message="Data laporan tidak tersedia."
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
  font-size: clamp(1.45rem, 2.2vw, 2rem);
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

.warning-note {
  margin: 0.35rem 0 0;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  border: 1px solid #f5d6a1;
  background: #fff6e8;
  color: #7d5321;
  font-size: 0.84rem;
}

.company-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.switch-link {
  text-decoration: none;
  color: #0e315f;
  font-weight: 700;
  border: 1px solid #bdd0ea;
  border-radius: 999px;
  background: #f3f8ff;
  padding: 0.45rem 0.9rem;
}

.switch-link.router-link-exact-active {
  background: #0f4b96;
  border-color: #0f4b96;
  color: #f8fbff;
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
.filters select,
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
  opacity: 0.7;
  cursor: wait;
}

.error-banner {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  border: 1px solid #efb7b7;
  background: #ffefef;
  color: #8f2929;
  font-size: 0.88rem;
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
