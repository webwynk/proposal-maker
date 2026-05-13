# WebWynk CRM & Document Suite 🚀

## Overview
**WebWynk CRM** is a sophisticated, full-stack agency management platform tailored for the modern digital ecosystem. It integrates project lifecycle management, automated financial operations, and high-fidelity document generation into a single, unified workflow.

The system has evolved from a local-first tool to a **Cloud-Native Enterprise Suite**, leveraging Supabase for industrial-grade data persistence and real-time collaboration.

---

## 💎 Core Capabilities

### 1. Unified Dashboard & Analytics
*   **Business Intelligence:** Real-time monitoring of total revenue, client acquisition, and active project counts.
*   **Visual Analytics:** Interactive charts for revenue trends and project status distributions.
*   **Activity Feed:** Instant visibility into recent invoicing and document updates.

### 2. Project Lifecycle & File Management
*   **Cloud Storage:** Integrated **Supabase Storage** for project-related assets (PDFs, design files, contracts).
*   **Milestone Tracking:** Granular control over project stages: `Discovery` → `Design` → `Development` → `Testing` → `Launched`.
*   **Communication Hub:** Direct "Project Updates" feed with automated email notifications to clients.

### 3. Integrated Document Engines
*   **Smart Proposals:** Real-time generator for multi-page, brand-aligned proposals with dynamic scope and pricing.
*   **Precision Invoicing:** Automated calculation engine for balance dues, tracking payments against milestones.
*   **Database Persistence:** Every document is stored in the cloud, enabling historical tracking and easy retrieval.

### 4. Automated Communication
*   **SMTP Integration:** Powered by **Nodemailer & Hostinger SMTP** for professional outbound communication.
*   **Triggered Notifications:** Automatic emails for new invoices, project status changes, and major updates.

---

## 🛠 Technical Architecture

### Cloud-Native Stack
*   **Backend:** Node.js & Express API.
*   **Database:** **Supabase (PostgreSQL)** — ensuring reliable, relational data management.
*   **Object Storage:** Supabase Buckets for secure file hosting.
*   **Authentication:** Multi-role JWT (JSON Web Token) system with secure `bcrypt` hashing.

### Modern Frontend
*   **UI Architecture:** Modular, multi-page layout (MPA) for improved performance and SEO.
*   **Technologies:** HTML5, Vanilla ES6+ JavaScript, and a proprietary Vanilla CSS design system.
*   **PDF Generation:** `html2pdf.js` for high-fidelity A4 document exports.

---

## 📁 System Blueprint

```text
/
├── server.js           # Express API & Core Business Logic
├── database.js         # Supabase Connection Layer
├── auth.js             # JWT & Security Middleware
├── email.js            # SMTP Notification Service
├── .env                # Environment Configuration (API Keys, SMTP)
├── netlify.toml        # Deployment Configuration
├── admin-*.html        # Agency Management Pages
├── client-*.html       # Secure Client Portal Pages
├── proposal.html       # Standalone Proposal Builder
├── invoice.html        # Standalone Invoice Builder
└── css/                # Global Design Tokens & Styles
```

---

## 🏁 Deployment & Launch

### 1. Configuration
Create a `.env` file with the following variables:
*   `SUPABASE_URL` & `SUPABASE_KEY`
*   `JWT_SECRET`
*   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

### 2. Execution
```bash
npm install     # Install enterprise dependencies
npm start       # Launch production server
```
Default access: `http://localhost:3000`

---

## 🎨 Design System
The WebWynk CRM utilizes a premium "Neo-Agency" aesthetic:
*   **Primary Accent:** `#ff5028` (Action Orange)
*   **System Depth:** `#7864f0` (Intelligence Purple)
*   **Canvas:** `#f0f0ff` (Soft Lavender)
*   **Typography:** `Bricolage Grotesque` (Display) & `Inter` (Functional)

---

**© 2026 WebWynk | Digital Excellence Redefined**
*Sector V, Kolkata, India*
[webwynk.com](https://webwynk.com)
