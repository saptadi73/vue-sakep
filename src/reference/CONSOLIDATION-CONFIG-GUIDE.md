# Consolidation Config Guide

Panduan ini menjelaskan langkah implementasi tahap awal konsolidasi: agregasi lintas entitas, lalu eliminasi.

## Urutan Proses

1. Normalisasi data report dari setiap entitas ke format baris yang seragam.
2. Mapping COA source ke consolidationKey.
3. Agregasi berdasarkan consolidationKey dan periode.
4. Terapkan eliminationRules.
5. Roll-up ke reportTree untuk hasil tampilan final.

## Struktur JSON Wajib

File default berada di src/reference/consolidation-config.json.

Field utama:

- version: versi schema config.
- groupCurrency: mata uang grup.
- entities: daftar entitas sumber data.
- coaMappings: aturan map COA per entitas.
- reportTree: struktur parent-child line report konsolidasi.
- eliminationRules: aturan eliminasi intercompany.

## Cara Edit dari UI Frontend

1. Buka menu Konsolidasi > Config Aggregasi & Eliminasi.
2. Route: /consolidation/config.
3. Edit JSON di editor.
4. Klik Simpan Config untuk validasi + simpan ke browser localStorage.
5. Gunakan Export JSON untuk backup/commit, dan Import JSON untuk memuat file revisi.
6. Buka menu Konsolidasi > Preview Agregasi & Eliminasi (route: /consolidation/preview).
7. Pilih section report lalu klik Hitung Ulang Preview untuk melihat before/elimination/after.
8. Cek Suggested Mapping Draft untuk akun yang belum termapping.
9. Klik Tambahkan Suggestion ke Config untuk menambahkan draft mapping ke config aktif.

## Apa yang Perlu Ditambahkan oleh Tim

1. Tambah entities sesuai seluruh anak perusahaan yang masuk scope konsolidasi.
2. Lengkapi coaMappings sampai semua akun source penting memiliki consolidationKey.
3. Definisikan reportTree final sesuai format laporan manajemen/audit.
4. Definisikan eliminationRules untuk akun intercompany (piutang-hutang, sales-cogs, dll).
5. Tetapkan convention consolidationKey agar konsisten antar tim.

## Output Preview yang Perlu Dicek

- Line Result: nilai per key sebelum dan sesudah eliminasi.
- Elimination Rules Applied: rule mana saja yang benar-benar terpakai.
- Source Summary: jumlah row termapping vs belum termapping per entitas.
- Top Unmapped Accounts: daftar akun yang masih belum punya rule mapping.
- Suggested Mapping Draft: rekomendasi mapping otomatis berdasarkan prefix akun dan kata kunci deskripsi.

## Rekomendasi Governance

- Satu perubahan mapping harus disertai contoh akun sumber dan expected hasil konsolidasi.
- Lakukan review berpasangan untuk perubahan eliminationRules karena berdampak material.
- Simpan snapshot config per periode pelaporan agar rekonsiliasi historis mudah.
