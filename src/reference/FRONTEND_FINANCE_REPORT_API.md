# Frontend Finance Reports API

Dokumentasi ini disiapkan untuk frontend Vue.js yang akan memakai API laporan keuangan dari modul `account_dynamic_reports_jabung`.

Fokus dokumen ini:

- login authentication via JSON-RPC
- akses multi-company
- Balance Sheet
- Profit and Loss
- Trial Balance
- General Ledger
- drill down dari BS/PnL ke GL
- drill down dari GL ke Journal Entry

## Ringkasan Endpoint

| Endpoint | Method | Auth | Tujuan |
|---|---|---|---|
| `/api/accounting/authenticate` | `POST` | public | login dan membuat session Odoo |
| `/api/accounting/companies` | `POST` | user | daftar company yang bisa diakses user |
| `/api/accounting/reports/balance-sheet` | `POST` | user | laporan Balance Sheet |
| `/api/accounting/reports/profit-loss` | `POST` | user | laporan Profit and Loss |
| `/api/accounting/reports/trial-balance` | `POST` | user | laporan Trial Balance |
| `/api/accounting/reports/general-ledger` | `POST` | user | laporan General Ledger summary dan detail |
| `/api/accounting/journal-entry` | `POST` | user | detail journal entry dari GL |

## Base URL

Contoh base URL Odoo:

```text
https://your-odoo-host
```

Semua endpoint di bawah menggunakan base URL tersebut.

## Authentication Model

Frontend menggunakan session authentication bawaan Odoo.

Flow:

1. Frontend memanggil `/api/accounting/authenticate`.
2. Odoo mengembalikan `session_id`.
3. Browser/client menyimpan cookie session.
4. Request berikutnya ke endpoint `auth="user"` memakai session yang sama.

Untuk Vue.js yang berbeda domain, request harus memakai:

```js
credentials: "include"
```

Server juga perlu disiapkan untuk CORS dan cookie policy jika frontend beda domain.

Untuk deployment saat ini, API finance reports membuka CORS default untuk:

```text
https://sakep.kanjabung.com
```

Backend juga mengirim:

```text
Access-Control-Allow-Credentials: true
```

Jika origin frontend berubah, set environment variable Odoo:

```text
FINANCE_REPORTS_CORS_ORIGIN=https://sakep.kanjabung.com
```

Untuk lebih dari satu origin, pisahkan dengan koma:

```text
FINANCE_REPORTS_CORS_ORIGIN=https://sakep.kanjabung.com,https://frontend-lain.kanjabung.com
```

Jika benar-benar ingin membuka untuk semua origin, isi `*`. Karena endpoint memakai cookie session, backend akan memantulkan origin request, bukan mengirim wildcard langsung.

## Halaman Login Frontend

Frontend perlu menyediakan halaman login sendiri sebelum user membuka dashboard finance reports.

Field minimum pada halaman login:

| Field | Type | Keterangan |
|---|---:|---|
| `login` | string | Email/username user Odoo. |
| `password` | string | Password user Odoo. |
| `db` | string | Nama database Odoo. Bisa dibuat hidden/default jika hanya memakai satu database. |

Tombol login memanggil endpoint:

```text
POST /api/accounting/authenticate
```

Contoh request dari halaman login:

```json
{
  "params": {
    "login": "finance@example.com",
    "password": "secret",
    "db": "kanjabung_MRP"
  }
}
```

Jika response `status = "success"`, frontend dapat mengarahkan user ke halaman laporan dan menyimpan data user seperlunya di state aplikasi:

- `uid`
- `name`
- `login`
- `company_id`
- `company_name`
- `company_ids`

Session login utama tetap disimpan oleh browser sebagai cookie Odoo. Karena itu request berikutnya wajib memakai `credentials: "include"`.

Contoh implementasi login:

```js
async function loginToOdoo({ login, password, db }) {
  const response = await fetch("/api/accounting/authenticate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      params: { login, password, db },
    }),
  })

  const json = await response.json()
  if (json.status === "error") {
    throw new Error(json.message || "Login gagal")
  }

  return json.data
}
```

Contoh alur di halaman login Vue:

```js
async function submitLogin() {
  loading.value = true
  errorMessage.value = ""

  try {
    const user = await loginToOdoo({
      login: form.login,
      password: form.password,
      db: form.db,
    })

    authStore.setUser(user)
    router.push("/finance/reports")
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
```

Catatan UI login:

- Tampilkan pesan error jika credential salah.
- Disable tombol login saat request sedang berjalan.
- Jangan simpan password di localStorage/sessionStorage.
- Jika memakai satu database tetap, field `db` bisa diisi otomatis dari config frontend.
- Setelah login sukses, panggil `/api/accounting/companies` untuk mengisi dropdown company pada halaman report.
- Jika request report mengembalikan session expired/unauthorized dari Odoo, arahkan user kembali ke halaman login.

## JSON-RPC Format

Gunakan format:

```json
{
  "params": {
    "key": "value"
  }
}
```

Controller juga menerima payload langsung tanpa wrapper `params`, tetapi frontend disarankan selalu memakai `params` agar konsisten.

Response sukses selalu memakai pola:

```json
{
  "status": "success",
  "data": {}
}
```

Response error:

```json
{
  "status": "error",
  "message": "Error message"
}
```

## Login

### `POST /api/accounting/authenticate`

#### Request

```json
{
  "params": {
    "login": "user@example.com",
    "password": "secret",
    "db": "kanjabung_MRP"
  }
}
```

#### Response

```json
{
  "status": "success",
  "message": "Authentication successful",
  "data": {
    "uid": 12,
    "session_id": "session-id",
    "db": "kanjabung_MRP",
    "login": "user@example.com",
    "name": "Finance User",
    "company_id": 1,
    "company_name": "Company Utama",
    "company_ids": [1, 2, 3]
  }
}
```

## Companies

### `POST /api/accounting/companies`

Mengambil company yang boleh dipakai user untuk filter laporan.

#### Request

```json
{
  "params": {}
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "active_company_id": 1,
    "companies": [
      {
        "id": 1,
        "name": "Company Utama",
        "currency_id": 12
      }
    ]
  }
}
```

## Parameter Umum Report

Parameter ini dipakai oleh Balance Sheet, Profit and Loss, Trial Balance, dan General Ledger.

| Field | Type | Wajib | Keterangan |
|---|---:|---:|---|
| `company_id` | integer | tidak | Satu company. Jika `company_ids` dikirim, field ini boleh tidak dikirim. |
| `company_ids` | array integer | tidak | Multi-company. User harus punya akses ke semua company yang dikirim. |
| `date_from` | string `YYYY-MM-DD` | disarankan | Tanggal awal. |
| `date_to` | string `YYYY-MM-DD` | disarankan | Tanggal akhir. |
| `date_range` | string | tidak | Alternatif jika tidak kirim tanggal manual, contoh `this_financial_year`. |
| `financial_year` | string | tidak | Default API: `january_december`. |
| `target_move` | string | tidak | `posted` atau `all`. |
| `journal_ids` | array integer | tidak | Filter journal. |
| `analytic_ids` | array integer | tidak | Filter analytic account. |
| `analytic_tag_ids` | array integer | tidak | Filter analytic tag. |

Jika `company_id` dan `company_ids` kosong, backend memakai active company session.

## Balance Sheet

### `POST /api/accounting/reports/balance-sheet`

#### Request

```json
{
  "params": {
    "company_ids": [1],
    "date_from": "2026-01-01",
    "date_to": "2026-12-31",
    "target_move": "posted",
    "debit_credit": true
  }
}
```

#### Response penting

```json
{
  "status": "success",
  "data": {
    "meta": {
      "report_type": "balance_sheet",
      "company_ids": [1],
      "company_name": "Company Utama",
      "date_from": "2026-01-01",
      "date_to": "2026-12-31"
    },
    "currency_id": 12,
    "lines": [
      {
        "name": "Assets",
        "type": "report",
        "balance": 150000000,
        "debit": 150000000,
        "credit": 0,
        "level": 1,
        "drilldown": {
          "type": "general_ledger",
          "endpoint": "/api/accounting/reports/general-ledger",
          "payload": {
            "company_ids": [1],
            "date_from": "2026-01-01",
            "date_to": "2026-12-31",
            "account_ids": [101, 102],
            "target_moves": "posted_only",
            "initial_balance": true,
            "include_details": true
          }
        }
      }
    ]
  }
}
```

Setiap line yang punya akun akan membawa `drilldown`. Jika `drilldown = false`, line tersebut hanya header/total yang tidak bisa dibuka ke GL.

## Profit and Loss

### `POST /api/accounting/reports/profit-loss`

Payload dan response sama seperti Balance Sheet. Perbedaannya `meta.report_type = "profit_loss"` dan struktur line mengikuti konfigurasi Profit and Loss.

#### Request

```json
{
  "params": {
    "company_ids": [1, 2],
    "date_from": "2026-01-01",
    "date_to": "2026-03-31",
    "target_move": "posted"
  }
}
```

## Trial Balance

### `POST /api/accounting/reports/trial-balance`

#### Parameter tambahan

| Field | Type | Default | Keterangan |
|---|---:|---:|---|
| `account_ids` | array integer | kosong | Filter akun tertentu. |
| `display_accounts` | string | `balance_not_zero` | Bisa `all` atau `balance_not_zero`. |
| `show_hierarchy` | boolean | `false` | Menampilkan struktur hierarki kode akun. |
| `strict_range` | boolean | `false` | Mengikuti opsi strict range report existing. |

#### Request

```json
{
  "params": {
    "company_ids": [1],
    "date_from": "2026-01-01",
    "date_to": "2026-12-31",
    "target_move": "posted",
    "display_accounts": "balance_not_zero"
  }
}
```

#### Response penting

```json
{
  "status": "success",
  "data": {
    "meta": {
      "report_type": "trial_balance",
      "company_ids": [1]
    },
    "lines": [
      {
        "id": 101,
        "code": "110101",
        "name": "Cash",
        "initial_debit": 0,
        "initial_credit": 0,
        "initial_balance": 0,
        "debit": 1000000,
        "credit": 250000,
        "balance": 750000,
        "ending_debit": 1000000,
        "ending_credit": 250000,
        "ending_balance": 750000
      }
    ],
    "retained": {},
    "subtotal": {}
  }
}
```

## General Ledger

### `POST /api/accounting/reports/general-ledger`

Endpoint ini punya dua mode:

- summary akun, jika tidak mengirim `account_id`
- detail move line akun, jika mengirim `account_id`

#### Parameter tambahan

| Field | Type | Default | Keterangan |
|---|---:|---:|---|
| `account_id` | integer | kosong | Akun yang dibuka detailnya. |
| `account_ids` | array integer | kosong | Filter beberapa akun untuk summary. |
| `account_tag_ids` | array integer | kosong | Filter account tag. |
| `partner_ids` | array integer | kosong | Filter partner. |
| `sort_accounts_by` | string | `date` | `date` atau `journal`. |
| `display_accounts` | string | `balance_not_zero` | `all` atau `balance_not_zero`. |
| `initial_balance` | boolean | `true` | Sertakan opening balance. |
| `include_details` | boolean | `false` | Sertakan detail line dalam konteks report. |
| `page` | integer | `1` | Halaman detail move line saat `account_id` dikirim. |
| `limit` | integer | `200` | Maksimal `1000`. |

### GL Summary

#### Request

```json
{
  "params": {
    "company_ids": [1],
    "date_from": "2026-01-01",
    "date_to": "2026-12-31",
    "target_move": "posted",
    "include_details": false
  }
}
```

#### Response penting

```json
{
  "status": "success",
  "data": {
    "meta": {
      "report_type": "general_ledger",
      "company_ids": [1]
    },
    "accounts": [
      {
        "id": 101,
        "code": "110101",
        "name": "Cash",
        "debit": 1000000,
        "credit": 250000,
        "balance": 750000,
        "drilldown": {
          "type": "general_ledger_lines",
          "endpoint": "/api/accounting/reports/general-ledger",
          "payload": {
            "account_id": 101,
            "include_details": true
          }
        }
      }
    ]
  }
}
```

Catatan: payload drilldown dari GL summary hanya berisi `account_id` dan `include_details`. Frontend sebaiknya merge payload tersebut dengan filter report aktif, misalnya `company_ids`, `date_from`, dan `date_to`.

### GL Detail Account

#### Request

```json
{
  "params": {
    "company_ids": [1],
    "date_from": "2026-01-01",
    "date_to": "2026-12-31",
    "target_move": "posted",
    "account_id": 101,
    "initial_balance": true,
    "include_details": true,
    "page": 1,
    "limit": 200
  }
}
```

#### Response penting

```json
{
  "status": "success",
  "data": {
    "page": 1,
    "limit": 200,
    "offset": 0,
    "total": 35,
    "lines": [
      {
        "lid": 9001,
        "account_id": 101,
        "ldate": "2026-02-01",
        "lcode": "BNK1",
        "partner_name": "Customer A",
        "move_id": 3001,
        "move_name": "BNK1/2026/0001",
        "lname": "Payment",
        "debit": 1000000,
        "credit": 0,
        "balance": 1000000,
        "journal_entry": {
          "type": "journal_entry",
          "endpoint": "/api/accounting/journal-entry",
          "payload": {
            "move_id": 3001
          }
        }
      }
    ]
  }
}
```

Line `Initial Balance` dan `Ending Balance` tidak punya `move_id`, sehingga `journal_entry = false`.

## Journal Entry

### `POST /api/accounting/journal-entry`

Mengambil detail journal entry dari `move_id`.

#### Request

```json
{
  "params": {
    "move_id": 3001
  }
}
```

#### Response penting

```json
{
  "status": "success",
  "data": {
    "id": 3001,
    "name": "BNK1/2026/0001",
    "date": "2026-02-01",
    "ref": "Payment Customer A",
    "state": "posted",
    "journal_id": 7,
    "journal_name": "Bank",
    "company_id": 1,
    "company_name": "Company Utama",
    "line_ids": [
      {
        "id": 9001,
        "date": "2026-02-01",
        "account_id": 101,
        "account_code": "110101",
        "account_name": "Cash",
        "partner_id": 25,
        "partner_name": "Customer A",
        "name": "Payment",
        "debit": 1000000,
        "credit": 0,
        "balance": 1000000,
        "amount_currency": 1000000,
        "currency_id": 12
      }
    ]
  }
}
```

## Flow Drill Down Frontend

### Flow dari BS/PnL ke GL

1. Frontend memanggil Balance Sheet atau Profit and Loss.
2. Render `data.lines`.
3. Untuk setiap line, cek `line.drilldown`.
4. Jika `line.drilldown` bukan `false`, tampilkan tombol atau row clickable.
5. Saat user klik, POST `line.drilldown.payload` ke `line.drilldown.endpoint`.
6. Render response GL.

Contoh:

```js
async function openFinancialLine(line) {
  if (!line.drilldown) return

  const response = await fetch(line.drilldown.endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: line.drilldown.payload }),
  })

  return response.json()
}
```

### Flow dari GL Summary ke GL Detail

1. Frontend memanggil `/api/accounting/reports/general-ledger`.
2. Render `data.accounts`.
3. Saat user klik akun, kirim request baru ke endpoint yang sama dengan `account_id`.
4. Gunakan filter aktif yang sama dengan report utama.

Contoh merge payload:

```js
const activeFilters = {
  company_ids: [1],
  date_from: "2026-01-01",
  date_to: "2026-12-31",
  target_move: "posted",
}

async function openGlAccount(account) {
  const payload = {
    ...activeFilters,
    ...account.drilldown.payload,
    page: 1,
    limit: 200,
  }

  const response = await fetch(account.drilldown.endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: payload }),
  })

  return response.json()
}
```

### Flow dari GL Detail ke Journal Entry

1. Frontend render `data.lines` dari GL detail.
2. Untuk line yang punya `line.journal_entry`, tampilkan tombol Journal.
3. Saat user klik, POST `line.journal_entry.payload` ke `/api/accounting/journal-entry`.
4. Render modal/detail journal entry dari response.

Contoh:

```js
async function openJournal(line) {
  if (!line.journal_entry) return

  const response = await fetch(line.journal_entry.endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: line.journal_entry.payload }),
  })

  return response.json()
}
```

## Contoh Helper JSON-RPC Vue

```js
export async function odooJsonRpc(endpoint, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params }),
  })

  const json = await response.json()
  if (json.status === "error") {
    throw new Error(json.message || "Odoo API error")
  }
  return json.data
}
```

## Catatan Implementasi UI

- Simpan filter aktif report di state Vue agar bisa dipakai ulang saat drilldown.
- Gunakan `meta.company_name`, `meta.date_from`, dan `meta.date_to` sebagai header report.
- Gunakan `line.level` atau panjang `line.list_len` untuk indentasi tree BS/PnL.
- Jangan tampilkan tombol drilldown jika `drilldown = false`.
- Jangan tampilkan tombol journal jika `journal_entry = false`.
- Untuk GL detail, pakai pagination dari `page`, `limit`, dan `total`.
- Untuk multi-company, kirim `company_ids`; jangan kirim company yang tidak muncul dari endpoint `/api/accounting/companies`.

## Catatan Backend

- Endpoint memakai session Odoo, bukan token stateless.
- Access company mengikuti `request.env.user.company_ids`.
- Jika DB lama masih menyimpan XML ID report dengan prefix `account_dynamic_reports`, API sudah punya fallback dari `account_dynamic_reports_jabung` ke `account_dynamic_reports`.
- Setelah update modul/controller, Odoo perlu restart agar route baru aktif.
