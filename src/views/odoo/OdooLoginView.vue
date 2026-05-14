<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOdooAuthStore } from '@/stores/odooAuth'
import { getOdooServerUrl, setOdooServerUrl } from '@/services/odooService'

const router = useRouter()
const route = useRoute()
const authStore = useOdooAuthStore()

const form = reactive({
  serverUrl: getOdooServerUrl() || import.meta.env.VITE_ODOO_API_BASE_URL || '',
  login: '',
  password: '',
  db: import.meta.env.VITE_ODOO_DB ?? '',
})

const errorMessage = ref('')

const submitLogin = async () => {
  errorMessage.value = ''

  try {
    if (!form.serverUrl.trim()) {
      throw new Error('URL server Odoo wajib diisi')
    }

    setOdooServerUrl(form.serverUrl)

    await authStore.login({
      login: form.login,
      password: form.password,
      db: form.db,
    })

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    await router.push(redirect || '/odoo/reports/kan-jabung')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login gagal'
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-card">
      <p class="eyebrow">Odoo Finance Reports</p>
      <h1>Login LAPORAN KEUANGAN SAKEP</h1>
      <p class="subtitle">Masuk untuk mengakses Laporan Holding dan Anak Perusahaan</p>

      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          URL Server Odoo
          <input
            v-model="form.serverUrl"
            type="url"
            placeholder="https://odoo.company.com"
            required
          />
        </label>

        <label>
          Email / Username Odoo
          <input v-model="form.login" type="text" autocomplete="username" required />
        </label>

        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="current-password" required />
        </label>

        <label>
          Database
          <input v-model="form.db" type="text" placeholder="kanjabung_MRP" required />
        </label>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <button type="submit" :disabled="authStore.loading">
          {{ authStore.loading ? 'Memproses...' : 'Login ke Odoo' }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 2.2rem);
  display: grid;
  place-items: center;
}

.login-card {
  width: min(560px, 100%);
  border-radius: 24px;
  padding: 1.3rem;
  background:
    linear-gradient(135deg, rgba(14, 42, 79, 0.95), rgba(14, 90, 95, 0.88)),
    radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.08), transparent 35%);
  color: #f4f8ff;
  box-shadow: 0 24px 48px rgba(12, 29, 57, 0.3);
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.74rem;
  opacity: 0.9;
}

h1 {
  margin: 0.3rem 0;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2.2rem);
}

.subtitle {
  margin: 0;
  opacity: 0.85;
}

.login-form {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
}

.login-form label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.86rem;
}

.login-form input {
  min-height: 42px;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(191, 215, 255, 0.45);
  border-radius: 10px;
  color: #0f2a4f;
  background: #f7fbff;
  font: inherit;
}

.error-message {
  margin: 0;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 191, 191, 0.9);
  background: rgba(122, 12, 12, 0.34);
  color: #ffe5e5;
}

.login-form button {
  min-height: 44px;
  border: none;
  border-radius: 12px;
  font: inherit;
  font-weight: 700;
  color: #f6fbff;
  background: linear-gradient(90deg, #2288d2, #2ab494);
  cursor: pointer;
}

.login-form button:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
