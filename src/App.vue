<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const companyMenus = [
  {
    company: 'PT. JAR (JAB Mart)',
    code: 'PT-JAR',
    links: [
      {
        to: '/reports/pt-jar/balance-sheet',
        label: 'Balance Sheet',
        key: 'balance-sheet',
      },
      {
        to: '/reports/pt-jar/pnl',
        label: 'Profit and Loss',
        key: 'pnl',
      },
    ],
  },
  {
    company: 'PT. BPRS',
    code: 'PT-BPRS',
    links: [
      {
        to: '/reports/pt-bprs/balance-sheet',
        label: 'Neraca Harian',
        key: 'balance-sheet',
      },
      {
        to: '/reports/pt-bprs/pnl',
        label: 'Laba Rugi Harian',
        key: 'pnl',
      },
    ],
  },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="app-shell">
    <aside class="side-panel">
      <div>
        <p class="brand-kicker">SAK EP Consolidation</p>
        <h1>Portal Pelaporan Keuangan</h1>
        <p class="desc">Multi-sumber laporan anak perusahaan untuk standardisasi grup.</p>
      </div>

      <nav class="company-nav">
        <section v-for="company in companyMenus" :key="company.code" class="company-block">
          <p class="company-title">{{ company.company }}</p>
          <RouterLink
            v-for="link in company.links"
            :key="link.key"
            :to="link.to"
            class="menu-link"
            :class="{ active: isActive(link.to) }"
          >
            {{ link.label }}
          </RouterLink>
        </section>
      </nav>
    </aside>

    <main class="content-panel">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  min-height: 100vh;
  gap: 1rem;
  padding: 1.1rem;
}

.side-panel {
  background: linear-gradient(180deg, #0b2546 0%, #133b6d 100%);
  color: #edf4ff;
  border-radius: 22px;
  padding: 1.2rem;
  display: grid;
  align-content: start;
  gap: 1.2rem;
  box-shadow: 0 22px 50px rgba(9, 28, 57, 0.26);
}

.brand-kicker {
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: #8ab8f5;
}

h1 {
  margin: 0.45rem 0;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2vw, 1.9rem);
  line-height: 1.2;
}

.desc {
  margin: 0;
  color: #d6e6ff;
  font-size: 0.92rem;
}

.company-nav {
  display: grid;
  gap: 0.8rem;
}

.company-block {
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 14px;
  padding: 0.65rem;
  display: grid;
  gap: 0.45rem;
}

.company-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.9rem;
}

.menu-link {
  display: block;
  padding: 0.52rem 0.62rem;
  border-radius: 10px;
  color: #dce9fa;
  text-decoration: none;
  transition:
    background-color 180ms ease,
    transform 180ms ease;
}

.menu-link:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(2px);
}

.menu-link.active {
  background: #f5f9ff;
  color: #11325b;
  font-weight: 700;
}

.content-panel {
  border-radius: 22px;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line-soft);
  box-shadow: 0 18px 45px rgba(18, 49, 89, 0.14);
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .side-panel,
  .content-panel {
    border-radius: 16px;
  }
}
</style>
