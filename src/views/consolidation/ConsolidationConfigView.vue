<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getDefaultConsolidationConfig,
  loadConsolidationConfig,
  resetConsolidationConfig,
  saveConsolidationConfig,
  validateConsolidationConfig,
} from '@/services/consolidationConfigService'
import type {
  CoaMappingRule,
  ConsolidationConfig,
  ConsolidationEntity,
  ConsolidationNode,
  EliminationRule,
} from '@/types/consolidationConfig'

const config = ref<ConsolidationConfig>(loadConsolidationConfig())
const jsonText = ref(JSON.stringify(config.value, null, 2))
const statusMessage = ref('Config berhasil dimuat.')
const parseErrors = ref<string[]>([])
const editorMode = ref<'table' | 'json'>('table')

const summary = computed(() => {
  const current = config.value
  return {
    entities: current.entities.length,
    mappings: current.coaMappings.length,
    treeNodes: current.reportTree.length,
    eliminationRules: current.eliminationRules.length,
  }
})

const syncJsonFromConfig = () => {
  jsonText.value = JSON.stringify(config.value, null, 2)
}

const markTableChanged = () => {
  parseErrors.value = []
  syncJsonFromConfig()
  statusMessage.value = 'Perubahan tabel diterapkan ke draft JSON. Klik Simpan Config untuk commit.'
}

const applyJsonText = () => {
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
  saveConsolidationConfig(config.value)
  syncJsonFromConfig()
  statusMessage.value = 'Config tersimpan ke browser storage.'
}

const saveTableConfig = () => {
  const errors = validateConsolidationConfig(config.value)
  if (errors.length > 0) {
    parseErrors.value = errors
    statusMessage.value = 'Validasi config gagal.'
    return
  }

  saveConsolidationConfig(config.value)
  syncJsonFromConfig()
  parseErrors.value = []
  statusMessage.value = 'Config tabel berhasil disimpan ke browser storage.'
}

const saveConfig = () => {
  if (editorMode.value === 'json') {
    applyJsonText()
    return
  }

  saveTableConfig()
}

const reloadFromStorage = () => {
  config.value = loadConsolidationConfig()
  syncJsonFromConfig()
  parseErrors.value = []
  statusMessage.value = 'Config dimuat ulang dari storage/default.'
}

const resetToDefault = () => {
  config.value = resetConsolidationConfig()
  syncJsonFromConfig()
  parseErrors.value = []
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
  statusMessage.value = 'Template default dimuat. Klik Simpan Config untuk commit.'
}

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
  if (!target || !(target instanceof HTMLInputElement)) {
    return ''
  }

  return target.value
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

  row.entityPair = index === 0 ? [value, currentB] : [currentA, value]
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
    <header class="hero">
      <p class="eyebrow">Consolidation Setup</p>
      <h1>Config Aggregasi dan Eliminasi</h1>
      <p class="subtitle">
        Langkah pertama konsolidasi adalah agregasi data lintas entitas. Atur mapping COA, tree
        report, dan rule eliminasi di sini.
      </p>
    </header>

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

    <section class="editor-card">
      <div class="toolbar">
        <button type="button" class="btn primary" @click="saveConfig">Simpan Config</button>
        <button type="button" class="btn" @click="reloadFromStorage">Muat Ulang</button>
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
                  <td><input v-model="row.entityId" type="text" @input="markTableChanged" /></td>
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
                    <input :value="row.order" type="number" @input="updateTreeOrder(row, $event)" />
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
                  <td><input v-model="row.debitKey" type="text" @input="markTableChanged" /></td>
                  <td><input v-model="row.creditKey" type="text" @input="markTableChanged" /></td>
                  <td>
                    <select v-model="row.scope" @change="onScopeChanged(row)">
                      <option value="all">all</option>
                      <option value="entity-pair">entity-pair</option>
                    </select>
                  </td>
                  <td>
                    <input
                      :value="row.entityPair?.[0] ?? ''"
                      type="text"
                      :disabled="row.scope !== 'entity-pair'"
                      @input="updateEntityPair(row, 0, $event)"
                    />
                  </td>
                  <td>
                    <input
                      :value="row.entityPair?.[1] ?? ''"
                      type="text"
                      :disabled="row.scope !== 'entity-pair'"
                      @input="updateEntityPair(row, 1, $event)"
                    />
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

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
