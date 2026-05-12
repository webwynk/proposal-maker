# WebWynk CRM - Features Specification

## Project Overview

A CRM system for WebWynk (web development agency) to manage clients, invoices, and project progress.

---

## 1. Authentication System

### 1.1 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access - manage users, create invoices, update progress |
| **Client/User** | Limited access - view own invoices, project progress, change password |

### 1.2 Login Flow

```
┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Client    │
│   Login     │     │   Login     │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  Dashboard  │     │  My Account │
│             │     │  - Change   │
│ - Users     │     │    Password │
│ - Invoices │     │             │
│ - Projects  │     │ ┌─────────┐ │
│             │     │ │Invoice  │ │
│             │     │ │View     │ │
│             │     │ └─────────┘ │
│             │     │ ┌─────────┐ │
│             │     │ │Project  │ │
│             │     │ │Progress │ │
│             │     │ └─────────┘ │
└─────────────┘     └─────────────┘
```

### 1.3 Registration

- **Admin**: Direct access (hardcoded or database seed)
- **Client**: NO self-registration — Admin creates account
- Admin sends credentials to client via email/manual

### 1.4 Password Management

- First login: Force password change
- Password requirements: Min 8 chars
- Password reset available via admin

---

## 2. Admin Features

### 2.1 User Management

**Create User:**
- Form fields:
  - Full Name (required)
  - Company Name (required)
  - Email (required, unique)
  - Phone (optional)
  - Initial Password (auto-generate or manual)
- Actions:
  - Save user
  - Display username/password for admin to share
  - Option to send via email (future)

**User List View:**
- Table columns: Name, Company, Email, Phone, Status, Created Date
- Actions per user: Edit, Delete, View Invoices, View Projects
- Search/filter functionality

**User Status:**
- Active / Inactive toggle

### 2.2 Invoice Management

**Create Invoice for Client:**
- Same form as current invoice.html
- But: Select client from dropdown (instead of manual entry)
- Pre-fill client details from user data

**Invoice Actions:**

| Action | Behavior |
|--------|----------|
| **Save** | Save to database, user can view |
| **Print** | Generate PDF (like current), NOT saved (optional) |
| **Save + Print** | Both actions |

**Invoice List:**
- Table: Invoice #, Client, Amount, Status (Paid/Unpaid), Date, Actions
- Actions: View, Edit, Print, Delete

### 2.3 Project Progress Management

**Create/Update Project:**
- Select client
- Project Name
- Project Status dropdown:
  - Discovery
  - Design
  - Development
  - Testing
  - Launched
  - On Hold
- Progress percentage (0-100%)
- Notes/Updates (textarea)
- Milestones with dates

**Project List View:**
- Table: Client, Project Name, Status, Progress, Last Updated
- Filter by client, status

### 2.4 Admin Dashboard

- Total clients count
- Total invoices / revenue
- Recent invoices
- Active projects count
- Quick actions: Add Client, Create Invoice

---

## 3. Client/User Features

### 3.1 My Account

**Change Password:**
- Current password verification
- New password + confirm
- Validation: min 8 chars

### 3.2 My Invoices

**List View:**
- Table: Invoice #, Amount, Status, Date
- Action: View (opens modal or detail page)

**View Invoice:**
- Read-only view of saved invoice
- Print button (generate PDF)
- Payment status indicator

### 3.3 My Projects

**Project List:**
- All projects assigned to this client

**Project Detail View:**
- Project name
- Current status (with visual indicator)
- Progress bar (%)
- Timeline/milestones
- Update history
- Notes from admin

---

## 4. Data Models

### 4.1 Users Table

```sql
id: INT (PK)
name: VARCHAR(255)
company: VARCHAR(255)
email: VARCHAR(255) UNIQUE
phone: VARCHAR(50)
password_hash: VARCHAR(255)
role: ENUM('admin', 'client')
is_active: BOOLEAN
created_at: DATETIME
updated_at: DATETIME
```

### 4.2 Invoices Table

```sql
id: INT (PK)
invoice_number: VARCHAR(50)
client_id: INT (FK -> users.id)
services: JSON  // [{name, price}]
milestones: JSON // [{label, amount}]
payment_received: DECIMAL
payment_received_date: DATE
payment_method: ENUM('bank', 'paypal', 'wise')
currency: ENUM('INR', 'USD')
status: ENUM('draft', 'sent', 'paid', 'overdue')
created_by: INT (FK -> users.id)
created_at: DATETIME
updated_at: DATETIME
```

### 4.3 Projects Table

```sql
id: INT (PK)
client_id: INT (FK -> users.id)
name: VARCHAR(255)
status: ENUM('discovery', 'design', 'development', 'testing', 'launched', 'on_hold')
progress: INT (0-100)
milestones: JSON // [{title, date, completed}]
notes: TEXT
created_by: INT (FK -> users.id)
created_at: DATETIME
updated_at: DATETIME
```

### 4.4 Project Updates Table

```sql
id: INT (PK)
project_id: INT (FK -> projects.id)
content: TEXT
created_by: INT (FK -> users.id)
created_at: DATETIME
```

---

## 5. UI/UX Requirements

### 5.1 Design Consistency

- Match existing proposal/invoice design
- Use same colors, fonts, components
- Keep the two-panel layout (editor + preview) for admin forms

### 5.2 Responsive

- Desktop: Full two-column
- Tablet: Stacked or collapsible
- Mobile: Single column

### 5.3 Navigation

**Admin Sidebar:**
- Dashboard
- Clients
- Invoices
- Projects
- Settings (optional)

**Client Sidebar:**
- My Account
- My Invoices
- My Projects

---

## 6. Recommended Tech Stack

### Option A: Client-Side Only (LocalStorage)

| Component | Technology |
|-----------|------------|
| Frontend | HTML + Vanilla JS (same as current) |
| Storage | LocalStorage + JSON files |
| PDF | html2pdf.js (existing) |

**Pros:** Simple, no server, same tech as current
**Cons:** No real authentication, data tied to browser, no multi-device

### Option B: Backend with Simple JSON Storage

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Database | JSON files (lowdb) or SQLite |
| Frontend | Same HTML/JS |
| Auth | JWT tokens |

**Pros:** Real authentication, multi-user, persistent
**Cons:** Requires Node.js setup

### Option C: Full Stack (Recommended)

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Database | SQLite (simple, file-based) |
| Frontend | Vanilla JS (keep consistency) |
| Auth | JWT + bcrypt |
| PDF | html2pdf.js |

**Pros:** Production-ready, scalable, secure
**Cons:** More setup

### Option D: No-Code/Low-Code

| Platform | Examples |
|----------|----------|
| Airtable | Database + interface |
| Glide | Mobile app |
| Retool | Internal tools |

**Pros:** Fast setup
**Cons:** Less customization, ongoing costs

---

## 7. Additional Feature Suggestions

### Priority 1 - Essential

1. **Invoice Recurring** — Template invoices for recurring clients
2. **Client Notes** — Internal notes about clients (admin only)
3. **Email Notifications** — Send invoice links to clients

### Priority 2 - Nice to Have

4. **Dashboard Charts** — Revenue over time, project status pie chart
5. **Export Data** — CSV export of invoices, clients
6. **Invoice Templates** — Multiple designs (currently only one)

### Priority 3 - Future

7. **Proposal Generation** — Integrate with existing proposal tool
8. **Time Tracking** — Log hours per project
9. **Quotation System** — Create quotes before invoices
10. **Payment Integration** — Stripe/Razorpay links in invoices
11. **Multi-admin** — Multiple staff accounts
12. **Activity Log** — Who did what, when

---

## 8. Implementation Phases

### Phase 1: Core (MVP)
- [ ] User auth (login/register/password change)
- [ ] Admin: Create/manage clients
- [ ] Admin: Create invoices (save only)
- [ ] Client: View own invoices

### Phase 2: Invoice Features
- [ ] Admin: Print invoices (PDF)
- [ ] Client: Print own invoices
- [ ] Invoice status (paid/unpaid)

### Phase 3: Projects
- [ ] Admin: Create/update projects
- [ ] Client: View project progress
- [ ] Project updates/notes

### Phase 4: Enhancement
- [ ] Dashboard stats
- [ ] Search/filter
- [ ] Export functionality

---

## 9. Questions for Decision

1. **Tech Stack Preference:** Which option do you prefer (A, B, C, or D)?
2. **Data Storage:** Should data persist across browsers (needs server) or stay in browser (local only)?
3. **Invoice Source:** Should invoices pull client data from database or manual entry like now?
4. **Proposal Integration:** Should proposal generator also be part of this CRM?

---

*Document Version: 1.0*
*Created: May 2026*