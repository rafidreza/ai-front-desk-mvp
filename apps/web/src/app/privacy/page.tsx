import type { Metadata } from 'next';
import Link from 'next/link';
import { BotMessageSquare, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — Daemion',
  description:
    'How Daemion handles customer messages, seller account data, and support information for AI customer support workflows.',
};

export default function PrivacyPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link className="landing-nav-brand" href="/">
          <span className="brand-mark">
            <BotMessageSquare size={19} />
          </span>
          Daemion
        </Link>
        <div className="landing-nav-links">
          <Link className="landing-nav-link" href="/client/login">
            Client login
          </Link>
          <Link className="btn-primary" href="/signup">
            Create account
          </Link>
        </div>
      </nav>

      <section className="legal-hero">
        <span className="landing-eyebrow">Privacy policy</span>
        <h1>How Daemion handles support data.</h1>
        <p>
          Daemion helps sellers answer customer messages. This page explains, in plain language,
          what information we handle and why.
        </p>
        <div className="legal-note">
          <ShieldCheck size={18} />
          <span>Last updated: May 31, 2026. This policy should be reviewed before public launch.</span>
        </div>
      </section>

      <section className="legal-content" aria-label="Privacy policy details">
        <article>
          <h2>What we collect</h2>
          <p>
            We may process customer messages, names or social profile identifiers, phone numbers,
            delivery details, order questions, support tickets, and seller-provided knowledge such
            as product details, pricing notes, return rules, and delivery policies.
          </p>
        </article>

        <article>
          <h2>How we use it</h2>
          <p>
            We use this information to answer customer questions, create tickets for messages that
            need human review, send login or support notifications, improve the seller&apos;s approved
            knowledge base, and keep operational audit records.
          </p>
        </article>

        <article>
          <h2>Who controls customer data</h2>
          <p>
            Each seller remains responsible for the customer data they bring to Daemion. Daemion
            acts as a service provider that processes that information only to run the support
            workflow the seller has requested.
          </p>
        </article>

        <article>
          <h2>AI and human review</h2>
          <p>
            Customer messages may be checked by AI systems to draft replies or quality scores.
            Messages that look risky, unclear, or sensitive can be escalated for human review
            instead of being answered automatically.
          </p>
        </article>

        <article>
          <h2>Retention</h2>
          <p>
            Sellers can configure retention settings for older conversation data. When retention
            cleanup is enabled, Daemion can redact old message text while keeping basic operational
            records needed for support quality and audit history.
          </p>
        </article>

        <article>
          <h2>Security</h2>
          <p>
            Daemion uses protected sessions, server-side access checks, webhook signature checks
            when provider secrets are configured, audit logs for important changes, and encrypted
            HTTPS hosting in production deployments.
          </p>
        </article>

        <article>
          <h2>Contact</h2>
          <p>
            For privacy or data requests, contact the Daemion operator who manages your workspace.
            Before public launch, replace this sentence with the final company contact email and
            postal details.
          </p>
        </article>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Daemion · seeed.ing</span>
        <span>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/client/login">Client login</Link>
        </span>
      </footer>
    </main>
  );
}
