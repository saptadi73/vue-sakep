import { createRouter, createWebHistory } from 'vue-router'
import PtJarBalanceSheetView from '@/views/ptJar/PtJarBalanceSheetView.vue'
import PtJarPnlView from '@/views/ptJar/PtJarPnlView.vue'
import PtJarLedgerView from '@/views/ptJar/PtJarLedgerView.vue'
import PtBprsBalanceSheetView from '@/views/ptBprs/PtBprsBalanceSheetView.vue'
import PtBprsPnlView from '@/views/ptBprs/PtBprsPnlView.vue'
import PtBprsGlView from '@/views/ptBprs/PtBprsGlView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/reports/pt-jar/balance-sheet',
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
  ],
})

export default router
