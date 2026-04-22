# Proposal: Pharmacy Bin Keeper (SaaS)

## 1) Purpose
Pharmacy Bin Keeper is a web system to manage medicine stock and medicine requests in one place.
It helps doctors, pharmacists, and specialists work in one connected workflow.

## 2) Main Features
1. **Dashboard**
   - Shows current stock level
   - Shows pending requests that need action
   - Shows recent activity

2. **Drug Master**
   - Keep a complete list of medicines
   - Store medicine details (code, unit, minimum stock, reorder level, storage location)

3. **Drug Ledger**
   - Show full movement history for each medicine
   - Easy to trace when stock comes in and goes out

4. **Stock Receiving (Terimaan)**
   - Record new stock received
   - Update stock balance automatically

5. **Doctor Request Module**
   - Doctors submit medicine requests for patients
   - Controlled medicines can be routed for specialist approval first

6. **Antibiotic Form Module**
   - Doctors submit antibiotic forms with clinical details
   - Specialist can approve or reject with notes

7. **Specialist Review**
   - Specialist dashboard to review pending requests/forms
   - Approval decision is recorded with date and notes

8. **Pharmacist Fulfilment**
   - Pharmacist processes approved requests
   - Dispensing completion is recorded

9. **Patient Registry**
   - Keep patient records related to medicine dispensing
   - Keep patient medicine history

10. **Reports**
   - View stock and request reports for monitoring and decision making

11. **Role Management**
   - Control access by role (admin, doctor, pharmacist, specialist)
   - Each role sees only relevant pages and actions

## 3) Technology Used (Simple View)
- **Frontend (what users see):** React + TypeScript
- **Design/UI:** Tailwind + shadcn
- **Backend & database:** Supabase (user login + data storage)
- **Data updates:** React Query (keeps screen data updated)
- **Charts:** Recharts
- **Hosting-ready web app:** Vite build system

## 4) How It Works (End-to-End)
1. User logs in.
2. System shows screens based on user role.
3. Doctor submits medicine request or antibiotic form.
4. If approval is needed, specialist reviews and decides.
5. Approved requests go to pharmacist.
6. Pharmacist dispenses medicine and records completion.
7. Stock movement is saved in ledger and balances are updated.
8. Management can check dashboard and reports anytime.

## 5) Business Benefits
- **Better stock control:** less risk of stock shortage or overstock
- **Faster workflow:** doctor, specialist, and pharmacist work in one system
- **Clear accountability:** every action is recorded with user and time
- **Safer process:** controlled medicines follow approval flow
- **Better visibility:** management can monitor status in real time
- **Less manual work:** reduces paper and duplicate entry

## 6) Future Upgrades
1. **Low stock alerts** by email/WhatsApp/notification
2. **Purchase planning support** based on usage trends
3. **Barcode/QR support** for faster receiving and dispensing
4. **Export options** (PDF/Excel) for reports and audits
5. **Branch comparison dashboard** for multi-clinic monitoring
6. **Mobile-friendly workflow** for ward/clinic use
7. **ERP/finance integration** for procurement and budgeting
8. **Forecasting** to predict future medicine demand

## 7) Conclusion
Pharmacy Bin Keeper is ready as a practical SaaS solution for pharmacy operations.
It improves control, speed, and traceability while supporting safer medicine governance.
