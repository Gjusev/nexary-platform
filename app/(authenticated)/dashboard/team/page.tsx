'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useTeam } from '@/hooks/use-team';
import { Copy, Plus, Trash2, Check, X, Clock, UserMinus, UserCheck, Shield, ShieldOff, Eye, Settings, Crown, Link2, ExternalLink } from 'lucide-react';
import { TeamMembersListSkeleton, InvitationLinksListSkeleton, JoinRequestsListSkeleton } from '@/components/chat-skeleton';
import { PermissionGate } from '@/components/auth/permission-gate';
import { usePermissions } from '@/components/auth/use-permissions';
import { PERMISSIONS } from '@/lib/permissions-config';

type JoinRequest = {
  id: string;
  teamSlug: string;
  requesterEmail: string;
  requesterName?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
};

type TeamMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: 'active' | 'suspended' | 'removed';
  joinedAt: Date;
  lastActive: Date | null;
  suspendedAt: Date | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
};

type InvitationLink = {
  id: string;
  teamSlug: string;
  token: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  maxUses: number | null;
  currentUses: number;
  status: 'active' | 'expired' | 'revoked' | 'used_up';
  notes: string | null;
};

function TeamManagementContent() {
  const t = useTranslations('dashboard');
  const { session, teamSlug } = useTeam();
  const router = useRouter();
  const { hasPermission } = usePermissions(teamSlug || '');

  const [invitationLinks, setInvitationLinks] = useState<InvitationLink[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [newLinkForm, setNewLinkForm] = useState({
    expiresInHours: '24',
    maxUses: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [linksResponse, requestsResponse, membersResponse] = await Promise.all([
        fetch('/api/team/invitation-links'),
        fetch('/api/team/join-requests'),
        fetch('/api/team/members')
      ]);

      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        setInvitationLinks(linksData.links || []);
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setJoinRequests(requestsData.requests || []);
      }

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setTeamMembers(membersData.members || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createInvitationLink = async () => {
    try {
      const response = await fetch('/api/team/invitation-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresInHours: newLinkForm.expiresInHours ? parseInt(newLinkForm.expiresInHours) : null,
          maxUses: newLinkForm.maxUses ? parseInt(newLinkForm.maxUses) : null,
          notes: newLinkForm.notes || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationLinks(prev => [data.link, ...prev]);
        setNewLinkForm({ expiresInHours: '24', maxUses: '', notes: '' });
        toast({
          title: t('linkCreated'),
          description: t('invitationLinkCreated'),
        });
      } else {
        const error = await response.json();
        toast({
          title: t('error'),
          description: error.error || t('linkCreateFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating link:', error);
      toast({
        title: t('error'),
        description: t('linkCreateFailed'),
        variant: 'destructive',
      });
    }
  };

  const revokeInvitationLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/team/invitation-links?linkId=${linkId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setInvitationLinks(prev => 
          prev.map(link => 
            link.id === linkId 
              ? { ...link, status: 'revoked' as const }
              : link
          )
        );
        toast({
          title: t('linkRevoked'),
          description: t('linkRevokedSuccessfully'),
        });
      } else {
        const error = await response.json();
        toast({
          title: t('error'),
          description: error.error || t('linkRevokeFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking link:', error);
      toast({
        title: t('error'),
        description: t('linkRevokeFailed'),
        variant: 'destructive',
      });
    }
  };

  const copyLinkToClipboard = async (token: string) => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteUrl = `${baseUrl}/api/join/${token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: t('copied'),
        description: t('invitationLinkCopied'),
      });
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        title: t('error'),
        description: t('copyFailed'),
        variant: 'destructive',
      });
    }
  };

  const reviewJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/team/join-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        setJoinRequests(prev => 
          prev.map(request => 
            request.id === requestId 
              ? { ...request, status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date() }
              : request
          )
        );
        toast({
          title: action === 'approve' ? t('requestApproved') : t('requestRejected'),
          description: action === 'approve' ? t('requestApprovedDescription') : t('requestRejectedDescription'),
        });
      } else {
        const error = await response.json();
        toast({
          title: t('error'),
          description: error.error || t('requestReviewFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reviewing request:', error);
      toast({
        title: t('error'),
        description: t('requestReviewFailed'),
        variant: 'destructive',
      });
    }
  };

  const manageMember = async (memberId: string, action: string, role?: string) => {
    try {
      const response = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action, 
          memberId, 
          role
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setTeamMembers(prev => 
          prev.map(member => {
            if (member.id === memberId) {
              switch (action) {
                case 'updateRole':
                  return { ...member, role: role! };
                case 'suspend':
                  return { ...member, status: 'suspended' as const, suspendedAt: new Date() };
                case 'reactivate':
                  return { ...member, status: 'active' as const, suspendedAt: null };
                case 'remove':
                  return { ...member, status: 'removed' as const };
                default:
                  return member;
              }
            }
            return member;
          }).filter(member => member.status !== 'removed')
        );

        toast({
          title: t('success'),
          description: data.message,
        });
      } else {
        const error = await response.json();
        toast({
          title: t('error'),
          description: error.error || t('memberActionFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error managing member:', error);
      toast({
        title: t('error'),
        description: t('memberActionFailed'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />{t('pending')}</Badge>;
      case 'used':
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><Check className="w-3 h-3 mr-1" />{t('usedApproved')}</Badge>;
      case 'expired':
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />{t('expiredRejected')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('teamManagement')}</h1>
            <p className="text-sm text-muted-foreground">{t('manageMembersInvitationsRequests')}</p>
          </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">{t('teamMembers')}</TabsTrigger>
            <TabsTrigger value="links">{t('invitationLinks')}</TabsTrigger>
            <TabsTrigger value="requests">{t('joinRequests')}</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {t('teamMembers')}
                </CardTitle>
                <CardDescription>
                  {t('manageTeamMembersRolesPermissions')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TeamMembersListSkeleton count={5} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  {t('createInvitationLink')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InvitationLinksListSkeleton count={3} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <JoinRequestsListSkeleton count={4} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('teamManagement')}</h1>
          <p className="text-sm text-muted-foreground">{t('manageMembersInvitationsRequests')}</p>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">{t('teamMembers')}</TabsTrigger>
          <TabsTrigger value="links">{t('invitationLinks')}</TabsTrigger>
          <TabsTrigger value="requests">{t('joinRequests')}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('teamMembers')}
              </CardTitle>
              <CardDescription>
                {t('manageTeamMembersRolesPermissions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <Card key={member.id} className="relative">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {member.name || member.email}
                              </h3>
                              {member.role === 'team-owner' && (
                                <Crown className="w-4 h-4" />
                              )}
                              {member.role === 'team-leader' && (
                                <Shield className="w-4 h-4" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {member.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={member.status === 'active' ? 'default' : 
                                        member.status === 'suspended' ? 'destructive' : 'secondary'}
                              >
                                {member.status === 'active' ? t('active') : 
                                 member.status === 'suspended' ? t('suspended') : t('removed')}
                              </Badge>
                              <Badge variant="outline">
                                {member.role === 'team-owner' ? t('owner') :
                                 member.role === 'team-leader' ? t('teamLeader') : t('member')}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('joined')}: {new Date(member.joinedAt).toLocaleDateString()}
                              {member.lastActive && (
                                <span className="ml-2">
                                  • {t('lastActive')}: {new Date(member.lastActive).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {member.suspendedAt && (
                              <div className="text-xs text-red-600 mt-1">
                                {t('suspendedAt')}: {new Date(member.suspendedAt).toLocaleDateString()}
                                {member.suspensionReason && (
                                  <span className="block">{t('reason')}: {member.suspensionReason}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {member.role !== 'team-owner' && member.email !== (session as any)?.primaryEmail && (
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {member.status === 'active' && (
                              <>
                                {member.role === 'member' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => manageMember(member.id, 'updateRole', 'team-leader')}
                                    title={t('promoteToTeamLeader')}
                                  >
                                    <Shield className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => manageMember(member.id, 'updateRole', 'member')}
                                    title={t('demoteToMember')}
                                  >
                                    <ShieldOff className="w-4 h-4" />
                                  </Button>
                                )}
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" title={t('suspendMember')}>
                                      <UserMinus className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('suspendMemberTitle')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t('suspendMemberDescription')}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => manageMember(member.id, 'suspend')}
                                        className="bg-yellow-600 hover:bg-yellow-700"
                                      >
                                        {t('suspend')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                            
                            {member.status === 'suspended' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => manageMember(member.id, 'reactivate')}
                                title={t('reactivate')}
                              >
                                <UserCheck className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" title={t('removeMember')}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('removeMemberTitle')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('removeMemberDescription')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => manageMember(member.id, 'remove')}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {t('remove')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {teamMembers.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground">
                        {t('noTeamMembers')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                {t('createInvitationLink')}
              </CardTitle>
              <CardDescription>
                {t('createNewInvitationLink')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkExpiresInHours">{t('expiresInHours')}</Label>
                  <Input
                    id="linkExpiresInHours"
                    type="number"
                    value={newLinkForm.expiresInHours}
                    onChange={(e) => setNewLinkForm(prev => ({ ...prev, expiresInHours: e.target.value }))}
                    placeholder={t('expiresInHoursPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkMaxUses">{t('maxUses')}</Label>
                  <Input
                    id="linkMaxUses"
                    type="number"
                    value={newLinkForm.maxUses}
                    onChange={(e) => setNewLinkForm(prev => ({ ...prev, maxUses: e.target.value }))}
                    placeholder={t('maxUsesPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkNotes">{t('notesOptional')}</Label>
                  <Input
                    id="linkNotes"
                    value={newLinkForm.notes}
                    onChange={(e) => setNewLinkForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('notesPlaceholder')}
                  />
                </div>
              </div>
              <PermissionGate permission="team.invite" teamSlug={teamSlug || ''} fallback={null}>
                <Button onClick={createInvitationLink} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('createLink')}
                </Button>
              </PermissionGate>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t('activeLinks')}</h3>
            {invitationLinks.map((link) => (
              <Card key={link.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono block max-w-[70vw] sm:max-w-none overflow-x-auto whitespace-nowrap">
                          {typeof window !== 'undefined' ? 
                            `${window.location.origin}/api/join/${link.token}` : 
                            `/api/join/${link.token}`}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLinkToClipboard(link.token)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/join/${link.token}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {getStatusBadge(link.status)}
                        {link.notes && <span className="text-sm text-muted-foreground">{link.notes}</span>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        <p>{t('created')}: {new Date(link.createdAt).toLocaleDateString()}</p>
                        {link.expiresAt && (
                          <p>{t('expires')}: {new Date(link.expiresAt).toLocaleDateString()}</p>
                        )}
                        <p>
                          {t('uses')}: {link.currentUses}{link.maxUses ? ` / ${link.maxUses}` : t('unlimited')}
                        </p>
                      </div>
                    </div>
                    {link.status === 'active' && (
                      <PermissionGate permission="team.invite" teamSlug={teamSlug || ''} fallback={null}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('revokeLink')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('revokeLinkDescription')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => revokeInvitationLink(link.id)}>
                                {t('revoke')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </PermissionGate>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {invitationLinks.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {t('noActiveLinks')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="grid gap-4">
            {joinRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{request.requesterName || request.requesterEmail}</p>
                          <p className="text-sm text-muted-foreground">{request.requesterEmail}</p>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.message && (
                        <div className="bg-muted p-3 rounded">
                          <p className="text-sm">{request.message}</p>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        <p>{t('requested')}: {new Date(request.createdAt).toLocaleDateString()}</p>
                        {request.reviewedAt && (
                          <p>{t('reviewed')}: {new Date(request.reviewedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => reviewJoinRequest(request.id, 'approve')}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {t('approve')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => reviewJoinRequest(request.id, 'reject')}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {t('reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {joinRequests.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {t('noPendingRequests')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TeamManagementPage() {
  const t = useTranslations('dashboard');

  return (
    <Suspense fallback={<div className="p-6">{t('loadingTeam')}</div>}>
      <TeamManagementContent />
    </Suspense>
  );
}
