<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getDefaultConsolidationConfig,
  loadConsolidationConfig,
  resetConsolidationConfig,
  saveConsolidationConfig,
  validateConsolidationConfig,
} from '@/services/consolidationConfigService'
import type { ConsolidationConfig } from '@/types/consolidationConfig'

const config = ref<ConsolidationConfig>(loadConsolidationConfig())
const jsonText = ref(JSON.stringify(config.value, null, 2))
const statusMessage = ref('Config berhasil dimuat.')
const parseErrors = ref<string[]>([])

const summary = computed(() => {
  const current = config.value
  return {
    entities: current.entities.length,
    mappings: current.coaMappings.length,
    treeNodes: current.reportTree.length,
    eliminationRules: current.eliminationRules.length,
  }
})

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
  jsonText.value = JSON.stringify(config.value, null, 2)
  statusMessage.value = 'Config tersimpan ke browser storage.'
}

const reloadFromStorage = () => {
  config.value = loadConsolidationConfig()
  jsonText.value = JSON.stringify(config.value, null, 2)
  parseErrors.value = []
  statusMessage.value = 'Config dimuat ulang dari storage/default.'
}

const resetToDefault = () => {
  config.value = resetConsolidationConfig()
  jsonText.value = JSON.stringify(config.value, null, 2)
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
  statusMessage.value = 'File berhasil dimuat. Klik Simpan Config untuk validasi dan apply.'
  parseErrors.value = []
  input.value = ''
}

const loadTemplate = () => {
  const template = getDefaultConsolidationConfig()
  jsonText.value = JSON.stringify(template, null, 2)
  statusMessage.value = 'Template default dimuat ke editor. Klik Simpan Config untuk apply.'
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
        <button type="button" class="btn primary" @click="applyJsonText">Simpan Config</button>
        <button type="button" class="btn" @click="reloadFromStorage">Muat Ulang</button>
        <button type="button" class="btn" @click="loadTemplate">Muat Template</button>
        <button type="button" class="btn" @click="resetToDefault">Reset Default</button>
        <button type="button" class="btn" @click="triggerImport">Import JSON</button>
        <button type="button" class="btn" @click="exportConfig">Export JSON</button>
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

      <textarea
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

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
