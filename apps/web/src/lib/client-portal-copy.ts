import { ClientChannelSummary, ClientProfile, Ticket, TicketStatus } from '@/types/domain';
import { formatBdt, formatLocalizedNumber } from './localized-format';

type ClientLanguage = ClientProfile['defaultLanguage'];

type TicketFilter = 'all' | 'open' | TicketStatus;

const englishStatusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  waiting_client: 'Waiting on you',
  reopened: 'Reopened',
  resolved: 'Resolved',
};

const banglaStatusLabels: Record<TicketStatus, string> = {
  open: 'খোলা',
  assigned: 'টিমের কাছে',
  waiting_client: 'আপনার সিদ্ধান্ত দরকার',
  reopened: 'আবার খোলা হয়েছে',
  resolved: 'সমাধান হয়েছে',
};

const englishFilterLabels: Record<TicketFilter, string> = {
  all: 'All',
  open: 'Open',
  assigned: 'Assigned',
  waiting_client: 'Waiting on you',
  reopened: 'Reopened',
  resolved: 'Resolved',
};

const banglaFilterLabels: Record<TicketFilter, string> = {
  all: 'সব',
  open: 'খোলা',
  assigned: 'টিমের কাছে',
  waiting_client: 'আপনার সিদ্ধান্ত দরকার',
  reopened: 'আবার খোলা হয়েছে',
  resolved: 'সমাধান হয়েছে',
};

function normalizeLanguage(_language?: ClientLanguage): ClientLanguage {
  return 'english';
}

function baseCopy(language: ClientLanguage) {
  if (language === 'bangla') {
    return {
      locale: 'bn-BD',
      nav: {
        aria: 'ক্লায়েন্ট পোর্টাল',
        overview: 'ওভারভিউ',
        tickets: 'টিকিট',
        knowledge: 'নলেজ',
        setup: 'সেটআপ',
      },
      common: {
        refresh: 'রিফ্রেশ',
        signOut: 'সাইন আউট',
        loading: 'লোড হচ্ছে',
        copy: 'কপি',
        noMessages: 'মেসেজ নেই',
      },
      dashboard: {
        eyebrow: 'ক্লায়েন্ট ড্যাশবোর্ড',
        supportCoverage: 'সাপোর্ট কভারেজ',
        coverageTitle: (connected: number) =>
          `${formatLocalizedNumber(connected, 'bangla')} / ${formatLocalizedNumber(3, 'bangla')} কাস্টমার চ্যানেলে AI সহায়তা চালু আছে`,
        coverageDescription:
          'Web support and internal handoff readiness are tracked so your team can see what is live, what needs setup, and where customers are already talking.',
        clientAccount: 'ক্লায়েন্ট অ্যাকাউন্ট',
        loadingAccount: 'অ্যাকাউন্ট লোড হচ্ছে',
        contactPending: 'যোগাযোগের তথ্য বাকি',
        channelsOnline: 'চ্যানেল অনলাইন',
        setupNeeded: 'সেটআপ দরকার',
        conversations: 'কথোপকথন',
        handledByAi: 'AI দ্বারা হ্যান্ডেল করা',
        containment: 'কন্টেইনমেন্ট',
        noHandoffNeeded: 'হ্যান্ডঅফ লাগেনি',
        openTickets: 'খোলা টিকিট',
        salesProtected: 'সেলস সুরক্ষিত',
        bdtEstimate: 'BDT অনুমান',
        channelVisibility: 'চ্যানেল দৃশ্যমানতা',
        channelConversations: 'কথোপকথন',
        openWidget: 'উইজেট খুলুন',
        recentTickets: 'সাম্প্রতিক টিকিট',
        delegate: 'ডেলিগেট',
        noTicketsYet: 'এখনও কোনো টিকিট নেই',
        recentConversations: 'সাম্প্রতিক কথোপকথন',
      },
      tickets: {
        eyebrow: 'ক্লায়েন্ট ডেলিগেশন',
        title: 'টিকিট',
        queueEyebrow: 'টিকিট কিউ',
        queueTitle: 'কাস্টমার ইস্যু যেগুলোতে আপনার সিদ্ধান্ত দরকার',
        queueDescription: 'ডেলিগেটেড কথোপকথন রিভিউ করুন, স্টেট আপডেট করুন, আর সাপোর্ট টিমকে একই তথ্য দিন।',
        open: 'খোলা',
        p1: 'P1',
        status: 'স্টেটাস',
        delegatedTickets: 'ডেলিগেটেড টিকিট',
        noTickets: 'কোনো টিকিট নেই',
        ticketDetail: 'টিকিট বিস্তারিত',
        selectTicket: 'বিস্তারিত দেখতে একটি টিকিট নির্বাচন করুন',
        raisedFromConversation: 'কাস্টমার কথোপকথন থেকে তৈরি',
        currentState: 'বর্তমান অবস্থা',
        raised: 'তোলা হয়েছে',
        lastUpdated: 'শেষ আপডেট',
        protectedSale: 'সুরক্ষিত সেল',
        raisedReason: 'কেন এই টিকিট তৈরি হয়েছে',
        suggestedReply: 'প্রস্তাবিত উত্তর',
        timeline: 'টিকিট টাইমলাইন',
        loadingTimeline: 'টাইমলাইন লোড হচ্ছে',
        noTimeline: 'এখনও কোনো টাইমলাইন ইভেন্ট নেই',
        customerConversation: 'কাস্টমার কথোপকথন',
        transcriptPending: 'লোড হলে কথোপকথনের ট্রান্সক্রিপ্ট এখানে দেখা যাবে',
        protectedEstimate: (amount: number) => `${formatBdt(amount, 'bangla')} সুরক্ষিত অনুমান`,
      },
      knowledge: {
        eyebrow: 'বিজনেস নলেজ',
        title: 'নলেজ বেস',
        approvedAnswers: 'অনুমোদিত উত্তর',
        commandTitle: (count: number) =>
          `${formatLocalizedNumber(count, 'bangla')} প্রকাশিত এন্ট্রি আপনার AI সাপোর্ট এজেন্ট ব্যবহার করতে পারে`,
        commandDescription: 'এগুলো এখন অনুমোদিত কাস্টমার-ফেসিং তথ্য। জমা দেওয়া আপডেট অপারেশন টিম প্রকাশ করা পর্যন্ত রিভিউতে থাকে।',
        published: 'প্রকাশিত',
        requests: 'রিকোয়েস্ট',
        publishedKnowledge: 'প্রকাশিত নলেজ',
        searchPlaceholder: 'এন্ট্রি খুঁজুন',
        approved: 'অনুমোদিত',
        suggestEdit: 'এডিট সাজেস্ট করুন',
        emptyEntries: 'এই ভিউতে কোনো প্রকাশিত এন্ট্রি নেই',
        addRequest: 'নলেজ রিকোয়েস্ট যোগ করুন',
        new: 'নতুন',
        editingRequest: (title: string) => `${title} এর জন্য এডিট রিকোয়েস্ট`,
        titleLabel: 'টাইটেল',
        answer: 'উত্তর',
        keywords: 'কিওয়ার্ড',
        category: 'ক্যাটাগরি',
        urgency: 'আর্জেন্সি',
        normal: 'নরমাল',
        urgent: 'আর্জেন্ট',
        businessNote: 'বিজনেস নোট',
        submitRequest: 'রিকোয়েস্ট জমা দিন',
        submitEdit: 'এডিট জমা দিন',
        submitting: 'জমা হচ্ছে',
        clear: 'ক্লিয়ার',
        updateRequests: 'আপডেট রিকোয়েস্ট',
        status: 'স্টেটাস',
        feedback: 'ফিডব্যাক',
        noRequests: 'এখনও কোনো আপডেট রিকোয়েস্ট নেই',
        requestSubmitted: 'নলেজ রিকোয়েস্ট জমা হয়েছে।',
        editSubmitted: 'এডিট রিকোয়েস্ট জমা হয়েছে।',
        loadError: 'নলেজ লোড করা যায়নি।',
        submitError: 'রিকোয়েস্ট জমা দেওয়া যায়নি।',
        titleError: 'টাইটেল কমপক্ষে ২ অক্ষর হতে হবে।',
        answerError: 'উত্তর কমপক্ষে ২ অক্ষর হতে হবে।',
        keywordError: 'কমপক্ষে একটি কিওয়ার্ড দিন।',
      },
      onboarding: {
        eyebrow: 'ক্লায়েন্ট অনবোর্ডিং',
        title: 'আপনার বিজনেস সেটআপ করুন',
        brief: 'আপনার ওয়ার্কস্পেসের জন্য বিজনেস কনটেক্সট, চ্যানেল সেটআপ পথ, এবং প্রথম নলেজ নোট শেয়ার করুন।',
        steps: { profile: 'প্রোফাইল', channels: 'চ্যানেল', knowledge: 'নলেজ' },
        businessProfile: 'বিজনেস প্রোফাইল',
        businessCategory: 'বিজনেস ক্যাটাগরি',
        businessCategoryPlaceholder: 'Fashion, dental clinic, electronics',
        customerChannels: 'কাস্টমার চ্যানেল',
        websiteUrl: 'Website URL',
        facebookPageUrl: 'Public page URL',
        continueChannels: 'চ্যানেলে যান',
        saving: 'সেভ হচ্ছে...',
        channelSetup: 'চ্যানেল সেটআপ',
        whatsappSetupPath: 'সাপোর্ট সেটআপ পথ',
        whatsappSelf: 'আমি সেটআপ তথ্য দেব',
        assisted: 'আমার সাথে সেটআপ করুন',
        skipNow: 'এখন বাদ দিন',
        whatsappSupportNumber: 'সাপোর্ট ফোন নম্বর',
        facebookSetupPath: 'পাবলিক পেজ সেটআপ পথ',
        facebookOauth: 'সহায়তাসহ সেটআপ রিকোয়েস্ট করুন',
        facebookOauthRequested: 'সহায়তাসহ সেটআপ রিকোয়েস্ট করা হয়েছে।',
        facebookPageId: 'Public page ID',
        websiteNoted: 'Website channel noted. ড্যাশবোর্ডে web widget প্রস্তুত থাকবে।',
        continueKnowledge: 'নলেজে যান',
        skipChannelSetup: 'চ্যানেল সেটআপ বাদ দিন',
        firstKnowledge: 'প্রথম নলেজ নোট',
        knowledgeTitle: 'নলেজ টাইটেল',
        businessKnowledge: 'বিজনেস নলেজ',
        keywords: 'কিওয়ার্ড',
        finish: 'অনবোর্ডিং শেষ করুন',
        finishing: 'শেষ হচ্ছে...',
        skipKnowledge: 'এখন নলেজ বাদ দিন',
        missingSession: 'ক্লায়েন্ট সেশন পাওয়া যায়নি।',
        selectChannel: 'কমপক্ষে একটি কাস্টমার চ্যানেল নির্বাচন করুন।',
        profileError: 'বিজনেস প্রোফাইল সেভ করা যায়নি।',
        channelError: 'চ্যানেল সেটআপ সেভ করা যায়নি।',
        skipError: 'চ্যানেল সেটআপ বাদ দেওয়া যায়নি।',
        finishError: 'অনবোর্ডিং শেষ করা যায়নি।',
      },
      statusLabels: banglaStatusLabels,
      filterLabels: banglaFilterLabels,
      channelStatus: (status: ClientChannelSummary['status']) => {
        if (status === 'connected') return 'সংযুক্ত';
        if (status === 'available') return 'ব্যবহারযোগ্য';
        if (status === 'contact_only') return 'শুধু কন্টাক্ট';
        return 'সেটআপ দরকার';
      },
      eventTitle: (eventType: string) => {
        if (eventType === 'ticket.created') return 'টিকিট তৈরি হয়েছে';
        if (eventType === 'ticket.status_updated') return 'স্টেটাস আপডেট হয়েছে';
        if (eventType === 'ticket.assignee_updated') return 'ওনার আপডেট হয়েছে';
        if (eventType === 'ticket.comment_added') return 'অপারেশন নোট যোগ হয়েছে';
        return eventType.replaceAll('.', ' ');
      },
    };
  }

  if (language === 'english') {
    return {
      locale: 'en',
      nav: {
        aria: 'Client portal',
        overview: 'Overview',
        tickets: 'Tickets',
        knowledge: 'Knowledge',
        setup: 'Setup',
      },
      common: {
        refresh: 'Refresh',
        signOut: 'Sign out',
        loading: 'Loading',
        copy: 'Copy',
        noMessages: 'No messages',
      },
      dashboard: {
        eyebrow: 'Client dashboard',
        supportCoverage: 'Support coverage',
        coverageTitle: (connected: number) =>
          `AI assistance is active across ${formatLocalizedNumber(connected, 'english')} of ${formatLocalizedNumber(1, 'english')} customer channel`,
        coverageDescription:
          'The web support widget is tracked so your team can see what is live, what needs setup, and where customers are already talking.',
        clientAccount: 'Client account',
        loadingAccount: 'Loading account',
        contactPending: 'Contact details pending',
        channelsOnline: 'Channels online',
        setupNeeded: 'Setup needed',
        conversations: 'Conversations',
        handledByAi: 'Handled by AI',
        containment: 'Containment',
        noHandoffNeeded: 'No handoff needed',
        openTickets: 'Open Tickets',
        salesProtected: 'Sales Protected',
        bdtEstimate: 'BDT estimate',
        channelVisibility: 'Channel visibility',
        channelConversations: 'conversations',
        openWidget: 'Open widget',
        recentTickets: 'Recent tickets',
        delegate: 'Delegate',
        noTicketsYet: 'No tickets yet',
        recentConversations: 'Recent conversations',
      },
      tickets: {
        eyebrow: 'Client delegation',
        title: 'Tickets',
        queueEyebrow: 'Ticket queue',
        queueTitle: 'Customer issues waiting for client decision',
        queueDescription: 'Review delegated conversations, update ownership state, and keep the support team aligned on resolution.',
        open: 'Open',
        p1: 'P1',
        status: 'Status',
        delegatedTickets: 'Delegated tickets',
        noTickets: 'No tickets',
        ticketDetail: 'Ticket detail',
        selectTicket: 'Select a ticket to view details',
        raisedFromConversation: 'Raised from customer conversation',
        currentState: 'Current state',
        raised: 'Raised',
        lastUpdated: 'Last updated',
        protectedSale: 'Protected sale',
        raisedReason: 'Why this ticket was raised',
        suggestedReply: 'Suggested reply',
        timeline: 'Ticket timeline',
        loadingTimeline: 'Loading timeline',
        noTimeline: 'No timeline events yet',
        customerConversation: 'Customer conversation',
        transcriptPending: 'Conversation transcript will appear here when loaded',
        protectedEstimate: (amount: number) => `${formatBdt(amount, 'english')} protected estimate`,
      },
      knowledge: {
        eyebrow: 'Business knowledge',
        title: 'Knowledge Base',
        approvedAnswers: 'Approved answers',
        commandTitle: (count: number) =>
          `${formatLocalizedNumber(count, 'english')} published entries available to your AI support agent`,
        commandDescription: 'These are the customer-facing facts currently approved for replies. Submitted updates stay in review until the operations team publishes them.',
        published: 'Published',
        requests: 'Requests',
        publishedKnowledge: 'Published knowledge',
        searchPlaceholder: 'Search entries',
        approved: 'approved',
        suggestEdit: 'Suggest edit',
        emptyEntries: 'No published entries match this view',
        addRequest: 'Add knowledge request',
        new: 'New',
        editingRequest: (title: string) => `Editing request for ${title}`,
        titleLabel: 'Title',
        answer: 'Answer',
        keywords: 'Keywords',
        category: 'Category',
        urgency: 'Urgency',
        normal: 'Normal',
        urgent: 'Urgent',
        businessNote: 'Business note',
        submitRequest: 'Submit request',
        submitEdit: 'Submit edit',
        submitting: 'Submitting',
        clear: 'Clear',
        updateRequests: 'Update requests',
        status: 'Status',
        feedback: 'Feedback',
        noRequests: 'No update requests yet',
        requestSubmitted: 'Knowledge request submitted.',
        editSubmitted: 'Edit request submitted.',
        loadError: 'Unable to load knowledge.',
        submitError: 'Unable to submit request.',
        titleError: 'Title must be at least 2 characters.',
        answerError: 'Answer must be at least 2 characters.',
        keywordError: 'Add at least one keyword.',
      },
      onboarding: {
        eyebrow: 'Client onboarding',
        title: 'Set up your business',
        brief: 'Share the business context, channel setup path, and first knowledge notes for your workspace.',
        steps: { profile: 'profile', channels: 'channels', knowledge: 'knowledge' },
        businessProfile: 'Business profile',
        businessCategory: 'Business category',
        businessCategoryPlaceholder: 'Fashion, dental clinic, electronics',
        customerChannels: 'Customer channels',
        websiteUrl: 'Website URL',
        facebookPageUrl: 'Public page URL',
        continueChannels: 'Continue to channels',
        saving: 'Saving...',
        channelSetup: 'Channel setup',
        whatsappSetupPath: 'Support setup path',
        whatsappSelf: 'I will provide setup details',
        assisted: 'Set it up with me',
        skipNow: 'Skip for now',
        whatsappSupportNumber: 'Support phone number',
        facebookSetupPath: 'Public page setup path',
        facebookOauth: 'Request assisted setup',
        facebookOauthRequested: 'Assisted setup requested.',
        facebookPageId: 'Public page ID',
        websiteNoted: 'Website channel noted. The dashboard will keep the web widget ready.',
        continueKnowledge: 'Continue to knowledge',
        skipChannelSetup: 'Skip channel setup',
        firstKnowledge: 'First knowledge notes',
        knowledgeTitle: 'Knowledge title',
        businessKnowledge: 'Business knowledge',
        keywords: 'Keywords',
        finish: 'Finish onboarding',
        finishing: 'Finishing...',
        skipKnowledge: 'Skip knowledge for now',
        missingSession: 'Client session is missing.',
        selectChannel: 'Select at least one customer channel.',
        profileError: 'Unable to save business profile.',
        channelError: 'Unable to save channel setup.',
        skipError: 'Unable to skip channel setup.',
        finishError: 'Unable to finish onboarding.',
      },
      statusLabels: englishStatusLabels,
      filterLabels: englishFilterLabels,
      channelStatus: (status: ClientChannelSummary['status']) => {
        if (status === 'connected') return 'Connected';
        if (status === 'available') return 'Available';
        if (status === 'contact_only') return 'Contact only';
        return 'Needs setup';
      },
      eventTitle: (eventType: string) => {
        if (eventType === 'ticket.created') return 'Ticket raised';
        if (eventType === 'ticket.status_updated') return 'Status updated';
        if (eventType === 'ticket.assignee_updated') return 'Owner updated';
        if (eventType === 'ticket.comment_added') return 'Operations note added';
        return eventType.replaceAll('.', ' ');
      },
    };
  }


  return baseCopy('english');
}

export function getClientPortalCopy(language?: ClientLanguage) {
  return baseCopy(normalizeLanguage(language));
}

export function priorityTone(priority: Ticket['priority']) {
  if (priority === 'P1') return 'coral';
  if (priority === 'P2') return 'amber';
  return 'blue';
}
