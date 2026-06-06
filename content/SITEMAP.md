# DAEMION — Website Sitemap

> **Brand source:** `Brand_Naming_Report.pdf` (v1.0).
> Positioning: civilizational intelligence infrastructure. Frontier AGI company.
> Peer tier: Anthropic, Palantir, Apple.
> Tagline: **Intelligence Beyond Instruction.**
> Master line: **Daemion builds cognition systems for the next industrial civilization.**

**Audience:** sovereign institutions, frontier-tech operators, enterprise CTOs, strategic investors, AGI researchers, deep-tech recruits.

**Primary goal of the site:** establish institutional authority and signal seriousness. Convert qualified inbound from sovereign / enterprise / research / capital partners into a direct conversation. No self-serve checkout. No demo widget. Sales-led, prestige-driven.

**Anti-goals:**
- No buzzwords ("AI revolution," "disruption," "magic," "creative buddy," "friendly AI").
- No bright colors. No chatbot imagery. No stock illustrations of brains-with-circuits.
- No price tags on the public surface. Pricing is institutional and conversation-driven.

---

## Page tree

```
/                            → Home — pages/home.md
/research                    → Research statement + publications — pages/research.md
/divisions                   → 6 divisions (Core, Vector, Atlas, Forge, Helix, Veil) — pages/divisions.md
/products                    → 4 products (Eidolon, Kheiron, Merqis, Aevum) — pages/products.md
/labs                        → 4 internal research labs (Orpheus, Mnemosyne, Atar, Thaleon) — pages/labs.md
/company                     → Mission, principles, leadership, location — pages/company.md
/careers                     → Open positions + hiring philosophy — pages/careers.md
/contact                     → Institutional inquiries — pages/contact.md
/privacy                     → Privacy policy — legal/privacy-policy.md
/terms                       → Terms of service — legal/terms-of-service.md
/data-deletion               → Data deletion request flow — legal/data-deletion.md
```

**Routing notes:**
- `/products/eidolon`, `/products/kheiron`, `/products/merqis`, `/products/aevum` — anchors within `/products` for v1. Promote to individual routes when product surfaces ship.
- `/divisions/<name>` — anchors within `/divisions` for v1.
- `/labs/<name>` — anchors within `/labs` for v1.
- `/veil` (the classified-systems division) — public surface is intentionally minimal. No deployments listed. Inquiries direct to `partnerships@daemion.com`.

## Navigation structure

**Top nav (desktop, 5 items + 1 button):**
- Research
- Divisions
- Products
- Company
- Careers
- → `Contact` (link, top-right, no button styling — minimal)

**Top nav (mobile, hamburger):**
Same 5 + `Labs`, `Privacy`, `Terms`, `Contact`.

**Footer (3 columns + brand row):**

| Daemion | Research | Legal |
|---|---|---|
| Divisions | Research statement | Privacy |
| Products | Labs | Terms |
| Company | Publications | Data deletion |
| Careers | — | — |
| Contact | — | — |

Plus brand row at the foot:
> **DAEMION** · Intelligence Beyond Instruction · © 2026 · Dhaka · [address line]

No social-icon clutter on the brand row. Optional muted links (LinkedIn, GitHub) lower-right at low opacity.

---

## Content principles

- **Restrained > expressive.** One declarative sentence carries more weight than a paragraph of marketing.
- **Inevitability > enthusiasm.** Daemion does not sell. It announces.
- **Architecture > anecdote.** Position by structure (divisions, products, labs, phases) — not by stories.
- **Confidence without proof.** This is a frontier lab; institutional authority comes from the seriousness of the framing, not from logos or testimonials.
- **Visual silence.** Black, graphite, off-white. Geometric serif/sans hybrid headlines. Ultra-thin body text. No emoji. No icons except minimal geometric marks.
- **Mobile-aware, but desktop-first.** This audience reads on desktops with high-DPI displays. Mobile must be flawless but is not the primary surface.

## Forbidden words and patterns

> Source: brand report, §6 "Design & Cultural Positioning" and §8 "Final Brand Feel."

**Never use:** AI revolution, disrupt, disruption, magic, magical, friendly AI, AI for everyone, creative buddy, assistant, chatbot, supercharge, unlock, leverage, journey, ecosystem, holistic, robust, powerful, intelligent, seamless, intuitive, game-changing, next-generation, cutting-edge.

**Speak instead of:** cognition, systems, alignment, coordination, infrastructure, autonomy, intelligence architecture, reasoning, long-horizon planning, machine agency, operational intelligence.

**Voice rules:**
- Present tense, third person ("Daemion builds...", "Merqis coordinates...").
- One thought per sentence.
- No exclamation marks. Anywhere.
- No "we" except in the Company section.
- No questions in headlines.
- Numerals over spelled-out numbers ("4 divisions" not "four divisions").

---

## SEO content map

| URL | Title (≤60 chars) | Meta description (≤155 chars) | Primary keyword |
|---|---|---|---|
| / | Daemion — Intelligence Beyond Instruction | Daemion builds autonomous cognition systems for the next industrial civilization. Frontier intelligence infrastructure. | Daemion |
| /research | Research — frontier cognition systems \| Daemion | Daemion's research statement on autonomous reasoning, long-horizon planning, alignment, and intelligence architecture. | frontier AI research |
| /divisions | Divisions — 6 mandates of Daemion | Daemion operates 6 divisions: Core, Vector, Atlas, Forge, Helix, Veil. Each addresses a distinct layer of intelligence infrastructure. | AGI infrastructure divisions |
| /products | Products — Eidolon, Kheiron, Merqis, Aevum \| Daemion | Daemion's product hierarchy: consumer cognition (Eidolon), executive intelligence (Kheiron), enterprise OS (Merqis), civilizational modeling (Aevum). | autonomous intelligence systems |
| /labs | Internal research labs \| Daemion | Orpheus, Mnemosyne, Atar, Thaleon — Daemion's internal research labs on consciousness, memory, defense, planetary infrastructure. | AGI research lab |
| /company | Company — mission, leadership, location \| Daemion | Daemion is a frontier AGI company headquartered in Dhaka. Mission: build cognition infrastructure for the next industrial civilization. | Daemion company |
| /careers | Careers at Daemion | Open positions across research, engineering, infrastructure, and operations. Frontier intelligence work, deliberate hiring. | Daemion careers |
| /contact | Contact — institutional inquiries \| Daemion | Direct inquiries from sovereign, enterprise, research, and capital partners. Daemion does not run a sales funnel. | contact Daemion |

**Open Graph (per page):**
- `og:type` — `website` for /, `article` for /research and /labs, `profile` for /company.
- `og:image` — monochrome 1200×630 wordmark on graphite. One canonical image; per-page variants only if visual differentiation justifies it.
- `og:title` and `og:description` mirror the SEO title/description above.

**Structured data:**
- `/` and `/company` — `Organization` schema (name, url, logo, sameAs, address).
- `/contact` and `/company` — `LocalBusiness` schema (Dhaka address, geo, openingHours).
- `/products` — `Product` schema per product (Eidolon, Kheiron, Merqis, Aevum).
- `/research` — `ScholarlyArticle` collection wrapper if publications listed.
- `/careers` — `JobPosting` schema per role.

**Technical SEO:**
- `sitemap.xml` generated from the page tree above.
- `robots.txt` allows all crawling; disallows nothing on the public site (Veil's content is server-rendered minimal — no hidden routes to protect).
- Canonical URLs absolute, no trailing slash.
- `hreflang` strategy deferred. The audience is global and English-first; Bangla translation, if pursued, is a long-term editorial decision rather than an immediate launch requirement.
- Page weight target: under 200 KB per page (HTML + CSS + critical assets). No third-party tracking on public marketing surface.

---

## Voice + tone

See `brand/voice.md` for the full guide. Quick rules:

- **Daemion announces. It does not sell.** Headlines are statements, not questions.
- **Architecture frames everything.** Mention the division or the product, not the use case.
- **Trust comes from gravity, not from numbers.** No customer-count, no funding total, no quotes from "happy customers."
- **Bangladesh is location, not theme.** Dhaka is the headquarters. It is mentioned in the company section, the contact section, and the footer. It is not a brand value or a positioning lever.

---

## Build order

1. **Home + Company + Contact** — minimum institutional surface (Week 1)
2. **Divisions + Products + Research** — establish the architecture (Week 1-2)
3. **Labs + Careers** — depth and recruitment (Week 2-3)
4. **Legal pages** — drafted and aligned to the institutional positioning (Week 2 for final lawyer review)
5. **Visual implementation** — monochrome design system, typography selection, motion guidelines (parallel track, Week 1-4)

---

## Decisions deferred (require founder input before publish)

- Final Dhaka office address.
- Founder names + bios for `/company` and `/careers`.
- Confirmation of which divisions/products/labs are public-facing at launch vs. announced-later.
- Whether `/veil` exists at all on the public site, or whether classified-systems work is silent.
- Whether to publish a research paper backlog at launch or wait for the first internal paper.
- Whether any prior product work (predating this brand positioning) is being retired, folded into one of the four Daemion products (most plausibly Merqis), or split off as a separately-named brand.

The last item is a strategic decision that does not affect this site. This site assumes Daemion is the frontier intelligence parent brand only; any prior or sibling product is treated as out of scope until a positioning decision is made.
