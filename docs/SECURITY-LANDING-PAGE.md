# Security & Privacy

Enterprise-grade security and data protection built from day one.

---

## 🇪🇺 EU Data Residency

Your data never leaves the European Union. We've designed Nexary with **complete EU data sovereignty**.

### AI Processing in Europe

- **Azure OpenAI**: Germany North region (Data Zone deployment)
- **Mistral AI**: Native EU provider (France)
- **Guarantee**: 100% of AI processing happens within EU borders

### Self-Hosted RAG Infrastructure

- **Location**: Germany (Hetzner)
- **Technology**: Qdrant vector database + PostgreSQL
- **Control**: Complete ownership of your document data
- **Performance**: <100ms search latency

### Data Processing Agreements

- **Signed with all AI providers** ✅
- **No model training on your data** ✅
- **Full data deletion on request** ✅

---

## 🔒 Technical Security

We follow security best practices from day one.

### Encryption & Secure Connections

- **TLS 1.3** for all data in transit
- **End-to-end encryption** for sensitive operations
- **Secure key management** via environment variables

### Authentication & Access Control

- **Stack Auth**: Enterprise authentication (SOC 2 compliant)
- **Team-based access control**: Role-based permissions
- **Secure session management**: Redis-backed sessions
- **Multi-factor authentication**: Available for all accounts

### Audit & Monitoring

- **Complete audit logs**: Every action logged
- **Real-time error tracking**: Sentry integration
- **Structured logging**: Pino-based JSON logs
- **Health monitoring**: System health checks
- **Performance metrics**: Response time tracking

### Code Security

- **TypeScript**: Type-safe codebase
- **ESLint**: Code quality enforcement
- **Automated dependency updates**: Dependabot
- **Vulnerability scanning**: npm audit
- **Secrets management**: Environment variables only

---

## 📋 Your GDPR Rights

We respect your privacy and give you full control over your data.

### Your Rights

| Right | Description | How to Exercise |
|-------|-------------|-----------------|
| **Right to Access** | See what data we have about you | Email privacy@nexary.com |
| **Right to Rectification** | Correct inaccurate data | Email privacy@nexary.com |
| **Right to Erasure** | Delete your data ("right to be forgotten") | Email privacy@nexary.com or use account settings |
| **Right to Portability** | Get your data in a machine-readable format | Email privacy@nexary.com |
| **Right to Object** | Object to processing of your data | Email privacy@nexary.com |
| **Right to Restrict** | Limit how we process your data | Email privacy@nexary.com |

### Data Subject Requests

- **Response time**: Within 30 days (usually much faster)
- **Verification required**: To protect your privacy
- **No cost**: Free of charge

**Contact**: privacy@nexary.com

---

## 🏗️ Built on Trusted Infrastructure

We don't cut corners on security. We use enterprise-grade providers with world-class certifications.

### AI Providers

| Provider | Certifications | Compliance | Role |
|----------|----------------|------------|------|
| **Azure OpenAI** | ISO 27001, SOC 1/2/3, C5, FedRAMP | GDPR compliant, EU AI Act aligned | Complex AI tasks |
| **Mistral AI** | ISO 27001 (pending) | GDPR compliant, EU native | Standard AI tasks |

### Data Infrastructure

| Component | Provider | Security Features |
|-----------|----------|-------------------|
| **Vector Database** | Qdrant (self-hosted) | Open source, full control |
| **Relational Database** | PostgreSQL | Encrypted at rest, row-level security |
| **Object Storage** | MinIO (self-hosted) | S3-compatible, encrypted |
| **Cache** | Redis | In-memory, ephemeral data |
| **Authentication** | Stack Auth | SOC 2 compliant, GDPR aligned |

### What This Means For You

✅ **Your AI requests** are processed by Microsoft Azure (ISO 27001 certified)
✅ **Your documents** are stored on servers you control in Germany
✅ **Your authentication** is handled by Stack Auth (SOC 2 compliant)
✅ **Your data** is protected by enterprise-grade encryption

---

## 🚫 What We DON'T Do

Transparency about our data practices.

- ❌ **We don't train AI models on your data** - Never
- ❌ **We don't sell your data** - Your data is yours, not ours
- ❌ **We don't send data outside the EU** - 100% EU processing
- ❌ **We don't store data longer than necessary** - Automatic cleanup policies
- ❌ **We don't access your data without permission** - Technical & legal barriers

---

## 🛡️ Security Best Practices

We implement industry-standard security measures.

### Application Security

- **Input validation**: All user inputs sanitized
- **SQL injection protection**: Parameterized queries
- **XSS prevention**: Content Security Policy headers
- **CSRF protection**: Token-based validation
- **Rate limiting**: API abuse prevention

### Operational Security

- **Least privilege access**: Team members get minimum required access
- **Regular updates**: Security patches applied promptly
- **Backup strategy**: Automated backups with redundancy
- **Incident response**: Documented procedures for security events

### Compliance Documentation

- **Privacy Policy**: Available on our website
- **Terms of Service**: Clear terms for using our service
- **Cookie Policy**: Transparent about tracking (if any)

---

## 🐛 Responsible Disclosure

Security is a team effort. If you find a vulnerability, please tell us.

### Bug Bounty Program

Found a security issue? We want to know about it.

**Scope**: `*.nexary.com`

**What we offer**:
- 🏆 Public credit (if desired)
- 💼 Swag package
- 📢 Recognition on our security page

**How to report**:
Email: security@nexary.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Proof of concept (if applicable)
- Your contact information

**Our commitment**:
- Response within 48 hours
- We'll keep you updated on our progress
- We'll credit you for the discovery

### What NOT to do

- Don't access other users' data
- Don't disrupt our service
- Don't use automated scanners without permission
- Don't publicly disclose the vulnerability before we fix it

---

## 📊 Third-Party Certifications

We use providers with world-class security certifications.

### Azure OpenAI (Microsoft)

Microsoft Azure holds the following certifications:

- ✅ **ISO/IEC 27001:2022** - Information security management
- ✅ **ISO/IEC 27018** - Protection of PII in cloud
- ✅ **ISO/IEC 27701** - Privacy information management
- ✅ **SOC 1 Type 2** - Service organization controls
- ✅ **SOC 2 Type 2** - Security, availability, processing integrity
- ✅ **SOC 3** - Trust services criteria
- ✅ **C5** - Germany BSI baseline protection
- ✅ **FedRAMP** - US government risk assessment
- ✅ **IRAP** - Australia government accreditation

### Mistral AI

- ✅ **GDPR Compliant** - EU data protection by design
- ✅ **EU Native** - Headquarters in Paris, France
- ✅ **ISO 27001** - Certification in progress
- ✅ **French ANSSI** - French cybersecurity agency compliant

### Stack Auth

- ✅ **SOC 2 Type II** - Service organization controls
- ✅ **GDPR Compliant** - EU data protection aligned

---

## 🔐 Data Protection by Design

Our architecture is built with privacy from the ground up.

### Data Minimization

We only collect data necessary to provide our service:

- ✅ User profile data (name, email) - For authentication
- ✅ Chat conversations - For AI responses and context
- ✅ Uploaded documents - For RAG processing
- ❌ We don't collect: Location data, payment info (handled by Stripe), behavioral tracking

### Purpose Limitation

Your data is only used for the purposes you consent to:

- ✅ **Chat conversations**: Only for generating AI responses
- ✅ **Document uploads**: Only for RAG search and retrieval
- ❌ Your data is never used for: Marketing, analytics, product development (without separate consent)

### Data Retention

We don't keep your data forever:

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Chat conversations | Until you delete | You can delete anytime |
| Uploaded documents | Until you delete | Vectors stored in Qdrant |
| Account data | Until account closure | 30-day grace period |
| Audit logs | 90 days | For security and debugging |
| Error logs | 30 days | Automated cleanup |

### Data Deletion

You can delete your data anytime:

1. **Via UI**: Settings → Delete Account
2. **Via Email**: privacy@nexary.com
3. **Processing time**: Within 7 days
4. **Confirmation**: Email notification when complete

---

## 🌍 EU AI Act Compliance

We're prepared for the EU AI Act.

### Transparency

We disclose:
- ✅ When you're interacting with AI
- ✅ Which AI provider is being used
- ✅ How your data is processed
- ✅ Your rights as a user

### Risk Management

- ✅ **Human oversight**: You can always review and edit AI outputs
- ✅ **Accuracy**: RAG provides source documents for verification
- ✅ **Robustness**: Multiple AI providers for reliability
- ✅ **Fallbacks**: Error handling and retry mechanisms

### AI System Classification

Our use of AI falls under **"Minimal Risk"** category:
- ✅ No prohibited AI practices (social scoring, real-time biometrics, etc.)
- ✅ Transparency obligations met
- ✅ Human oversight available
- ✅ No high-risk applications (employment, law enforcement, etc.)

---

## 📞 Contact Us

Questions about security or privacy? We're here to help.

### General Inquiries

**Email**: privacy@nexary.com
**Response Time**: Within 2 business days

### Data Subject Requests

**Email**: privacy@nexary.com
**Subject**: Data Subject Request - [Your Email]
**Response Time**: Within 30 days (usually faster)

### Security Issues

**Email**: security@nexary.com
**PGP Key**: [Available on request]
**Response Time**: Within 48 hours

### Business Inquiries

**Email**: hello@nexary.com
**Sales**: For enterprise security questionnaires

---

## 📝 Legal Documents

Our complete legal documentation:

- [Privacy Policy](/privacy) - How we collect and use data
- [Terms of Service](/terms) - Rules for using our service
- [Cookie Policy](/cookies) - How we use cookies
- [DPA Template](/dpa) - Data Processing Addendum (available on request)

---

## 🔄 Last Updated

**Date**: January 2026
**Version**: 1.0

We update this page regularly to reflect our current security practices and compliance status. Significant changes will be announced via email to all users.

---

## 💡 Why Trust Nexary?

We're a European startup building AI tools the right way:

1. **EU First**: Built in Europe, for Europe
2. **Transparent**: Open about our practices and providers
3. **Privacy-Focused**: Your data is yours, not ours
4. **Enterprise-Grade**: Using the same infrastructure as Fortune 500 companies
5. **Compliant**: GDPR and EU AI Act aligned from day one

**Questions?** Email privacy@nexary.com

**Ready to get started?** [Start your free trial](/signup)
