import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { DaemionLockup } from './_components/DaemionBrand';

export const metadata: Metadata = {
  title: 'Daemion Client Portal — Autonomous customer operations',
  description:
    'The Daemion customer application for support tickets, knowledge, customer conversations, and channel operations.',
};

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link className="landing-nav-brand" href="/">
          <DaemionLockup />
        </Link>
        <div className="landing-nav-links">
          <a className="landing-nav-link" href="https://daemion.io">
            Public website
          </a>
          <Link className="landing-nav-link" href="/internal/login">
            Internal access
          </Link>
          <Link className="landing-nav-link" href="/client/login">
            Client login
          </Link>
          <Link className="btn-primary" href="/signup">
            Create account
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Customer application</span>
          <h1>Autonomous support operations, held in one quiet workspace.</h1>
          <p className="landing-lede">
            Open the client portal to review escalated tickets, maintain your knowledge base, and
            monitor the channels Daemion operates on your behalf.
          </p>
          <div className="landing-hero-ctas">
            <Link className="btn-primary" href="/client/login">
              Customer login
            </Link>
            <Link className="btn-ghost" href="/signup">
              Request access →
            </Link>
          </div>
          <div className="landing-hero-trust">
            <ShieldCheck size={16} />
            <span>
              Managed setup. <strong>You answer only the tickets we escalate.</strong>
            </span>
          </div>
        </div>

        <div className="landing-hero-visual">
          <span className="landing-widget-tag">Live demo</span>
          <div className="landing-widget-frame">
            <iframe
              src="/widget?clientId=pilot-client"
              title="Daemion customer chat widget — live demo"
            />
          </div>
        </div>
      </section>

      <section className="landing-pillars">
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <MessageSquare size={18} />
          </span>
          <h2>Conversation control</h2>
          <p>
            Track what Daemion resolved automatically and where human review is still needed.
          </p>
        </div>
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <Inbox size={18} />
          </span>
          <h2>Ticket signal</h2>
          <p>
            Refunds, custom orders, complaints, and exceptions arrive with context already attached.
          </p>
        </div>
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <Sparkles size={18} />
          </span>
          <h2>Knowledge upkeep</h2>
          <p>
            Approve suggested knowledge updates so the system gets sharper without becoming noisy.
          </p>
        </div>
      </section>

      <section className="landing-showcase">
        <header className="landing-showcase-head">
          <h2>The customer workspace behind Daemion.</h2>
          <p>
            Customers do not need to manage the whole machine. They only need the moments that
            require judgment.
          </p>
        </header>

        <div className="landing-mock-shell" aria-hidden="true">
          <div className="landing-mock-chrome">
            <span className="landing-mock-dot" />
            <span className="landing-mock-dot" />
            <span className="landing-mock-dot" />
            <span className="landing-mock-url">app.daemion.io/client/tickets</span>
          </div>
          <div className="landing-mock-body">
            <aside className="landing-mock-sidebar">
              <div>Overview</div>
              <div className="is-active">Tickets · 3</div>
              <div>Conversations</div>
              <div>Knowledge</div>
              <div>Reports</div>
            </aside>
            <div className="landing-mock-main">
              <div className="landing-mock-row">
                <div>
                  <strong>Rahima — refund for damaged kurti</strong>
                  <div className="preview">
                    &ldquo;Apu kurti ta chere chilo. Refund chai…&rdquo;
                  </div>
                </div>
                <span className="landing-mock-pill p1">P1 · refund</span>
                <span className="landing-mock-time">2 min ago</span>
              </div>
              <div className="landing-mock-row">
                <div>
                  <strong>Sazid — custom size order</strong>
                  <div className="preview">
                    &ldquo;Bhai 42 size er saree pawa jabe?&rdquo;
                  </div>
                </div>
                <span className="landing-mock-pill p2">P2 · custom</span>
                <span className="landing-mock-time">12 min ago</span>
              </div>
              <div className="landing-mock-row">
                <div>
                  <strong>Tania — delivery to Khulna</strong>
                  <div className="preview">
                    &ldquo;Khulna te delivery koto? COD ase?&rdquo;
                  </div>
                </div>
                <span className="landing-mock-pill ok">resolved by AI</span>
                <span className="landing-mock-time">22 min ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Daemion</span>
        <span>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/internal/login">Internal access</Link>
          {' · '}
          <Link href="/client/login">Client login</Link>
        </span>
      </footer>
    </main>
  );
}
