# Cost Analysis & Pricing Strategy for Nexary

**Analysis Date**: January 2026
**Currency**: EUR (€)
**Focus**: B2B SaaS with hybrid AI strategy

---

## 📊 Executive Summary

### Key Findings

| Metric | Value | Notes |
|--------|-------|-------|
| **Break-even Point** | 87 users | At €29/mo pricing |
| **Recommended Pricing** | €29-€99/mo | Per user/team |
| **Gross Margin Target** | 70-80% | Industry standard for SaaS |
| **CAC Payback Period** | <12 months | Healthy SaaS metric |

### 💰 Quick Pricing Recommendation

```
Starter:    €29/mo  - 1-5 users, 100 AI requests/day
Professional: €79/mo  - Unlimited users, 1,000 AI requests/day
Enterprise:  €299/mo - Unlimited everything + SLA
```

**Start charging after**: 20-30 beta users OR 3 months of testing (whichever comes first)

---

## 1️⃣ Cost Structure Breakdown

### Fixed Costs (Monthly)

| Cost Item | Amount | Frequency | Notes |
|-----------|--------|-----------|-------|
| **Infrastructure** | €67 | Monthly | Hetzner server (Germany) |
| **Database** | €0 | - | Included in infra |
| **Qdrant (self-hosted)** | €0 | - | Included in infra |
| **Redis** | €0 | - | Included in infra |
| **MinIO** | €0 | - | Included in infra |
| **Domain + SSL** | €15 | Yearly (~€1.25/mo) | nexary.com |
| **Error Tracking (Sentry)** | €0 | Free tier | Up to 5k errors/month |
| **Monitoring (optional)** | €20 | Monthly | Datadog/Rollbar (optional) |
| **Stack Auth** | €0 | Free tier | Up to 1,000 MAU |
| **GitHub** | €0 | Free tier | For development |
| **Vercel Hosting** | €0 | Free tier | Hobby plan |
| **TOTAL FIXED** | **~€90** | Monthly | Without monitoring |

### Variable Costs (Per User/Per Month)

Assumptions:
- **Active user**: Uses app 20 days/month
- **Daily usage**: 10 AI requests (chat messages)
- **Request breakdown**:
  - 7 requests: Simple chat → Mistral 7B (70%)
  - 2 requests: Complex tasks → Azure OpenAI (20%)
  - 1 request: RAG query → Mistral embed + Azure OpenAI (10%)

#### AI Costs Per User

**Simple Chat (Mistral 7B) - 7 requests/day × 20 days = 140 requests/month**

| Metric | Value |
|--------|-------|
| Tokens per request (avg) | 500 input + 500 output = 1,000 |
| Total tokens/month | 140,000 |
| Cost (€0.07/1M tokens) | €0.0098/month |

**Complex Tasks (Azure OpenAI) - 2 requests/day × 20 days = 40 requests/month**

| Metric | Value |
|--------|-------|
| Tokens per request (avg) | 1,500 input + 1,000 output = 2,500 |
| Total tokens/month | 100,000 |
| Cost (€0.165 input + €0.66 output) | €0.041/month |
| Data Zone premium (+10%) | €0.045/month |

**RAG Queries (Mistral embed + Azure OpenAI) - 1 request/day × 20 days = 20 requests/month**

| Metric | Value |
|--------|-------|
| Embedding tokens (Mistral) | 2,000 × 20 = 40,000 tokens → €0.0028 |
| RAG generation (Azure) | 2,000 input + 500 output × 20 = 50,000 tokens → €0.023 |
| RAG total | **€0.026/month** |

#### Storage Costs Per User

| Metric | Value |
|--------|-------|
| Documents stored | 10 PDFs × 5MB avg = 50MB |
| Chat history | 100 messages × 2KB = 200KB |
| Vector embeddings | 50MB × 0.5 (compressed) = 25MB |
| Total storage/user | ~75MB |
| Cost on Hetzner (4TB for €67) | €0.00125/month/user |

**Negligible - can be considered €0 for pricing**

#### Total Variable Cost Per User

| Component | Cost (€/mo) | % of Total |
|-----------|-------------|------------|
| Simple chat (Mistral) | €0.0098 | 13% |
| Complex tasks (Azure) | €0.045 | 59% |
| RAG queries | €0.026 | 34% |
| Storage | €0.00125 | <2% |
| **TOTAL PER USER** | **€0.082** | 100% |

**Buffer for overages (+50%)**: €0.12/user/month

---

## 2️⃣ Cost Scenarios by User Count

### Scenario A: Early Stage (0-50 users)

| Metric | Value |
|--------|-------|
| Users | 50 |
| Fixed costs | €90 |
| Variable costs (50 × €0.12) | €6 |
| **Total monthly cost** | **€96** |
| Cost per user | €1.92 |

**Cash burn**: €96/month (covered by founder savings/investment)

### Scenario B: Growth Stage (50-200 users)

| Metric | Value |
|--------|-------|
| Users | 100 |
| Fixed costs | €90 |
| Variable costs (100 × €0.12) | €12 |
| Stack Auth (paid tier starts ~1k MAU) | €0 |
| **Total monthly cost** | **€102** |
| Cost per user | €1.02 |

**Cash burn**: €102/month

| Users | 200 |
|-------|-----|
| Fixed costs | €90 |
| Variable costs (200 × €0.12) | €24 |
| **Total monthly cost** | **€114** |
| Cost per user | €0.57 |

### Scenario C: Scale-up (200-1,000 users)

| Metric | Value |
|--------|-------|
| Users | 500 |
| Fixed costs (upgrade infra) | €150 (bigger server) |
| Variable costs (500 × €0.12) | €60 |
| Stack Auth (Growth tier) | €50 |
| Sentry (Team tier) | €30 |
| **Total monthly cost** | **€290** |
| Cost per user | €0.58 |

| Users | 1,000 |
|-------|-------|
| Fixed costs (multiple servers) | €300 |
| Variable costs (1,000 × €0.12) | €120 |
| Stack Auth (Scale tier) | €150 |
| Sentry (Business tier) | €80 |
| Monitoring (Datadog) | €70 |
| **Total monthly cost** | **€720** |
| Cost per user | €0.72 |

### Scenario D: Serious Growth (1,000-10,000 users)

| Users | 5,000 |
|-------|-------|
| Infrastructure (cluster) | €1,500 |
| Variable costs (5,000 × €0.12) | €600 |
| Stack Auth (Enterprise) | €500 |
| Sentry | €200 |
| Support tools | €100 |
| **Total monthly cost** | **€2,900** |
| Cost per user | €0.58 |

| Users | 10,000 |
|-------|--------|
| Infrastructure (auto-scaling) | €3,000 |
| Variable costs (10,000 × €0.12) | €1,200 |
| Stack Auth | €1,000 |
| Sentry/monitoring | €500 |
| Support staff (2 FTE) | €6,000 |
| **Total monthly cost** | **€11,700** |
| Cost per user | €1.17 |

---

## 3️⃣ When to Start Charging

### 🟢 Green Light - Start Charging NOW

**If you have ANY of these:**

- ✅ 20+ active beta users
- ✅ 3+ months of testing completed
- ✅ Product-market fit signals (users asking for features)
- ✅ External validation (demo day, accelerator acceptance)
- ✅ Waitlist of 50+ people

**Reasoning**: You've validated the product. Time to validate revenue.

### 🟡 Yellow Light - Prepare to Charge

**If you have:**

- ⚠️ 10-20 beta users
- ⚠️ 1-3 months of testing
- ⚠️ Some user engagement but not viral yet
- ⚠️ Product still evolving

**Action Plan**:
1. Set a charging deadline: "After Feb 28, we'll start paid plans"
2. Offer "Founders pricing" for early adopters (50% off forever)
3. Get testimonials from beta users
4. Prepare landing page with pricing

### 🔴 Red Light - NOT Ready Yet

**If you have:**

- ❌ <10 beta users
- ❌ <1 month of testing
- ❌ Major bugs or incomplete features
- ❌ No user feedback yet

**Action Plan**: Focus on product, not pricing. Get to 20 users first.

---

## 4️⃣ Pricing Strategy

### Recommended Pricing Tiers

#### 🌱 Starter - €29/month

**Target**: Solo developers, freelancers, small teams

**Includes**:
- 1-5 users
- 100 AI requests/day (~3,000/month)
- 10GB document storage
- Basic RAG (local only)
- Email support

**Cost breakdown**:
- Infrastructure: €1/user
- AI costs: €2.40/user (at 100 requests/day)
- Support: €5/user
- **Total cost**: ~€8/user
- **Gross margin**: 72%

**Gross profit**: €21/user × 5 users = €105/month

#### 🚀 Professional - €79/month

**Target**: Startups, agencies, growing teams

**Includes**:
- Unlimited users (up to 20)
- 1,000 AI requests/day (~30,000/month)
- 100GB document storage
- Advanced RAG + semantic search
- Priority email support
- Team collaboration features

**Cost breakdown**:
- Infrastructure: €2/user
- AI costs: €6/user (at 1,000 requests/day, but only 30% active)
- Support: €10/user
- **Total cost**: ~€18/user
- **Gross margin**: 77%

**Gross profit**: €61/month

#### 🏢 Enterprise - €299/month

**Target**: Large companies, EU enterprises with compliance needs

**Includes**:
- Unlimited users
- Unlimited AI requests
- Unlimited storage
- Dedicated RAG infrastructure
- Custom compliance reports
- SLA (99.9% uptime)
- Phone + Slack support
- Onboarding assistance

**Cost breakdown**:
- Infrastructure: €50/user (dedicated resources)
- AI costs: €30/user (heavy usage)
- Support: €80/user
- Account management: €40/user
- **Total cost**: ~€200/account
- **Gross margin**: 33% (lower but higher absolute profit)

**Gross profit**: €99/account

### 💡 Alternative: Usage-Based Pricing

For more flexibility:

```typescript
Pricing = {
  baseFee: 19, // €/month base
  aiRequests: {
    first_1000: 0, // Free
    next_9000: 0.01, // €0.01 per request
    over_10000: 0.005 // €0.005 per request (volume discount)
  },
  storage: {
    first_10gb: 0, // Free
    over_10gb: 0.50 // €0.50 per GB
  },
  users: {
    first_5: 0, // Free
    over_5: 5 // €5 per additional user
  }
}

// Example calculation:
// Startup with:
// - 8 users
// - 5,000 AI requests/month
// - 25GB storage
//
// Cost = €19 + (3 users × €5) + (4,000 requests × €0.01) + (15GB × €0.50)
//      = €19 + €15 + €40 + €7.50
//      = €81.50/month
```

---

## 5️⃣ Revenue Projections

### Conservative Scenario (10% conversion from waitlist)

| Month | Users | Paying Users | ARPU | MRR | ARR |
|-------|-------|--------------|------|-----|-----|
| Month 1 | 20 | 2 | €29 | €58 | €696 |
| Month 3 | 50 | 5 | €45 | €225 | €2,700 |
| Month 6 | 100 | 10 | €55 | €550 | €6,600 |
| Month 12 | 300 | 30 | €65 | €1,950 | €23,400 |

### Moderate Scenario (25% conversion)

| Month | Users | Paying Users | ARPU | MRR | ARR |
|-------|-------|--------------|------|-----|-----|
| Month 1 | 20 | 5 | €29 | €145 | €1,740 |
| Month 3 | 50 | 12 | €45 | €540 | €6,480 |
| Month 6 | 100 | 25 | €55 | €1,375 | €16,500 |
| Month 12 | 300 | 75 | €65 | €4,875 | €58,500 |

### Optimistic Scenario (40% conversion)

| Month | Users | Paying Users | ARPU | MRR | ARR |
|-------|-------|--------------|------|-----|-----|
| Month 1 | 20 | 8 | €29 | €232 | €2,784 |
| Month 3 | 50 | 20 | €45 | €900 | €10,800 |
| Month 6 | 100 | 40 | €55 | €2,200 | €26,400 |
| Month 12 | 300 | 120 | €65 | €7,800 | €93,600 |

**ARPU** = Average Revenue Per User
**MRR** = Monthly Recurring Revenue
**ARR** = Annual Recurring Revenue

---

## 6️⃣ Break-Even Analysis

### Fixed Costs Coverage

You need **€90/month** to cover fixed costs.

#### At €29/month (Starter)
- Break-even at: **4 users** (€116 revenue)
- Margin after 4 users: €26/month

#### At €79/month (Professional)
- Break-even at: **2 users** (€158 revenue)
- Margin after 2 users: €68/month

#### Mixed Pricing (average €49/month)
- Break-even at: **2 users** (€98 revenue)
- Margin after 2 users: €8/month

### Time to Break-Even

**Assumption**: You need to invest €2,000 in development before launch

| Pricing Strategy | Users Needed | Months (at 10 users/month) | Months (at 20 users/month) |
|------------------|--------------|---------------------------|---------------------------|
| All Starter (€29) | 70 | 7 | 4 |
| All Pro (€79) | 26 | 3 | 2 |
| 50/50 Mix | 41 | 5 | 3 |

**Recommendation**: Aim for 50 paying users in first 3 months

---

## 7️⃣ Cash Flow Planning

### Startup Costs (One-time)

| Item | Cost | Notes |
|------|------|-------|
| Domain registration | €15 | nexary.com |
| Company formation (GmbH) | €2,500 | If Germany-based |
| Legal documents (privacy, terms) | €500 | Lawyer review |
| Logo + branding | €200 | Fiverr/99designs |
| Landing page design | €0 | DIY with shadcn/ui |
| **Total startup** | **€3,215** | One-time |

### Operating Burn Rate (Monthly)

| Phase | Monthly Burn | Runway (€10k) | Runway (€20k) |
|-------|--------------|----------------|----------------|
| Pre-launch (0 revenue) | €500 | 20 months | 40 months |
| Launch (10 users @ €29) | €-210 (profit!) | ∞ | ∞ |
| Growth (50 users @ avg €45) | €-1,680 (profit) | ∞ | ∞ |

**Note**: Negative burn = profit! ✅

### Recommended Cash Reserve

**Minimum**: €5,000 (10 months runway at pre-launch)
**Comfortable**: €15,000 (can invest in marketing)
**Ideal**: €30,000 (can hire 1-2 part-time developers)

---

## 8️⃣ Pricing Psychology & Tactics

### 🎯 Anchor Pricing

Display 3 tiers with Pro highlighted:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Starter       │  │  Professional ⭐│  │   Enterprise    │
│                 │  │                 │  │                 │
│    €29/month    │  │    €79/month    │  │    €299/month   │
│                 │  │                 │  │                 │
│  [Sign Up]      │  │  [Sign Up]      │  │  [Contact Us]   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

Psychology:
- Starter makes Pro look reasonable (€29 → €79)
- Pro looks like the "smart choice"
- Enterprise justifies the Pro price

### 💰 Founders Deal

**Limited to first 50 customers**:

```
🎉 Founders Pricing - 50% OFF FOREVER 🎉

Lock in lifetime pricing:
- Starter: €14.50/month (normally €29)
- Professional: €39.50/month (normally €79)
- Enterprise: €149.50/month (normally €299)

Only X spots remaining! [Claim Your Spot]
```

Benefits:
- ✅ Creates urgency (scarcity)
- ✅ Gets early revenue
- ✅ Builds customer loyalty
- ✅ Incentivizes early adoption

### 📅 Annual Discount

**Standard SaaS tactic**: 2 months free if paid annually

```
Monthly: €79/month
Annual: €790/year (€65.83/month - SAVE €168!)
```

Benefits:
- ✅ Improves cash flow
- ✅ Reduces churn
- ✅ Predictable revenue
- ✅ 16% discount is standard

### 🎁 Free Trial

**Recommended**: 14-day free trial, no credit card required

```
✅ Full access to Professional plan
✅ 100 AI requests/day during trial
✅ No credit card required
✅ Cancel anytime
```

Why 14 days?
- Short enough to create urgency
- Long enough to experience value
- Industry standard

---

## 9️⃣ Competitive Pricing Analysis

### Similar Products (2025/2026)

| Product | Pricing | Target | Differentiation |
|---------|---------|--------|-----------------|
| **ChatGPT Plus** | $20/mo (€18) | Individuals | No RAG, no EU focus |
| **ChatGPT Team** | $25/mo (€23) | Teams | No RAG, no EU focus |
| **Claude Pro** | $20/mo (€18) | Individuals | No RAG, no EU focus |
| **Notion AI** | $10/mo (€9) | Individuals | Limited AI features |
| **Mem.ai** | $10/mo (€9) | Individuals | Knowledge mgmt focus |
| **Perplexity Pro** | $20/mo (€18) | Research | No RAG |
| **Pinecone (RAG)** | $70/mo | Developers | Infrastructure only |
| **Nexary** | **€29-€79/mo** | **EU Teams** | **RAG + EU compliance** |

### Your Competitive Advantages

| Feature | Nexary | Competitors | Value |
|---------|--------|-------------|-------|
| **EU data residency** | ✅✅✅ | ❌ | +€10-20 value |
| **Self-hosted RAG** | ✅✅ | ❌ | +€20 value |
| **GDPR compliant** | ✅✅✅ | ⚠️ Partial | +€10 value |
| **Multi-provider AI** | ✅✅ | ❌ | +€5 value |
| **Team collaboration** | ✅ | ⚠️ Some | +€5 value |
| **German support** | ✅ | ❌ | +€5 value |
| **Total premium value** | | | **+€55 value** |

**Conclusion**: You can charge 2-3x more than ChatGPT Plus because:
1. B2B (businesses pay more than consumers)
2. EU compliance (premium feature)
3. RAG included (would cost €70+ separately)
4. Team features (not available in consumer AI)

---

## 🔟 Pricing Implementation Checklist

### Pre-Launch (2-4 weeks before)

- [ ] Finalize pricing tiers
- [ ] Create pricing page on website
- [ ] Set up Stripe payment integration
- [ ] Draft terms of service
- [ ] Prepare FAQ about pricing
- [ ] Create "Founders pricing" landing page
- [ ] Set up email capture for waitlist
- [ ] Prepare onboarding flow for paid users

### Launch Week

- [ ] Announce pricing to beta users
- [ ] Offer "Founders deal" (limited spots)
- [ ] Share on Twitter/LinkedIn
- [ ] Publish pricing blog post
- [ ] Send email to waitlist
- [ ] Monitor first payments
- [ ] Collect feedback on pricing

### Post-Launch (Month 1-3)

- [ ] Track conversion rate (waitlist → paid)
- [ ] Monitor churn (cancellations)
- [ ] Survey users about pricing
- [ ] Adjust if needed (increase/decrease)
- [ ] Add enterprise pricing if requested
- [ ] Consider annual plans
- [ ] A/B test different price points

---

## 📈 Key Metrics to Track

### SaaS Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **MRR** | Monthly Recurring Revenue | Growth >10% MoM |
| **ARPU** | Average Revenue Per User | €40-60 |
| **CAC** | Customer Acquisition Cost | <€50 |
| **LTV** | Lifetime Value | >€500 |
| **LTV:CAC** | Ratio | >3:1 |
| **Churn Rate** | Monthly cancellations | <5% |
| **MRR Churn** | Revenue churn | <2% |
| **Net MRR Growth** | New - Churn | >15% |
| **ARPU Expansion** | Existing users upgrading | >10% |
| **NPS** | Net Promoter Score | >40 |

### Unit Economics (Per €29 Customer)

| Metric | Value |
|--------|-------|
| Revenue | €29.00 |
| COGS (AI + Infra) | €2.50 |
| Gross Profit | €26.50 |
| Gross Margin | 91% |
| Support Cost | €5.00 |
| Net Profit | €21.50 |
| Net Margin | 74% |

**This is excellent!** Typical SaaS margins are 60-80%.

---

## 🎯 Final Recommendations

### 💰 Start Charging When You Have:

1. ✅ **20+ active users** (not just signups)
2. ✅ **Product is stable** (no major bugs)
3. ✅ **Clear value proposition** (users say "wow")
4. ✅ **Some external validation** (demo day, press, etc.)

### 📊 Pricing Strategy:

```
Phase 1 (Months 1-3): "Founders Pricing"
- 50% lifetime discount
- Limited to 50 customers
- Goal: 20-30 paying users
- Revenue: ~€400-900/month

Phase 2 (Months 4-6): Full Launch
- Standard pricing (€29-79)
- Public launch
- Goal: 50-100 paying users
- Revenue: ~€2,000-5,000/month

Phase 3 (Months 7-12): Growth
- Annual plans (+15% discount)
- Enterprise tier
- Goal: 200-500 paying users
- Revenue: ~€10,000-25,000/month
```

### 🚀 First 12 Months Target:

| Month | Goal | MRR | Notes |
|-------|------|-----|-------|
| 1 | 10 paying users | €290 | Launch with Founders pricing |
| 3 | 30 paying users | €870 | Focus on onboarding |
| 6 | 75 paying users | €2,175 | Add features based on feedback |
| 9 | 150 paying users | €4,350 | Start marketing spend |
| 12 | 300 paying users | €8,700 | Hire first employee |

**ARR Goal by Month 12**: €100,000+

---

## 📞 Next Steps

1. **Review this document** - Does the pricing make sense?
2. **Check your runway** - Do you have €3,000-5,000 for startup costs?
3. **Survey beta users** - Would they pay €29-79/month?
4. **Create pricing page** - Use the 3-tier model
5. **Set up Stripe** - Get ready to accept payments
6. **Soft launch** - Offer to 10 beta users first
7. **Public launch** - Announce to the world!

---

**Last Updated**: January 2026
**Author**: AI Analysis based on current market conditions
**Disclaimer**: These are estimates. Actual costs may vary based on usage patterns and provider pricing changes.
