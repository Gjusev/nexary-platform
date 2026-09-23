/**
 * Admin Teams Table Component
 *
 * Displays a list of all teams with their SSO/SCIM configuration.
 * Includes search, filtering, and actions.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MoreHorizontal,
  Eye,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  ssoType: 'none' | 'saml' | 'oidc' | 'both';
  samlConfigured: boolean;
  oidcConfigured: boolean;
  scimEnabled: boolean;
  enterpriseAuthEnabled: boolean;
  createdAt: Date;
}

interface SsoTypeBadgeProps {
  type: Team['ssoType'];
}

function SsoTypeBadge({ type }: SsoTypeBadgeProps) {
  const t = useTranslations('admin.teams.ssoType');

  const variants: Record<Team['ssoType'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    none: { label: t('none'), variant: 'secondary' },
    saml: { label: t('saml'), variant: 'default' },
    oidc: { label: t('oidc'), variant: 'default' },
    both: { label: t('both'), variant: 'outline' },
  };

  const { label, variant } = variants[type];

  return <Badge variant={variant}>{label}</Badge>;
}

interface ConfigBadgeProps {
  configured: boolean;
}

function ConfigBadge({ configured }: ConfigBadgeProps) {
  const t = useTranslations('admin.teams.status');
  const label = configured ? t('configured') : t('notConfigured');
  const variant = configured ? 'default' : 'secondary';

  return <Badge variant={variant}>{label}</Badge>;
}

export function AdminTeamsTable() {
  const t = useTranslations('admin.teams');
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch teams
  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter teams based on search
  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.name')}</TableHead>
              <TableHead>{t('table.slug')}</TableHead>
              <TableHead className="text-center">{t('table.members')}</TableHead>
              <TableHead>{t('table.sso')}</TableHead>
              <TableHead>{t('table.scim')}</TableHead>
              <TableHead className="text-center">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('table.noResults')}
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {team.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{team.memberCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SsoTypeBadge type={team.ssoType} />
                      <div className="flex gap-1">
                        <ConfigBadge configured={team.samlConfigured} />
                        <ConfigBadge configured={team.oidcConfigured} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ConfigBadge configured={team.scimEnabled} />
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/teams/${team.slug}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {t('table.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/teams/${team.slug}/saml`)}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          SAML Config
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/teams/${team.slug}/scim`)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          SCIM Config
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
