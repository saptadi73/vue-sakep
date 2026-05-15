import { createRouter, createWebHistory } from 'vue-router'
import PtJarBalanceSheetView from '@/views/ptJar/PtJarBalanceSheetView.vue'
import PtJarPnlView from '@/views/ptJar/PtJarPnlView.vue'
import PtJarLedgerView from '@/views/ptJar/PtJarLedgerView.vue'
import PtJarTrialBalanceView from '@/views/ptJar/PtJarTrialBalanceView.vue'
import PtBprsBalanceSheetView from '@/views/ptBprs/PtBprsBalanceSheetView.vue'
import PtBprsPnlView from '@/views/ptBprs/PtBprsPnlView.vue'
import PtBprsGlView from '@/views/ptBprs/PtBprsGlView.vue'
import PtBprsTrialBalanceView from '@/views/ptBprs/PtBprsTrialBalanceView.vue'
import PtUspsKanjabungBalanceSheetView from '@/views/ptUspsKanjabung/PtUspsKanjabungBalanceSheetView.vue'
import PtUspsKanjabungPnlView from '@/views/ptUspsKanjabung/PtUspsKanjabungPnlView.vue'
import PtUspsKanjabungTrialBalanceView from '@/views/ptUspsKanjabung/PtUspsKanjabungTrialBalanceView.vue'
import OdooLoginView from '@/views/odoo/OdooLoginView.vue'
import OdooFinanceReportsView from '@/views/odoo/OdooFinanceReportsView.vue'
import ConsolidationConfigView from '@/views/consolidation/ConsolidationConfigView.vue'
import ConsolidationPreviewView from '@/views/consolidation/ConsolidationPreviewView.vue'
import ConsolidationConfigHelpView from '@/views/help/ConsolidationConfigHelpView.vue'
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
      component: PtJarBalanceSheetView,
    },
    {
      path: '/reports/pt-jar/pnl',
      name: 'pt-jar-pnl',
      component: PtJarPnlView,
    },
    {
      path: '/reports/pt-jar/ledger',
      name: 'pt-jar-ledger',
      component: PtJarLedgerView,
    },
    {
      path: '/reports/pt-jar/trial-balance',
      name: 'pt-jar-trial-balance',
      component: PtJarTrialBalanceView,
    },
    {
      path: '/reports/pt-bprs/balance-sheet',
      name: 'pt-bprs-balance-sheet',
      component: PtBprsBalanceSheetView,
    },
    {
      path: '/reports/pt-bprs/pnl',
      name: 'pt-bprs-pnl',
      component: PtBprsPnlView,
    },
    {
      path: '/reports/pt-bprs/gl',
      name: 'pt-bprs-gl',
      component: PtBprsGlView,
    },
    {
      path: '/reports/pt-bprs/trial-balance',
      name: 'pt-bprs-trial-balance',
      component: PtBprsTrialBalanceView,
    },
    {
      path: '/reports/pt-uspps-kanjabung/balance-sheet',
      name: 'pt-uspps-kanjabung-balance-sheet',
      component: PtUspsKanjabungBalanceSheetView,
    },
    {
      path: '/reports/pt-uspps-kanjabung/pnl',
      name: 'pt-uspps-kanjabung-pnl',
      component: PtUspsKanjabungPnlView,
    },
    {
      path: '/reports/pt-uspps-kanjabung/trial-balance',
      name: 'pt-uspps-kanjabung-trial-balance',
      component: PtUspsKanjabungTrialBalanceView,
    },
    {
      path: '/odoo/login',
      name: 'odoo-login',
      component: OdooLoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/odoo/reports/:companyCode(kan-jabung|pt-jgi)',
      name: 'odoo-reports',
      component: OdooFinanceReportsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/consolidation/config',
      name: 'consolidation-config',
      component: ConsolidationConfigView,
      meta: { requiresAuth: true },
    },
    {
      path: '/consolidation/preview',
      name: 'consolidation-preview',
      component: ConsolidationPreviewView,
      meta: { requiresAuth: true },
    },
    {
      path: '/help/consolidation-config',
      name: 'help-consolidation-config',
      component: ConsolidationConfigHelpView,
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
