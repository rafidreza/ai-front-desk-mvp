import { ClientChannelSummary, ClientProfile, Ticket, TicketStatus } from '@/types/domain';

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

const mixedStatusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Team assigned',
  waiting_client: 'Apnar decision dorkar',
  reopened: 'Reopened',
  resolved: 'Resolved',
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

const mixedFilterLabels: Record<TicketFilter, string> = {
  all: 'All',
  open: 'Open',
  assigned: 'Team assigned',
  waiting_client: 'Decision dorkar',
  reopened: 'Reopened',
  resolved: 'Resolved',
};

function normalizeLanguage(language?: ClientLanguage): ClientLanguage {
  if (language === 'bangla' || language === 'english' || language === 'mixed') return language;
  return 'mixed';
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
        data: 'ডাটা',
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
        coverageTitle: (connected: number) => `${connected} / 3 কাস্টমার চ্যানেলে AI সহায়তা চালু আছে`,
        coverageDescription:
          'Messenger, WhatsApp এবং web widget আলাদা করে ট্র্যাক করা হচ্ছে, যেন কোন চ্যানেল লাইভ আর কোথায় সেটআপ দরকার তা বোঝা যায়।',
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
        protectedEstimate: (amount: number) => `BDT ${amount.toLocaleString('bn-BD')} সুরক্ষিত অনুমান`,
      },
      statusLabels: banglaStatusLabels,
      filterLabels: banglaFilterLabels,
      channelStatus: (status: ClientChannelSummary['status']) => {
        if (status === 'connected') return 'সংযুক্ত';
        if (status === 'available') return 'ব্যবহারযোগ্য';
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
        data: 'Data',
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
        coverageTitle: (connected: number) => `AI assistance is active across ${connected} of 3 customer channels`,
        coverageDescription:
          'Messenger, WhatsApp, and the web widget are tracked separately so your team can see which channels are live, which need setup, and where customers are already talking.',
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
        protectedEstimate: (amount: number) => `BDT ${amount.toLocaleString('en')} protected estimate`,
      },
      statusLabels: englishStatusLabels,
      filterLabels: englishFilterLabels,
      channelStatus: (status: ClientChannelSummary['status']) => {
        if (status === 'connected') return 'Connected';
        if (status === 'available') return 'Available';
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

  return {
    locale: 'en',
    nav: {
      aria: 'Client portal',
      overview: 'Overview',
      tickets: 'Tickets',
      knowledge: 'Knowledge',
      data: 'Data',
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
      coverageTitle: (connected: number) => `${connected} of 3 customer channels e AI assistance active`,
      coverageDescription:
        'Messenger, WhatsApp, ar web widget alada track kora hocche, jate live channel, setup-needed channel, ar customer traffic clear thake.',
      clientAccount: 'Client account',
      loadingAccount: 'Account loading',
      contactPending: 'Contact details pending',
      channelsOnline: 'Channels online',
      setupNeeded: 'Setup needed',
      conversations: 'Conversations',
      handledByAi: 'AI handled',
      containment: 'Containment',
      noHandoffNeeded: 'Handoff lageni',
      openTickets: 'Open Tickets',
      salesProtected: 'Sales Protected',
      bdtEstimate: 'BDT estimate',
      channelVisibility: 'Channel visibility',
      channelConversations: 'conversations',
      openWidget: 'Open widget',
      recentTickets: 'Recent tickets',
      delegate: 'Delegate',
      noTicketsYet: 'Ekhono ticket nei',
      recentConversations: 'Recent conversations',
    },
    tickets: {
      eyebrow: 'Client delegation',
      title: 'Tickets',
      queueEyebrow: 'Ticket queue',
      queueTitle: 'Customer issue jekhane client decision dorkar',
      queueDescription: 'Delegated conversations review korun, state update korun, ar support team ke aligned rakhun.',
      open: 'Open',
      p1: 'P1',
      status: 'Status',
      delegatedTickets: 'Delegated tickets',
      noTickets: 'Ticket nei',
      ticketDetail: 'Ticket detail',
      selectTicket: 'Details dekhte ekta ticket select korun',
      raisedFromConversation: 'Customer conversation theke raised',
      currentState: 'Current state',
      raised: 'Raised',
      lastUpdated: 'Last updated',
      protectedSale: 'Protected sale',
      raisedReason: 'Ei ticket keno raised hoyeche',
      suggestedReply: 'Suggested reply',
      timeline: 'Ticket timeline',
      loadingTimeline: 'Timeline loading',
      noTimeline: 'Ekhono timeline event nei',
      customerConversation: 'Customer conversation',
      transcriptPending: 'Load hole conversation transcript ekhane dekha jabe',
      protectedEstimate: (amount: number) => `BDT ${amount.toLocaleString('en')} protected estimate`,
    },
    statusLabels: mixedStatusLabels,
    filterLabels: mixedFilterLabels,
    channelStatus: (status: ClientChannelSummary['status']) => {
      if (status === 'connected') return 'Connected';
      if (status === 'available') return 'Available';
      return 'Setup needed';
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

export function getClientPortalCopy(language?: ClientLanguage) {
  return baseCopy(normalizeLanguage(language));
}

export function priorityTone(priority: Ticket['priority']) {
  if (priority === 'P1') return 'coral';
  if (priority === 'P2') return 'amber';
  return 'blue';
}
