# WebWynk CRM

A full-stack Client Relationship Management system built for **WebWynk** — a digital agency. Designed to manage clients, projects, invoices, and proposals from a single admin dashboard, with a dedicated portal for clients to track their work.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Server** | Express.js |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | JWT (JSON Web Tokens) via `jsonwebtoken` |
| **Password Hashing** | `bcryptjs` |
| **File Uploads** | `multer` (memory storage) → Supabase Storage |
| **Email** | `nodemailer` via Hostinger SMTP |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **PDF Export** | `html2pdf.js` (CDN) |
| **Charts** | `Chart.js` (CDN) |

---

## Project Structure

```
/
├── server.js              # Express API server (all routes)
├── auth.js                # JWT middleware (generateToken, authenticateToken, requireAdmin, requireClient)
├── database.js            # Supabase client initialisation
├── email.js               # Nodemailer email helpers
├── .env                   # Environment variables (not committed)
│
├── index.html             # Login page (admin & client)
├── admin.html             # Admin dashboard (stats + recent activity)
├── admin-clients.html     # Admin client list + project/invoice management
├── admin-client-view.html # Single client dossier (tabbed view)
├── invoice.html           # Invoice creator/editor
├── proposal.html          # Proposal creator/editor
│
├── client.html            # Client dashboard (overview)
├── client-projects.html   # Client: my projects
├── client-invoices.html   # Client: my invoices
├── client-proposals.html  # Client: my proposals
├── client-settings.html   # Client: change password
│
├── js/
│   ├── admin.js           # All admin page logic (CRUD, modals, rendering)
│   ├── auth.js            # Frontend login / logout flow
│   ├── client.js          # Client portal logic
│   ├── invoice-maker.js   # Invoice form + PDF preview logic
│   └── proposal-maker.js  # Proposal form + PDF preview logic
│
└── css/
    ├── dashboard.css      # Admin & client dashboard styles
    ├── auth.css           # Login page styles
    └── editor.css         # Invoice / Proposal editor styles
```

---

## Environment Variables (`.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_publishable_key
PORT=3000
JWT_SECRET=your_jwt_secret_key
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contact@webwynk.com
SMTP_PASS=your_email_password
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start server
npm run start
# → Runs at http://localhost:3000

# Default admin credentials (seeded on first run)
Email:    admin@webwynk.com
Password: admin123
```

---

## Features

### 🔐 Authentication
- Shared login page (`index.html`) for both admin and clients.
- Role-based access: `admin` and `client` roles stored in the database.
- JWT tokens stored in `localStorage`, validated on every API request.
- Automatic redirect to login on expired or invalid tokens (401/403).
- Password change functionality for clients via settings page.

---

### 👤 Admin — Client Management
- **Create** clients with name, company, email, phone, and password.
- **Edit** client details and toggle active/inactive status.
- **Delete** clients from the system.
- **View** a dedicated client dossier (`admin-client-view.html`) with a tabbed interface showing all associated Projects, Invoices, and Proposals for that client.

---

### 📁 Admin — Project Management
- **Create** projects linked to a client with:
  - Project Name
  - Project Type (Web Development / SEO / Design / Marketing / Other) — shown as a highlighted colour-coded pill badge
  - Priority (Urgent / High / Medium / Low)
  - Start Date & End Date
  - Status (Discovery / Design / Development / Testing / Launched)
  - Notes
  - External Links
  - Milestones (with individual title, progress %, start/end dates, and link)
- **Edit** existing projects and update all fields.
- **Delete** projects.
- **Overall Completion** calculated as the **sum** of all milestone progress values.
- Project cards displayed with client name, type pill, priority badge, status badge, and progress bar.
- **Project Updates** — admin can post text updates against a project; clients are notified by email.
- **File Uploads** — files can be uploaded per project and stored in Supabase Storage; clients can view them.
- **Comments** — both admin and client can leave comments on a project.

---

### 🧾 Admin — Invoice Management
- **Create** invoices with:
  - Invoice Number, Client, Date
  - Line items (services) with description and price
  - Milestones / payment schedule
  - Payment received amount and date
  - Currency (INR, USD, EUR, GBP, etc.)
  - Status (Draft / Sent / Paid / Overdue)
  - Notes
- **Edit** and **Delete** invoices.
- **PDF Export** — generates a print-ready invoice PDF directly in the browser using `html2pdf.js`.
- **Auto Email** — when an invoice is created, the client receives an automated notification email.

---

### 📄 Admin — Proposal Management
- **Create** proposals with:
  - Proposal Number, Client, Date
  - Project Title and Overview
  - Scope of Work (list items)
  - Growth Blueprint section
  - Timeline duration, Start Date, Delivery Date
  - Services with price breakdown
  - Milestones
  - Currency and Status (Draft / Sent / Accepted / Rejected)
- **Edit** and **Delete** proposals.
- **Live PDF Preview** — proposal renders in a live preview pane and can be exported as a branded PDF.

---

### 📊 Admin — Dashboard
- Summary stats: Total Clients, Total Invoices, Active Projects, Pending Revenue.
- Recent invoices table with client links.
- Active projects overview (latest 3) with progress bars.

---

### 🧑‍💻 Client Portal
- Clients log in to a dedicated dashboard showing:
  - **My Projects** — with milestone progress, project status, updates feed, file downloads, and comment thread.
  - **My Invoices** — list of invoices with amounts, status, and download option.
  - **My Proposals** — list of proposals with status.
  - **Settings** — change account password.
- All client data is scoped to the logged-in client; clients cannot see other clients' data.

---

### 📧 Email Notifications
- **Invoice Created** → email sent to client with invoice number and portal link.
- **Project Update Posted** → email sent to client with update content and project status.
- Email transport: Hostinger SMTP via `nodemailer`.

---

## API Overview

All routes require a valid JWT Bearer token in the `Authorization` header.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/login` | Public | Authenticate user, return JWT |
| POST | `/api/change-password` | Auth | Change own password |
| GET | `/api/clients` | Admin | List all clients |
| POST | `/api/clients` | Admin | Create client |
| PUT | `/api/clients/:id` | Admin | Update client |
| DELETE | `/api/clients/:id` | Admin | Delete client |
| GET | `/api/projects` | Admin | List all projects |
| POST | `/api/projects` | Admin | Create project |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| GET | `/api/projects/:id/updates` | Auth | Get project updates |
| POST | `/api/projects/:id/updates` | Admin | Post project update (triggers email) |
| GET | `/api/projects/:id/files` | Auth | List project files |
| POST | `/api/projects/:id/files` | Auth | Upload file to project |
| DELETE | `/api/projects/:id/files/:fileId` | Auth | Delete project file |
| GET | `/api/projects/:id/comments` | Auth | Get project comments |
| POST | `/api/projects/:id/comments` | Auth | Post comment |
| GET | `/api/invoices` | Admin | List all invoices |
| POST | `/api/invoices` | Admin | Create invoice (triggers email) |
| PUT | `/api/invoices/:id` | Admin | Update invoice |
| DELETE | `/api/invoices/:id` | Admin | Delete invoice |
| GET | `/api/proposals` | Admin | List all proposals |
| POST | `/api/proposals` | Admin | Create proposal |
| PUT | `/api/proposals/:id` | Admin | Update proposal |
| DELETE | `/api/proposals/:id` | Admin | Delete proposal |
| GET | `/api/my-projects` | Client | Get own projects |
| GET | `/api/my-invoices` | Client | Get own invoices |
| GET | `/api/my-proposals` | Client | Get own proposals |
| GET | `/api/admin/stats` | Admin | Dashboard summary stats |

---

## Notes

- On first run in non-production mode, the server seeds a default admin user (`admin@webwynk.com` / `admin123`). **Change this password after first login.**
- `project_type` is stored and displayed as a colour-coded pill on all project cards (Web Development = Blue, SEO = Yellow, Design = Pink, Marketing = Green, Other = Grey).
- Session storage is used to cache API responses for performance; cache is automatically invalidated on any create / update / delete action.
