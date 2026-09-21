import { createRouter, createWebHistory } from 'vue-router'
import { useOdooAuthStore } from '@/stores/odooAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/odoo/login',
    },
    {
      path: '/reports/pt-jar/balance-sheet',
      name: 'pt-jar-balance-sheet',
      component: () => import('@/views/ptJar/PtJarBalanceSheetView.vue'),
    },
    {
      path: '/reports/pt-jar/pnl',
      name: 'pt-jar-pnl',
      component: () => import('@/views/ptJar/PtJarPnlView.vue'),
    },
    {
      path: '/reports/pt-jar/ledger',
      name: 'pt-jar-ledger',
      component: () => import('@/views/ptJar/PtJarLedgerView.vue'),
    },
    {
      path: '/reports/pt-jar/trial-balance',
      name: 'pt-jar-trial-balance',
      component: () => import('@/views/ptJar/PtJarTrialBalanceView.vue'),
    },
    {
      path: '/reports/pt-bprs/balance-sheet',
      name: 'pt-bprs-balance-sheet',
      component: () => import('@/views/ptBprs/PtBprsBalanceSheetView.vue'),
    },
    {
      path: '/reports/pt-bprs/pnl',
      name: 'pt-bprs-pnl',
      component: () => import('@/views/ptBprs/PtBprsPnlView.vue'),
    },
    {
      path: '/reports/pt-bprs/gl',
      name: 'pt-bprs-gl',
      component: () => import('@/views/ptBprs/PtBprsGlView.vue'),
    },
    {
      path: '/reports/pt-bprs/trial-balance',
      name: 'pt-bprs-trial-balance',
      component: () => import('@/views/ptBprs/PtBprsTrialBalanceView.vue'),
    },
    {
      path: '/reports/pt-uspps-kanjabung/balance-sheet',
      name: 'pt-uspps-kanjabung-balance-sheet',
      component: () => import('@/views/ptUspsKanjabung/PtUspsKanjabungBalanceSheetView.vue'),
    },
    {
      path: '/reports/pt-uspps-kanjabung/pnl',
      name: 'pt-uspps-kanjabung-pnl',
      component: () => import('@/views/ptUspsKanjabung/PtUspsKanjabungPnlView.vue'),
    },
    {
      path: '/reports/pt-uspps-kanjabung/trial-balance',
      name: 'pt-uspps-kanjabung-trial-balance',
      component: () => import('@/views/ptUspsKanjabung/PtUspsKanjabungTrialBalanceView.vue'),
    },
    {
      path: '/odoo/login',
      name: 'odoo-login',
      component: () => import('@/views/odoo/OdooLoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/odoo/reports/:companyCode(kan-jabung|pt-jgi)',
      name: 'odoo-reports',
      component: () => import('@/views/odoo/OdooFinanceReportsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/consolidation/config',
      name: 'consolidation-config',
      component: () => import('@/views/consolidation/ConsolidationConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/consolidation/preview',
      name: 'consolidation-preview',
      component: () => import('@/views/consolidation/ConsolidationPreviewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/consolidation/reports',
      name: 'consolidation-reports',
      component: () => import('@/views/consolidation/ConsolidationReportsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/help/consolidation-config',
      name: 'help-consolidation-config',
      component: () => import('@/views/help/ConsolidationConfigHelpView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useOdooAuthStore()
  const isDashboardRoute =
    to.path.startsWith('/reports') ||
    to.path.startsWith('/odoo/reports') ||
    to.path.startsWith('/consolidation') ||
    to.path.startsWith('/help')

  if (to.path === '/') {
    return authStore.isAuthenticated ? '/odoo/reports/kan-jabung' : '/odoo/login'
  }

  if (isDashboardRoute && !authStore.isAuthenticated) {
    return {
      path: '/odoo/login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      path: '/odoo/login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return '/odoo/reports/kan-jabung'
  }

  return true
})

export default router
