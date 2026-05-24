import defaultConfigJson from '@/reference/consolidation-config.json'
import { fetchOdooJsonConfigByCode, upsertOdooJsonConfig } from '@/services/odooService'
import type { ConsolidationConfig } from '@/types/consolidationConfig'

const STORAGE_KEY = 'consolidation:config:v1'
const LAST_CONFIRMED_KEY = 'consolidation:config:last-confirmed-backend:v1'
const ODOO_CONFIG_CODE = 'sakep_consolidated_report'
const ODOO_CONFIG_NAME = 'SAKep Consolidated Report'

export type SaveConsolidationConfigResult = {
  mode: 'backend-and-storage' | 'storage-only'
  error?: string
}

const cloneDefault = (): ConsolidationConfig => {
  return JSON.parse(JSON.stringify(defaultConfigJson)) as ConsolidationConfig
}

export const getDefaultConsolidationConfig = (): ConsolidationConfig => {
  return cloneDefault()
}

const clearStoredConfigCache = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(LAST_CONFIRMED_KEY)
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export const validateConsolidationConfig = (value: unknown): string[] => {
  const errors: string[] = []

  if (!isObject(value)) {
    return ['Config harus berupa object JSON.']
  }

  if (typeof value.version !== 'string' || value.version.trim() === '') {
    errors.push('Field version wajib diisi.')
  }

  if (typeof value.groupCurrency !== 'string' || value.groupCurrency.trim() === '') {
    errors.push('Field groupCurrency wajib diisi.')
  }

  if (!Array.isArray(value.entities)) {
    errors.push('Field entities harus berupa array.')
  }

  if (!Array.isArray(value.coaMappings)) {
    errors.push('Field coaMappings harus berupa array.')
  }

  if (!Array.isArray(value.reportTree)) {
    errors.push('Field reportTree harus berupa array.')
  }

  if (!Array.isArray(value.eliminationRules)) {
    errors.push('Field eliminationRules harus berupa array.')
  }

  return errors
}

export const readStoredConsolidationConfig = (): ConsolidationConfig | null => {
  return null
}

export const loadConsolidationConfig = (): ConsolidationConfig => {
  clearStoredConfigCache()
  return cloneDefault()
}

const normalizeConfig = (config: ConsolidationConfig): ConsolidationConfig => {
  return JSON.parse(JSON.stringify(config)) as ConsolidationConfig
}

export const loadConsolidationConfigFromBackend = async (): Promise<ConsolidationConfig | null> => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    clearStoredConfigCache()
    const record = await fetchOdooJsonConfigByCode(ODOO_CONFIG_CODE)
    if (!record?.config) {
      return null
    }

    const parsed = record.config as unknown
    const errors = validateConsolidationConfig(parsed)
    if (errors.length > 0) {
      return null
    }

    return normalizeConfig(JSON.parse(JSON.stringify(parsed)) as ConsolidationConfig)
  } catch {
    return null
  }
}

export const loadConsolidationConfigFromFile = loadConsolidationConfigFromBackend

export const saveConsolidationConfig = async (
  config: ConsolidationConfig,
): Promise<SaveConsolidationConfigResult> => {
  const normalized = normalizeConfig(config)

  if (typeof window === 'undefined') {
    return {
      mode: 'storage-only',
      error: 'Window tidak tersedia untuk menyimpan config backend.',
    }
  }

  try {
    await upsertOdooJsonConfig({
      name: ODOO_CONFIG_NAME,
      code: ODOO_CONFIG_CODE,
      sequence: 10,
      config: normalized,
    })

    clearStoredConfigCache()

    return { mode: 'backend-and-storage' }
  } catch (error) {
    clearStoredConfigCache()
    return {
      mode: 'storage-only',
      error:
        error instanceof Error
          ? error.message
          : 'Gagal menghubungi API backend untuk simpan config.',
    }
  }
}

export const resetConsolidationConfig = (): ConsolidationConfig => {
  const next = cloneDefault()
  void saveConsolidationConfig(next)
  return next
}
