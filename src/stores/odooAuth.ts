import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authenticateOdoo, fetchOdooCompanies } from '@/services/odooService'
import type { OdooAuthPayload, OdooCompany, OdooUserSession } from '@/types/odoo'

const STORAGE_KEY = 'odoo:auth-session'

interface PersistedAuthSession {
  user: OdooUserSession
  activeCompanyId: number | null
}

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return value
}

const normalizePersistedSession = (value: unknown): PersistedAuthSession | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as {
    user?: Partial<OdooUserSession>
    activeCompanyId?: unknown
  }

  if (!raw.user || typeof raw.user !== 'object') {
    return null
  }

  const companyIds = Array.isArray(raw.user.company_ids)
    ? raw.user.company_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))
    : []

  const companyId = toSafeNumber(raw.user.company_id) ?? companyIds[0] ?? 0

  const normalizedUser: OdooUserSession = {
    uid: toSafeNumber(raw.user.uid) ?? 0,
    session_id: typeof raw.user.session_id === 'string' ? raw.user.session_id : undefined,
    db: typeof raw.user.db === 'string' ? raw.user.db : '',
    login: typeof raw.user.login === 'string' ? raw.user.login : '',
    name: typeof raw.user.name === 'string' ? raw.user.name : '',
    company_id: companyId,
    company_name: typeof raw.user.company_name === 'string' ? raw.user.company_name : '',
    company_ids: companyIds.length ? companyIds : companyId ? [companyId] : [],
  }

  return {
    user: normalizedUser,
    activeCompanyId: toSafeNumber(raw.activeCompanyId),
  }
}

const readPersistedSession = (): PersistedAuthSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizePersistedSession(parsed)

    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return normalized
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useOdooAuthStore = defineStore('odoo-auth', () => {
  const persisted = readPersistedSession()

  const user = ref<OdooUserSession | null>(persisted?.user ?? null)
  const companies = ref<OdooCompany[]>([])
  const activeCompanyId = ref<number | null>(persisted?.activeCompanyId ?? null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  const persistSession = () => {
    if (typeof window === 'undefined') {
      return
    }

    if (!user.value) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }

    const payload: PersistedAuthSession = {
      user: user.value,
      activeCompanyId: activeCompanyId.value,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  const setUserSession = (session: OdooUserSession | null | undefined) => {
    if (!session) {
      throw new Error('Session login Odoo tidak valid.')
    }

    user.value = session

    if (typeof session.company_id === 'number' && !Number.isNaN(session.company_id)) {
      activeCompanyId.value = session.company_id
    } else if (Array.isArray(session.company_ids) && session.company_ids.length) {
      activeCompanyId.value = session.company_ids[0] ?? null
    } else {
      activeCompanyId.value = null
    }

    persistSession()
  }

  const login = async (payload: OdooAuthPayload) => {
    loading.value = true

    try {
      const session = await authenticateOdoo(payload)
      setUserSession(session)
      await ensureCompanies()
    } finally {
      loading.value = false
    }
  }

  const ensureCompanies = async () => {
    if (!isAuthenticated.value) {
      companies.value = []
      return
    }

    const response = await fetchOdooCompanies()
    const safeCompanies = Array.isArray(response.companies) ? response.companies : []
    companies.value = safeCompanies

    if (
      typeof response.active_company_id === 'number' &&
      !Number.isNaN(response.active_company_id)
    ) {
      activeCompanyId.value = response.active_company_id
    }

    if (!activeCompanyId.value && safeCompanies.length > 0) {
      activeCompanyId.value = safeCompanies[0]?.id ?? null
    }

    persistSession()
  }

  const setActiveCompany = (companyId: number) => {
    activeCompanyId.value = companyId
    persistSession()
  }

  const logout = () => {
    user.value = null
    companies.value = []
    activeCompanyId.value = null
    persistSession()
  }

  return {
    user,
    companies,
    activeCompanyId,
    loading,
    isAuthenticated,
    login,
    logout,
    ensureCompanies,
    setActiveCompany,
  }
})
