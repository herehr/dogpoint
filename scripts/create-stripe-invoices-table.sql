-- Create table for Stripe invoices CSV import
-- Column names match CSV header for easy PgAdmin Import

DROP TABLE IF EXISTS stripe_invoices_import;

CREATE TABLE stripe_invoices_import (
  "id"                      TEXT PRIMARY KEY,
  "Amount Due"              NUMERIC(12,2),
  "Billing"                 TEXT,
  "Closed"                  TEXT,           -- true/false as text
  "Currency"                TEXT,
  "Customer"                TEXT,
  "Date (UTC)"              TEXT,           -- keep as text for import
  "Due Date (UTC)"          TEXT,
  "Number"                  TEXT,
  "Paid"                    TEXT,           -- true/false as text
  "Subscription"             TEXT,
  "Subtotal"                NUMERIC(12,2),
  "Total Discount Amount"   NUMERIC(12,2),
  "Applied Coupons"         TEXT,
  "Tax"                     NUMERIC(12,2),
  "Tax Percent"             NUMERIC(8,2),
  "Total"                   NUMERIC(12,2),
  "Amount Paid"             NUMERIC(12,2),
  "Status"                  TEXT
);

CREATE INDEX idx_stripe_invoices_import_subscription ON stripe_invoices_import("Subscription");
CREATE INDEX idx_stripe_invoices_import_status ON stripe_invoices_import("Status");

/*
PgAdmin Import steps:
1. Run this SQL (Query Tool) to create the table
2. Right-click stripe_invoices_import → Import/Export
3. Import tab:
   - Filename: /Users/hermannehringfeld/Downloads/invoices-2.csv
   - Format: csv
   - Header: YES (toggle ON)
   - Delimiter: ,
   - Quote: "
4. Columns tab: leave default (auto-maps by header name)
5. Click OK
*/
