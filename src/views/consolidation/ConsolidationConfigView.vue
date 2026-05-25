<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getDefaultConsolidationConfig,
  loadConsolidationConfig,
  loadConsolidationConfigFromFile,
  resetConsolidationConfig,
  saveConsolidationConfig,
  validateConsolidationConfig,
} from '@/services/consolidationConfigService'
import {
  fetchOdooCompaniesForConsolidation,
  findOdooCompanyForEntity,
  loadConsolidationSourceData,
} from '@/services/consolidationSourceService'
import { useOdooAuthStore } from '@/stores/odooAuth'
import type {
  CoaMappingRule,
  ConsolidationConfig,
  ConsolidationEntity,
  ConsolidationNode,
  ConsolidationSection,
  EliminationRule,
} from '@/types/consolidationConfig'
import type { ConsolidationSourceData } from '@/services/consolidationEngineService'
import type { ReportRow } from '@/types/report'

const authStore = useOdooAuthStore()
const config = ref<ConsolidationConfig>(getDefaultConsolidationConfig())
const jsonText = ref(JSON.stringify(config.value, null, 2))
const statusMessage = ref('Memuat config dari backend Odoo...')
const parseErrors = ref<string[]>([])
const editorMode = ref<'table' | 'json'>('table')
const isLoading = ref(true)
const isDebugLoading = ref(false)
const debugSection = ref<ConsolidationSection>('balance-sheet')
const debugSourceData = ref<ConsolidationSourceData>({})
const debugCompanies = ref(authStore.companies)
const debugStatusMessage = ref('Menunggu config selesai dimuat untuk cek data source.')
const activeSourceLabel = ref('backend Odoo')
const activeSourceTone = ref<'backend' | 'fallback' | 'template'>('backend')
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: number | undefined

const hideToast = () => {
  toastVisible.value = false
  toastMessage.value = ''
}

const showSuccessToast = (message: string) => {
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer)
  }

  toastMessage.value = message
  toastVisible.value = true
  toastTimer = window.setTimeout(() => {
    hideToast()
    toastTimer = undefined
  }, 3000)
}

const buildSaveStatusMessage = (
  result: Awaited<ReturnType<typeof saveConsolidationConfig>>,
  tableMode = false,
) => {
  if (result.mode === 'backend-and-storage') {
    return tableMode
      ? 'Config tabel berhasil disimpan permanen ke backend Odoo dan browser storage.'
      : 'Config berhasil disimpan permanen ke backend Odoo dan browser storage.'
  }

  return tableMode
    ? `Config tabel belum tersimpan permanen ke backend Odoo. ${result.error ?? ''}`.trim()
    : `Config belum tersimpan permanen ke backend Odoo. ${result.error ?? ''}`.trim()
}

const summary = computed(() => {
  const current = config.value
  return {
    entities: current.entities.length,
    mappings: current.coaMappings.length,
    treeNodes: current.reportTree.length,
    eliminationRules: current.eliminationRules.length,
  }
})

const entityIdOptions = computed(() => {
  return config.value.entities.map((entity) => ({
    id: entity.id,
    label: `${entity.id} - ${entity.name}`,
  }))
})

const eliminationKeyOptionsBySection = computed<Record<ConsolidationSection, string[]>>(() => {
  const bySection: Record<ConsolidationSection, string[]> = {
    pnl: [],
    'balance-sheet': [],
    'trial-balance': [],
  }

  for (const section of Object.keys(bySection) as ConsolidationSection[]) {
    const keys = config.value.reportTree
      .filter((node) => node.section === section)
      .map((node) => node.key)
    bySection[section] = Array.from(new Set(keys))
  }

  return bySection
})

const getEliminationKeyOptions = (section: ConsolidationSection): string[] => {
  return eliminationKeyOptionsBySection.value[section] ?? []
}

const getDefaultDebugPeriodParams = () => {
  const today = new Date()
  const year = today.getFullYear()

  return {
    date_from: `${year}-01-01`,
    date_to: today.toISOString().slice(0, 10),
    target_move: 'posted' as const,
  }
}

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

const runSourceDebug = async (mode: 'auto' | 'manual' = 'manual') => {
  isDebugLoading.value = true
  debugStatusMessage.value = 'Mengambil data source...'

  try {
    await authStore.ensureCompanies()
    debugCompanies.value = authStore.companies
    if (debugCompanies.value.length === 0) {
      debugCompanies.value = await fetchOdooCompaniesForConsolidation()
    }

    debugSourceData.value = await loadConsolidationSourceData(
      config.value,
      debugCompanies.value,
      [debugSection.value],
      getDefaultDebugPeriodParams(),
    )
    debugStatusMessage.value =
      mode === 'auto'
        ? 'Data source berhasil dimuat otomatis untuk debug config.'
        : 'Data source berhasil dimuat ulang untuk debug config.'
  } catch (error) {
    debugSourceData.value = {}
    debugStatusMessage.value = `Gagal memuat data source. ${
      error instanceof Error ? error.message : ''
    }`.trim()
  } finally {
    isDebugLoading.value = false
  }
}

const debugEntities = computed(() => {
  return config.value.entities
    .filter((entity) => entity.enabled)
    .map((entity) => {
      const company =
        entity.source === 'odoo' ? findOdooCompanyForEntity(entity.id, debugCompanies.value) : null
      const rows = debugSourceData.value[entity.id]?.[debugSection.value] ?? []
      const mappings = config.value.coaMappings.filter(
        (mapping) => mapping.entityId === entity.id && mapping.section === debugSection.value,
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
          .slice(0, 12)
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
            !config.value.reportTree.some(
              (node) => node.section === debugSection.value && node.key === key,
            ),
        )
      const hasRelevantSourceRows = targetRows.length > 0
      const hasTargetMappings = mappings.length > 0
      const hasMatchedRows = matchedRows.length > 0
      const hasMappingsButNoRows = hasTargetMappings && rows.length > 0 && !hasRelevantSourceRows
      const hasRowsButNoMatch = hasTargetMappings && hasRelevantSourceRows && !hasMatchedRows
      const hasRelevantUnmappedRows = rows.some((row) =>
        mappings.some((mapping) => accountMatches(mapping.sourceAccount, row.Account)),
      )
      const warnings: string[] = []

      if (entity.source === 'odoo' && !company) {
        warnings.push('Company Odoo untuk entity ini tidak terdeteksi.')
      }

      if (entity.source === 'odoo' && company && rows.length === 0) {
        warnings.push('Company Odoo terdeteksi, tetapi rows source untuk section ini kosong.')
      }

      if (entity.source !== 'odoo' && rows.length === 0) {
        warnings.push('Rows source static/mock untuk section ini kosong.')
      }

      if (hasMappingsButNoRows) {
        warnings.push('Mapping target ada, tetapi rows source untuk pola sourceAccount itu tidak ditemukan.')
      }

      if (hasRowsButNoMatch || (hasTargetMappings && hasRelevantUnmappedRows && !hasMatchedRows)) {
        warnings.push('Source rows ada dan mapping ada, tetapi pola sourceAccount tidak match.')
      }

      if (missingTreeKeys.length > 0) {
        warnings.push(`Key ${missingTreeKeys.join(', ')} tidak ada di report tree section ini.`)
      }

      return {
        entity,
        company,
        rows,
        mappings,
        targetMappings,
        targetRows: targetRows.slice(0, 16),
        matchedRows,
        warnings,
      }
    })
})

const syncJsonFromConfig = () => {
  jsonText.value = JSON.stringify(config.value, null, 2)
}

const markTableChanged = () => {
  parseErrors.value = []
  syncJsonFromConfig()
  statusMessage.value = 'Perubahan tabel diterapkan ke draft JSON. Klik Simpan Config untuk commit.'
}

const applyJsonText = async () => {
  parseErrors.value = []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText.value)
  } catch (error) {
    statusMessage.value = 'JSON tidak valid. Periksa format tanda kurung atau koma.'
    parseErrors.value = [error instanceof Error ? error.message : 'Unknown JSON parse error']
    return
  }

  const errors = validateConsolidationConfig(parsed)
  if (errors.length > 0) {
    statusMessage.value = 'Validasi config gagal.'
    parseErrors.value = errors
    return
  }

  config.value = parsed as ConsolidationConfig
  const saveResult = await saveConsolidationConfig(config.value)
  syncJsonFromConfig()
  statusMessage.value = buildSaveStatusMessage(saveResult)

  if (saveResult.mode === 'backend-and-storage') {
    activeSourceLabel.value = 'backend Odoo (terkonfirmasi)'
    activeSourceTone.value = 'backend'
    showSuccessToast('Berhasil disimpan ke backend Odoo.')
  } else {
    activeSourceLabel.value = 'template default'
    activeSourceTone.value = 'template'
  }
}

const saveTableConfig = async () => {
  const errors = validateConsolidationConfig(config.value)
  if (errors.length > 0) {
    parseErrors.value = errors
    statusMessage.value = 'Validasi config gagal.'
    return
  }

  const saveResult = await saveConsolidationConfig(config.value)
  syncJsonFromConfig()
  parseErrors.value = []
  statusMessage.value = buildSaveStatusMessage(saveResult, true)

  if (saveResult.mode === 'backend-and-storage') {
    activeSourceLabel.value = 'backend Odoo (terkonfirmasi)'
    activeSourceTone.value = 'backend'
    showSuccessToast('Berhasil disimpan ke backend Odoo.')
  } else {
    activeSourceLabel.value = 'template default'
    activeSourceTone.value = 'template'
  }
}

const saveConfig = async () => {
  if (editorMode.value === 'json') {
    await applyJsonText()
    return
  }

  await saveTableConfig()
}

const loadBackendFirst = async () => {
  isLoading.value = true

  try {
    const fromFile = await loadConsolidationConfigFromFile()
    config.value = fromFile ?? loadConsolidationConfig()
    syncJsonFromConfig()
    parseErrors.value = []
    activeSourceLabel.value = fromFile ? 'backend Odoo (terkonfirmasi)' : 'template default'
    activeSourceTone.value = fromFile ? 'backend' : 'template'
    statusMessage.value = fromFile
      ? 'Config terbaru dimuat dari backend Odoo yang terkonfirmasi.'
      : 'Backend Odoo tidak tersedia, config fallback ke template default.'
    await runSourceDebug('auto')
  } finally {
    isLoading.value = false
  }
}

const reloadFromStorage = async () => {
  await loadBackendFirst()
}

const resetToDefault = () => {
  config.value = resetConsolidationConfig()
  syncJsonFromConfig()
  parseErrors.value = []
  activeSourceLabel.value = 'template default'
  activeSourceTone.value = 'template'
  statusMessage.value = 'Config direset ke template default.'
}

const exportConfig = () => {
  const blob = new Blob([jsonText.value], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'consolidation-config.json'
  anchor.click()
  window.URL.revokeObjectURL(url)
  statusMessage.value = 'Config berhasil diexport.'
}

const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerImport = () => {
  fileInputRef.value?.click()
}

const importConfigFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  const text = await file.text()
  jsonText.value = text
  editorMode.value = 'json'
  statusMessage.value = 'File berhasil dimuat. Klik Simpan Config untuk validasi dan apply.'
  parseErrors.value = []
  input.value = ''
}

const loadTemplate = () => {
  const template = getDefaultConsolidationConfig()
  config.value = template
  syncJsonFromConfig()
  parseErrors.value = []
  activeSourceLabel.value = 'template default'
  activeSourceTone.value = 'template'
  statusMessage.value = 'Template default dimuat. Klik Simpan Config untuk commit.'
}

onMounted(async () => {
  await loadBackendFirst()
})

watch(debugSection, async () => {
  if (isLoading.value) {
    return
  }

  await runSourceDebug('auto')
})

onBeforeUnmount(() => {
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer)
  }
})

const addEntity = () => {
  const next: ConsolidationEntity = {
    id: `entity-${Date.now()}`,
    name: 'Entitas Baru',
    source: 'manual',
    enabled: true,
    ownershipPct: 100,
  }
  config.value.entities.push(next)
  markTableChanged()
}

const addMapping = () => {
  const next: CoaMappingRule = {
    entityId: config.value.entities[0]?.id ?? '',
    sourceAccount: '',
    consolidationKey: '',
    section: 'pnl',
    lineType: 'detail',
    sign: 1,
  }
  config.value.coaMappings.push(next)
  markTableChanged()
}

const addTreeNode = () => {
  const next: ConsolidationNode = {
    key: `node_${config.value.reportTree.length + 1}`,
    section: 'pnl',
    label: 'Node Baru',
    lineType: 'detail',
    order: config.value.reportTree.length + 1,
  }
  config.value.reportTree.push(next)
  markTableChanged()
}

const addEliminationRule = () => {
  const next: EliminationRule = {
    id: `elim-${Date.now()}`,
    name: 'Rule Eliminasi Baru',
    enabled: true,
    section: 'pnl',
    debitKey: '',
    creditKey: '',
    scope: 'all',
    method: 'percentage',
    percentage: 100,
  }
  config.value.eliminationRules.push(next)
  markTableChanged()
}

const removeEntity = (index: number) => {
  config.value.entities.splice(index, 1)
  markTableChanged()
}

const removeMapping = (index: number) => {
  config.value.coaMappings.splice(index, 1)
  markTableChanged()
}

const removeTreeNode = (index: number) => {
  config.value.reportTree.splice(index, 1)
  markTableChanged()
}

const removeEliminationRule = (index: number) => {
  config.value.eliminationRules.splice(index, 1)
  markTableChanged()
}

const onScopeChanged = (rule: EliminationRule) => {
  if (rule.scope === 'all') {
    rule.entityPair = undefined
  }
  markTableChanged()
}

const onMethodChanged = (rule: EliminationRule) => {
  if (rule.method === 'full') {
    rule.percentage = undefined
  } else if (rule.percentage === undefined) {
    rule.percentage = 100
  }
  markTableChanged()
}

const readEventValue = (event: Event): string => {
  const target = event.target
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return ''
  }

  return target.value
}

const preventSelectTyping = (event: KeyboardEvent) => {
  if (event.key.length === 1) {
    event.preventDefault()
  }
}

const updateOwnershipPct = (row: ConsolidationEntity, event: Event) => {
  const value = readEventValue(event)
  row.ownershipPct = value ? Number(value) : undefined
  markTableChanged()
}

const updateMappingDescContains = (row: CoaMappingRule, event: Event) => {
  const value = readEventValue(event)
  row.sourceDescriptionContains = value || undefined
  markTableChanged()
}

const updateMappingParentKey = (row: CoaMappingRule, event: Event) => {
  const value = readEventValue(event)
  row.parentKey = value || undefined
  markTableChanged()
}

const updateMappingNote = (row: CoaMappingRule, event: Event) => {
  const value = readEventValue(event)
  row.note = value || undefined
  markTableChanged()
}

const updateTreeParentKey = (row: ConsolidationNode, event: Event) => {
  const value = readEventValue(event)
  row.parentKey = value || undefined
  markTableChanged()
}

const updateTreeOrder = (row: ConsolidationNode, event: Event) => {
  const value = readEventValue(event)
  row.order = Number(value || 0)
  markTableChanged()
}

const updateTreeFormula = (row: ConsolidationNode, event: Event) => {
  const value = readEventValue(event)
  row.formula = value || undefined
  markTableChanged()
}

const updateEntityPair = (row: EliminationRule, index: 0 | 1, event: Event) => {
  const value = readEventValue(event)
  const currentA = row.entityPair?.[0] ?? ''
  const currentB = row.entityPair?.[1] ?? ''
  const nextA = index === 0 ? value : currentA
  const nextB = index === 1 ? value : currentB

  if (!nextA && !nextB) {
    row.entityPair = undefined
    row.scope = 'all'
  } else {
    row.entityPair = [nextA, nextB]
    row.scope = 'entity-pair'
  }

  markTableChanged()
}

const updateEliminationPercentage = (row: EliminationRule, event: Event) => {
  const value = readEventValue(event)
  row.percentage = value ? Number(value) : undefined
  markTableChanged()
}

const updateEliminationNote = (row: EliminationRule, event: Event) => {
  const value = readEventValue(event)
  row.note = value || undefined
  markTableChanged()
}
</script>

<template>
  <section class="page-wrap">
    <transition name="toast-fade">
      <div v-if="toastVisible" class="toast toast-success" role="status" aria-live="polite">
        {{ toastMessage }}
      </div>
    </transition>

    <header class="hero">
      <p class="eyebrow">Consolidation Setup</p>
      <h1>Config Aggregasi dan Eliminasi</h1>
      <p class="subtitle">
        Langkah pertama konsolidasi adalah agregasi data lintas entitas. Atur mapping COA, tree
        report, dan rule eliminasi di sini.
      </p>
    </header>

    <section v-if="isLoading" class="loading-card" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <div>
        <h2>Memuat config konsolidasi</h2>
        <p>Mengambil versi terbaru dari backend Odoo, lalu menyiapkan fallback lokal.</p>
      </div>
    </section>

    <template v-else>
      <div class="summary-grid">
        <article class="stat-card">
          <p class="stat-label">Entitas Aktif</p>
          <p class="stat-value">{{ summary.entities }}</p>
        </article>
        <article class="stat-card">
          <p class="stat-label">COA Mapping</p>
          <p class="stat-value">{{ summary.mappings }}</p>
        </article>
        <article class="stat-card">
          <p class="stat-label">Node Report Tree</p>
          <p class="stat-value">{{ summary.treeNodes }}</p>
        </article>
        <article class="stat-card">
          <p class="stat-label">Rule Eliminasi</p>
          <p class="stat-value">{{ summary.eliminationRules }}</p>
        </article>
      </div>

      <section class="help-card">
        <h2>Yang Perlu Anda Tambahkan</h2>
        <ol>
          <li>Lengkapi entities sesuai seluruh anak perusahaan yang masuk konsolidasi.</li>
          <li>Isi coaMappings untuk setiap COA source ke consolidationKey target.</li>
          <li>Bangun reportTree untuk struktur final laporan konsolidasi.</li>
          <li>Definisikan eliminationRules untuk transaksi antar entitas (intercompany).</li>
        </ol>
      </section>

      <section class="source-debug-card">
        <div class="debug-head">
          <div>
            <h2>Debug Data Source</h2>
            <p class="debug-subtitle">
              Cek apakah row sumber sudah tercapture dan match dengan mapping aktif.
            </p>
          </div>
          <div class="debug-actions">
            <label class="debug-field">
              Section
              <select v-model="debugSection">
                <option value="balance-sheet">balance-sheet</option>
                <option value="pnl">pnl</option>
                <option value="trial-balance">trial-balance</option>
              </select>
            </label>
            <button
              type="button"
              class="btn primary"
              :disabled="isDebugLoading"
              @click="runSourceDebug()"
            >
              {{ isDebugLoading ? 'Mengecek...' : 'Re-check Data Source' }}
            </button>
          </div>
        </div>

        <p class="status">
          {{ debugStatusMessage }} Login Odoo:
          {{ authStore.isAuthenticated ? 'aktif' : 'belum login' }} | Company Odoo:
          {{ debugCompanies.length }}
        </p>
        <p class="status">
          Daftar company:
          {{
            debugCompanies.length
              ? debugCompanies.map((company) => `${company.name} (#${company.id})`).join(', ')
              : '-'
          }}
        </p>

        <div class="sheet-scroll">
          <table class="sheet-table debug-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Source Info</th>
                <th>Rows Loaded</th>
                <th>Mapping Section</th>
                <th>Target Mapping</th>
                <th>Source Rows Target Mapping</th>
                <th>Matched Rows</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="debugEntities.length === 0">
                <td colspan="8" class="empty-cell">
                  Tidak ada entity aktif di config.
                </td>
              </tr>
              <tr v-for="entry in debugEntities" :key="entry.entity.id">
                <td>{{ entry.entity.id }}</td>
                <td>
                  <span v-if="entry.company">
                    {{ entry.company.name }} (#{{ entry.company.id }})
                  </span>
                  <span v-else>{{ entry.entity.source }}</span>
                </td>
                <td>{{ entry.rows.length }}</td>
                <td>{{ entry.mappings.length }}</td>
                <td>
                  <div v-if="entry.targetMappings.length === 0" class="muted-text">-</div>
                  <div
                    v-for="mapping in entry.targetMappings"
                    :key="`${entry.entity.id}-${mapping.sourceAccount}-${mapping.consolidationKey}`"
                    class="debug-line"
                  >
                    {{ mapping.sourceAccount }} -> {{ mapping.consolidationKey }} ({{
                      mapping.section
                    }}, sign {{ mapping.sign ?? 1 }})
                  </div>
                </td>
                <td>
                  <div v-if="entry.targetRows.length === 0" class="muted-text">-</div>
                  <div
                    v-for="row in entry.targetRows"
                    :key="`${entry.entity.id}-${row.Account}-${row.Description}`"
                    class="debug-line"
                  >
                    {{ row.Account }} | {{ row.Description }} | {{ formatDebugAmount(row) }}
                  </div>
                </td>
                <td>
                  <div v-if="entry.matchedRows.length === 0" class="muted-text">-</div>
                  <div
                    v-for="item in entry.matchedRows"
                    :key="`${entry.entity.id}-${item.mapping.sourceAccount}-${item.row.Account}-${item.row.Description}`"
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

      <section class="editor-card">
        <div class="toolbar">
          <button type="button" class="btn primary" @click="saveConfig">Simpan Config</button>
          <button type="button" class="btn" @click="reloadFromStorage">Muat Ulang Backend</button>
          <button type="button" class="btn" @click="loadTemplate">Muat Template</button>
          <button type="button" class="btn" @click="resetToDefault">Reset Default</button>
          <button type="button" class="btn" @click="triggerImport">Import JSON</button>
          <button type="button" class="btn" @click="exportConfig">Export JSON</button>
        </div>

        <div class="mode-switch" role="tablist" aria-label="Mode Editor Config">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: editorMode === 'table' }"
            @click="editorMode = 'table'"
          >
            Mode Tabel
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: editorMode === 'json' }"
            @click="editorMode = 'json'"
          >
            Mode JSON
          </button>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="application/json"
          class="file-input"
          @change="importConfigFile"
        />

        <p class="status">{{ statusMessage }}</p>
        <p v-if="!isLoading" class="source-badge" :class="`source-${activeSourceTone}`">
          Sumber aktif: {{ activeSourceLabel }}
        </p>

        <ul v-if="parseErrors.length" class="error-list">
          <li v-for="error in parseErrors" :key="error">{{ error }}</li>
        </ul>

        <div v-if="editorMode === 'table'" class="table-mode-wrap">
          <article class="sheet-card">
            <div class="sheet-head">
              <h3>Entities</h3>
              <button type="button" class="btn" @click="addEntity">Tambah Baris</button>
            </div>
            <div class="sheet-scroll">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Source</th>
                    <th>Enabled</th>
                    <th>Ownership %</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in config.entities" :key="`ent-${idx}`">
                    <td><input v-model="row.id" type="text" @input="markTableChanged" /></td>
                    <td><input v-model="row.name" type="text" @input="markTableChanged" /></td>
                    <td>
                      <select v-model="row.source" @change="markTableChanged">
                        <option value="odoo">odoo</option>
                        <option value="bprs">bprs</option>
                        <option value="jabmart">jabmart</option>
                        <option value="uspps">uspps</option>
                        <option value="manual">manual</option>
                      </select>
                    </td>
                    <td class="cell-center">
                      <input v-model="row.enabled" type="checkbox" @change="markTableChanged" />
                    </td>
                    <td>
                      <input
                        :value="row.ownershipPct ?? ''"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        @input="updateOwnershipPct(row, $event)"
                      />
                    </td>
                    <td class="cell-center">
                      <button type="button" class="btn danger" @click="removeEntity(idx)">
                        Hapus
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="sheet-card">
            <div class="sheet-head">
              <h3>COA Mappings</h3>
              <button type="button" class="btn" @click="addMapping">Tambah Baris</button>
            </div>
            <div class="sheet-scroll">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Source Account</th>
                    <th>Desc Contains</th>
                    <th>Consolidation Key</th>
                    <th>Section</th>
                    <th>Parent Key</th>
                    <th>Line Type</th>
                    <th>Sign</th>
                    <th>Note</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in config.coaMappings" :key="`map-${idx}`">
                    <td>
                      <select
                        v-model="row.entityId"
                        @change="markTableChanged"
                        @keydown="preventSelectTyping"
                      >
                        <option value="">-- pilih entity --</option>
                        <option
                          v-for="entity in entityIdOptions"
                          :key="entity.id"
                          :value="entity.id"
                        >
                          {{ entity.label }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <input v-model="row.sourceAccount" type="text" @input="markTableChanged" />
                    </td>
                    <td>
                      <input
                        :value="row.sourceDescriptionContains ?? ''"
                        type="text"
                        @input="updateMappingDescContains(row, $event)"
                      />
                    </td>
                    <td>
                      <input v-model="row.consolidationKey" type="text" @input="markTableChanged" />
                    </td>
                    <td>
                      <select v-model="row.section" @change="markTableChanged">
                        <option value="pnl">pnl</option>
                        <option value="balance-sheet">balance-sheet</option>
                        <option value="trial-balance">trial-balance</option>
                      </select>
                    </td>
                    <td>
                      <input
                        :value="row.parentKey ?? ''"
                        type="text"
                        @input="updateMappingParentKey(row, $event)"
                      />
                    </td>
                    <td>
                      <select v-model="row.lineType" @change="markTableChanged">
                        <option value="header">header</option>
                        <option value="detail">detail</option>
                        <option value="subtotal">subtotal</option>
                        <option value="total">total</option>
                        <option value="derived">derived</option>
                      </select>
                    </td>
                    <td>
                      <select v-model.number="row.sign" @change="markTableChanged">
                        <option :value="1">1</option>
                        <option :value="-1">-1</option>
                      </select>
                    </td>
                    <td>
                      <input
                        :value="row.note ?? ''"
                        type="text"
                        @input="updateMappingNote(row, $event)"
                      />
                    </td>
                    <td class="cell-center">
                      <button type="button" class="btn danger" @click="removeMapping(idx)">
                        Hapus
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="sheet-card">
            <div class="sheet-head">
              <h3>Report Tree</h3>
              <button type="button" class="btn" @click="addTreeNode">Tambah Baris</button>
            </div>
            <div class="sheet-scroll">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Section</th>
                    <th>Label</th>
                    <th>Line Type</th>
                    <th>Parent Key</th>
                    <th>Order</th>
                    <th>Formula</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in config.reportTree" :key="`tree-${idx}`">
                    <td><input v-model="row.key" type="text" @input="markTableChanged" /></td>
                    <td>
                      <select v-model="row.section" @change="markTableChanged">
                        <option value="pnl">pnl</option>
                        <option value="balance-sheet">balance-sheet</option>
                        <option value="trial-balance">trial-balance</option>
                      </select>
                    </td>
                    <td><input v-model="row.label" type="text" @input="markTableChanged" /></td>
                    <td>
                      <select v-model="row.lineType" @change="markTableChanged">
                        <option value="header">header</option>
                        <option value="detail">detail</option>
                        <option value="subtotal">subtotal</option>
                        <option value="total">total</option>
                        <option value="derived">derived</option>
                      </select>
                    </td>
                    <td>
                      <input
                        :value="row.parentKey ?? ''"
                        type="text"
                        @input="updateTreeParentKey(row, $event)"
                      />
                    </td>
                    <td>
                      <input
                        :value="row.order"
                        type="number"
                        @input="updateTreeOrder(row, $event)"
                      />
                    </td>
                    <td>
                      <input
                        :value="row.formula ?? ''"
                        type="text"
                        @input="updateTreeFormula(row, $event)"
                      />
                    </td>
                    <td class="cell-center">
                      <button type="button" class="btn danger" @click="removeTreeNode(idx)">
                        Hapus
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="sheet-card">
            <div class="sheet-head">
              <h3>Elimination Rules</h3>
              <button type="button" class="btn" @click="addEliminationRule">Tambah Baris</button>
            </div>
            <div class="sheet-scroll">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Enabled</th>
                    <th>Section</th>
                    <th>Debit Key</th>
                    <th>Credit Key</th>
                    <th>Scope</th>
                    <th>Entity A</th>
                    <th>Entity B</th>
                    <th>Method</th>
                    <th>Percentage</th>
                    <th>Note</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in config.eliminationRules" :key="`elim-${idx}`">
                    <td><input v-model="row.id" type="text" @input="markTableChanged" /></td>
                    <td><input v-model="row.name" type="text" @input="markTableChanged" /></td>
                    <td class="cell-center">
                      <input v-model="row.enabled" type="checkbox" @change="markTableChanged" />
                    </td>
                    <td>
                      <select v-model="row.section" @change="markTableChanged">
                        <option value="pnl">pnl</option>
                        <option value="balance-sheet">balance-sheet</option>
                        <option value="trial-balance">trial-balance</option>
                      </select>
                    </td>
                    <td>
                      <select v-model="row.debitKey" @change="markTableChanged">
                        <option value="">-- pilih key --</option>
                        <option
                          v-for="key in getEliminationKeyOptions(row.section)"
                          :key="`debit-${row.id}-${key}`"
                          :value="key"
                        >
                          {{ key }}
                        </option>
                        <option
                          v-if="
                            row.debitKey &&
                            !getEliminationKeyOptions(row.section).includes(row.debitKey)
                          "
                          :value="row.debitKey"
                        >
                          {{ row.debitKey }} (custom)
                        </option>
                      </select>
                    </td>
                    <td>
                      <select v-model="row.creditKey" @change="markTableChanged">
                        <option value="">-- pilih key --</option>
                        <option
                          v-for="key in getEliminationKeyOptions(row.section)"
                          :key="`credit-${row.id}-${key}`"
                          :value="key"
                        >
                          {{ key }}
                        </option>
                        <option
                          v-if="
                            row.creditKey &&
                            !getEliminationKeyOptions(row.section).includes(row.creditKey)
                          "
                          :value="row.creditKey"
                        >
                          {{ row.creditKey }} (custom)
                        </option>
                      </select>
                    </td>
                    <td>
                      <select v-model="row.scope" @change="onScopeChanged(row)">
                        <option value="all">all</option>
                        <option value="entity-pair">entity-pair</option>
                      </select>
                    </td>
                    <td>
                      <select
                        :value="row.entityPair?.[0] ?? ''"
                        @change="updateEntityPair(row, 0, $event)"
                      >
                        <option value="">-- pilih entitas --</option>
                        <option
                          v-for="entity in entityIdOptions"
                          :key="`entity-a-${row.id}-${entity.id}`"
                          :value="entity.id"
                        >
                          {{ entity.label }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <select
                        :value="row.entityPair?.[1] ?? ''"
                        @change="updateEntityPair(row, 1, $event)"
                      >
                        <option value="">-- pilih entitas --</option>
                        <option
                          v-for="entity in entityIdOptions"
                          :key="`entity-b-${row.id}-${entity.id}`"
                          :value="entity.id"
                        >
                          {{ entity.label }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <select v-model="row.method" @change="onMethodChanged(row)">
                        <option value="full">full</option>
                        <option value="percentage">percentage</option>
                      </select>
                    </td>
                    <td>
                      <input
                        :value="row.percentage ?? ''"
                        type="number"
                        min="0"
                        max="100"
                        :disabled="row.method !== 'percentage'"
                        @input="updateEliminationPercentage(row, $event)"
                      />
                    </td>
                    <td>
                      <input
                        :value="row.note ?? ''"
                        type="text"
                        @input="updateEliminationNote(row, $event)"
                      />
                    </td>
                    <td class="cell-center">
                      <button type="button" class="btn danger" @click="removeEliminationRule(idx)">
                        Hapus
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <textarea
          v-else
          v-model="jsonText"
          class="json-editor"
          spellcheck="false"
          aria-label="Consolidation JSON Config Editor"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.page-wrap {
  display: grid;
  gap: 1rem;
  position: relative;
}

.loading-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(8, 58, 101, 0.12), rgba(19, 111, 134, 0.1));
  border: 1px solid rgba(19, 111, 134, 0.18);
}

.loading-card h2 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
}

.loading-card p {
  margin: 0;
  color: #425871;
}

.loading-spinner {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  border: 3px solid rgba(19, 111, 134, 0.2);
  border-top-color: #126f86;
  animation: spin 0.85s linear infinite;
  flex: 0 0 auto;
}

.toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 40;
  min-width: min(20rem, calc(100vw - 2rem));
  max-width: 24rem;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(8, 22, 44, 0.22);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.toast-success {
  background: linear-gradient(135deg, #0e7a55, #16916a);
  color: #effff8;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.hero {
  border-radius: 18px;
  padding: 1rem 1.1rem;
  background: linear-gradient(130deg, rgba(8, 58, 101, 0.95), rgba(19, 111, 134, 0.88));
  color: #f1f7ff;
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
  color: #d8ebff;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 0.7rem;
}

.stat-card {
  border: 1px solid rgba(13, 55, 94, 0.15);
  border-radius: 14px;
  padding: 0.75rem;
  background: #fbfdff;
}

.stat-label {
  margin: 0;
  font-size: 0.78rem;
  color: #4e5f74;
}

.stat-value {
  margin: 0.2rem 0 0;
  font-weight: 700;
  font-size: 1.25rem;
  color: #103861;
}

.help-card,
.source-debug-card,
.editor-card {
  border-radius: 14px;
  border: 1px solid rgba(11, 45, 82, 0.13);
  background: #ffffff;
  padding: 0.9rem;
}

.help-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.help-card ol {
  margin: 0;
  padding-left: 1rem;
  color: #30465e;
}

.source-debug-card {
  display: grid;
  gap: 0.7rem;
}

.debug-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: end;
}

.debug-head h2 {
  margin: 0;
  font-size: 1rem;
  color: #163b61;
}

.debug-subtitle {
  margin: 0.25rem 0 0;
  color: #52677f;
  font-size: 0.9rem;
}

.debug-actions {
  display: flex;
  align-items: end;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.debug-field {
  display: grid;
  gap: 0.25rem;
  min-width: 180px;
  color: #35516f;
  font-size: 0.82rem;
  font-weight: 700;
}

.debug-field select {
  min-height: 34px;
  border-radius: 9px;
  border: 1px solid rgba(13, 58, 101, 0.32);
  background: #fff;
  padding: 0 0.5rem;
  font: inherit;
}

.debug-table td {
  vertical-align: top;
}

.debug-line {
  min-width: 260px;
  margin: 0.1rem 0;
  color: #1f2937;
  font-size: 0.8rem;
  line-height: 1.35;
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

.muted-text,
.empty-cell {
  color: #64748b;
}

.empty-cell {
  text-align: center;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.mode-switch {
  margin-top: 0.6rem;
  display: inline-flex;
  border-radius: 10px;
  border: 1px solid rgba(13, 58, 101, 0.25);
  overflow: hidden;
}

.mode-btn {
  min-height: 34px;
  padding: 0 0.8rem;
  border: 0;
  background: #f1f7ff;
  color: #1f4266;
  font-weight: 600;
  cursor: pointer;
}

.mode-btn.active {
  background: #134673;
  color: #f4f8ff;
}

.btn {
  border-radius: 9px;
  min-height: 34px;
  border: 1px solid rgba(13, 58, 101, 0.32);
  background: #f8fbff;
  padding: 0 0.7rem;
  color: #163b61;
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  background: #134673;
  color: #f4f8ff;
  border-color: #134673;
}

.btn.danger {
  background: #fff1f1;
  border-color: rgba(142, 38, 38, 0.34);
  color: #7d2424;
}

.file-input {
  display: none;
}

.status {
  margin: 0.7rem 0 0.4rem;
  font-size: 0.9rem;
  color: #35516f;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.7rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}

.source-backend {
  background: rgba(18, 111, 134, 0.1);
  color: #0f6d83;
  border-color: rgba(18, 111, 134, 0.22);
}

.source-fallback {
  background: rgba(100, 116, 139, 0.1);
  color: #475569;
  border-color: rgba(100, 116, 139, 0.22);
}

.source-template {
  background: rgba(138, 92, 0, 0.1);
  color: #8a5c00;
  border-color: rgba(138, 92, 0, 0.22);
}

.error-list {
  margin: 0 0 0.6rem;
  padding-left: 1rem;
  color: #8f1a1a;
}

.json-editor {
  width: 100%;
  min-height: 460px;
  border-radius: 12px;
  border: 1px solid rgba(10, 44, 80, 0.22);
  background: #0d1d2f;
  color: #d9e8ff;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.84rem;
  line-height: 1.5;
  padding: 0.75rem;
  resize: vertical;
}

.table-mode-wrap {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.8rem;
}

.sheet-card {
  border-radius: 12px;
  border: 1px solid rgba(13, 56, 96, 0.16);
  background: #fcfeff;
  padding: 0.65rem;
}

.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.55rem;
}

.sheet-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #1d4368;
}

.sheet-scroll {
  overflow: auto;
}

.sheet-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.sheet-table th,
.sheet-table td {
  border: 1px solid rgba(12, 54, 93, 0.16);
  padding: 0.34rem;
  vertical-align: middle;
}

.sheet-table th {
  background: #eef5ff;
  font-weight: 700;
  text-align: left;
}

.sheet-table input,
.sheet-table select {
  width: 100%;
  min-height: 30px;
  border-radius: 7px;
  border: 1px solid rgba(11, 47, 80, 0.22);
  padding: 0 0.4rem;
  font: inherit;
  background: #fff;
}

.cell-center {
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
