export const site = {
  name: 'Daemion',
  url: 'https://daemion.io',
  customerAppUrl: 'https://app.daemion.io/client/login',
  tagline: 'Intelligence Beyond Instruction.',
  masterLine: 'Daemion builds cognition systems for the next industrial civilization.',
  description: 'Daemion builds autonomous cognition systems for the next industrial civilization. Frontier intelligence infrastructure.',
  year: '2026',
  location: 'Dhaka',
  logo: '/marks/daemion-lockup.svg',
  mark: '/marks/daemion-mark.svg',
};

export const nav = [
  ['Research', '/research'],
  ['Divisions', '/divisions'],
  ['Products', '/products'],
  ['Company', '/company'],
  ['Careers', '/careers'],
  ['Customer login', site.customerAppUrl],
  ['Contact', '/contact'],
];

export const footer = {
  Daemion: [
    ['Divisions', '/divisions'],
    ['Products', '/products'],
    ['Company', '/company'],
    ['Careers', '/careers'],
    ['Customer login', site.customerAppUrl],
    ['Contact', '/contact'],
  ],
  Research: [
    ['Research statement', '/research'],
    ['Labs', '/labs'],
    ['Publications', '/research#publications'],
  ],
  Legal: [
    ['Privacy', '/privacy'],
    ['Terms', '/terms'],
    ['Data deletion', '/data-deletion'],
  ],
};

export const architecture = {
  divisions: [
    ['Core', '/divisions#core', 'foundation cognition'],
    ['Vector', '/divisions#vector', 'autonomous execution'],
    ['Atlas', '/divisions#atlas', 'planetary intelligence'],
    ['Forge', '/divisions#forge', 'AI hardware and compute'],
    ['Helix', '/divisions#helix', 'biotech and synthetic cognition'],
    ['Veil', '/divisions#veil', 'classified systems'],
  ],
  products: [
    ['Eidolon', '/products#eidolon', 'persistent cognitive counterpart'],
    ['Kheiron', '/products#kheiron', 'strategic intelligence'],
    ['Merqis', '/products#merqis', 'enterprise operating intelligence'],
    ['Aevum', '/products#aevum', 'civilizational modeling'],
  ],
  labs: [
    ['Orpheus', '/labs#orpheus', 'machine consciousness'],
    ['Mnemosyne', '/labs#mnemosyne', 'long-memory systems'],
    ['Atar', '/labs#atar', 'autonomous defense'],
    ['Thaleon', '/labs#thaleon', 'planetary infrastructure'],
  ],
};

export const divisions = [
  {
    id: 'core',
    eyebrow: 'Division 01',
    title: 'Core',
    mandate: 'Foundation cognition systems.',
    body: 'Core develops the reasoning architectures, long-horizon planning systems, and alignment frameworks that underwrite every Daemion product and division. Core output is the substrate; the rest of the organization deploys it.',
    focus: ['Reasoning architectures', 'Long-horizon planning under uncertainty', 'Autonomous cognition without continuous human instruction', 'Alignment of self-directing systems'],
    posture: 'General intelligence infrastructure. Slow horizon. Long publication cycles.',
    links: [['Orpheus', '/labs#orpheus'], ['Mnemosyne', '/labs#mnemosyne']],
  },
  {
    id: 'vector',
    eyebrow: 'Division 02',
    title: 'Vector',
    mandate: 'Autonomous execution systems.',
    body: 'Vector deploys intelligence into motion. Multi-agent orchestration, robotics control, operational automation, and the coordination of populations of autonomous agents. Where Core builds the reasoning substrate, Vector turns it into action.',
    focus: ['Agentic systems and multi-agent coordination', 'Robotics control and embodied cognition', 'Operational automation at enterprise and infrastructure scale', 'Conflict resolution and decentralized intelligence'],
    posture: 'Intelligence in motion. Field-deployed. Continuous iteration against operational pressure.',
    links: [['Merqis', '/products#merqis'], ['Kheiron', '/products#kheiron']],
  },
  {
    id: 'atlas',
    eyebrow: 'Division 03',
    title: 'Atlas',
    mandate: 'Planetary-scale intelligence mapping.',
    body: 'Atlas builds the modeling layer for systems that operate at the scale of economies, geopolitics, and global logistics. Long-cycle simulation, scenario reasoning, and the cognitive infrastructure for strategic decisions that cannot be made on intuition alone.',
    focus: ['Economic modeling and forecasting', 'Geopolitical simulation and scenario reasoning', 'Global logistics intelligence', 'Long-cycle systems modeling under sustained uncertainty'],
    posture: 'Understanding complex systems. Quiet outputs. High-stakes inputs.',
    links: [['Aevum', '/products#aevum'], ['Kheiron', '/products#kheiron']],
  },
  {
    id: 'forge',
    eyebrow: 'Division 04',
    title: 'Forge',
    mandate: 'AI hardware and compute.',
    body: 'Forge designs and produces the hardware substrate for Daemion cognition systems. Inference silicon, edge devices, robotics compute, and secure inference environments. Industrial precision, silent power, deliberate verticalization.',
    focus: ['Inference hardware and dedicated cognition silicon', 'Edge and embedded compute for autonomous systems', 'Robotics-grade compute platforms', 'Secure inference environments for sovereign deployment'],
    posture: 'Hardware as architecture. Multi-year design cycles. Verticalized supply chain.',
  },
  {
    id: 'helix',
    eyebrow: 'Division 05',
    title: 'Helix',
    mandate: 'Biotech and synthetic cognition.',
    body: 'Helix studies the intersection of biological and synthetic intelligence. Neural interfaces, synthetic biology informed by cognitive systems, longevity research, and cognitive enhancement programs developed under deliberate ethical constraints.',
    focus: ['Neural interface architectures', 'Synthetic biology under cognition-aware design', 'Longevity and aging-systems research', 'Cognitive enhancement under supervised programs'],
    posture: 'Long-cycle research. Conservative publication. Tightly governed deployment.',
  },
  {
    id: 'veil',
    eyebrow: 'Division 06',
    title: 'Veil',
    mandate: 'Classified systems.',
    body: 'Veil operates Daemion classified-systems work: cyber defense, strategic intelligence, autonomous security infrastructure, and direct partnerships with sovereign institutions. The public surface for Veil is restricted by design.',
    focus: ['Cyber defense cognition', 'Strategic intelligence systems', 'Autonomous security infrastructure', 'Sovereign partnership deployments'],
    posture: 'Restricted public surface. Direct inquiry only.',
    mail: 'partnerships@daemion.com',
  },
];

export const products = [
  {
    id: 'eidolon',
    tier: 'Consumer',
    title: 'Eidolon',
    line: 'A persistent cognitive counterpart.',
    body: ['Eidolon is Daemion consumer cognition surface: a persistent counterpart that reasons alongside its operator across years, contexts, and decisions. Not a productivity assistant. Not a generalized chatbot. A counterpart.', 'Eidolon holds long memory, models its operator intent over extended horizons, and operates with autonomy bounded by explicit alignment. The operator retains directive authority; Eidolon retains continuity.'],
    capabilities: ['Persistent memory across years of operation', 'Long-horizon goal tracking and intent modeling', 'Reasoning under partial information', 'Autonomy bounded by explicit alignment protocols', 'Cross-device continuity through Daemion substrate'],
    availability: 'Closed invitation. Direct application through eidolon@daemion.com.',
  },
  {
    id: 'kheiron',
    tier: 'Executive',
    title: 'Kheiron',
    line: 'Strategic intelligence for sovereign and executive systems.',
    body: ['Kheiron is Daemion executive-tier intelligence, built for operators whose decisions shape institutional, governmental, and economic outcomes.', 'Kheiron surface is scenario reasoning, strategic simulation, and long-horizon planning under uncertainty. It does not advise. It models. The operator decides.'],
    capabilities: ['Scenario reasoning across multiple time horizons', 'Strategic simulation of complex institutional systems', 'Long-horizon planning under sustained uncertainty', 'Geopolitical and economic modeling at sovereign scale', 'Deployed under direct engagement only'],
    availability: 'Direct engagement only. Inquiries via kheiron@daemion.com.',
  },
  {
    id: 'merqis',
    tier: 'Enterprise',
    title: 'Merqis',
    line: 'Operational intelligence at scale.',
    body: ['Merqis is Daemion enterprise intelligence operating system. It coordinates autonomous operations across the breadth of an institution: customer interaction, internal coordination, inventory, compliance, inbound communication, and outbound execution.', 'Merqis is not a workflow tool. It is the cognition layer that makes autonomous operations possible at the scale at which institutions operate.'],
    capabilities: ['Enterprise-wide operational coordination', 'Autonomous operations across departments and functions', 'Multi-channel cognition', 'Long-cycle memory of institutional state', 'Integration with existing enterprise infrastructure under Forge-hardened compute'],
    availability: 'Direct engagement through merqis@daemion.com.',
  },
  {
    id: 'aevum',
    tier: 'Civilizational',
    title: 'Aevum',
    line: 'Deep-time intelligence.',
    body: ['Aevum is Daemion civilizational-tier modeling system. Long-horizon simulation of climate, economic systems, demographic dynamics, and the planetary infrastructure that supports them.', 'Aevum operates under Atlas, with direct engagement by sovereign institutions, multilateral organizations, and selected research consortiums.'],
    capabilities: ['Climate and earth-systems modeling', 'Long-cycle economic forecasting', 'Demographic and migration simulation', 'Planetary infrastructure intelligence', 'Multi-decadal scenario reasoning'],
    availability: 'Sovereign and multilateral engagement only. Inquiries via aevum@daemion.com.',
  },
];

export const labs = [
  ['orpheus', 'Lab 01', 'The Orpheus Lab', 'Machine consciousness and emergent cognition.', 'Orpheus studies the conditions under which emergent cognition arises in scaled systems: self-modeling, introspection, unified agency, and the architectural prerequisites for subjective coherence in autonomous intelligence.', 'Almost nothing published. By design.'],
  ['mnemosyne', 'Lab 02', 'The Mnemosyne Archive', 'Long-memory and persistent intelligence architectures.', 'Mnemosyne builds the memory substrate for autonomous systems operating over years and decades. Continual learning, episodic retrieval, lossless compaction of operational context, and architectures that prevent drift across long-running deployments.', 'Selective. Publishes when the field benefits.'],
  ['atar', 'Lab 03', 'Project Atar', 'Autonomous defense cognition.', 'Atar studies self-directing tactical and defensive cognition systems: autonomous defense in adversarial conditions, doctrine modeling, threat reasoning, and alignment of autonomous defense systems to operator intent over long horizons.', 'Restricted. Most output is classified or partner-only.'],
  ['thaleon', 'Lab 04', 'Project Thaleon', 'Planetary infrastructure AGI.', 'Thaleon is Daemion planetary-coordination program: architectural research for intelligence systems at the scale of energy, logistics, climate, communication networks, and global infrastructure.', 'Long publication cycles. Outputs appear as multi-year programs rather than discrete papers.'],
].map(([id, eyebrow, title, mandate, body, publication]) => ({ id, eyebrow, title, mandate, body, publication }));

export const researchVectors = [
  ['1', 'Reasoning architectures', 'How does an autonomous system reason about novel problems without falling back to memorization? Core works on reasoning architectures that compose primitive operations into novel solutions, with explicit treatment of uncertainty and partial information.'],
  ['2', 'Long-horizon planning', 'How does an autonomous system plan over weeks, months, or years, sustaining intent across drift in the environment, in its own state, and in the operators it coordinates with? This is the central problem of Phase II operations.'],
  ['3', 'Persistent memory', 'How does an autonomous system carry context across years of operation without losing fidelity or accumulating drift? Mnemosyne studies long-memory architectures, episodic retrieval, and memory compaction under bounded compute.'],
  ['4', 'Alignment of autonomous systems', 'How are autonomous systems aligned to operator intent when the operator is not in the loop for the majority of decisions? Core treats alignment as an architectural problem, not a fine-tuning problem.'],
  ['5', 'Multi-agent coordination', 'How do populations of autonomous agents coordinate without centralized control? Vector studies orchestration, role specialization, conflict resolution, and decentralized intelligence under adversarial conditions.'],
  ['6', 'Machine consciousness and emergent cognition', 'How do cognitive architectures give rise to self-modeling, introspection, and unified agency? Orpheus studies the conditions under which emergent cognition arises in scaled systems. The lab publishes almost nothing.'],
];

export const contactOffices = [
  ['Company office', 'General inquiries, company-level partnerships, executive engagement, press, and inquiries that do not fit a more specific office.', 'office@daemion.com'],
  ['Research office', 'Academic collaboration, doctoral residencies, visiting researcher programs, and inquiries directed at internal laboratories.', 'research@daemion.com'],
  ['Partnerships office', 'Infrastructure partnerships, hardware co-design, foundation-model collaboration, and engagements spanning multiple divisions.', 'partnerships@daemion.com'],
  ['Eidolon office', 'Direct engagement for the consumer cognition program.', 'eidolon@daemion.com'],
  ['Kheiron office', 'Direct engagement for executive and sovereign strategic systems.', 'kheiron@daemion.com'],
  ['Merqis office', 'Direct engagement for enterprise operating intelligence.', 'merqis@daemion.com'],
  ['Aevum office', 'Direct engagement for civilizational modeling programs.', 'aevum@daemion.com'],
  ['Press and media', 'Interviews, published commentary, conference appearances, and press inquiries.', 'press@daemion.com'],
  ['Careers', 'Open positions and standing interest.', 'careers@daemion.com'],
  ['Security disclosure', 'Vulnerability reporting and responsible-disclosure submissions.', 'security@daemion.com'],
  ['Privacy and data handling', 'Privacy inquiries and data-deletion requests.', 'privacy@daemion.com'],
].map(([name, purpose, email]) => ({ name, purpose, email }));

export const careerDomains = [
  ['Research', 'Core, Orpheus, Mnemosyne, Atar, and Thaleon hire research scientists, research engineers, and research associates.', ['Reasoning architectures', 'Long-horizon planning under uncertainty', 'Persistent memory and continual learning', 'Alignment of autonomous systems', 'Multi-agent coordination']],
  ['Engineering', 'Vector and Merqis hire systems engineers, infrastructure engineers, and applied research engineers.', ['Multi-agent orchestration platforms', 'Long-running autonomous system infrastructure', 'Inference platform engineering', 'Operational integration of cognition systems']],
  ['Hardware', 'Forge hires silicon engineers, hardware architects, and supply-chain operators.', ['Inference silicon architecture', 'Edge and embedded compute platforms', 'Robotics-grade compute systems']],
  ['Strategy and operations', 'The Company office hires program directors, partnerships operators, and strategic-engagement leads.', ['Institutional engagement', 'Sovereign coordination', 'Program architecture']],
  ['Design', 'Design hires across product surfaces for restrained, institutional visual systems.', ['Long-cycle product work', 'Editorial systems', 'Interface restraint']],
].map(([title, body, focus]) => ({ title, body, focus }));

export const legal = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'How Daemion processes data submitted through the public website, inquiry forms, careers applications, and direct correspondence.',
    note: 'Version 1.0. Pending Bangladesh-qualified legal review before final production use.',
    sections: [
      ['Scope', 'This Privacy Policy describes how Daemion processes personal data submitted through the public website, inquiry forms, careers applications, direct correspondence, and Daemion product workspaces. For business clients, product engagements are additionally governed by separate data processing agreements.'],
      ['Controller', 'Daemion is operated by [LEGAL ENTITY NAME], incorporated in Bangladesh. Registered office: [REGISTERED ADDRESS]. For questions, contact privacy@daemion.com.'],
      ['What data Daemion collects', 'Daemion collects only the data needed to respond to inquiries, evaluate careers applications, and operate the public website: names, organizations, roles, email addresses, inquiry content, careers materials, interview notes, IP address, user agent, request timing, and aggregated page-view paths.'],
      ['Tracking posture', 'Daemion does not deploy third-party analytics, advertising trackers, social-media pixels, or session-replay tools on the public website. Page-view analysis is server-side and aggregated.'],
      ['Product workspace data', 'When a business client uses a Daemion product workspace, Daemion processes the account, support, knowledge, ticket, and operational data needed to provide that workspace. Access credentials and tenant secrets are stored with security controls appropriate to their sensitivity and are removed when no longer needed.'],
      ['How product data is used and shared', 'Product workspace data is used solely to generate AI-assisted support outputs, route conversations and support tickets to the business client, and operate the service on the client’s behalf. For this data Daemion acts as a data processor for the business client, which is the controller of its own customers’ data. Content may be processed by sub-processors that provide AI language models only to generate replies or operational summaries. Daemion does not sell product data, does not use it for advertising, and does not use it to build cross-business profiles. Product data is encrypted in transit and hosted on Cloudflare and a managed PostgreSQL database.'],
      ['Why Daemion processes data', 'Daemion processes data to respond to inquiries, evaluate careers applications, operate and secure the site, deliver the AI customer-support product to business clients, comply with legal obligations, and maintain institutional records where appropriate.'],
      ['Retention', 'Inquiry submissions are retained for 24 months from receipt. Careers materials are retained for 12 months from role close unless the candidate consents to longer retention. Web server logs are retained for 90 days, then aggregated or deleted. Product workspace data is retained for the duration of the business client’s engagement and is deleted on request or on account closure, subject to the applicable data processing agreement.'],
      ['Rights', 'Individuals may request access, correction, deletion, restriction, objection, withdrawal of consent, or complaint routing by writing to privacy@daemion.com.'],
      ['Contact', 'Privacy inquiries: privacy@daemion.com. Postal address: [REGISTERED OFFICE ADDRESS], Dhaka, Bangladesh.'],
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'Terms governing use of the Daemion public website, inquiry forms, and direct correspondence.',
    note: 'Version 1.0. Pending Bangladesh-qualified legal review before final production use.',
    sections: [
      ['Acceptance', 'By accessing the public website, submitting an inquiry form, sending correspondence to a Daemion mailbox, or applying to a careers posting, visitors agree to these Terms and to the Privacy Policy.'],
      ['Operator', 'The public website is operated by [LEGAL ENTITY NAME], incorporated in Bangladesh. Registered office: [REGISTERED ADDRESS]. Trade license and tax information remain pending final company details.'],
      ['Scope', 'The public surface provides editorial information about Daemion, inquiry routing, careers information, and links to legal documents. Product engagements operate under separate agreements.'],
      ['Acceptable use', 'Visitors must not submit unlawful, infringing, fraudulent, or rights-violating material; probe systems outside the disclosure process; submit automated inquiries; or impersonate a person or institution.'],
      ['Intellectual property', 'The DAEMION mark, website content, layout, design, code, and editorial material are property of Daemion or its licensors. Brief quotation with attribution is permitted.'],
      ['Submitted material', 'Material submitted through inquiry forms, mailboxes, or careers applications is processed under the Privacy Policy. Daemion does not solicit confidential information through public inquiry forms.'],
      ['Governing law', 'These Terms are governed by the laws of Bangladesh. Disputes are brought before the courts of Dhaka, Bangladesh, subject to mandatory rights that may apply elsewhere.'],
      ['Contact', 'Terms questions: office@daemion.com. Privacy and data-protection inquiries: privacy@daemion.com. Security disclosures: security@daemion.com.'],
    ],
  },
  'data-deletion': {
    slug: 'data-deletion',
    title: 'Data Deletion',
    description: 'How to request deletion of personal data submitted to Daemion through the public website, inquiry surfaces, careers channels, and Daemion product workspaces.',
    note: 'Version 1.0. Pending Bangladesh-qualified legal review before final production use.',
    sections: [
      ['Who may request deletion', 'Individuals may request deletion of personal data they submitted directly to Daemion or that Daemion processes in connection with public website, inquiry, careers, correspondence, or product workspace surfaces. Customers of a business that uses Daemion may also ask that business to submit a deletion request on their behalf.'],
      ['Product workspace data', 'To delete product workspace data, write to privacy@daemion.com with the subject line Data deletion request and include enough detail to locate the workspace, account, or customer record. Daemion verifies the request with the business client where required before deletion.'],
      ['How to request deletion', 'Write to privacy@daemion.com with the subject line Data deletion request. Include the email address used, the relevant office or form, and enough detail to locate the data.'],
      ['Verification', 'Daemion verifies the request before deletion. Verification may require a confirmation email or additional information where the request involves sensitive material.'],
      ['Timeline', 'Daemion acknowledges deletion requests within 3 business days and completes eligible deletion within 30 days unless a lawful retention basis applies.'],
      ['What may be deleted', 'Inquiry records, careers materials, direct correspondence, form submissions, and web logs that identify the requester may be deleted where no retention exception applies.'],
      ['Retention exceptions', 'Tax records, legal matters, active institutional matters, and anonymized aggregates may be retained where required or justified.'],
      ['Confirmation', 'When deletion is complete, Daemion sends a confirmation email describing what was deleted and what, if anything, was retained.'],
      ['Contact', 'Deletion requests: privacy@daemion.com. Postal address: [REGISTERED OFFICE ADDRESS], Dhaka, Bangladesh.'],
    ],
  },
};
