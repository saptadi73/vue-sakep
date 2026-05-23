# Network Diagnostic Steps untuk "Failed to fetch" Error

## Situasi Saat Ini
- Frontend berhasil build dan jalankan dengan code yang benar
- Request payload sudah benar (userid, signature, headers semua OK)
- Error terjadi di level network: `TypeError: Failed to fetch`
- Kemungkinan: CORS blocked, server tidak accessible, atau network connectivity issue

---

## Step 1: Check Browser Network Tab (Fastest)

**Lakukan:**
1. Buka browser DevTools: F12
2. Tab: Network
3. Di aplikasi, click tombol load report USPPS (Balance Sheet atau Trial Balance)
4. Lihat di Network tab untuk request ke `36.92.125.247:33507`

**Cari jawaban untuk:**
- Apakah request muncul di Network tab?
  - ✅ Ya → Lanjut ke Step 2 (lihat response headers)
  - ❌ Tidak → Kemungkinan CORS pre-flight OPTIONS request di-block. Lanjut ke Step 3.

**Kalau request muncul, lihat:**
- Status code: Apa? (200, 400, 403, network error, etc?)
- Response Headers: Cari `Access-Control-Allow-Origin`
  - Ada? Nilainya apa?
  - Tidak ada? → CORS issue
- Response Body: Ada error message?

---

## Step 2: Test dari Postman (Verify Server Status)

**Tujuan:** Pastikan server API masih online dan accessible

**Lakukan:**
1. Buka Postman
2. Import: `src/reference/USPPS.postman_collection.json`
3. Test: GetNeracaHarian request

**Expected:**
- ✅ Response 200 dengan data → Server OK, issue adalah CORS di browser
- ❌ Response error / network error → Server potentially down atau not accessible

**Jika Postman berhasil tapi browser tidak:**
→ Ini adalah CORS issue (server tidak allow request dari browser)
→ Solusi: Konfigurasi server untuk return `Access-Control-Allow-Origin` header

---

## Step 3: Test Network Connectivity

**Tujuan:** Pastikan komputer bisa reach server IP

**Di PowerShell, jalankan:**
```powershell
# Test koneksi ke server
Test-NetConnection -ComputerName 36.92.125.247 -Port 33507 -InformationLevel Detailed
```

**Expected:**
- ✅ TcpTestSucceeded: True → Network OK
- ❌ TcpTestSucceeded: False → Network tidak accessible (firewall, routing issue)

---

## Step 4: Alternative - Check Application Debug Output

**Console Frontend Debug:**
1. Buka browser console (F12 → Console tab)
2. Cari message dengan `requestAttempt` object
3. Lihat:
   - `timestampStart` vs `timestampEnd` → berapa lama fetch?
   - `errorType` → apa tipe error?
   - Full error message

---

## Possible Causes & Solutions

| Cause | Sign | Solution |
|-------|------|----------|
| **CORS Blocked** | Network tab: request ada, no `Access-Control-Allow-Origin` header | Koordinasi dengan API team untuk add CORS headers. Atau gunakan CORS proxy. |
| **Server Offline** | Postman juga error / network error | Hubungi infra team untuk cek server status |
| **Network Unreachable** | `Test-NetConnection` gagal | Check firewall, VPN, network config |
| **DNS Issue** | Resolve error | Check DNS atau gunakan IP langsung |

---

## Quick Summary Debug Info to Share

Setelah collect info dari steps di atas, share:
```json
{
  "browser_network_tab": {
    "request_visible": "yes/no",
    "status_code": "??",
    "access_control_allow_origin": "??",
    "error_in_response": "??"
  },
  "postman_test": {
    "success": "yes/no",
    "status": "??"
  },
  "network_connectivity": {
    "tcp_test_succeeded": "yes/no"
  },
  "console_debug": {
    "timestamp_duration_ms": "??",
    "error_type": "??"
  }
}
```

---

## Notes

- VITE_USPPS_KANJABUNG_API_BASE_URL sudah benar set ke: `http://36.92.125.247:33507`
- Frontend code sudah benar (build successful, payload correct)
- Issue adalah di network/CORS level, bukan code level
