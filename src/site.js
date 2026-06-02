import {
  architecture,
  careerDomains,
  contactOffices,
  divisions,
  footer,
  labs,
  legal,
  nav,
  products,
  researchVectors,
  site,
} from './content.js';

const esc = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const link = ([label, href]) => `<a href="${href}">${esc(label)}</a>`;
const mail = (email) => `<a class="mail" href="mailto:${email}">${email}</a>`;

function shell({ slug = '', title, description, ogType = 'website', body, schema = '' }) {
  const path = slug === '' ? '/' : `/${slug}`;
  const canonical = `${site.url}${path === '/' ? '' : path}`;
  const pageTitle = title.includes('Daemion') ? title : `${title} | Daemion`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${site.url}/og/daemion-wordmark.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#000000">
  <link rel="icon" href="/marks/daemion-mark.svg" type="image/svg+xml">
  <link rel="preload" href="/marks/daemion-lockup.svg" as="image" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/styles.css">
  ${schema}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  ${header()}
  <main id="main">${body}</main>
  ${siteFooter()}
  <script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function header() {
  return `<header class="site-header">
  <div class="nav-wrap">
    <a class="brand-link" href="/" aria-label="Daemion home">
      <img src="/marks/daemion-lockup.svg" width="760" height="132" alt="Daemion">
    </a>
    <button class="mobile-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav class="nav-links" id="site-nav" aria-label="Primary navigation">
      ${nav.map(link).join('')}
    </nav>
  </div>
</header>`;
}

function siteFooter() {
  return `<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-logo">
        <img src="/marks/daemion-lockup.svg" width="760" height="132" alt="Daemion">
        <p>${esc(site.tagline)}</p>
      </div>
      ${Object.entries(footer)
        .map(([heading, items]) => `<div class="footer-col"><h3>${heading}</h3>${items.map(link).join('')}</div>`)
        .join('')}
    </div>
    <div class="brand-row">DAEMION · ${esc(site.tagline)} · © ${site.year} · ${site.location}</div>
  </div>
</footer>`;
}

function hero({ eyebrow, title, lede, actions = '', mark = true }) {
  return `<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <img class="hero-wordmark" src="/marks/daemion-lockup.svg" width="760" height="132" alt="Daemion">
      <span class="eyebrow">${esc(eyebrow)}</span>
      <h1>${title}</h1>
      <p class="lede">${lede}</p>
      ${actions ? `<div class="hero-actions">${actions}</div>` : ''}
    </div>
    ${
      mark
        ? `<div class="hero-mark" aria-hidden="true">
            <div class="orbital-ring"></div>
            <img src="/marks/daemion-mark.svg" width="160" height="160" alt="">
          </div>`
        : ''
    }
  </div>
</section>`;
}

function architectureTable() {
  const column = (label, items) => `<div class="arch-column">
    <div class="arch-heading">${label}</div>
    ${items.map(([name, href, desc]) => `<a class="arch-item" href="${href}"><strong>${name}</strong><span>${desc}</span></a>`).join('')}
  </div>`;
  return `<div class="architecture-table">
    ${column('Divisions', architecture.divisions)}
    ${column('Products', architecture.products)}
    ${column('Labs', architecture.labs)}
  </div>`;
}

function home() {
  const phases = [
    ['I', 'Foundation models and enterprise cognition.'],
    ['II', 'Autonomous operations layer for global business.'],
    ['III', 'Infrastructure-scale intelligence systems.'],
    ['IV', 'AI-governed logistics, economics, and robotics.'],
    ['V', 'Civilizational coordination infrastructure.'],
  ];

  return shell({
    slug: '',
    title: 'Daemion — Intelligence Beyond Instruction',
    description: site.description,
    schema: organizationSchema(),
    body: `${hero({
      eyebrow: site.tagline,
      title: 'Daemion builds cognition systems for the next industrial civilization.',
      lede: 'Daemion is a frontier intelligence company. We design autonomous cognition systems operating across business, infrastructure, governance, and machine coordination. Not chatbots. Not apps. Cognition infrastructure.',
      actions: '<a class="cta primary" href="/contact">Contact office</a><a class="cta" href="/divisions">See architecture</a>',
    })}
    <section class="page-section">
      <div class="wrap split">
        <div>
          <span class="eyebrow">What Daemion is</span>
          <h2>The cognition layer for institutions that operate on the order of decades.</h2>
        </div>
        <div class="copy">
          <p>Daemion sits at the intersection of three reference identities: the philosophical depth of an alignment laboratory, the infrastructural seriousness of a planetary-scale platform, and the product elegance of a deeply considered consumer surface.</p>
          <p>We build for sovereign systems, frontier enterprises, strategic operators, and the research community that informs them.</p>
          <p>Daemion does not sell convenience. It constructs the substrate.</p>
        </div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">Architecture</span>
            <h2>6 divisions, 4 products, and 4 internal research labs.</h2>
          </div>
          <p>Each addresses a distinct layer of the intelligence stack.</p>
        </div>
        ${architectureTable()}
      </div>
    </section>
    <section class="page-section">
      <div class="wrap split">
        <div>
          <span class="eyebrow">Research</span>
          <h2>Reasoning architectures, memory, alignment, and coordination.</h2>
          <a class="cta" href="/research">Research statement</a>
        </div>
        <div class="copy">
          <p>Daemion research concerns reasoning architectures, long-horizon planning under uncertainty, alignment of autonomous systems, persistent memory, and the operational coordination of machine agents at scale.</p>
          <p>Internal labs operate under deliberate secrecy. Publications appear when warranted.</p>
        </div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap split">
        <div>
          <span class="eyebrow">The arc</span>
          <h2>Five phases describe the trajectory.</h2>
        </div>
        <div>
          <ul class="phase-list">
            ${phases.map(([n, text]) => `<li><span class="index-number">${n}</span><span>${text}</span></li>`).join('')}
          </ul>
          <p class="quote-line">At the final stage, Daemion becomes less a company, more a cognitive substrate for institutions.</p>
        </div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap split">
        <div>
          <span class="eyebrow">What Daemion is not</span>
          <h2>Not an everyday productivity tool. Not a consumer entertainment surface.</h2>
        </div>
        <div class="copy">
          <p>Daemion is critical intelligence infrastructure for advanced civilization. The tone is restrained, the surfaces are silent, and the interfaces imply intelligence rather than advertise it.</p>
        </div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap split">
        <div>
          <span class="eyebrow">Engage</span>
          <h2>Inquiries are handled directly through the Company office.</h2>
        </div>
        <div class="copy">
          <p>Inquiries from sovereign institutions, enterprise operators, frontier research collaborators, and capital partners are handled directly. Daemion does not run a sales funnel.</p>
          <a class="cta primary" href="/contact">Contact the office</a>
        </div>
      </div>
    </section>`,
  });
}

function divisionsPage() {
  return shell({
    slug: 'divisions',
    title: 'Divisions — 6 mandates of Daemion',
    description: 'Daemion operates 6 divisions: Core, Vector, Atlas, Forge, Helix, Veil. Each addresses a distinct layer of intelligence infrastructure.',
    body: `${hero({
      eyebrow: 'Six divisions',
      title: 'Each addresses one layer of the intelligence infrastructure stack.',
      lede: 'Daemion is structured as six operating divisions. Each holds a distinct mandate within the architecture of autonomous intelligence, from foundation cognition to classified deployment.',
      actions: `<div class="anchor-row">${divisions.map((d) => `<a href="#${d.id}">${d.title}</a>`).join('')}</div>`,
    })}
    <section class="page-section">
      <div class="wrap">
        ${divisions.map(entity).join('')}
      </div>
    </section>
    <section class="page-section tight">
      <div class="wrap split">
        <div><span class="eyebrow">Operating model</span><h2>Autonomous within mandate. Coordinated through substrate.</h2></div>
        <div class="copy"><p>The six divisions share Daemion research substrate, alignment infrastructure, and core compute fabric. Cross-division coordination happens through the research office and shared infrastructure governance, not through product committees.</p></div>
      </div>
    </section>`,
  });
}

function entity(item) {
  return `<article class="entity" id="${item.id}">
    <div>
      <span class="mono">${item.eyebrow}</span>
      <h2>${item.title}</h2>
      <div class="mandate">${item.mandate}</div>
    </div>
    <div>
      <p>${item.body}</p>
      <div class="meta-grid">
        <div class="meta-box"><span class="mono">Focus areas</span><ul>${item.focus.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        <div class="meta-box"><span class="mono">Operating posture</span><p>${item.posture}</p>${item.mail ? mail(item.mail) : ''}${item.links ? `<div class="anchor-row">${item.links.map(link).join('')}</div>` : ''}</div>
      </div>
    </div>
  </article>`;
}

function productsPage() {
  return shell({
    slug: 'products',
    title: 'Products — Eidolon, Kheiron, Merqis, Aevum | Daemion',
    description: 'Daemion product hierarchy: Eidolon, Kheiron, Merqis, and Aevum.',
    body: `${hero({
      eyebrow: 'Four products',
      title: 'Cognition for individuals, executives, enterprises, and civilizations.',
      lede: 'Daemion product hierarchy spans four operating tiers. Each product is a deployed application of cognition infrastructure built on Daemion shared research and execution substrate.',
      actions: `<div class="anchor-row">${products.map((p) => `<a href="#${p.id}">${p.title}</a>`).join('')}</div>`,
    })}
    <section class="page-section">
      <div class="wrap product-stack">
        ${products
          .map(
            (p) => `<article class="product-card" id="${p.id}">
          <div><span class="mono">Tier — ${p.tier}</span><h2>${p.title}</h2><div class="line">${p.line}</div></div>
          <div>
            ${p.body.map((x) => `<p>${x}</p>`).join('')}
            <ul class="feature-list">${p.capabilities.map((x) => `<li><span class="index-number">·</span><span>${x}</span></li>`).join('')}</ul>
            <div class="status-line">${p.availability}</div>
          </div>
        </article>`,
          )
          .join('')}
      </div>
    </section>
    <section class="page-section tight">
      <div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Hierarchy</span><h2>Four products. Four operating tiers. One substrate.</h2></div><p>Every product is engaged directly through the relevant office.</p></div>
        ${products.map((p) => `<div class="feature-row"><strong>${p.tier}</strong><span>${p.title}</span><a class="mail" href="mailto:${p.title.toLowerCase()}@daemion.com">${p.title.toLowerCase()}@daemion.com</a></div>`).join('')}
      </div>
    </section>`,
  });
}

function labsPage() {
  return shell({
    slug: 'labs',
    title: 'Internal research labs | Daemion',
    description: 'Orpheus, Mnemosyne, Atar, and Thaleon: Daemion internal research labs.',
    ogType: 'article',
    body: `${hero({
      eyebrow: 'Four laboratories',
      title: 'Internal research on architectural gaps in autonomous intelligence.',
      lede: 'Daemion operates four internal research laboratories. Each lab addresses an unsolved architectural problem in general intelligence infrastructure.',
      actions: `<div class="anchor-row">${labs.map((l) => `<a href="#${l.id}">${l.title.replace('The ', '').replace('Project ', '')}</a>`).join('')}</div>`,
    })}
    <section class="page-section"><div class="wrap">${labs.map(labEntity).join('')}</div></section>
    <section class="page-section tight"><div class="wrap split"><div><span class="eyebrow">Lab philosophy</span><h2>Small, deliberate, multi-year.</h2></div><div class="copy"><p>Each lab is deliberately staffed and granted multi-year horizons. Output cadence is set by research necessity, not by external publication pressure.</p><p>Daemion treats publication as alignment-relevant. Some lines of research are too consequential to release without sustained internal review.</p><a class="cta primary" href="/contact?topic=research">Contact research office</a></div></div></section>`,
  });
}

function labEntity(item) {
  return `<article class="entity" id="${item.id}">
    <div><span class="mono">${item.eyebrow}</span><h2>${item.title}</h2><div class="mandate">${item.mandate}</div></div>
    <div><p>${item.body}</p><div class="meta-box"><span class="mono">Publication posture</span><p>${item.publication}</p></div></div>
  </article>`;
}

function researchPage() {
  return shell({
    slug: 'research',
    title: 'Research — frontier cognition systems | Daemion',
    description: 'Daemion research statement on autonomous reasoning, long-horizon planning, alignment, and intelligence architecture.',
    ogType: 'article',
    body: `${hero({
      eyebrow: 'Research',
      title: 'Daemion studies autonomous cognition.',
      lede: 'Daemion research program addresses open problems of intelligence operating without continuous human instruction: reasoning under uncertainty, long-horizon planning, persistent memory, alignment, and machine-agent coordination at scale.',
      actions: '<a class="cta primary" href="/contact?topic=research">Contact research office</a><a class="cta" href="/labs">Internal labs</a>',
    })}
    <section class="page-section">
      <div class="wrap split">
        <div><span class="eyebrow">Statement</span><h2>The research problem is architectural, not parametric.</h2></div>
        <div class="copy"><p>The next century of intelligence will not be defined by larger models. It will be defined by systems that reason over long horizons, coordinate with one another, and operate under sustained autonomy without degrading.</p><p>Research is conducted across Core and four internal laboratories. Publication is treated as an alignment-relevant decision, not a status signal.</p></div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Open problems</span><h2>Six research vectors.</h2></div><p>Each vector maps to a gap in autonomous cognition infrastructure.</p></div>
        ${researchVectors.map(([n, title, text]) => `<div class="feature-row"><strong>${n}</strong><span><b>${title}</b><br>${text}</span><a class="text-link" href="/contact?topic=research">Research office</a></div>`).join('')}
      </div>
    </section>
    <section class="page-section tight" id="publications"><div class="wrap split"><div><span class="eyebrow">Publications</span><h2>Publications appear here as they ship.</h2></div><div class="copy"><p>Daemion publishes when the field benefits from publication. Internal work that informs deployed systems is not published.</p></div></div></section>`,
  });
}

function companyPage() {
  const principles = [
    ['Architecture over feature', 'Daemion organizes work as architecture, not as products in isolation. Divisions, products, and labs share a common cognition substrate.'],
    ['Restraint over expression', 'Daemion published outputs are sparse and deliberate. Restraint is a design discipline, not a marketing aesthetic.'],
    ['Alignment as architecture', 'Alignment is treated as a property of system design, not a layer added at deployment.'],
    ['Long horizons', 'Daemion operates on multi-year and multi-decade horizons. Quarterly cycles do not govern research direction.'],
  ];
  return shell({
    slug: 'company',
    title: 'Company — mission, leadership, location | Daemion',
    description: 'Daemion is a frontier intelligence company headquartered in Dhaka.',
    ogType: 'profile',
    schema: organizationSchema(),
    body: `${hero({
      eyebrow: 'Company',
      title: 'A frontier intelligence company headquartered in Dhaka.',
      lede: 'Daemion builds autonomous cognition systems for the next industrial civilization. The organization operates across 6 divisions, 4 products, and 4 internal research labs.',
      actions: '<a class="cta primary" href="/contact">Engage with the Company office</a>',
    })}
    <section class="page-section"><div class="wrap split"><div><span class="eyebrow">Mission</span><h2>The cognition layer for institutions that operate on the order of decades.</h2></div><div class="copy"><p>Daemion exists to build autonomous intelligence as civilizational infrastructure. The mission is multi-generational. The work is structured accordingly.</p></div></div></section>
    <section class="page-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Principles</span><h2>How Daemion is built.</h2></div><p>Four principles shape how the company operates.</p></div><div class="grid two">${principles.map(([t, b]) => `<article class="panel"><h3>${t}</h3><p>${b}</p></article>`).join('')}</div></div></section>
    <section class="page-section"><div class="wrap split"><div><span class="eyebrow">Headquarters</span><h2>Dhaka, Bangladesh.</h2></div><div class="copy"><p>The decision to anchor frontier intelligence work outside the Bay Area, Boston, and London is deliberate. The next industrial civilization will not be coordinated from a single geography.</p><p class="muted">Daemion<br>[ADDRESS TBD]<br>Dhaka, Bangladesh</p></div></div></section>
    <section class="page-section tight"><div class="wrap split"><div><span class="eyebrow">Press</span><h2>Press inquiries are handled directly.</h2></div><div class="copy">${mail('press@daemion.com')}<p>Press appearances, interviews, and published commentary are listed as they occur.</p></div></div></section>`,
  });
}

function careersPage() {
  const process = ['Application review by the relevant domain lead.', 'First conversation: 45 minutes, structured.', 'Technical or research assessment calibrated to the role.', 'Panel conversations across the team and one cross-division conversation.', 'Founder conversation for senior and selected roles.', 'Decision and offer within 5 business days of the final conversation.'];
  return shell({
    slug: 'careers',
    title: 'Careers at Daemion',
    description: 'Open positions across research, engineering, infrastructure, and operations.',
    body: `${hero({
      eyebrow: 'Careers',
      title: 'Frontier intelligence infrastructure. Long horizons. Deliberate hiring.',
      lede: 'Daemion hires people who can hold a problem over years. Engineering, research, infrastructure, and operations roles open as the architecture requires them.',
      actions: `<a class="cta primary" href="mailto:careers@daemion.com">careers@daemion.com</a><a class="cta" href="/divisions">Architecture</a>`,
    })}
    <section class="page-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Domains</span><h2>Where Daemion hires.</h2></div><p>Open and standing-interest domains are listed below.</p></div><div class="grid two">${careerDomains.map((d) => `<article class="panel"><h3>${d.title}</h3><p>${d.body}</p><ul class="feature-list">${d.focus.map((x) => `<li><span class="index-number">·</span><span>${x}</span></li>`).join('')}</ul></article>`).join('')}</div></div></section>
    <section class="page-section"><div class="wrap split"><div><span class="eyebrow">Process</span><h2>Consistent across roles. Calibrated to depth.</h2></div><ol class="role-list">${process.map((x, i) => `<li><span class="index-number">${String(i + 1).padStart(2, '0')}</span><span>${x}</span></li>`).join('')}</ol></div></section>
    <section class="page-section tight"><div class="wrap split"><div><span class="eyebrow">Apply</span><h2>Standing interest is accepted.</h2></div><div class="copy"><p>Applications and standing interest both flow through careers@daemion.com. Subject line: Standing interest · [domain].</p>${mail('careers@daemion.com')}</div></div></section>`,
  });
}

function contactPage() {
  return shell({
    slug: 'contact',
    title: 'Contact — institutional inquiries | Daemion',
    description: 'Direct inquiries from sovereign, enterprise, research, and capital partners.',
    schema: organizationSchema(),
    body: `${hero({
      eyebrow: 'Contact',
      title: 'Daemion does not run a sales funnel.',
      lede: 'Inquiries from sovereign institutions, enterprise operators, research collaborators, and capital partners are handled directly by the relevant Daemion office.',
      mark: false,
    })}
    <section class="page-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Where to write</span><h2>Inquiries are routed by office.</h2></div><p>Use the address that fits the engagement.</p></div>${contactOffices.map((o) => `<div class="office-row"><strong>${o.name}</strong><span>${o.purpose}</span>${mail(o.email)}</div>`).join('')}</div></section>
    <section class="page-section tight"><div class="wrap split"><div><span class="eyebrow">Headquarters</span><h2>Dhaka office. Prior arrangement only.</h2></div><div class="copy"><p>Daemion<br>[ADDRESS TBD]<br>Dhaka, Bangladesh</p><p>The Dhaka office operates Sun-Thu, 10:00-19:00 Bangladesh Standard Time. Friday and Saturday correspondence is acknowledged the following Sunday.</p></div></div></section>`,
  });
}

function legalPage(key) {
  const doc = legal[key];
  return shell({
    slug: doc.slug,
    title: `${doc.title} | Daemion`,
    description: doc.description,
    ogType: 'article',
    body: `${hero({
      eyebrow: 'Legal',
      title: doc.title,
      lede: doc.description,
      mark: false,
    })}
    <section class="page-section">
      <div class="wrap split">
        <div><span class="eyebrow">Document status</span><h2>${doc.note}</h2></div>
        <div class="copy"><p>For questions about this document, contact privacy@daemion.com or office@daemion.com as appropriate.</p><div class="legal-note">${doc.note}</div></div>
      </div>
    </section>
    <section class="page-section">
      <div class="wrap">${doc.sections.map(([title, body], i) => `<article class="entity"><div><span class="mono">${String(i + 1).padStart(2, '0')}</span><h2>${title}</h2></div><div><p>${body}</p></div></article>`).join('')}</div>
    </section>`,
  });
}

function notFoundPage() {
  return shell({
    slug: '404',
    title: '404 | Daemion',
    description: 'The requested Daemion page was not found.',
    body: `<section class="not-found"><div class="wrap"><span class="eyebrow">404</span><h1>Signal absent.</h1><p class="lede">The requested surface does not exist.</p><div class="hero-actions"><a class="cta primary" href="/">Return home</a><a class="cta" href="/contact">Contact office</a></div></div></section>`,
  });
}

function organizationSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Daemion',
    url: site.url,
    logo: `${site.url}/marks/daemion-mark.svg`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dhaka',
      addressCountry: 'BD',
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export const pages = [
  ['', home],
  ['research', researchPage],
  ['divisions', divisionsPage],
  ['products', productsPage],
  ['labs', labsPage],
  ['company', companyPage],
  ['careers', careersPage],
  ['contact', contactPage],
  ['privacy', () => legalPage('privacy')],
  ['terms', () => legalPage('terms')],
  ['data-deletion', () => legalPage('data-deletion')],
  ['404', notFoundPage],
];

export function sitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter(([slug]) => slug !== '404')
  .map(([slug]) => `  <url><loc>${site.url}${slug ? `/${slug}` : ''}</loc></url>`)
  .join('\n')}
</urlset>`;
}

export function robots() {
  return `User-agent: *
Allow: /

Sitemap: ${site.url}/sitemap.xml
`;
}
