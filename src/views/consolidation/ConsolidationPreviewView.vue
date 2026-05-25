<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildConsolidationPreview } from '@/services/consolidationEngineService'
import {
  getDefaultConsolidationConfig,
  loadConsolidationConfig,
  loadConsolidationConfigFromFile,
  saveConsolidationConfig,
} from '@/services/consolidationConfigService'
import {
  fetchOdooCompaniesForConsolidation,
  loadConsolidationSourceData,
} from '@/services/consolidationSourceService'
import { useOdooAuthStore } from '@/stores/odooAuth'
import type { CoaMappingRule, ConsolidationConfig } from '@/types/consolidationConfig'
import type { ConsolidationPreviewResult } from '@/types/consolidationResult'
import type { ConsolidationSection } from '@/types/consolidationConfig'
import type { ConsolidationSourceData } from '@/services/consolidationEngineService'
import type { ReportRow } from '@/types/report'

const sectionOptions: Array<{ label: string; value: ConsolidationSection }> = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Balance Sheet', value: 'balance-sheet' },
  { label: 'Trial Balance', value: 'trial-balance' },
]

const authStore = useOdooAuthStore()
const selectedSection = ref<ConsolidationSection>('pnl')
const activeConfig = ref<ConsolidationConfig>(getDefaultConsolidationConfig())
const result = ref<ConsolidationPreviewResult>(
  buildConsolidationPreview(selectedSection.value, activeConfig.value),
)
const sourceData = ref<ConsolidationSourceData>({})
const statusMessage = ref('Memuat config aktif dari backend Odoo untuk preview.')
const isLoading = ref(true)

const getDefaultPeriodParams = () => {
  const today = new Date()
  const year = today.getFullYear()

  return {
    date_from: `${year}-01-01`,
    date_to: today.toISOString().slice(0, 10),
    target_move: 'posted' as const,
  }
}

const buildPreviewWithLiveSources = async () => {
  await authStore.ensureCompanies()
  const companies =
    authStore.companies.length > 0 ? authStore.companies : await fetchOdooCompaniesForConsolidation()
  sourceData.value = await loadConsolidationSourceData(
    activeConfig.value,
    companies,
    [selectedSection.value],
    getDefaultPeriodParams(),
  )

  result.value = buildConsolidationPreview(
    selectedSection.value,
    activeConfig.value,
    sourceData.value,
  )
}

const loadActiveConfig = async () => {
  isLoading.value = true

  try {
    const fromBackend = await loadConsolidationConfigFromFile()
    activeConfig.value = fromBackend ?? loadConsolidationConfig()
    await buildPreviewWithLiveSources()
    statusMessage.value = fromBackend
      ? 'Preview dihitung dari config backend Odoo yang aktif.'
      : 'Backend Odoo tidak tersedia. Preview memakai template default.'
  } catch (error) {
    result.value = buildConsolidationPreview(selectedSection.value, activeConfig.value)
    statusMessage.value = `Preview memakai data mock karena data Odoo gagal dimuat. ${
      error instanceof Error ? error.message : ''
    }`.trim()
  } finally {
    isLoading.value = false
  }
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const recalculate = async () => {
  isLoading.value = true

  try {
    await buildPreviewWithLiveSources()
    statusMessage.value = 'Preview berhasil dihitung ulang menggunakan config aktif dan data Odoo.'
  } catch (error) {
    result.value = buildConsolidationPreview(selectedSection.value, activeConfig.value)
    statusMessage.value = `Preview memakai data mock karena data Odoo gagal dimuat. ${
      error instanceof Error ? error.message : ''
    }`.trim()
  } finally {
    isLoading.value = false
  }
}

const totalBefore = computed(() =>
  result.value.rows.reduce((sum, row) => sum + row.amountBefore, 0),
)
const totalElimination = computed(() =>
  result.value.rows.reduce((sum, row) => sum + row.eliminationAmount, 0),
)
const totalAfter = computed(() => result.value.rows.reduce((sum, row) => sum + row.amountAfter, 0))

const topUnmapped = computed(() => result.value.unmappedEntries.slice(0, 20))
const topSuggestions = computed(() => result.value.mappingSuggestions.slice(0, 30))

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const accountMatches = (pattern: string, account: string): boolean => {
  const cleanPattern = pattern.trim()
  const cleanAccount = account.trim()

  if (!cleanPattern || !cleanAccount) {
    return false
  }

  if (!cleanPattern.includes('*')) {
    return cleanPattern === cleanAccount
  }

  const regex = new RegExp(`^${escapeRegex(cleanPattern).replace(/\\\*/g, '.*')}$`)
  return regex.test(cleanAccount)
}

const formatDebugAmount = (row: ReportRow) => row.Amount ?? row.Amount1 ?? '-'

const rowMatchesMapping = (mapping: CoaMappingRule, row: ReportRow): boolean => {
  return (
    accountMatches(mapping.sourceAccount, row.Account) &&
    (!mapping.sourceDescriptionContains ||
      row.Description.toLowerCase().includes(mapping.sourceDescriptionContains.toLowerCase()))
  )
}

const debugEntities = computed(() => {
  return activeConfig.value.entities
    .filter((entity) => entity.enabled)
    .map((entity) => {
      const rows = sourceData.value[entity.id]?.[selectedSection.value] ?? []
      const mappings = activeConfig.value.coaMappings.filter(
        (mapping) => mapping.entityId === entity.id && mapping.section === selectedSection.value,
      )
      const targetMappings = mappings
      const targetRows =
        mappings.length > 0
          ? rows.filter((row) =>
              mappings.some((mapping) => accountMatches(mapping.sourceAccount, row.Account)),
            )
          : []
      const matchedRows = mappings.flatMap((mapping) =>
        rows
          .filter((row) => rowMatchesMapping(mapping, row))
          .slice(0, 8)
          .map((row) => ({
            mapping,
            row,
          })),
      )

      const missingTreeKeys = mappings
        .map((mapping) => mapping.consolidationKey)
        .filter(
          (key, index, keys) =>
            keys.indexOf(key) === index &&
            !activeConfig.value.reportTree.some(
              (node) => node.section === selectedSection.value && node.key === key,
            ),
      )
      const hasRelevantUnmappedRows = result.value.unmappedEntries.some(
        (entry) =>
          entry.entityId === entity.id &&
          mappings.some((mapping) => accountMatches(mapping.sourceAccount, entry.account)),
      )
      const warnings: string[] = []

      if (entity.source === 'odoo' && rows.length === 0) {
        warnings.push('Data Odoo untuk section ini belum termuat.')
      }

      if (mappings.length > 0 && rows.length > 0 && targetRows.length === 0) {
        warnings.push('Mapping section ada, tetapi tidak ada source row yang match pola sourceAccount.')
      }

      if (
        mappings.length > 0 &&
        (targetRows.length > 0 || hasRelevantUnmappedRows) &&
        matchedRows.length === 0
      ) {
        warnings.push('Mapping ada, tetapi tidak ada row source yang match sourceAccount.')
      }

      if (missingTreeKeys.length > 0) {
        warnings.push(`Key ${missingTreeKeys.join(', ')} tidak ada di report tree section ini.`)
      }

      return {
        entity,
        rows,
        mappings,
        targetMappings,
        targetRows: targetRows.slice(0, 12),
        matchedRows,
        warnings,
      }
    })
})

const mappingDrafts = computed<CoaMappingRule[]>(() => {
  return result.value.mappingSuggestions.map((item) => ({
    entityId: item.entityId,
    sourceAccount: item.account,
    consolidationKey: item.suggestedConsolidationKey,
    section: item.section,
    parentKey: item.suggestedParentKey,
    lineType: item.suggestedLineType,
    sign: item.suggestedSign,
    note: `AUTO-SUGGEST (${item.confidence}): ${item.reason}`,
  }))
})

const copyDraftToClipboard = async () => {
  const text = JSON.stringify(mappingDrafts.value, null, 2)

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    statusMessage.value = 'Draft mapping berhasil disalin ke clipboard.'
    return
  }

  statusMessage.value = 'Clipboard API tidak tersedia. Silakan copy manual dari Export JSON config.'
}

const applySuggestionsToConfig = async () => {
  const config = JSON.parse(JSON.stringify(activeConfig.value)) as ConsolidationConfig
  const existingKeys = new Set(
    config.coaMappings.map(
      (m) => `${m.entityId}|${m.section}|${m.sourceAccount}|${m.consolidationKey}`,
    ),
  )

  let added = 0

  for (const draft of mappingDrafts.value) {
    const dedupeKey = `${draft.entityId}|${draft.section}|${draft.sourceAccount}|${draft.consolidationKey}`
    if (existingKeys.has(dedupeKey)) {
      continue
    }

    config.coaMappings.push(draft)
    existingKeys.add(dedupeKey)
    added += 1
  }

  if (added === 0) {
    statusMessage.value = 'Tidak ada suggestion baru yang ditambahkan (semua sudah ada).'
    return
  }

  const saveResult = await saveConsolidationConfig(config)
  if (saveResult.mode === 'backend-and-storage') {
    activeConfig.value = config
  }
  await recalculate()
  statusMessage.value =
    saveResult.mode === 'backend-and-storage'
      ? `${added} suggestion berhasil ditambahkan dan disimpan permanen ke backend Odoo. Cek /consolidation/config untuk review.`
      : `${added} suggestion ditambahkan, tetapi backend Odoo gagal menyimpan perubahan. ${saveResult.error ?? ''}`.trim()
}

onMounted(async () => {
  await loadActiveConfig()
})
</script>

<template>
  <section class="page-wrap">
    <header class="hero">
      <p class="eyebrow">Consolidation Preview</p>
      <h1>Agregasi dan Eliminasi</h1>
      <p class="subtitle">
        Halaman ini membantu validasi hasil konsolidasi: nilai sebelum eliminasi, nilai eliminasi,
        dan nilai setelah eliminasi.
      </p>
    </header>

    <section class="filter-card">
      <label class="field">
        Section Report
        <select v-model="selectedSection">
          <option v-for="opt in sectionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <button type="button" class="btn primary" :disabled="isLoading" @click="recalculate">
        Hitung Ulang Preview
      </button>
      <p class="status">{{ statusMessage }}</p>
    </section>

    <section v-if="isLoading" class="filter-card">
      <p class="status">Memuat config aktif dari backend Odoo...</p>
    </section>

    <section v-else class="summary-grid">
      <article class="stat-card">
        <p class="stat-label">Total Before</p>
        <p class="stat-value">{{ formatMoney(totalBefore) }}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Total Elimination</p>
        <p class="stat-value">{{ formatMoney(totalElimination) }}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Total After</p>
        <p class="stat-value">{{ formatMoney(totalAfter) }}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Unmapped Rows</p>
        <p class="stat-value">{{ result.unmappedEntries.length }}</p>
      </article>
    </section>

    <section v-if="!isLoading" class="table-card">
      <h2>Line Result</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Key</th>
              <th>Label</th>
              <th>Type</th>
              <th>Before</th>
              <th>Elimination</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.rows" :key="row.key" :class="`row-${row.lineType}`">
              <td>{{ row.order }}</td>
              <td>{{ row.key }}</td>
              <td>{{ row.label }}</td>
              <td>{{ row.lineType }}</td>
              <td class="num">{{ formatMoney(row.amountBefore) }}</td>
              <td class="num">{{ formatMoney(row.eliminationAmount) }}</td>
              <td class="num">{{ formatMoney(row.amountAfter) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isLoading" class="table-card">
      <h2>Debug Source Mapping</h2>
      <p class="status">
        Section: {{ selectedSection }} | Odoo login:
        {{ authStore.isAuthenticated ? 'aktif' : 'belum login' }} | Company Odoo:
        {{ authStore.companies.length }}
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Source</th>
              <th>Rows Loaded</th>
              <th>Mappings</th>
              <th>Target Mapping</th>
              <th>Source Rows Target Mapping</th>
              <th>Matched Rows</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in debugEntities" :key="entry.entity.id">
              <td>{{ entry.entity.id }}</td>
              <td>{{ entry.entity.source }}</td>
              <td>{{ entry.rows.length }}</td>
              <td>{{ entry.mappings.length }}</td>
              <td>
                <div v-if="entry.targetMappings.length === 0" class="empty">-</div>
                <div
                  v-for="mapping in entry.targetMappings"
                  :key="`${mapping.sourceAccount}-${mapping.consolidationKey}`"
                  class="debug-line"
                >
                  {{ mapping.sourceAccount }} -> {{ mapping.consolidationKey }} ({{
                    mapping.section
                  }}, sign {{ mapping.sign ?? 1 }})
                </div>
              </td>
              <td>
                <div v-if="entry.targetRows.length === 0" class="empty">-</div>
                <div
                  v-for="row in entry.targetRows"
                  :key="`${row.Account}-${row.Description}`"
                  class="debug-line"
                >
                  {{ row.Account }} | {{ row.Description }} | {{ formatDebugAmount(row) }}
                </div>
              </td>
              <td>
                <div v-if="entry.matchedRows.length === 0" class="empty">-</div>
                <div
                  v-for="item in entry.matchedRows"
                  :key="`${item.mapping.sourceAccount}-${item.row.Account}-${item.row.Description}`"
                  class="debug-line"
                >
                  {{ item.row.Account }} | {{ item.row.Description }} |
                  {{ formatDebugAmount(item.row) }}
                </div>
              </td>
              <td>
                <div v-if="entry.mappings.length === 0" class="muted-text">
                  Tidak ada mapping section ini.
                </div>
                <div v-else-if="entry.warnings.length === 0" class="ok-text">OK</div>
                <div v-for="warning in entry.warnings" :key="warning" class="warning-text">
                  {{ warning }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isLoading" class="table-card">
      <h2>Elimination Rules Applied</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Debit Key</th>
              <th>Credit Key</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="result.eliminations.length === 0">
              <td colspan="4" class="empty">Belum ada rule eliminasi yang terpakai.</td>
            </tr>
            <tr v-for="entry in result.eliminations" :key="entry.ruleId">
              <td>{{ entry.ruleName }}</td>
              <td>{{ entry.debitKey }}</td>
              <td>{{ entry.creditKey }}</td>
              <td class="num">{{ formatMoney(entry.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isLoading" class="table-card">
      <h2>Source Summary</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Rows</th>
              <th>Mapped</th>
              <th>Unmapped</th>
              <th>Mapped Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="source in result.sourceSummary" :key="source.entityId">
              <td>{{ source.entityId }}</td>
              <td>{{ source.rowCount }}</td>
              <td>{{ source.mappedCount }}</td>
              <td>{{ source.unmappedCount }}</td>
              <td class="num">{{ formatMoney(source.totalMappedAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isLoading" class="table-card">
      <h2>Top Unmapped Accounts (Sample)</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Account</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="topUnmapped.length === 0">
              <td colspan="4" class="empty">Semua akun terpetakan atau tidak ada nilai numerik.</td>
            </tr>
            <tr
              v-for="row in topUnmapped"
              :key="`${row.entityId}-${row.account}-${row.description}`"
            >
              <td>{{ row.entityId }}</td>
              <td>{{ row.account }}</td>
              <td>{{ row.description }}</td>
              <td class="num">{{ formatMoney(row.rawAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isLoading" class="table-card">
      <div class="table-head">
        <h2>Suggested Mapping Draft</h2>
        <div class="actions">
          <button type="button" class="btn" @click="copyDraftToClipboard">Copy Draft JSON</button>
          <button type="button" class="btn primary" @click="applySuggestionsToConfig">
            Tambahkan Suggestion ke Config
          </button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Account</th>
              <th>Consolidation Key</th>
              <th>Sign</th>
              <th>Confidence</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="topSuggestions.length === 0">
              <td colspan="6" class="empty">
                Belum ada suggestion (cek mapping/report tree untuk section ini).
              </td>
            </tr>
            <tr
              v-for="item in topSuggestions"
              :key="`${item.entityId}-${item.account}-${item.suggestedConsolidationKey}`"
            >
              <td>{{ item.entityId }}</td>
              <td>{{ item.account }}</td>
              <td>{{ item.suggestedConsolidationKey }}</td>
              <td>{{ item.suggestedSign }}</td>
              <td>{{ item.confidence }}</td>
              <td>{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.page-wrap {
  display: grid;
  gap: 1rem;
}

.hero {
  border-radius: 18px;
  padding: 1rem 1.1rem;
  background: linear-gradient(130deg, rgba(92, 56, 10, 0.96), rgba(184, 120, 37, 0.84));
  color: #fff9f0;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
}

h1 {
  margin: 0.3rem 0;
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}

.subtitle {
  margin: 0;
  color: #fff1d9;
}

.filter-card,
.table-card {
  border-radius: 14px;
  border: 1px solid rgba(70, 45, 16, 0.15);
  background: #fff;
  padding: 0.9rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  max-width: 260px;
  font-size: 0.9rem;
  color: #3a2c18;
}

.field select {
  min-height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(84, 59, 20, 0.28);
  padding: 0 0.55rem;
  font: inherit;
}

.btn {
  margin-top: 0.6rem;
  border-radius: 9px;
  min-height: 36px;
  border: 1px solid rgba(94, 59, 17, 0.33);
  background: #fff8ef;
  color: #623a12;
  font-weight: 700;
  padding: 0 0.8rem;
  cursor: pointer;
}

.btn.primary {
  background: #6d4112;
  color: #fff7ed;
  border-color: #6d4112;
}

.status {
  margin: 0.5rem 0 0;
  color: #5f4729;
  font-size: 0.9rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 0.7rem;
}

.stat-card {
  border: 1px solid rgba(86, 55, 19, 0.14);
  border-radius: 14px;
  padding: 0.75rem;
  background: #fffdf9;
}

.stat-label {
  margin: 0;
  font-size: 0.78rem;
  color: #5f4b34;
}

.stat-value {
  margin: 0.2rem 0 0;
  font-weight: 700;
  font-size: 1.2rem;
  color: #593714;
}

.table-card h2 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}

.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  margin-bottom: 0.6rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

th,
td {
  border: 1px solid rgba(88, 57, 16, 0.17);
  padding: 0.45rem;
  text-align: left;
}

th {
  background: #fff4e6;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.row-header td,
.row-subtotal td,
.row-total td {
  font-weight: 700;
  background: #fffbf3;
}

.empty {
  text-align: center;
  color: #74593a;
}

.debug-line {
  min-width: 260px;
  margin: 0.1rem 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #1f2937;
}

.warning-text {
  min-width: 220px;
  margin: 0.1rem 0;
  color: #9a3412;
  font-size: 0.8rem;
  line-height: 1.35;
}

.ok-text {
  color: #166534;
  font-weight: 700;
}

.muted-text {
  color: #64748b;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
