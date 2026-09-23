"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTeam } from '@/hooks/use-team';
import { Loader2 } from 'lucide-react';

type Subscription = {
  id: string;
  team_slug: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
};

type Entitlement = {
  feature_key: string;
  quantity: number;
};

type Plan = {
  id: string;
  name: string;
  limits: any;
  features: any;
};

export default function BillingPage() {
  const t = useTranslations('admin.billing');
  const { teamSlug, isLoading: teamLoading } = useTeam();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch billing data
  useEffect(() => {
    if (teamSlug) {
      fetchBillingData();
      fetchPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSlug]);

  async function fetchBillingData() {
    if (!teamSlug) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/billing?teamSlug=${teamSlug}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setEntitlements(data.entitlements || []);
        if (data.subscription) {
          setSelectedPlan(data.subscription.plan_id);
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to fetch billing data');
      }
    } catch (err) {
      console.error('Error fetching billing:', err);
      setError('Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }

  async function handleChangePlan() {
    if (!selectedPlan || !teamSlug) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSlug, planId: selectedPlan }),
      });

      if (res.ok) {
        await fetchBillingData();
        // Show success message (you could use a toast here)
        alert('Plan updated successfully');
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to update plan');
        alert(`Failed to update plan: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error changing plan:', err);
      setError('Failed to update plan');
      alert('Error changing plan');
    } finally {
      setLoading(false);
    }
  }

  if (teamLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('billing')}</h1>
        <p className="text-sm text-muted-foreground">{t('manageYourBillingAndSubscriptions')}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('currentPlan')}</CardTitle>
          <CardDescription>{t('viewAndChangeYourCurrentPlan')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>{t('plan')}</Label>
              <select
                className="w-full border rounded h-9 px-2"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                disabled={loading}
              >
                <option value="">{t('selectPlan')}</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('status')}</Label>
              <div>
                {subscription ? (
                  <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'}>
                    {subscription.status}
                  </Badge>
                ) : (
                  <Badge variant="outline">No subscription</Badge>
                )}
              </div>
            </div>
          </div>
          {subscription && (
            <div className="text-sm text-muted-foreground">
              <p>Period: {new Date(subscription.current_period_start).toLocaleDateString()} - {new Date(subscription.current_period_end).toLocaleDateString()}</p>
            </div>
          )}
          <Button onClick={handleChangePlan} disabled={loading || !selectedPlan}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('changePlan')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('usage')}</CardTitle>
          <CardDescription>{t('currentUsageAndLimits')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {entitlements.length > 0 ? (
            entitlements.map(ent => (
              <div key={ent.feature_key} className="grid md:grid-cols-2 gap-4 items-center">
                <Label className="capitalize">{ent.feature_key.replace(/_/g, ' ')}</Label>
                <Badge variant="outline">{ent.quantity}</Badge>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No usage data available</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('paymentMethod')}</CardTitle>
          <CardDescription>{t('manageYourPaymentMethod')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>{t('addPaymentMethod')}</Button>
          <p className="text-sm text-muted-foreground mt-2">Payment method management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
