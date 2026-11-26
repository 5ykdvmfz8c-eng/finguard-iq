# FinGuard IQ

Build FINANCIAL IQ: Automated Financial Fraud Detection and Prevention System based on the attached specification (PROJECT_NAME_FINANCIAL_IQ_pasted.md) and dashboard reference design (IMG_5871.png).

Implement Phases 1 to 3 as our foundational launch:
1. Business Accounts & Roles: Multi-tenant structure with role-based access (Administrator, Financial Manager, Auditor, Employee).
2. Financial Transaction Ingestion: Support for CSV/Excel file uploads and manual recording of transactions (tracking amount, date, payment method, frequency, responsible employee, supplier/customer, and invoice reference).
3. Duplicate Payment & Fraud Detection Engine: Automated detection for duplicate payments (same supplier, invoice number, amount, or suspicious split payments) and risk level assignment (LOW, MEDIUM, HIGH, CRITICAL).
4. Management Dashboard: A clean, high-density interface inspired by the attached VaultGuard screenshot—featuring a dark navigation sidebar, a Risk Health Score dial with top risk contributors, a risk trend timeline, and a live triage table for alerts and incidents, with support for South African Rand (ZAR) and multi-currency displays.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/81c6842c-3101-4514-a04e-1f4938885854).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
