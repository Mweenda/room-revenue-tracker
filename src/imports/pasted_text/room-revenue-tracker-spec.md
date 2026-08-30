Here is a comprehensive design brief and specification document tailored for your graphics designer and frontend team. It captures the full functional requirements, design tokens, and page-by-page layout structure discussed for the **Room Revenue Tracker**.

---

# Design & Frontend Specification: Room Revenue Tracker

## 1. Executive Project Summary

**Room Revenue Tracker** is a dedicated web application designed to manage a 42-room residential property across 4 distinct blocks: **BBH**, **NWG**, **ANX**, and **CRV**. The system automates revenue tracking, student tenant onboarding, prepaid meter utility cost splitting, and maintenance triage, replacing manual spreadsheets with a multi-tenant platform.

The UI must be **mobile-first**, highly responsive (optimised for standard 375px wide smartphone viewports up to desktop resolutions), clean, and high-contrast for ease of navigation on mobile devices.

---

## 2. Design System & Style Tokens

### Theme & Palette

* **Primary / Accent:** Emerald (`#059669` / `emerald-600`) — used for primary calls-to-action (CTAs), verified payment status indicators, and positive balances.


* **Background / Structure:** Slate Neutral (`#0f172a` for dark headers/sidebars; `#f8fafc` for light content backgrounds; `#ffffff` for cards).


* **Status Badges:**
* **Verified / Active:** Soft Emerald (`bg-emerald-100 text-emerald-800`)


* **Pending / In Review:** Soft Amber (`bg-amber-100 text-amber-800`)


* **Rejected / Alert:** Soft Red (`bg-red-100 text-red-800`)





### Typography & Layout Constraints

* **Design Approach:** Mobile-first, card-based responsive layout.


* **Touch Targets:** All buttons, form inputs, and interactive tabs must have a minimum touch target height of **44px** to ensure mobile usability.


* **Typography:** Clean sans-serif font stack (Inter / System Sans) with bold headers and visible numerical indicators for financial ledgers.



---

## 3. Core Architecture & Views Specification

The dashboard system consists of two primary user roles—**Landlord / Property Owner** and **Student Tenant**—and is divided into four main sections: **Portal**, **Pay**, **Utilities**, and **Reports**.

---

### Phase A: Landlord Onboarding Flow

Before accessing the main workspace, a newly registered landlord goes through a structured setup wizard:

1. **Personal & Contact Info:** Landlord full name, contact phone number, house/street address.


2. **Property Capacity & Valuation:** Select block (BBH, NWG, ANX, CRV), configure total available rooms, set bed spaces per room (up to 4 per room), and establish the base rent/value per bed space.


3. **Additional Per-Student Allocations:** Set configurable default allocations, including the **owner utility contribution cap** (default: K70/student) and optional garbage collection fees.



---

### View 1: Portal Page (`/dashboard/portal/`)

The main operational view for the landlord to monitor property occupancy at a glance.

#### UI Components & Sections:

* **Top KPI Bar:** Quick cards showing:
* Total Bed Spaces (42 total across the 4 blocks).


* Occupied Spaces (green badge).


* Vacant Spaces (amber badge).


* Total Verified Monthly Revenue (K).




* **Student Onboarding CTA:** Prominent button (`+ Onboard New Student`) opening a modal or form to assign a student to an available bed space (collecting student full name, phone number, NRC, and move-in date).


* **4-Block Occupancy Grid:** Visual grid representing **BBH**, **NWG**, **ANX**, and **CRV**.


* Each bed space is rendered as an interactive card displaying its auto-generated identifier (e.g., `BBH-101-A`, `NWG-102-B`).


* **Status Colors:** Green = Occupied, Grey = Vacant, Amber = Notice Given.


* **Click / Tap Action:** Tapping a bed space card opens a drawer showing the occupying student's profile, contract details, and current outstanding balance.





---

### View 2: Pay Page (`/dashboard/pay/`)

The core financial ledger and mobile money verification hub.

#### UI Components & Sections:

* **Verification Queue:** Table or card list of submitted mobile money payments (Airtel / MTN) awaiting landlord review.


* **Payment Items Display:**
* Student Name & Bed Space ID (e.g., `CRV-104-A`).


* Submitted Amount (K).


* Mobile Money Transaction Reference Code.


* Payment Proof Thumbnail (clicking opens a full-screen image viewer to inspect uploaded receipts).




* **Verification Controls:** One-click **Verify** (marks payment as verified and updates ledger) or **Reject** (opens prompt for rejection reason, notifying student to resubmit).


* **Revenue Progress Bar:** Block-by-block breakdown showing expected vs. verified revenue for the current billing cycle.



---

### View 3: Utilities Subsystem Page (`/dashboard/utilities/`)

Handles shared prepaid meter entries and automated cost splitting per block.

#### Business Logic & UI Controls:

* **Meter Entry Form:** Allows landlords (or block students) to enter total prepaid meter units purchased and cost per unit for a block.


* **Automated Calculation Summary:**
* System applies owner cap: $\text{Total Owner Contribution} = \text{K70} \times \text{Number of Active Students in Block}$.


* Displays total bill, amount covered by landlord, remaining excess, and exact split owed by each student in the block.




* **Student Utility Ledger:** Status table indicating which students have settled their excess utility split and which remain pending.



---

### View 4: Report & Triage Page (`/dashboard/reports/`)

Maintenance tracking and data export tools.

#### UI Components & Sections:

* **Maintenance Issue Queue:** Triage list of reported issues (Plumbing, Electrical, Structural, Appliance) tagged directly to student bed spaces.


* **Issue Card Detail:** Displays description, attached photo proof (up to 3 photos), reporting date, and current status (Open, In Progress, Resolved).


* **Status Action Dropdown:** Landlord can update issue status and append resolution notes.


* **CSV Export Controls:** Buttons to generate and download streamable CSV reports for:
* Monthly Revenue Ledger


* Occupancy Reports


* Utility Bill Summaries


* Maintenance Logs





---

### View 5: Student Portal (Tenant Perspective)

A simplified, dedicated single-page portal for students logged into the platform:

* **Profile Header:** Student Name, assigned Bed Space ID (e.g., `ANX-102-B`), and move-in date.


* **Balance Card:** Current rent status, utility excess share due, and clear status tags (Paid, Pending, Overdue).


* **Payment Submission Widget:** Form to select payment method (Airtel / MTN), enter transaction reference number, and upload proof of payment image (JPEG/PNG max 5MB).


* **Maintenance Submission Widget:** Simple form to report issues, select category, add descriptions, and upload up to 3 photos.