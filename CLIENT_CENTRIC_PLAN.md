# Client-Centric Admin Dashboard Refactoring Plan

This document outlines the step-by-step implementation plan for migrating the WebWynk CRM Admin Dashboard from a global view architecture to a client-centric "Dossier" architecture.

## Phase 1: Navigation and UI Preparation

### Step 1.1: Update Global Navigation (Sidebar)
*   **Target File:** `admin.html`, `admin-clients.html`, and any other admin pages with a sidebar.
*   **Action:** Remove the sidebar links for "Invoices", "Proposals", and "Projects".
*   **Goal:** Streamline the primary navigation to focus purely on "Dashboard" and "Clients".

### Step 1.2: Enhance the Client List
*   **Target File:** `admin-clients.html` & `js/admin.js`
*   **Action:** Update the clients table rendering logic in `admin.js`. Add a prominent **"View Profile"** (or 👁️ icon) button alongside the existing Edit/Delete buttons.
*   **Action:** Ensure the "View" button links to a new route, passing the client ID (e.g., `admin-client-view.html?id=[CLIENT_ID]`).

## Phase 2: Building the Client Dossier Interface

### Step 2.1: Create the Client View Layout
*   **Target File:** Create `admin-client-view.html` (can copy structure from `admin-clients.html` for consistency).
*   **Action:** Implement the layout structure:
    *   **Header Section:** Display Client Name, Company, Email, Phone, and quick summary stats (e.g., Total Revenue, Active Projects).
    *   **Tabbed Navigation Bar:** Create HTML/CSS for tabs: `[ Overview | Invoices | Proposals | Projects ]`.
    *   **Tab Content Containers:** Create empty `<div>` containers for each tab's content.

### Step 2.2: Migrate UI Components
*   **Action:** Move the tables and "Create New" buttons from the old global files (`admin-invoices.html`, `admin-proposals.html`, `admin-projects.html`) into their respective tab containers within `admin-client-view.html`.
*   **Action:** Modify the "Create New" modals/forms so that the `Client ID` field is either hidden or read-only, automatically pre-filled based on the client currently being viewed.

## Phase 3: JavaScript Refactoring and Data Binding

### Step 3.1: URL Parsing and Initialization
*   **Target File:** `js/admin.js`
*   **Action:** Add logic to detect when the user is on `admin-client-view.html`.
*   **Action:** Parse the `?id=` parameter from the URL to get the active `CLIENT_ID`.
*   **Action:** Fetch the specific client's base details (`/api/clients/:id` - might need a new endpoint or filter from existing data) to populate the Header Section.

### Step 3.2: Implement Tab Switching Logic
*   **Target File:** `js/admin.js`
*   **Action:** Write a function to handle tab clicks, toggling the visibility of the respective content containers and updating the active state of the tab buttons.

### Step 3.3: Client-Specific Data Loading
*   **Target File:** `js/admin.js`
*   **Action:** Create or modify loading functions to filter by client:
    *   `loadClientInvoices(clientId)`: Fetch and render only this client's invoices.
    *   `loadClientProposals(clientId)`: Fetch and render only this client's proposals.
    *   `loadClientProjects(clientId)`: Fetch and render only this client's projects.
*   *Note: The backend API already supports client-specific filtering, or we can filter the global list client-side if the dataset is small, but server-side filtering is preferred.*

### Step 3.4: Update Create/Edit/Delete Operations
*   **Target File:** `js/admin.js`
*   **Action:** Ensure that when an admin submits a new Invoice/Proposal/Project from the Client View, the payload automatically includes the correct `CLIENT_ID`.
*   **Action:** Ensure that after a successful Create/Edit/Delete operation, only the relevant client-specific data table is refreshed, rather than reloading the entire page.

## Phase 4: Cleanup and Finalization

### Step 4.1: Delete Deprecated Files
*   **Action:** Safely delete `admin-invoices.html`, `admin-proposals.html`, and `admin-projects.html` as their functionality is now housed within the Client Dossier.

### Step 4.2: End-to-End Testing
*   **Action:** Verify the complete flow:
    1.  Log in as Admin.
    2.  Navigate to Clients.
    3.  Click "View" on a client.
    4.  Switch between Invoices, Proposals, and Projects tabs.
    5.  Create a new invoice within the client view and verify it attaches correctly.
    6.  Verify dashboard statistics still aggregate correctly across all clients.

## Future Considerations (Post-Implementation)
*   **Client Notes Tab:** Add a section for admins to leave internal notes on a client.
*   **Timeline/Activity Feed:** Create a chronological history of all actions related to a specific client.
