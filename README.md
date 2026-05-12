# WebWynk CRM & Proposal Generator

## Overview
WebWynk CRM & Proposal Generator is a comprehensive web-based tool suite designed for **WebWynk**, a Digital Marketing Agency based in Kolkata, India. It combines a powerful real-time document generator (for business proposals and invoices) with a fully functional Customer Relationship Management (CRM) backend. 

The system allows the agency to create polished PDF documents instantly, manage client relationships, track project progress, and handle invoicing through a secure role-based dashboard.

## Full Functionality

### 1. Proposal Generator
A real-time, interactive editor for creating 4-page professional business proposals.
* **Live Preview:** See document changes instantly as you type.
* **Dynamic Content:** Add or remove project scope items, services, and payment milestones.
* **Multi-Currency Support:** Toggle between India (₹ INR) and Worldwide ($ USD) formatting.
* **PDF Export:** Generates high-quality A4 PDF documents using `html2pdf.js`.
* **Automated Calculations:** Auto-calculates project delivery dates based on duration.

### 2. Invoice Generator
A dedicated tool for creating and tracking client invoices.
* **Live Calculations:** Automatically calculates balance due based on total cost minus received payments.
* **Payment Tracking:** Track partial payments, payment methods, and received dates.
* **Region-Specific Details:** Displays appropriate payment info (SBI bank details for India, PayPal/Wise for worldwide).
* **Export to PDF:** Instant PDF generation.

### 3. CRM System
A full-stack backend powered by Node.js, Express, and SQLite (`sql.js`), featuring secure JWT authentication and role-based access.

#### Admin Features (Agency)
* **Dashboard:** View total clients, revenue, recent invoices, and active projects.
* **User Management:** Create client accounts and manage their access.
* **Invoice Management:** Create invoices linked directly to client accounts, save them to the database, and track payment status (draft, sent, paid, overdue).
* **Project Tracking:** Update project status (Discovery, Design, Development, Testing, Launched), progress percentage, milestones, and add notes.

#### Client Features
* **Secure Login:** Access personal dashboard via credentials provided by the admin.
* **My Invoices:** View and download customized invoices in a read-only format.
* **My Projects:** Track the real-time progress of their web development or marketing projects, view milestones, and read admin updates.
* **Account Management:** Secure password updating functionality.

## Tech Stack
* **Frontend:** HTML5, Vanilla CSS (with CSS variables), Vanilla JavaScript (ES6+)
* **Backend:** Node.js, Express
* **Database:** SQLite (via `sql.js`)
* **Authentication:** JWT (JSON Web Tokens), `bcryptjs`
* **PDF Generation:** `html2pdf.js`

## Getting Started

### Prerequisites
* Node.js

### Installation
1. Navigate to the project directory:
   ```bash
   cd "proposal generator"
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to the local server address (typically `http://localhost:3000`).

## Project Structure
* `index.html` - Login page and smart routing system.
* `admin*.html` / `js/admin.js` - Dedicated admin dashboard pages and logic.
* `client*.html` / `js/client.js` - Dedicated client portal pages and logic.
* `proposal.html` / `js/proposal-maker.js` - Proposal generator standalone app.
* `invoice.html` / `js/invoice-maker.js` - Invoice generator standalone app.
* `server.js` - Node.js/Express backend API.
* `database.js` - SQLite3 integration layer.
* `css/dashboard.css`, `css/editor.css`, `css/auth.css` - UI styling and modular design system.
* `webwynk.db` - SQLite database file.

## Credits
Developed by **WebWynk** - Digital Marketing Agency
