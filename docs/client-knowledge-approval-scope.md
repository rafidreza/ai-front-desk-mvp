# Client Knowledge Approval Scope

**Status:** Improvement task T51  
**Last updated:** 2026-05-19  
**Owner:** Product + internal operations

## Purpose

Clients should be able to keep business knowledge current without directly changing the live AI knowledgebase. The client portal should collect structured update requests, while the internal portal keeps final publishing control until the workflow is proven safe.

## Client-Editable Scope

Clients may submit requests for business facts that are safe to review and publish into `KnowledgeEntry` records:

- Delivery areas, delivery fees, cash-on-delivery rules, and delivery timelines.
- Return, exchange, refund, cancellation, and warranty policy text.
- Product details such as sizes, materials, colors, care instructions, fit notes, and bundle contents.
- Stock and availability notes when phrased as general guidance, not real-time inventory guarantees.
- Payment methods, advance payment rules, bkash/nagad/bank transfer instructions, and invoice notes.
- Store hours, pickup address, contact information, page links, and holiday closures.
- Campaign, discount, preorder, custom order, or launch notes with clear start/end dates.
- Common customer questions that the AI currently misses.
- Preferred answer wording, tone notes, or customer-facing clarifications for a specific KB item.

## Blocked Or Internal-Only Scope

Clients must not directly edit operational controls that affect system safety, routing, or model behavior:

- System prompts, prompt profiles, model selection, temperature, or AI runtime settings.
- Embedding settings, vector indexes, retrieval weights, confidence thresholds, or reindex jobs.
- QA scores, calibration results, hallucination tags, containment metrics, or internal defect labels.
- Ticket escalation rules, urgent-alert routing, internal assignees, or SLA configuration.
- Raw imported files, OCR diagnostics, ingestion logs, provider logs, webhook credentials, or API tokens.
- Version rollback controls and archive/delete actions on live KB entries.
- Cross-client data, internal notes that are not explicitly shared, and operational audit logs.

## Auto-Block Rules

Client submissions should be accepted as requests but flagged or blocked from auto-publishing when they include:

- Payment credentials or secrets beyond approved public payment instructions.
- Claims that guarantee exact stock, exact delivery date, refund approval, or policy exceptions.
- Medical, legal, financial, or regulated advice.
- Aggressive, discriminatory, abusive, or unsafe language.
- Requests to hide escalation options or prevent customers from reaching a human.
- Contradictions with an already active policy entry.
- Empty, duplicate, or very low-information content.

## Approval Rules

All client-submitted KB changes should begin as `submitted` requests and not modify live knowledge until reviewed.

Allowed internal review outcomes:

- `approved`: publish exactly as submitted.
- `edited_then_published`: internal reviewer adjusts wording and publishes.
- `needs_clarification`: request remains open and client sees the reviewer question.
- `rejected`: request is closed with a clear client-visible reason.

Publishing must:

- Create or update a live `KnowledgeEntry`.
- Write a `KnowledgeEntryVersion` snapshot.
- Preserve reviewer identity and timestamps.
- Trigger embedding refresh for the published entry.
- Keep the original client submission immutable for audit history.

## Client Portal UX Rules

The client portal should describe this as "Business knowledge updates", not as low-level AI configuration.

Clients should see:

- Published KB entries for their own workspace only.
- Their submitted requests and statuses.
- Reviewer comments when a request is rejected or needs clarification.
- A simple add/edit request form with category, question/title, answer/content, urgency, and notes.

Clients should not see:

- Internal-only fields, model configuration, embeddings, raw logs, or cross-client review queues.
- Internal reviewer discussion unless explicitly marked client-visible.

## Internal Portal UX Rules

The internal portal should have a KB review queue for triage and publishing.

Reviewers should be able to:

- Filter by client, status, urgency, category, and submitted date.
- Compare current published content against proposed content.
- Edit proposed wording before publishing.
- Reject or request clarification with a client-visible reason.
- See full audit history for the request.

## Permission Boundary

- Client-authenticated users can create requests only for their own `clientId`.
- Client-authenticated users can read only published entries and their own request history.
- Internal users can review requests across clients through authenticated internal API routes.
- Live `KnowledgeEntry` create/update/archive/publish actions remain internal-only.
