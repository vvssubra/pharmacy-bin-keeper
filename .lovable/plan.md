

## Digital Bin Card System — Implementation Plan

### 1. Setup & Design System
- Add **Inter** font via Google Fonts
- Update CSS variables: primary `#1A3C6E`, accent `#2E75B6`, remove dark mode
- No toast notifications for success — feedback via data updates
- Light mode only

### 2. Supabase Backend Setup
- Connect to Supabase (Lovable Cloud)
- **Profiles table**: `id (uuid, FK to auth.users)`, `full_name`, `facility` — with RLS so users can read their own profile
- **User roles table**: `user_id`, `role` (enum: admin, pharmacist, staff) — with `has_role()` security definer function and RLS
- Trigger to auto-create profile on signup

### 3. Authentication
- **Login page**: NOT a centered splash — uses the same app shell layout (sidebar + header visible but disabled/minimal). Login form in a Card, top-left aligned in the content area
- Email + password via Supabase Auth
- No registration page
- Auth context with `onAuthStateChange` listener
- Protected route wrapper redirecting to `/login` if unauthenticated

### 4. App Shell Layout
- **Sidebar** (280px, collapsible to icon rail with labels still visible via tooltips):
  - Dashboard (Home icon)
  - Drug Master (Pill icon)  
  - Upload Mingguan (Upload icon)
  - Terimaan (PackagePlus icon)
  - Laporan (FileText icon)
  - Active route highlighted with primary color indicator
- **Top navbar** (64px fixed): App name "Digital Bin Card", facility "Klinik Kesihatan Kempas", user name + role Badge, logout button
- **Main content**: fluid, scrollable area — sidebar and navbar stay fixed
- Responsive: sidebar collapses on mobile

### 5. Placeholder Pages (mock layout, no real data)
- **Dashboard**: Cards showing placeholder stats (Total Drugs, Low Stock, Out of Stock, Recent Activity) with empty chart placeholder
- **Drug Master**: Table layout with columns (Drug Name, Category, Unit, Current Stock, Status badge) — empty state with FileText icon and "Click 'Add New' to begin."
- **Upload Mingguan**: Upload area placeholder with instructions
- **Terimaan**: Placeholder table of recent receipts, "Add New" button that opens a Dialog with the signature two-column form layout (left: delivery details, right: drug search + auto-populated fields)
- **Laporan**: Report filter controls and empty table placeholder

### 6. Status Badges
- In Stock: muted green (`#16A34A`)
- Low Stock: muted amber (`#F59E0B`)  
- Out of Stock: muted red (`#DC2626`)

### 7. Empty States
- No illustrations — stark centered message with `FileText` icon and direct text

