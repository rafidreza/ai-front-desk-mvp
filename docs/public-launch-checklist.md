# Public Launch Checklist

This is the plain-English launch checklist for Daemion.

It has two sections:

- Development tasks: work that a developer can finish in the codebase or deployment setup.
- Stakeholder tasks: work that needs business accounts, content, approvals, credentials, or legal decisions.

## Current Situation

Daemion is technically close to a public staging launch.

The app has:

- Public website and widget.
- Internal operator console.
- Client login and dashboard.
- Knowledge base import/review workflow.
- Messenger, WhatsApp, web chat, ticketing, QA, prompt tuning, and digest foundations.
- Cloudflare staging configuration for `dev.daemion.io` and `api.dev.daemion.io`.
- Public privacy policy page at `/privacy`.
- Email deliverability checklist for Postmark and Cloudflare.

The main blocker is not ordinary coding anymore. The main blocker is real-world setup: seller content, production credentials, Meta approval, DNS/email verification, legal review, and deployment account access.

## Development Tasks Still Pending

### 1. Deploy the app to public HTTPS

Status: blocked until deployment account access is available.

Meaning:

The code already has Cloudflare staging configuration, but someone with access to the Cloudflare/Wrangler account must publish the web app and API with real secrets.

Example:

The developer can run the deploy command, but only after the correct account is logged in and the production secrets are added.

### 2. Connect real provider secrets

Status: blocked until credentials are provided.

Needed secrets include:

- Anthropic API key for production AI replies.
- Meta Messenger Page access token.
- WhatsApp Cloud API credentials, if WhatsApp is included in the launch.
- Postmark server token for real emails.
- Sentry DSN, if production error monitoring should be enabled.

Example:

Without the Anthropic key, the app can still answer using its local fallback path, but that is not the real production AI experience.

### 3. Load the real alpha seller knowledge base

Status: blocked until seller material is available.

Meaning:

The app needs the seller's real Q&A, delivery rules, return policy, product notes, size guide, pricing notes, and chat examples.

Example:

If a customer asks, "Dhakar baire delivery charge koto?", the AI should answer from the seller's approved delivery policy, not from demo data.

### 4. Final production smoke test

Status: pending after deployment.

Meaning:

After the real domain is live, test the important customer journeys:

- Visit the website.
- Open the chat widget.
- Send a test customer message.
- Confirm a ticket is created when the AI is unsure.
- Confirm internal login works.
- Confirm client login code delivery works.
- Confirm digest email delivery works.

## Stakeholder Tasks Still Pending

### 1. Provide alpha seller content

Owner: seller / business team.

Needed:

- 30 to 50 real customer questions and approved answers.
- Product catalog or price list.
- Delivery, return, exchange, refund, and warranty rules.
- Examples of messages that must be escalated to a human.

### 2. Create and approve Meta app setup

Owner: Meta Business account owner.

Needed:

- Meta developer app.
- Facebook Page connection.
- Test users.
- Messenger permissions.
- App Review submission.
- Demo video.
- Business verification.
- Privacy policy URL: `/privacy` is now available, but should be legally reviewed before submission.

### 3. Decide WhatsApp launch path

Owner: business team.

Needed:

- Decide whether launch includes WhatsApp immediately or later.
- Choose direct WhatsApp Cloud API or a BSP provider.
- Verify phone number and business account.

### 4. Verify email domain records

Owner: Cloudflare/Postmark account owner.

Needed:

- Add SPF, DKIM, return-path, and DMARC records in Cloudflare.
- Verify the domain in Postmark.
- Send test emails to Gmail and Outlook.

Use: `docs/email-deliverability-launch-checklist.md`.

### 5. Legal review

Owner: business/legal advisor.

Needed:

- Review privacy policy.
- Finalize company contact details.
- Finalize DPA/processors language.
- Confirm Bangladesh PDPA consent wording.
- Confirm data retention promise.

Important:

The app has a PDPA consent banner and DPA tracking workflow, but the final legal wording should still be approved by a qualified legal advisor.

### 6. Billing decision

Owner: business team.

Status: intentionally deferred.

Meaning:

Billing/payment work is not currently being developed because it was previously paused. Public launch can happen as a private pilot without billing automation, but a paid launch needs a processor decision later.

## Recommended Next Step

Get the real alpha seller content first.

That unlocks the most important launch test: checking whether Daemion can answer real customer questions correctly before live customers see it.
