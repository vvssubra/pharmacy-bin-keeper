

## Upload Mingguan Page — Implementation Plan

This is a UI-only build with mock data. No Excel parsing or database writes — just the full interactive interface.

### Route Update

Change route from `/upload-mingguan` to `/upload` in `App.tsx` and `AppSidebar.tsx`.

### Full Rewrite of `src/pages/UploadMingguan.tsx`

Single large component with 4 sections managed by React state:

**State machine:**
- `idle` → files selected → `filesReady` → "Proses Fail" clicked → `preview` → "Sahkan Import" → toast + reset to `idle`

**Section 1 — Drop Zone**
- Drag-and-drop area using native `onDrop`/`onDragOver` + hidden `<input type="file" multiple accept=".xls,.xlsx">`
- CloudUpload icon, labels as specified
- Below: file list with name, formatted size, X remove button
- "Proses Fail" button disabled when no files

**Section 2 — Import Preview Table** (shown after Proses Fail)
- Mock data: 5 rows covering all status types (Sedia, Duplikasi Dilangkau, Ralat: Ubat Tidak Dijumpai, Ralat: Tiada Baki Awal, Ralat: Format Tidak Sah)
- Collapsible rows using shadcn Collapsible for error rows — nested table showing failed row details
- Checkbox column: pre-checked for Sedia/Duplikasi rows, disabled for Ralat rows
- Select All / Deselect All toggle

**Section 3 — Confirm Bar** (shown with preview)
- Summary: "X fail sedia untuk import — Y transaksi akan direkodkan"
- "Sahkan Import" primary + "Batal" outline buttons
- On confirm: toast success, reset state

**Section 4 — Import History** (always visible)
- Mock table with 3 past import batches
- Columns: Tarikh Upload, Diupload Oleh, Fail, Transaksi Berjaya, Ralat, Tindakan
- Rollback button → AlertDialog confirmation

### Files Changed

| File | Action |
|------|--------|
| `src/pages/UploadMingguan.tsx` | Full rewrite — all 4 sections with mock data |
| `src/App.tsx` | Route `/upload-mingguan` → `/upload` |
| `src/components/AppSidebar.tsx` | Nav URL → `/upload` |

