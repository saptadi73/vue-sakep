<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="help-page">
    <header class="hero">
      <p class="eyebrow">Help Center</p>
      <h1>Panduan Update Config JSON Konsolidasi</h1>
      <p class="subtitle">
        Dokumentasi ini membantu tim update config konsolidasi dengan aman lewat UI tabel (seperti
        spreadsheet) atau mode JSON.
      </p>
    </header>

    <section class="card">
      <h2>Route Penting</h2>
      <div class="link-grid">
        <RouterLink to="/consolidation/config" class="link-pill">/consolidation/config</RouterLink>
        <RouterLink to="/consolidation/preview" class="link-pill"
          >/consolidation/preview</RouterLink
        >
      </div>
    </section>

    <section class="card">
      <h2>Langkah Cepat Update Config</h2>
      <ol>
        <li>Buka halaman Config di menu Konsolidasi atau route /consolidation/config.</li>
        <li>Pilih Mode Tabel untuk edit baris-kolom seperti Excel.</li>
        <li>Lengkapi sheet Entities, COA Mappings, Report Tree, dan Elimination Rules.</li>
        <li>Klik Simpan Config untuk validasi dan simpan ke localStorage.</li>
        <li>Gunakan Export JSON untuk backup atau commit ke repository.</li>
        <li>Jika ada file revisi dari tim lain, gunakan Import JSON.</li>
        <li>Buka halaman Preview, lalu klik Hitung Ulang Preview untuk validasi hasil.</li>
      </ol>
    </section>

    <section class="card">
      <h2>Checklist Isi Config</h2>
      <ul>
        <li>Entities: id unik, source benar, enabled sesuai scope konsolidasi.</li>
        <li>COA Mappings: sourceAccount, consolidationKey, section, sign sudah konsisten.</li>
        <li>Report Tree: parent-child dan order sudah sesuai struktur laporan final.</li>
        <li>Elimination Rules: debitKey/creditKey valid, method benar, percentage tepat.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Validasi di Halaman Preview</h2>
      <ul>
        <li>Line Result: cek nilai before, elimination, after per key.</li>
        <li>Elimination Rules Applied: pastikan rule yang diharapkan benar-benar terpakai.</li>
        <li>Source Summary: cek mapped vs unmapped setiap entitas.</li>
        <li>Top Unmapped Accounts: akun yang belum termapping.</li>
        <li>Suggested Mapping Draft: gunakan suggestion sebagai draft, lalu review kembali.</li>
      </ul>
    </section>

    <section class="card warning">
      <h2>Catatan Penting</h2>
      <ul>
        <li>Mode Tabel dan Mode JSON memakai draft data yang sama dan selalu sinkron.</li>
        <li>Perubahan belum permanen sampai klik Simpan Config.</li>
        <li>Untuk perubahan besar, selalu Export JSON sebagai snapshot sebelum update.</li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.help-page {
  display: grid;
  gap: 1rem;
}

.hero {
  border-radius: 18px;
  padding: 1rem 1.1rem;
  background: linear-gradient(130deg, rgba(20, 52, 94, 0.95), rgba(20, 109, 117, 0.88));
  color: #f1f7ff;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
}

h1 {
  margin: 0.3rem 0;
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}

.subtitle {
  margin: 0;
  color: #d7ebff;
}

.card {
  border-radius: 14px;
  border: 1px solid rgba(14, 55, 93, 0.16);
  background: #fff;
  padding: 0.9rem;
}

.card h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #173d64;
}

.card ol,
.card ul {
  margin: 0;
  padding-left: 1rem;
  color: #2f465f;
}

.link-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.link-pill {
  display: inline-block;
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(23, 66, 109, 0.28);
  background: #f3f9ff;
  text-decoration: none;
  color: #1e4a74;
  font-weight: 600;
}

.warning {
  border-color: rgba(165, 119, 38, 0.33);
  background: #fffaf0;
}

@media (max-width: 960px) {
  .help-page {
    gap: 0.8rem;
  }
}
</style>
