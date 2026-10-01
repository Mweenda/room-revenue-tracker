This documentation provides a comprehensive technical blueprint for code generation and workflow automation of your boarding house billing system, specifically optimized for development 

It outlines the data schema, the exact state machine logic for the Billing Status Breakdown, and the architecture for Make.com scenarios.

1. Core Data Model (Billing Record Schema)
Each row in the Monthly Billing Tab table represents an individual bed space/billing unit. In Make.com, this maps to a JSON object or a Data Store record with the following structure:
{
  "billing_id": "ANX-19-A",
  "house_block": "ANX",
  "tenant_name": "Samantha Musako (Kakompe)",
  "phone_number": "260977227794",
  "current_rent": 1200.00,
  "entry_date": "2026-06-26",
  "adjustments_fees": 0.00,
  "adjustment_notes": "",
  "target_month": "Jul",
  "accumulated_total": 8400.00,
  "total_balance": 1200.00,
  "billing_status": "🟢 Open Window"
}

2. Billing Status State Machine (Make.com Router Logic)
To automate status updates, a Make.com Router should evaluate each record using the following sequential conditional filters:
Route 1: Vacant
    • Business Rule: The bed space is currently unoccupied.
    • Make.com Filter Condition:
        ◦ tenant_name Equals (case insensitive) Vacant
    • Expected Balance: 0
Route 2: Paid / Secured
    • Business Rule: The tenant has fully cleared their outstanding balance or has pre-paid for an upcoming month (e.g., Target Month is Aug).
    • Make.com Filter Condition:
        ◦ tenant_name Not Equals Vacant
        ◦ AND total_balance Numeric Equals 0
Route 3: Grace Period
    • Business Rule: Active tenants with early entry dates or approved extensions who possess an outstanding balance that does not yet trigger an overdue status.
    • Make.com Filter Condition:
        ◦ tenant_name Not Equals Vacant
        ◦ AND total_balance Numeric Greater Than 0
        ◦ AND tenant_name In Array ["Collins Mubanga", "McDonald", "Jairos Banda", "Christopher Phiri"] (or flagged via an approved extension date)
Route 4: Overdue / Unpaid
    • Business Rule: The tenant has missed the payment window, owes more than a single month's rent, or their billing cycle belongs to a previous month (e.g., Jun, Mar).
    • Make.com Filter Condition:
        ◦ tenant_name Not Equals Vacant
        ◦ AND (total_balance Numeric Greater Than current_rent OR target_month In Array ["Jun", "Mar"])
Route 5: Open Window
    • Business Rule: The current active billing cycle (e.g., Jul) is open, and the tenant owes exactly the current month's rent.
    • Make.com Filter Condition:
        ◦ tenant_name Not Equals Vacant
        ◦ AND total_balance Numeric Equals current_rent
        ◦ AND target_month Equals Jul

3. Billing Status Breakdown Metrics (Dashboard Aggregations)
When generating the dashboard summary table, metrics are aggregated by counting the beds and summing their Current Rent (representing the monthly capacity value under that status), rather than summing the Total Balance.
Status	Target Bed Count	Target Amount Calculation (Current Rent)	Business Meaning
🟢 Open Window	27	28,750	Active current-month invoices awaiting payment.
✅ Paid / Secured	10	10,900	Fully settled or advanced accounts.
❌ OVERDUE / UNPAID	7	7,150	Critical accounts requiring collection/escalation.
Vacant	6	5,900	Unutilized bed capacity.
⏳ Grace Period	4	4,200	Temporary payment extensions granted.
Total System Capacity	54 Beds	56,900 (Total Expected Revenue)	100% Occupancy Value

4. Recommended Make.com Scenario Architecture
To build this out seamlessly in Make.com, structure the logic into three independent, decoupled scenarios:
Scenario A: Monthly Billing Initialization (Triggered 1st of the Month)
    1. Trigger: Schedule module runs on the 1st of every month.
    2. Action: Fetch all active beds from the master inventory.
    3. Logic:
        ◦ If tenant_name is "Vacant", set total_balance = 0.
        ◦ If occupied, roll over any previous total_balance into accumulated_total, add the new month's current_rent, and set the target_month to the new month string.
    4. Router: Route through the State Machine Filters (Section 2) to assign the initial billing_status.
Scenario B: Payment Processing & Webhook Integration
    1. Trigger: Custom Webhook receives a payment notification (e.g., from a mobile money gateway or bank integration).
    2. Action: Search for the tenant record using phone_number or billing_id.
    3. Logic:
        ◦ Deduct the payment amount from total_balance.
        ◦ Log any partial payment details in adjustments_fees and adjustment_notes.
    4. Router: Re-evaluate the record through the state machine router to instantly transition the status (e.g., from 🟢 Open Window to ✅ Paid / Secured).
Scenario C: Dashboard Metrics Sync (Nightly Batch or Real-Time)
    1. Trigger: Runs after Scenario A/B completes, or on a nightly cron schedule.
    2. Action: Use an Aggregator module to group all records by billing_status.
    3. Logic: Compute the COUNT(billing_id) and SUM(current_rent) for each status group.
    4. Action: Update the executive summary metrics table to keep the dashboard perfectly aligned.
