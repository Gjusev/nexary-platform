'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@stackframe/stack';
import { useTeam } from '@/hooks/use-team';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Search, Star, Users, Globe, Lock, 
  MoreVertical, Pencil, Trash2, Copy, Heart,
  Sparkles, TrendingUp, Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  visibility: 'private' | 'team' | 'community';
  user_id: string;
  username?: string;
  team_slug?: string;
  category?: string;
  tags?: string[];
  usage_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
}

export default function PromptsPage() {
  const t = useTranslations('dashboard');
  const user = useUser({ or: 'redirect' });
  const { teamSlug, currentTeam } = useTeam();
  const { toast } = useToast();
  
  // Usar currentTeam como team para mantener compatibilidad
  const team = currentTeam ? { slug: teamSlug, name: currentTeam.displayName } : null;

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'team' | 'community'>('private');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    description: '',
    visibility: 'private' as 'private' | 'team' | 'community',
    category: '',
    tags: [] as string[],
  });

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        visibility: activeTab,
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (team?.slug && activeTab === 'team') {
        params.append('teamSlug', team.slug);
      }

      const response = await fetch(`/api/prompts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch prompts');

      const data = await response.json();
      setPrompts(data.prompts);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, team?.slug, toast, t]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleCreatePrompt = async () => {
    try {
      const payload = {
        ...formData,
        teamSlug: formData.visibility === 'team' ? team?.slug : undefined,
      };

      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to create prompt');

      toast({
        title: t('success'),
        description: t('promptCreated'),
      });

      setCreateDialogOpen(false);
      resetForm();
      fetchPrompts();
    } catch (error) {
      console.error('Error creating prompt:', error);
      toast({
        title: t('error'),
        description: t('promptCreateFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePrompt = async () => {
    if (!editingPrompt) return;

    try {
      const response = await fetch(`/api/prompts/${editingPrompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update prompt');

      toast({
        title: t('success'),
        description: t('promptUpdated'),
      });

      setEditDialogOpen(false);
      setEditingPrompt(null);
      resetForm();
      fetchPrompts();
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast({
        title: t('error'),
        description: t('promptUpdateFailed'),
        variant: 'destructive',
      });
    }
  };

  const confirmDeletePrompt = () => {
    if (!deletingPromptId) return;
    handleDeletePrompt(deletingPromptId);
    setDeleteDialogOpen(false);
    setDeletingPromptId(null);
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete prompt');

      toast({
        title: t('success'),
        description: t('promptDeleted'),
      });

      fetchPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast({
        title: t('error'),
        description: t('promptDeleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (promptId: string) => {
    setDeletingPromptId(promptId);
    setDeleteDialogOpen(true);
  };

  const handleToggleFavorite = async (promptId: string) => {
    try {
      const response = await fetch(`/api/prompts/${promptId}/favorite`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');

      fetchPrompts();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: t('error'),
        description: t('favoriteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleUsePrompt = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);

      await fetch(`/api/prompts/${prompt.id}/use`, {
        method: 'POST',
      });

      toast({
        title: t('copied'),
        description: t('promptCopied'),
      });

      fetchPrompts();
    } catch (error) {
      console.error('Error using prompt:', error);
      toast({
        title: t('error'),
        description: t('promptCopyFailed'),
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title,
      content: prompt.content,
      description: prompt.description || '',
      visibility: prompt.visibility,
      category: prompt.category || '',
      tags: prompt.tags || [],
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      description: '',
      visibility: 'private',
      category: '',
      tags: [],
    });
    setEditingPrompt(null);
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'private':
        return <Lock className="w-4 h-4" />;
      case 'team':
        return <Users className="w-4 h-4" />;
      case 'community':
        return <Globe className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'private':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'team':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'community':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-600" />
            {t('promptLibrary')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('promptLibraryDescription')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          {t('addPrompt')}
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPrompts')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="private" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t('private')}
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('team')}
            {!team && <Badge variant="secondary" className="ml-1">{t('noTeam')}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('community')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {prompts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? t('noPromptsFound')
                    : activeTab === 'private'
                    ? t('noPrivatePrompts')
                    : activeTab === 'team'
                    ? t('noTeamPrompts')
                    : t('noCommunityPrompts')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {prompts.map((prompt) => (
                <Card key={prompt.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {prompt.title}
                          <Badge className={getVisibilityColor(prompt.visibility)} variant="secondary">
                            {getVisibilityIcon(prompt.visibility)}
                          </Badge>
                        </CardTitle>
                        {prompt.description && (
                          <CardDescription className="mt-1">{prompt.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleFavorite(prompt.id)}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              prompt.is_favorite ? 'fill-red-500 text-red-500' : ''
                            }`}
                          />
                        </Button>
                        {prompt.user_id === user.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(prompt)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(prompt.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {prompt.content}
                    </p>
                    
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {prompt.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {prompt.usage_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {prompt.favorite_count}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(prompt.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleUsePrompt(prompt)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {t('use')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('createPrompt')}</DialogTitle>
            <DialogDescription>
              {t('createPromptDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('title')}</label>
              <Input
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('content')} <span className="text-xs text-muted-foreground">({formData.content.length}/16000)</span>
              </label>
              <Textarea
                placeholder={t('contentPlaceholder')}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[200px]"
                maxLength={16000}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('description')} ({t('optional')})</label>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('visibility')}</label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: any) => setFormData({ ...formData, visibility: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {t('private')}
                      </div>
                    </SelectItem>
                    <SelectItem value="team" disabled={!team}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {t('team')} {!team && `(${t('noTeam')})`}
                      </div>
                    </SelectItem>
                    <SelectItem value="community">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {t('community')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('category')} ({t('optional')})</label>
                <Input
                  placeholder={t('categoryPlaceholder')}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('tags')} ({t('optional')}, {t('commaSeparated')})</label>
              <Input
                placeholder={t('tagsPlaceholder')}
                value={formData.tags.join(', ')}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreatePrompt}
              disabled={!formData.title || !formData.content}
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editPrompt')}</DialogTitle>
            <DialogDescription>
              {t('editPromptDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Same form as create, but for edit */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('title')}</label>
              <Input
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('content')} <span className="text-xs text-muted-foreground">({formData.content.length}/16000)</span>
              </label>
              <Textarea
                placeholder={t('contentPlaceholder')}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[200px]"
                maxLength={16000}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('description')} ({t('optional')})</label>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('visibility')}</label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: any) => setFormData({ ...formData, visibility: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {t('private')}
                      </div>
                    </SelectItem>
                    <SelectItem value="team" disabled={!team}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {t('team')} {!team && `(${t('noTeam')})`}
                      </div>
                    </SelectItem>
                    <SelectItem value="community">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {t('community')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('category')} ({t('optional')})</label>
                <Input
                  placeholder={t('categoryPlaceholder')}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('tags')} ({t('optional')}, {t('commaSeparated')})</label>
              <Input
                placeholder={t('tagsPlaceholder')}
                value={formData.tags.join(', ')}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                resetForm();
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleUpdatePrompt}
              disabled={!formData.title || !formData.content}
            >
              {t('update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('confirmDeleteDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeletePrompt}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
