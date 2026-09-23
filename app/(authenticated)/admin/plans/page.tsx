"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTeam } from '@/hooks/use-team';

type Plan = {
  id: string;
  name: string;
  limits: any;
  features: any;
};

export default function PlansPage() {
  const t = useTranslations('admin.plans');
  const { isGlobalAdmin, isLoading: authLoading } = useTeam();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // New plan form state
  const [newPlan, setNewPlan] = useState({
    id: '',
    name: '',
    limits: '{}',
    features: '{}',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to fetch plans');
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlan() {
    if (!editingPlan) return;

    setSaveLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPlan.id,
          name: editingPlan.name,
          limits: typeof editingPlan.limits === 'string' ? JSON.parse(editingPlan.limits) : editingPlan.limits,
          features: typeof editingPlan.features === 'string' ? JSON.parse(editingPlan.features) : editingPlan.features,
        }),
      });

      if (res.ok) {
        await fetchPlans();
        setEditingPlan(null);
        setIsCreating(false);
        setNewPlan({ id: '', name: '', limits: '{}', features: '{}' });
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to save plan');
        alert(`Failed to save plan: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      setError('Failed to save plan');
      alert('Error saving plan');
    } finally {
      setSaveLoading(false);
    }
  }

  function startEditing(plan: Plan) {
    setEditingPlan({
      ...plan,
      limits: typeof plan.limits === 'string' ? plan.limits : JSON.stringify(plan.limits, null, 2),
      features: typeof plan.features === 'string' ? plan.features : JSON.stringify(plan.features, null, 2),
    });
  }

  function startCreating() {
    setIsCreating(true);
    setEditingPlan({
      id: '',
      name: '',
      limits: '{}',
      features: '{}',
    });
  }

  function cancelEditing() {
    setEditingPlan(null);
    setIsCreating(false);
    setNewPlan({ id: '', name: '', limits: '{}', features: '{}' });
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isGlobalAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to manage plans.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">{t('plans')}</h1>
          <p className="text-sm text-muted-foreground">{t('managePricingPlans')}</p>
        </div>
        <Button onClick={startCreating} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createPlan')}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Existing Plans */}
          {plans.map(plan => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {plan.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(plan)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>ID: {plan.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Limits</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(plan.limits, null, 2)}
                  </pre>
                </div>
                <div>
                  <Label>Features</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(plan.features, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-auto">
            <CardHeader>
              <CardTitle>
                {isCreating ? t('createPlan') : t('editPlan')}: {editingPlan.name || 'New Plan'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Plan ID *</Label>
                <Input
                  value={editingPlan.id}
                  onChange={(e) => setEditingPlan({ ...editingPlan, id: e.target.value })}
                  disabled={!isCreating}
                  placeholder="e.g., pro, enterprise"
                />
              </div>
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="e.g., Pro Plan"
                />
              </div>
              <div>
                <Label>Limits (JSON) *</Label>
                <Textarea
                  value={typeof editingPlan.limits === 'string' ? editingPlan.limits : JSON.stringify(editingPlan.limits, null, 2)}
                  onChange={(e) => setEditingPlan({ ...editingPlan, limits: e.target.value })}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder='{"members": 10, "rags": 3, "queries": 5000}'
                />
              </div>
              <div>
                <Label>Features (JSON)</Label>
                <Textarea
                  value={typeof editingPlan.features === 'string' ? editingPlan.features : JSON.stringify(editingPlan.features, null, 2)}
                  onChange={(e) => setEditingPlan({ ...editingPlan, features: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder='{"priority_support": true, "custom_models": false}'
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={cancelEditing} disabled={saveLoading}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSavePlan} disabled={saveLoading || !editingPlan.id || !editingPlan.name}>
                  {saveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  {isCreating ? 'Create' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
