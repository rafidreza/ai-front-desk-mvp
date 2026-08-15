import { ClientProfile } from '../types/domain';

type ClientLanguage = ClientProfile['defaultLanguage'];

function normalizeLanguage(_language?: ClientLanguage): ClientLanguage {
  return 'english';
}

export function getClientLanguageCopy(language?: ClientLanguage) {
  const normalized = normalizeLanguage(language);

  if (normalized === 'bangla') {
    return {
      digest: {
        dailySubject: (businessName: string) => `${businessName} দৈনিক সাপোর্ট সামারি`,
        weeklySubject: (businessName: string) => `${businessName} সাপ্তাহিক সাপোর্ট রিকভারি রিপোর্ট`,
        narrative: (summary: { conversations: number; openTickets: number; salesRecoveredEstimate: number }) =>
          `${summary.conversations}টি কথোপকথন হ্যান্ডেল হয়েছে, ${summary.openTickets}টি খোলা টিকিট আছে, আনুমানিক BDT ${summary.salesRecoveredEstimate} সেলস সুরক্ষিত হয়েছে।`,
        conversations: 'হ্যান্ডেল করা কথোপকথন',
        tickets: 'তৈরি হওয়া টিকিট',
        openTickets: 'খোলা টিকিট',
        resolvedTickets: 'সমাধান হওয়া টিকিট',
        p1Tickets: 'P1 টিকিট',
        containment: 'কন্টেইনমেন্ট',
        averageConfidence: 'গড় কনফিডেন্স',
        averageCsat: 'গড় CSAT',
        noCsat: 'এখনও যথেষ্ট রেটিং নেই',
        salesProtected: 'আনুমানিক সুরক্ষিত সেলস',
        cta: 'পেন্ডিং হ্যান্ডঅফ রিভিউ করতে আপনার Daemion ড্যাশবোর্ড খুলুন।',
      },
      channels: {
        messengerLinked: 'পেজ লিংক করা',
        messengerSetupNeeded: 'পেজ সেটআপ দরকার',
        messengerDetail: (pageId: string) => `Page ID: ${pageId}`,
        messengerMissing: 'Messenger traffic লাইভ করার আগে Facebook Page ID যোগ করুন।',
        messengerReady: 'Inbox automation এর জন্য প্রস্তুত',
        messengerConnect: 'Facebook Page কানেক্ট করুন',
        whatsappLinked: 'Business contact সেট করা',
        whatsappSetupNeeded: 'Business contact দরকার',
        whatsappDetail: (contact: string) => `Support contact: ${contact}`,
        whatsappMissing: 'Handoff routing এর জন্য WhatsApp POC অথবা owner phone যোগ করুন।',
        whatsappReady: 'WhatsApp support এর জন্য প্রস্তুত',
        whatsappConnect: 'WhatsApp contact যোগ করুন',
        widgetAvailable: 'Widget ব্যবহারযোগ্য',
        widgetCopy: 'Embed link কপি করুন',
      },
    };
  }

  if (normalized === 'english') {
    return {
      digest: {
        dailySubject: (businessName: string) => `${businessName} daily support summary`,
        weeklySubject: (businessName: string) => `${businessName} weekly support recovery report`,
        narrative: (summary: { conversations: number; openTickets: number; salesRecoveredEstimate: number }) =>
          `${summary.conversations} conversations handled, ${summary.openTickets} open tickets, estimated BDT ${summary.salesRecoveredEstimate} sales protected.`,
        conversations: 'Conversations handled',
        tickets: 'Tickets created',
        openTickets: 'Open tickets',
        resolvedTickets: 'Resolved tickets',
        p1Tickets: 'P1 tickets',
        containment: 'Containment',
        averageConfidence: 'Average confidence',
        averageCsat: 'Average CSAT',
        noCsat: 'Not enough ratings yet',
        salesProtected: 'Estimated sales protected',
        cta: 'Open your Daemion dashboard to review pending handoffs.',
      },
      channels: {
        messengerLinked: 'Page linked',
        messengerSetupNeeded: 'Page setup needed',
        messengerDetail: (pageId: string) => `Page ID: ${pageId}`,
        messengerMissing: 'Add the Facebook Page ID before Messenger traffic can go live.',
        messengerReady: 'Ready for inbox automation',
        messengerConnect: 'Connect Facebook Page',
        whatsappLinked: 'Business contact set',
        whatsappSetupNeeded: 'Business contact needed',
        whatsappDetail: (contact: string) => `Support contact: ${contact}`,
        whatsappMissing: 'Add a WhatsApp POC or owner phone number for handoff routing.',
        whatsappReady: 'Ready for WhatsApp support',
        whatsappConnect: 'Add WhatsApp contact',
        widgetAvailable: 'Widget available',
        widgetCopy: 'Copy embed link',
      },
    };
  }

  return getClientLanguageCopy('english');
}

export function buildDigestSubject(input: { businessName: string; cadence: 'daily' | 'weekly'; language?: ClientLanguage }) {
  const copy = getClientLanguageCopy(input.language).digest;
  return input.cadence === 'weekly' ? copy.weeklySubject(input.businessName) : copy.dailySubject(input.businessName);
}

export function buildDigestNarrative(input: {
  language?: ClientLanguage;
  summary: { conversations: number; openTickets: number; salesRecoveredEstimate: number };
}) {
  return getClientLanguageCopy(input.language).digest.narrative(input.summary);
}

export function buildChannelCopy(language: ClientLanguage | undefined): ReturnType<typeof getClientLanguageCopy>['channels'] {
  return getClientLanguageCopy(language).channels;
}
