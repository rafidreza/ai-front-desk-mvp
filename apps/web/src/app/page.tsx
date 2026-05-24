import type { Metadata } from 'next';
import Link from 'next/link';
import { BotMessageSquare, Inbox, MessageSquare, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Front Desk — AI customer support for Bangladeshi F-Commerce sellers',
  description:
    'We answer your Facebook and WhatsApp customer messages with AI, and only send you the tickets that need your decision.',
};

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link className="landing-nav-brand" href="/">
          <span className="brand-mark">
            <BotMessageSquare size={19} />
          </span>
          AI Front Desk
        </Link>
        <div className="landing-nav-links">
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
          <span className="landing-eyebrow">For Facebook & WhatsApp sellers</span>
          <h1>AI customer support for Bangladeshi F-Commerce sellers.</h1>
          <p className="landing-lede">
            We answer your Facebook and WhatsApp customer messages with AI, and only send you the
            tickets that need your decision.
          </p>
          <div className="landing-hero-ctas">
            <Link className="btn-primary" href="/signup">
              Create client account
            </Link>
            <Link className="btn-ghost" href="/internal/login">
              Internal access →
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
              title="AI Front Desk customer chat widget — live demo"
            />
          </div>
        </div>
      </section>

      <section className="landing-pillars">
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <MessageSquare size={18} />
          </span>
          <h2>Auto-answers buyer DMs</h2>
          <p>
            Price, delivery charge, COD, sizing, availability — answered in Bangla, Banglish, or
            English from your own knowledge base.
          </p>
        </div>
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <Inbox size={18} />
          </span>
          <h2>Only sends you tickets</h2>
          <p>
            Refunds, custom orders, complaints — escalated as a ticket with full context. P1 alerts
            ping you on WhatsApp.
          </p>
        </div>
        <div className="landing-pillar">
          <span className="landing-pillar-icon">
            <BotMessageSquare size={18} />
          </span>
          <h2>We do the setup</h2>
          <p>
            You share your chat history and price list once. We build the knowledge base, tune the
            agent, and run quality review before going live.
          </p>
        </div>
      </section>

      <section className="landing-showcase">
        <header className="landing-showcase-head">
          <h2>The only screen you log into.</h2>
          <p>
            A small ticket queue with the messages our AI couldn&apos;t resolve on its own. Reply
            once, we learn for next time.
          </p>
        </header>

        <div className="landing-mock-shell" aria-hidden="true">
          <div className="landing-mock-chrome">
            <span className="landing-mock-dot" />
            <span className="landing-mock-dot" />
            <span className="landing-mock-dot" />
            <span className="landing-mock-url">aifrontdesk.com.bd/tickets</span>
          </div>
          <div className="landing-mock-body">
            <aside className="landing-mock-sidebar">
              <div>Dashboard</div>
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
        <span>© 2026 AI Front Desk · seeed.ing</span>
        <span>
          <Link href="/internal/login">Internal access</Link>
          {' · '}
          <Link href="/client/login">Client login</Link>
        </span>
      </footer>
    </main>
  );
}
