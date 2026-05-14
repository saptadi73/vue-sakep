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
  ],
})

export default router
