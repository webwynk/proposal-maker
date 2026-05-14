# Project Section Redesign Plan
## WebWynk CRM — Admin + Client Views

---

## 1. Current State Analysis

### What exists right now

#### Admin Side (`admin-client-view.html` → Projects Tab)
- `clientProjectsList` container rendered by `renderProjectCard()` in `admin.js`
- Each card has: name + type pill + priority badge + status badge + timeline row
- Notes/description block
- Progress bar in a plain `#f8fafc` box
- Milestone Grid (auto-fill cards, click to edit/add)
- Footer row: Files Repository | Collaboration Feed | Project Settings | Remove Project
- Add Milestone card (dashed border, + icon)

#### Client Side (`client-projects.html` → `projectsList`)
- Identical card structure but **read-only** (no edit/delete/settings buttons)
- Milestones: click opens a **view-only** `milestoneModal`
- Footer row: Files Repository | Collaboration Feed only

#### Current Problems (from screenshot)
1. **No visual hierarchy** — project name, priority, status, type all share the same visual weight
2. **Progress section** is a plain grey box, looks like a form field
3. **Milestone cards** are uniform — no visual status differentiation (done vs in-progress vs not-started)
4. **Footer action row** looks like plain text links, not clear CTAs
5. **No project status accent** — cards don't visually indicate lifecycle stage
6. **Zero spacing rhythm** — items stack without breathing room
7. **Add Milestone card** inconsistent with real milestone cards
8. **Empty milestone state** is plain text with no helpful UI

---

## 2. Design Vision

> **Think: Linear / Notion / ClickUp project card** — clean white card, left-border status accent colour, milestone progress indicators, action bar with icon buttons. Modern, airy, information-dense but not cluttered.

### Design Tokens (aligned with REDESIGN_PLAN.md)
```
--primary:   #ff5028   (CTAs, delete)
--secondary: #7864f0   (accent, active milestone fill)
--bg:        #f5f5fa
--surface:   #ffffff
--title:     #18181b
--body:      #52525b
--muted:     #a1a1aa
--border:    #e4e4e7
--success:   #22c55e
```

### Status → Left-border Accent Colour Mapping
| Status | Accent Colour |
|---|---|
| discovery | `#7864f0` (purple) |
| design | `#f59e0b` (amber) |
| development | `#3b82f6` (blue) |
| testing | `#ec4899` (pink) |
| launched | `#22c55e` (green) |

---

## 3. Component Breakdown

### 3A. Project Card Shell
**Current:** Flat white card, `border-radius: 20px`, no left-border  
**New:** White card, **4px left-border** coloured by project status, `border-radius: 0 16px 16px 0`

### 3B. Project Header Row
**Current:** Name + type pill inline, priority + status badges inline  
**New:**
- **Left zone:** Name (`1.25rem`, `font-weight: 700`) → type pill on new row → timeline chip below
- **Right zone:** Priority badge + status badge stacked vertically

### 3C. Progress Section
**Current:** Plain `#f8fafc` padded box  
**New:** No background box:
- Label row: `OVERALL COMPLETION` (muted, 0.7rem uppercase) + `{n}%` (bold, secondary colour)
- Bar: 8px tall, `border-radius: 4px`, fill = secondary, track = border colour
- Below bar: `{n} of {total} milestones complete` in muted text

### 3D. Milestone Section Header
**Current:** `MILESTONE ROADMAP` label squished with buttons  
**New:**
- Section divider (`border-top: 1px solid var(--border)`)
- Label: `Milestone Roadmap` (`font-weight: 700`, `0.95rem`)
- Admin: `+ Add Milestone` button floated right
- Client: no add button

### 3E. Milestone Cards
**Current:** All cards look identical regardless of progress  
**New:** Visual status from `m.progress`:
- `0%` → class `ms-pending` (grey left border + empty-circle icon)
- `1–99%` → class `ms-active` (blue left border + clock icon)
- `100%` → class `ms-done` (green left border + checkmark icon)

Card layout:
```
┌─────────────────────────────────────────┐
│ ● DONE  /  ◐ IN PROGRESS  /  ○ PENDING  │  ← status icon
│ Milestone Title (bold)                   │
│ Description (2-line clamp, muted)        │
│ ▓▓▓▓▓▓░░░░  45%                         │  ← progress bar + %
│ Due: 31 May 2026         🔗  📄          │  ← date + action icons
└─────────────────────────────────────────┘
```

### 3F. Add Milestone Card (Admin Only)
**Current:** Dashed border with plain text `+`  
**New:** Same dashed border with SVG plus-circle icon:
- Hover: `border-color: var(--secondary)`, faint purple background
- Text: `Add a Milestone`

### 3G. Empty Milestone State
**Current:** Plain `<div>No milestones defined yet.</div>`  
**New:** Structured empty state:
- SVG icon (flag/rocket)
- Heading: `No milestones yet`
- Subtext: `Break this project into phases to track progress`
- Admin: `+ Add First Milestone` CTA button

### 3H. Project Footer Action Bar
**Current:** Raw emoji + `btn btn-outline` row  
**New:** Clean icon-button bar:

Left group (admin + client):
- Folder SVG + `Files`
- Message-circle SVG + `Comments`

Right group (admin only):
- Gear SVG + `Settings` (ghost button)
- Trash SVG + `Remove` (danger ghost button)

Footer: `border-top: 1px solid var(--border)`, `padding-top: 20px`, `margin-top: 28px`

---

## 4. New CSS Classes Required

Add to `css/dashboard.css` (additive only, no removals):

```css
/* Left-border status accent on project card */
.project-card-saas { border-left: 4px solid var(--border); border-radius: 0 16px 16px 0; }
.project-card-saas.status-discovery   { border-left-color: #7864f0; }
.project-card-saas.status-design      { border-left-color: #f59e0b; }
.project-card-saas.status-development { border-left-color: #3b82f6; }
.project-card-saas.status-testing     { border-left-color: #ec4899; }
.project-card-saas.status-launched    { border-left-color: #22c55e; }

/* Milestone status variants */
.milestone-card.ms-done    { border-left: 3px solid #22c55e; }
.milestone-card.ms-active  { border-left: 3px solid #3b82f6; }
.milestone-card.ms-pending { border-left: 3px solid var(--border); }
.ms-status-icon { width: 18px; height: 18px; margin-bottom: 8px; }

/* Project footer bar */
.project-footer-bar {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 20px; margin-top: 28px;
}
.project-footer-left, .project-footer-right { display: flex; gap: 8px; }

/* Icon action buttons */
.btn-icon {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600;
  border: 1px solid var(--border); background: transparent; color: var(--body);
  cursor: pointer; transition: all 0.2s;
}
.btn-icon:hover { background: var(--bg); color: var(--title); }
.btn-icon.danger { color: #ef4444; border-color: #fee2e2; }
.btn-icon.danger:hover { background: #fef2f2; }

/* Progress section */
.project-progress-section { margin: 24px 0; }
.project-progress-meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
.project-progress-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.project-progress-value { font-size: 0.85rem; font-weight: 700; color: var(--secondary); }
.project-progress-sub { font-size: 0.75rem; color: var(--muted); margin-top: 6px; }

/* Milestone empty state */
.milestone-empty {
  grid-column: 1 / -1; text-align: center; padding: 40px 20px;
  border: 2px dashed var(--border); border-radius: 12px; color: var(--muted);
}
.milestone-empty h4 { font-size: 0.95rem; font-weight: 700; color: var(--body); margin: 8px 0 6px; }
.milestone-empty p { font-size: 0.8rem; margin: 0 0 16px; }

/* Milestone section header */
.milestone-section-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 24px; margin-top: 4px; border-top: 1px solid var(--border);
  margin-bottom: 20px;
}
.milestone-section-title { font-size: 0.95rem; font-weight: 700; color: var(--title); }
```

---

## 5. JS Template Changes

### Files to change
| File | Change |
|---|---|
| `js/admin.js` | Rewrite `renderProjectCard()` function only (lines 801–894) |
| `js/client.js` | Rewrite `renderProjectCard()` function only (lines 174–256) |

> ⚠️ **All function names, IDs, and `window.*` exposures remain identical.** Only the HTML string returned by `renderProjectCard()` changes.

### Template Changes in `renderProjectCard()`

1. Card element: add `status-${p.status}` class
2. Project name: move type pill below name (not beside)
3. Progress bar: remove wrapper box, use `.project-progress-section`
4. Milestones: derive `ms-done / ms-active / ms-pending` class; add SVG status icon
5. Footer: replace raw buttons with `.btn-icon` + `.project-footer-bar`
6. Empty state: replace plain text with `.milestone-empty`

---

## 6. Modal Improvements

### Milestone Modal — Admin (Edit/Add)
- Progress field: add `<input type="range">` slider with live number display beside it
- Range slider styled with secondary colour fill

### Milestone Modal — Client (View)
- Replace plain `msProgressView` text with a styled progress bar
- Add status label: `Done` / `In Progress` / `Pending`

### Collaboration (Comments) Modal
- Admin avatar: purple (`var(--secondary)`)
- Client avatar: orange (`var(--primary)`)
- `Send` button: paper-plane SVG icon button
- Comment bubbles: already well-structured, just refine colours

### Files Modal
- Styled upload zone: dashed border, upload SVG, "Click to upload or drag and drop"
- File list: file extension icon + name + uploader badge

---

## 7. Implementation Phases

| Phase | Work | Files |
|---|---|---|
| **A** | Add new CSS classes | `css/dashboard.css` |
| **B** | Admin `renderProjectCard()` rewrite | `js/admin.js` |
| **C** | Client `renderProjectCard()` rewrite | `js/client.js` |
| **D** | Milestone modal improvements | `admin-client-view.html`, `client-projects.html` |
| **E** | Files + Comments modal improvements | same HTML files |

---

## 8. IDs / Functions That Must Not Change

| ID / Function | Used by |
|---|---|
| `clientProjectsList` | `admin.js → loadClientProjects()` |
| `projectsList` | `client.js → renderProjects()` |
| `openMilestoneModal(id, idx)` | admin milestone card onclick |
| `viewMilestone(id, idx)` | client milestone card onclick |
| `openProjectFiles(id)` | footer files button |
| `openProjectComments(id)` | footer comments button |
| `editProject(id)` | admin footer settings button |
| `deleteProject(id)` | admin footer remove button |
| `milestoneModal`, `filesModal`, `commentsModal` | closeModal() calls |
| `milestoneProjectId`, `milestoneIndex` | saveMilestone() reads |
| `msTitle`, `msStartDate`, `msEndDate`, `msProgress`, `msDesc`, `msLink`, `msFile` | saveMilestone() reads |
| `msTitleView`, `msDateView`, `msProgressView`, `msDescView` | viewMilestone() writes |
| `projectFilesTable`, `currentProjectFilesId`, `fileUploadInput` | file upload/load |
| `commentsList`, `currentCommentProjectId`, `commentText` | comments load/post |

---

## 9. Progress Tracker

| Phase | Task | Status |
|---|---|---|
| A | CSS additions to dashboard.css | ✅ Complete |
| B | Admin renderProjectCard() rewrite | ✅ Complete |
| C | Client renderProjectCard() rewrite | ✅ Complete |
| D | Milestone modal improvements | ✅ Complete |
| E | Files + Comments modal improvements | ✅ Complete |
