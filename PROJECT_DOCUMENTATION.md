# WebWynk Proposal Generator - Project Documentation

## Overview

WebWynk Proposal Generator is a web-based tool for creating professional business proposals and invoices. Developed by **WebWynk** (a Digital Marketing Agency based in Kolkata, India), this tool allows users to fill in client and project details through an interactive editor and generate polished PDF documents.

---

## Project Structure

```
proposal generator/
├── index.html          # Main login page & router
├── admin.html          # Admin dashboard
├── admin-*.html        # Admin subpages (clients, invoices, etc.)
├── client.html         # Client dashboard
├── client-*.html       # Client subpages
├── proposal.html       # Proposal generator standalone page
├── invoice.html        # Invoice generator standalone page
├── css/
│   ├── dashboard.css   # Main dashboard styles
│   ├── editor.css      # Editor specific styles
│   └── auth.css        # Login page styles
├── js/
│   ├── admin.js        # Admin logic
│   ├── client.js       # Client portal logic
│   ├── auth.js         # Authentication logic
│   ├── proposal-maker.js # Proposal generator logic
│   └── invoice-maker.js  # Invoice generator logic
└── assets/
```

---

## Pages Overview

### 1. Proposal Generator (`index.html`)

The main proposal creation tool with a 4-page document structure:

| Page | Content |
|------|---------|
| **Page 1** | Cover, Client Details, Agency Info, Project Overview, Project Scope |
| **Page 2** | Growth Blueprint, Why Choose Us (6 points), Our Process (4 steps) |
| **Page 3** | Investment/Pricing Table, Payment Milestones, Project Timeline, Payment Details |
| **Page 4** | Terms & Conditions, Footer |

**Editor Sections:**
- Proposal Info (Number, Date)
- Client Details (Name, Company, Email, Phone, Address)
- Project Details (Title, Overview)
- Project Scope (Dynamic rows - add/remove items)
- Growth Blueprint (Strategy description)
- Why Choose Us (Static - 6 predefined points)
- Timeline (Duration, Start Date, Delivery Date)
- Pricing & Payment (Services with pricing, Payment milestones)
- Region toggle (India INR / Worldwide USD)

### 2. Invoice Generator (`invoice.html`)

A single-page invoice document with:

- Invoice header with number and date
- Balance due calculation
- Bill To / From sections
- Service line items table
- Payment milestones (optional)
- Payment received tracking
- Payment methods based on region

**Editor Sections:**
- Invoice Info (Number, Date)
- Client Details (Billed To)
- Services & Pricing (Line items)
- Payment Milestones (Optional)
- Payment Received tracking

---

## Technical Implementation

### Technology Stack

| Category | Technology |
|----------|------------|
| **HTML** | Semantic HTML5 |
| **CSS** | Vanilla CSS with CSS Variables |
| **JavaScript** | Vanilla ES6+ (no frameworks) |
| **PDF Generation** | html2pdf.js (v0.10.2) |
| **Fonts** | Google Fonts (Bricolage Grotesque, Inter) |
| **Icons** | SVG inline icons |

### CSS Design System

**Color Palette:**
```css
--color-primary: #ff5028        /* Orange-red */
--color-secondary: #7864f0       /* Purple */
--color-bg: #f0f0ff              /* Light lavender */
--color-title: #21212d           /* Dark navy */
--color-body: #54595f            /* Gray */
--color-white: #ffffff
--color-border: #e2e2f0
--color-input-bg: #f8f8ff
--color-success: #22c55e        /* Green */
```

**Typography:**
- Headings: `Bricolage Grotesque` (serif-style display font)
- Body: `Inter` (sans-serif)

**Layout:**
- Two-column grid: 440px editor + flexible preview
- Full viewport height (`100vh`)
- Scrollable panels

### JavaScript Architecture

**Key Functions (script.js):**

| Function | Purpose |
|----------|---------|
| `init()` | Initialize defaults, dates, event bindings |
| `bindInputEvents()` | Link form inputs to preview updates |
| `bindTabEvents()` | Region toggle (India/Worldwide) |
| `addScopeRow()` | Add dynamic project scope items |
| `addServiceRow()` | Add pricing line items |
| `addMilestoneRow()` | Add payment milestone rows |
| `updateInvoicePreview()` | Render pricing table in preview |
| `updateScopePreview()` | Render scope table in preview |
| `updateMilestonePreview()` | Render milestones in preview |
| `formatCurrency()` | Format INR/USD with proper localization |
| `bindPrintButton()` | PDF generation with html2pdf.js |

**Key Functions (invoice.js):**

- Same pattern as script.js for invoice-specific functionality
- Additional balance calculation: `total - received = balance due`
- Payment received date tracking

### PDF Generation

The tool uses `html2pdf.js` to generate PDFs with:
- A4 portrait format (210mm × 297mm)
- 2mm margin on all sides
- JPEG image quality at 98%
- Scale factor of 2 for clarity
- Page break handling for multi-page proposals

---

## Features

### Core Features

1. **Live Preview** - Real-time document updates as user types
2. **Dynamic Rows** - Add/remove scope items, services, milestones
3. **Multi-Currency** - Toggle between India (₹) and Worldwide ($)
4. **PDF Export** - Generate professional PDF documents
5. **Auto Date** - Default to today's date on load
6. **Timeline Calculator** - Auto-calculate delivery date from duration
7. **Payment Tracking** - Track received payments vs. total

### Pre-populated Content

**Agency Information (Static):**
- Name: WebWynk
- Email: contact@webwynk.com
- Phone: +91 9083895364 / +91 6295666768
- Address: Sector V, Kolkata, India
- Website: webwynk.com

**Payment Details (India):**
- Bank: State Bank of India
- Account Holder: Hasanur Jaman
- Account Number: 43467519027
- IFSC: SBIN0011371
- Type: Savings

**Payment Methods (Worldwide):**
- PayPal: webwynk.com/payment/
- Wise: wise.com/pay/business/hasanurjaman

**Default Scope Items:**
- Number of Pages
- Functionality
- Security Enhancement
- Basic SEO

**Default Milestones:**
- 50% Advance
- 50% On Delivery

**"Why Choose Us" Points:**
1. Expert Team (5+ years experience)
2. On-Time Delivery
3. 24/7 Support
4. Custom Solutions
5. Transparent Pricing
6. Proven Results

**Process Steps:**
1. Discovery
2. Design
3. Development
4. Launch

---

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  EDITOR PANEL (440px)          │  PREVIEW PANEL (flex)     │
│  ┌─────────────────────────┐   │  ┌─────────────────────┐ │
│  │ Header with Logo        │   │  │                     │ │
│  ├─────────────────────────┤   │  │   Live Preview      │ │
│  │                         │   │  │   Document          │ │
│  │ Form Sections           │   │  │                     │ │
│  │ (Scrollable)            │   │  │   - Proposal        │ │
│  │                         │   │  │   - Invoice         │ │
│  │                         │   │  │                     │ │
│  ├─────────────────────────┤   │  │                     │ │
│  │ Print Button (Sticky)  │   │  │                     │ │
│  └─────────────────────────┘   │  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Behavior

- **Desktop (>1200px):** Full two-column layout
- **Tablet (768-1200px):** Stacked layout with narrower editor
- **Mobile (<768px):** Single column, tabs for editor/preview

---

## External Dependencies

| CDN | Version | Purpose |
|-----|---------|---------|
| Google Fonts | - | Bricolage Grotesque, Inter |
| html2pdf.js | 0.10.2 | PDF generation |

---

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

---

## Future Enhancements (Potential)

1. Local storage persistence for drafts
2. Template selection/management
3. Client management database
4. Email delivery integration
5. Digital signature support
6. Dark mode toggle
7. Multi-language support

---

## Credits

- **Developer:** WebWynk (Digital Marketing Agency)
- **Location:** Sector V, Kolkata, India
- **Contact:** contact@webwynk.com

---

*Last Updated: May 2026*