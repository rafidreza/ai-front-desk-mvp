# Google Sheet Data Source Contract

**Status:** Improvement task T63  
**Last updated:** 2026-05-23  
**Owner:** Product + engineering

## Purpose

Clients should be able to connect one Google Sheet that contains operational facts the AI can safely use for customer replies. The first supported use cases are product availability and order status. The sheet is treated as a client-owned external data source, not as editable AI configuration.

## MVP Decision

The MVP should support public or link-shareable Google Sheets exported as CSV. OAuth-based private Sheet access is useful later, but it adds Google app verification, token storage, refresh handling, and client permission complexity. For the first version, the client can share a Sheet link that is visible to "anyone with the link" and can revoke access from Google Sheets at any time.

The system should not read the sheet live for every customer message. It should sync and cache normalized records, then answer from the cached database copy. If the data is stale, missing, or invalid, the AI should say it needs the team to confirm instead of inventing availability or order status.

## Supported Sheet Layout

The connected spreadsheet should contain these tabs:

| Tab | Required | Purpose |
|---|---:|---|
| `Products` | Yes | Product catalog, stock state, price, variants, and availability notes. |
| `Orders` | Optional | Order status lookup for customers who provide an order identifier. |

Column names are case-insensitive. Spaces, hyphens, and underscores should be normalized, so `Product Name`, `product_name`, and `product-name` are treated as the same field.

## Products Tab Template

| Column | Required | Example | Notes |
|---|---:|---|---|
| `sku` | One of `sku` or `product_name` | `KURTI-BLK-M` | Stable product identifier when available. |
| `product_name` | One of `sku` or `product_name` | `Black Cotton Kurti` | Used for customer search and display. |
| `variant` | No | `Black / M` | Size, color, bundle, or option label. |
| `availability_status` | Yes | `in_stock` | Allowed values: `in_stock`, `low_stock`, `out_of_stock`, `preorder`, `discontinued`, `unknown`. |
| `stock_quantity` | No | `12` | Non-negative number. Used only when the client is comfortable exposing quantity. |
| `price` | No | `1490` | Numeric amount in the client's default currency. |
| `currency` | No | `BDT` | Defaults to the client currency if empty. |
| `product_url` | No | `https://...` | Optional customer-facing product link. |
| `availability_note` | No | `Restock expected Sunday` | Short customer-safe note. |
| `last_updated_at` | No | `2026-05-23 14:30` | Client-entered freshness hint. |

## Orders Tab Template

| Column | Required | Example | Notes |
|---|---:|---|---|
| `order_id` | Yes | `ORD-1042` | Customer-provided lookup key. |
| `customer_phone` | No | `017...` | Optional privacy check. Store normalized digits only if used. |
| `customer_email` | No | `buyer@example.com` | Optional privacy check. |
| `customer_name` | No | `Nadia` | Display only when needed for internal review. |
| `order_status` | Yes | `shipped` | Allowed values: `received`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled`, `returned`, `unknown`. |
| `payment_status` | No | `paid` | Allowed values: `unpaid`, `partial`, `paid`, `refunded`, `unknown`. |
| `tracking_url` | No | `https://...` | Customer-facing courier/tracking link. |
| `order_note` | No | `Courier pickup completed` | Short customer-safe note. |
| `last_updated_at` | No | `2026-05-23 14:30` | Client-entered freshness hint. |

## Freshness Rules

- Store the last successful sync time for the connected Sheet.
- Treat product data as fresh for 15 minutes by default.
- Treat order data as fresh for 5 minutes by default because customers expect status answers to be current.
- Show stale data in internal/client UI, but customer-facing AI replies should include a confirmation caveat or escalate when freshness expires.
- Keep the previous successful cache when a sync fails, and record the failure reason separately.

## Customer Reply Rules

For product availability questions:

- Match by SKU first, then product name, then variant keywords.
- Answer only from a normalized product record with a known availability status.
- If several products match, ask a clarifying question instead of picking one.
- If the product is missing or stale, create or update a ticket and say the team will confirm.

For order status questions:

- Require an order ID before lookup.
- If phone or email verification is configured for the client, require a matching customer identifier before exposing status.
- Share only customer-safe fields: status, tracking link, payment status when configured, and public note.
- Never expose another customer's name, phone, email, address, or internal note in a chat reply.

## Client Setup Copy

Client portal setup should ask for:

1. Share the Google Sheet with "Anyone with the link can view".
2. Keep a `Products` tab with the required columns.
3. Add an `Orders` tab only if they want order-status replies.
4. Paste the Google Sheet link into Daemon.
5. Click "Sync now" and fix any validation errors shown.

Suggested helper text:

> We will read this Sheet on a schedule and use it only for product availability and order-status replies. If the Sheet is unavailable or stale, the AI will ask your team to confirm instead of guessing.

## Validation Rules

- Reject links that are not Google Sheets URLs or CSV export URLs.
- Reject sheets without a readable `Products` tab.
- Reject product rows that contain neither `sku` nor `product_name`.
- Normalize known statuses and mark unknown statuses as validation warnings.
- Skip empty rows.
- Store row-level validation errors so the UI can show exactly what the client needs to fix.

## Out Of Scope For First Version

- Private OAuth access to Google Drive or Google Sheets.
- Writing back to the client's Sheet.
- Inventory reservation, checkout, or order mutation.
- Multi-warehouse allocation.
- Exact stock guarantees when the Sheet is stale.
- Using Sheet rows as general knowledgebase entries without review.
