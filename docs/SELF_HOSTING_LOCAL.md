# Lampiran Teknikal — Panduan *Hosting* Setempat (Docker + Supabase di PC Pejabat)

> Dokumen ini menyokong tuntutan "self‑hosted" dalam
> [`PROJEK_INOVASI_PHARMACY_BIN.md`](./PROJEK_INOVASI_PHARMACY_BIN.md). Ia menerangkan cara
> Pharmacy Bin Keeper dan Supabase dijalankan sepenuhnya di PC pejabat dalam rangkaian dalaman (LAN),
> tanpa pergantungan kepada perkhidmatan awan luar.
>
> *This document backs up the "self‑hosted" claim in the innovation write‑up. It documents how the
> Pharmacy Bin Keeper app and Supabase run entirely on an office PC over the local network (LAN),
> with no dependency on external cloud services.*

---

## 1. Seni bina (Architecture)

```
  ┌────────────────────────── PC PEJABAT (dalam premis) ──────────────────────────┐
  │                                                                               │
  │   Pelayar web staf (LAN)                Docker Engine                          │
  │   ┌───────────────────┐                 ┌───────────────────────────────────┐ │
  │   │ Farmasi / MO / FMS│  http://PC_IP   │  Kontena Supabase (self-hosted)   │ │
  │   │  (Chrome/Edge)    │◄───────────────►│   • PostgreSQL   (data)           │ │
  │   └───────────────────┘   :8080 / :3000 │   • GoTrue Auth  (ID & peranan)   │ │
  │            ▲                            │   • PostgREST / Realtime / Storage │ │
  │            │                            │   • Studio / Kong (API gateway)    │ │
  │   ┌────────┴──────────┐                 └───────────────────────────────────┘ │
  │   │ App web (Vite)    │  VITE_SUPABASE_URL = http://PC_IP:8000                 │
  │   │ dev atau statik   │                            │                           │
  │   └───────────────────┘                            ▼                           │
  │                                          Sandaran (backup) → storan dalaman     │
  └───────────────────────────────────────────────────────────────────────────────┘
        ✗ Tiada sambungan ke pelayan awan luar / internet awam
```

**Komponen:**
- **Supabase (self‑hosted)** — PostgreSQL + Auth + PostgREST + Realtime + Storage + Studio, dijalankan sebagai set kontena Docker.
- **Aplikasi web** — React 18 + Vite; dilayari staf melalui LAN.
- **Kos pelesenan:** RM 0 (semua sumber terbuka + perkakasan sedia ada).

---

## 2. Keperluan (Prerequisites)

| Perkara | Cadangan minimum |
|---------|------------------|
| OS | Windows 10/11 (Pro), Linux, atau macOS |
| Docker | Docker Desktop (Windows/macOS) atau Docker Engine + Compose (Linux) |
| RAM | ≥ 8 GB (16 GB disyorkan) |
| Storan | ≥ 20 GB kosong (data + imej Docker) |
| Node.js | v18+ dan npm (untuk membina aplikasi web) |
| Rangkaian | PC pada LAN pejabat dengan IP tetap/dikhaskan (contoh `192.168.1.50`) |

> **Nota Windows:** Docker Desktop memerlukan WSL2. Pasang WSL2 dahulu jika belum ada
> (`wsl --install` dalam PowerShell pentadbir).

---

## 3. Langkah A — Jalankan Supabase secara setempat (Docker)

Supabase menyediakan konfigurasi `docker-compose` rasmi untuk *self‑hosting*.

```bash
# 1. Klon repositori Supabase (hanya folder docker diperlukan)
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 2. Salin fail persekitaran contoh
cp .env.example .env

# 3. WAJIB tukar rahsia lalai dalam .env sebelum guna dalam persekitaran sebenar:
#    - POSTGRES_PASSWORD   (kata laluan pangkalan data)
#    - JWT_SECRET          (rahsia untuk token — jana rentetan rawak >= 32 aksara)
#    - ANON_KEY            (JWT ditandatangani dengan JWT_SECRET di atas)
#    - SERVICE_ROLE_KEY    (JWT ditandatangani dengan JWT_SECRET di atas)
#    - DASHBOARD_USERNAME / DASHBOARD_PASSWORD  (log masuk Studio)
#    Jana ANON_KEY & SERVICE_ROLE_KEY di: https://supabase.com/docs/guides/self-hosting#api-keys

# 4. Tarik imej & jalankan
docker compose pull
docker compose up -d

# 5. Semak status
docker compose ps
```

Selepas berjaya:
- **Supabase Studio** → `http://localhost:8000` (atau `http://PC_IP:8000` dari PC lain di LAN)
- **API / gateway** → `http://PC_IP:8000`
- Data disimpan dalam volume Docker setempat (`./volumes/db/data`) — **kekal di PC ini sahaja**.

> **Keselamatan LAN:** Untuk membolehkan akses dari komputer lain di pejabat, benarkan port
> masuk (contoh `8000`, `8080`) pada Windows Defender Firewall, dan gunakan IP tetap untuk PC hos.

---

## 4. Langkah B — Sediakan skema pangkalan data

Jadual aplikasi (rujuk `CLAUDE.md`): `drugs`, `transactions`, `dispensing_requests`,
`antibiotic_forms`, `patient_registry`, `patient_drug_history`, `profiles`, `user_roles`,
`drug_quotas`, `ai_audit_logs`.

Pilihan untuk mencipta skema pada Supabase setempat:
1. **Migrasi** — jika folder `supabase/migrations/` wujud dalam repo ini, jalankan melalui Supabase CLI
   (`supabase db push`) yang dihalakan ke instance setempat; atau
2. **SQL Editor Studio** — tampal skrip SQL skema ke dalam SQL Editor di Studio (`http://PC_IP:8000`); atau
3. **Eksport → Import** — `pg_dump` skema dari projek Supabase awan sedia ada, kemudian `psql` import
   ke pangkalan data setempat.

> Selepas skema dicipta, daftarkan pengguna pertama (admin) melalui **Authentication** dalam Studio,
> kemudian masukkan baris peranan `admin` ke dalam jadual `user_roles` untuk pengguna tersebut.

---

## 5. Langkah C — Halakan aplikasi web ke Supabase setempat

Aplikasi membaca dua pemboleh ubah persekitaran (rujuk `src/integrations/supabase/client.ts`).
Cipta fail `.env` di root projek:

```dotenv
# Halakan ke Supabase SETEMPAT (bukan awan)
VITE_SUPABASE_URL="http://PC_IP:8000"
VITE_SUPABASE_PUBLISHABLE_KEY="<ANON_KEY-dari-langkah-3>"
```

Gantikan `PC_IP` dengan alamat IP LAN PC hos (contoh `http://192.168.1.50:8000`) supaya komputer
lain di pejabat boleh menyambung.

**Jalankan aplikasi:**

```bash
npm install

# Pilihan 1 — mod pembangunan (paling mudah)
npm run dev          # http://PC_IP:8080

# Pilihan 2 — binaan produksi (disyorkan untuk penggunaan harian)
npm run build        # hasilkan folder dist/
npx vite preview --host --port 8080
#   atau hidangkan dist/ melalui mana-mana pelayan statik / kontena nginx
```

Staf lain di pejabat kini boleh melayari `http://PC_IP:8080`.

---

## 6. Sandaran (Backup) & pemulihan

Kerana data berada di PC pejabat, **sandaran berkala adalah wajib**.

```bash
# Sandar pangkalan data (jadualkan harian melalui Task Scheduler / cron)
docker compose exec -T db pg_dump -U postgres postgres > backup_$(date +%F).sql

# Pulih daripada sandaran
cat backup_YYYY-MM-DD.sql | docker compose exec -T db psql -U postgres postgres
```

> Simpan salinan sandaran di storan dalaman berasingan (contoh cakera luaran / NAS pejabat).
> Jangan simpan satu-satunya salinan di PC hos yang sama.

---

## 7. Senarai semak operasi (Operational checklist)

- [ ] Rahsia lalai (`POSTGRES_PASSWORD`, `JWT_SECRET`, kunci API, kata laluan Studio) telah ditukar.
- [ ] IP tetap ditetapkan untuk PC hos; port firewall dibenarkan untuk LAN sahaja.
- [ ] Skema pangkalan data dicipta; pengguna admin didaftarkan dengan peranan `user_roles`.
- [ ] `.env` aplikasi menghala ke `http://PC_IP:8000` dengan `ANON_KEY` yang betul.
- [ ] Sandaran automatik dijadualkan; pemulihan telah diuji sekurang‑kurangnya sekali.
- [ ] Docker ditetapkan untuk mula automatik (`restart: unless-stopped`) supaya sistem pulih selepas *reboot*.
- [ ] PC hos tidak terdedah ke internet awam (LAN dalaman sahaja).

---

## 8. Kelebihan pendekatan setempat (untuk write‑up)

| Aspek | Kelebihan |
|-------|-----------|
| **Kedaulatan data** | Data pesakit tidak pernah meninggalkan premis fasiliti. |
| **Kos** | RM 0 pelesenan — sumber terbuka + perkakasan sedia ada; tiada langganan awan bulanan. |
| **Ketersediaan** | Beroperasi dalam LAN walaupun tanpa internet awam. |
| **Replikasi** | Fasiliti lain hanya perlu pasang set Docker yang sama untuk sistem serupa. |
| **Keselamatan** | Kawalan akses berasaskan peranan (admin/fms/mo/pharmacist) + jejak audit. |
| **Kawalan** | Sandaran, kemas kini dan konfigurasi dikawal sepenuhnya oleh fasiliti. |
