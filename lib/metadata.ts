interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
}

export const metadata: Record<string, PageMetadata> = {
  home: {
    title: 'Nexary - AI Power for Your Business | 100% GDPR Compliant',
    description: 'Unlock the possibilities of Artificial Intelligence without compromising data privacy or control. Secure, compliant AI platform for German enterprises.',
    keywords: ['AI', 'GDPR', 'Germany', 'Enterprise', 'RAG', 'Chat with documents', 'Data privacy'],
    image: '/og-home.png'
  },
  about: {
    title: 'About Nexary | Secure AI Platform',
    description: 'Learn about Nexary\'s mission, story, and team. Discover how we\'re revolutionizing enterprise AI with complete data sovereignty.',
    keywords: ['About', 'Mission', 'Team', 'Company', 'AI platform'],
    image: '/og-about.png'
  },
  features: {
    title: 'Features | Smart Chat, RAG & More | Nexary',
    description: 'Explore Nexary\'s powerful features: Smart Chat, RAG document management, semantic search, and enterprise-grade security.',
    keywords: ['Features', 'Smart Chat', 'RAG', 'Semantic Search', 'Analytics', 'Security'],
    image: '/og-features.png'
  },
  pricing: {
    title: 'Pricing | Simple & Transparent | Nexary',
    description: 'Simple, transparent pricing for teams of all sizes. Choose the plan that fits your needs. All plans include core features.',
    keywords: ['Pricing', 'Plans', 'Free', 'Enterprise', 'Cost'],
    image: '/og-pricing.png'
  },
  contact: {
    title: 'Contact Us | Get in Touch | Nexary',
    description: 'Have questions? Contact the Nexary team for support, sales inquiries, or partnership opportunities.',
    keywords: ['Contact', 'Support', 'Sales', 'Help', 'Inquiry'],
    image: '/og-contact.png'
  },
  security: {
    title: 'Security & Compliance | GDPR, ISO 27001 | Nexary',
    description: 'Learn about Nexary\'s security measures, GDPR compliance, ISO 27001 orientation, and data protection guarantees.',
    keywords: ['Security', 'GDPR', 'ISO 27001', 'Compliance', 'Data Protection'],
    image: '/og-security.png'
  }
};