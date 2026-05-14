import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authenticateOdoo, fetchOdooCompanies } from '@/services/odooService'
import type { OdooAuthPayload, OdooCompany, OdooUserSession } from '@/types/odoo'

const STORAGE_KEY = 'odoo:auth-session'

interface PersistedAuthSession {
  user: OdooUserSession
  activeCompanyId: number | null
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
    return JSON.parse(raw) as PersistedAuthSession
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

  const setUserSession = (session: OdooUserSession) => {
    user.value = session

    if (session.company_id) {
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
    companies.value = response.companies

    if (response.active_company_id) {
      activeCompanyId.value = response.active_company_id
    }

    if (!activeCompanyId.value && response.companies.length > 0) {
      activeCompanyId.value = response.companies[0]?.id ?? null
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
