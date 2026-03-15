# Pharmacy Bin Keeper

## What This Is

A pharmacy inventory and drug dispensing management system for Malaysian healthcare facilities. It enables pharmacists to manage drug stock, doctors to request drugs and antibiotic approvals, and specialists to review antibiotic prescriptions — all through a role-based web interface.

## Core Value

Every drug movement is traceable and every dispensing request is accountable — from doctor request to pharmacist fulfilment.

## Current Milestone: v2.0 English UI & Admin Features

**Goal:** Switch UI language to English, enable admin-controlled user creation, and auto-sync new drugs into the doctor's drug request form.

**Target features:**
- English UI (all labels, toasts, statuses in English)
- Manual user creation by admin (create accounts without self-signup)
- Drug-request sync (new drugs in master list auto-appear in doctor request form)

## Requirements

### Validated

<!-- Shipped in v1.0 -->

- ✓ Role-based access control (admin, pharmacist, doctor, specialist) — v1.0
- ✓ Drug master management (add/edit drugs with location codes) — v1.0
- ✓ Stock ledger via transaction log (terimaan/keluaran/baki_awal) — v1.0
- ✓ Doctor drug dispensing requests (pending → approved/rejected/fulfilled/deferred) — v1.0
- ✓ Antibiotic approval forms (Clinical Pathway NAG 2024) — v1.0
- ✓ Patient registry and drug history — v1.0
- ✓ Bin card and drug ledger views — v1.0
- ✓ Google OAuth + email/password authentication — v1.0
- ✓ Reports and dashboard with charts — v1.0
- ✓ Role Management page — v1.0

### Active

<!-- v2.0 scope -->

- [ ] UI language switched from Malay to English
- [ ] Admin can create user accounts manually (name, email, role)
- [ ] Doctor's drug request form auto-loads all drugs from the drug master

### Out of Scope

- Real-time WebSocket notifications — not required yet, polling is sufficient
- Multi-facility/multi-tenant support — single facility for now
- Mobile native app — web-first

## Context

- Built with React 18 + TypeScript + Vite (SWC), hosted on Vercel
- Supabase for PostgreSQL backend + Auth (RLS enabled)
- UI currently entirely in Malay (Bahasa Malaysia) — all labels, toasts, status values
- Auth supports Google OAuth and email/password; user roles stored in `user_roles` table
- Drug stock is computed from `transactions` table (no dedicated stock column)
- Roles managed via Supabase RLS with admin-only policies

## Constraints

- **Tech stack**: React + TypeScript + Supabase — no backend changes to infrastructure
- **RLS**: All DB changes must respect existing Row Level Security policies
- **Auth**: User creation must go through Supabase Auth admin API (not direct DB insert)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Malay UI language | Original deployment context | ⚠️ Revisit — switching to English in v2 |
| Computed stock from transactions | Audit trail integrity | ✓ Good |
| 3-role consolidation (admin/pharmacist/doctor/specialist) | Simplified permissions | ✓ Good |
| Supabase RLS for data security | Prevents unauthorized data access | ✓ Good |

---
*Last updated: 2026-03-16 — Milestone v2.0 started*
