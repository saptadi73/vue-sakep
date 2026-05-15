import defaultConfigJson from '@/reference/consolidation-config.json'
import type { ConsolidationConfig } from '@/types/consolidationConfig'

const STORAGE_KEY = 'consolidation:config:v1'

const cloneDefault = (): ConsolidationConfig => {
  return JSON.parse(JSON.stringify(defaultConfigJson)) as ConsolidationConfig
}

export const getDefaultConsolidationConfig = (): ConsolidationConfig => {
  return cloneDefault()
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
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const errors = validateConsolidationConfig(parsed)
    if (errors.length > 0) {
      return null
    }

    return parsed as ConsolidationConfig
  } catch {
    return null
  }
}

export const loadConsolidationConfig = (): ConsolidationConfig => {
  return readStoredConsolidationConfig() ?? cloneDefault()
}

export const saveConsolidationConfig = (config: ConsolidationConfig) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config, null, 2))
}

export const resetConsolidationConfig = (): ConsolidationConfig => {
  const next = cloneDefault()
  saveConsolidationConfig(next)
  return next
}
