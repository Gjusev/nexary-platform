'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@stackframe/stack';
import { useTeam } from '@/hooks/use-team';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Plus, Search, Star, Users, Globe, Lock,
    MoreVertical, Pencil, Trash2, Copy, Heart,
    Sparkles, TrendingUp, Clock, Bot
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

interface AssistantTemplate {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    category: string;
    icon: string;
    sample_prompts?: string[];
    tags?: string[];
    visibility: 'private' | 'team' | 'community';
    user_id?: string;
    username?: string;
    team_slug?: string;
    usage_count: number;
    conversation_count?: number;
    is_featured: boolean;
    is_favorited?: boolean;
    created_at: string;
    updated_at?: string;
    welcome_message?: string;
    avatar_color?: string;
    preferred_model?: string;
    context_questions?: string[];
}

// Color presets for avatar
const AVATAR_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
];

export default function AssistantsPage() {
    const t = useTranslations('dashboard');
    const ta = useTranslations('dashboard.assistantsPage');
    const user = useUser({ or: 'redirect' });
    const { teamSlug, currentTeam } = useTeam();
    const { toast } = useToast();
    const router = useRouter();

    const team = currentTeam ? { slug: teamSlug, name: currentTeam.displayName } : null;

    const [assistants, setAssistants] = useState<AssistantTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'private' | 'team' | 'community'>('private');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingAssistant, setEditingAssistant] = useState<AssistantTemplate | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        system_prompt: '',
        category: '',
        icon: '🤖',
        sample_prompts: [] as string[],
        tags: [] as string[],
        visibility: 'private' as 'private' | 'team' | 'community',
        welcome_message: '',
        avatar_color: '#6366f1',
        preferred_model: '',
        context_questions: [] as string[],
    });

    const fetchAssistants = useCallback(async () => {
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

            const response = await fetch(`/api/assistants?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch assistants');

            const data = await response.json();
            setAssistants(data.templates || data.assistants || []);
        } catch (error) {
            console.error('Error fetching assistants:', error);
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
        fetchAssistants();
    }, [fetchAssistants]);

    const handleCreateAssistant = async () => {
        try {
            const payload = {
                ...formData,
                teamSlug: formData.visibility === 'team' ? team?.slug : undefined,
            };

            const response = await fetch('/api/assistants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to create assistant');

            toast({
                title: t('success'),
                description: ta('toast.created'),
            });

            setCreateDialogOpen(false);
            resetForm();
            fetchAssistants();
        } catch (error) {
            console.error('Error creating assistant:', error);
            toast({
                title: t('error'),
                description: ta('toast.createFailed'),
                variant: 'destructive',
            });
        }
    };

    const handleUpdateAssistant = async () => {
        if (!editingAssistant) return;

        try {
            const response = await fetch(`/api/assistants/${editingAssistant.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to update assistant');

            toast({
                title: t('success'),
                description: ta('toast.updated'),
            });

            setEditDialogOpen(false);
            setEditingAssistant(null);
            resetForm();
            fetchAssistants();
        } catch (error) {
            console.error('Error updating assistant:', error);
            toast({
                title: t('error'),
                description: ta('toast.updateFailed'),
                variant: 'destructive',
            });
        }
    };

    const confirmDeleteAssistant = () => {
        if (!deletingId) return;
        handleDeleteAssistant(deletingId);
        setDeleteDialogOpen(false);
        setDeletingId(null);
    };

    const handleDeleteAssistant = async (id: string) => {
        try {
            const response = await fetch(`/api/assistants/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete assistant');

            toast({
                title: t('success'),
                description: ta('toast.deleted'),
            });

            fetchAssistants();
        } catch (error) {
            console.error('Error deleting assistant:', error);
            toast({
                title: t('error'),
                description: ta('toast.deleteFailed'),
                variant: 'destructive',
            });
        }
    };

    const openDeleteDialog = (id: string) => {
        setDeletingId(id);
        setDeleteDialogOpen(true);
    };

    const handleDuplicateAssistant = async (id: string) => {
        try {
            const response = await fetch(`/api/assistants/${id}/duplicate`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Failed to duplicate assistant');

            toast({
                title: t('success'),
                description: ta('toast.duplicated'),
            });

            // Switch to private tab to see the duplicated assistant
            setActiveTab('private');
            fetchAssistants();
        } catch (error) {
            console.error('Error duplicating assistant:', error);
            toast({
                title: t('error'),
                description: ta('toast.duplicateFailed'),
                variant: 'destructive',
            });
        }
    };

    const handleToggleFavorite = async (id: string) => {
        try {
            const response = await fetch(`/api/templates/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: id }),
            });

            if (!response.ok) throw new Error('Failed to toggle favorite');

            fetchAssistants();
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast({
                title: t('error'),
                description: t('favoriteFailed'),
                variant: 'destructive',
            });
        }
    };

    const handleUseAssistant = async (assistant: AssistantTemplate) => {
        // Navigate to chat with assistant loaded
        router.push(`/chat?assistant=${assistant.id}`);
    };

    const openEditDialog = (assistant: AssistantTemplate) => {
        setEditingAssistant(assistant);
        setFormData({
            name: assistant.name,
            description: assistant.description,
            system_prompt: assistant.system_prompt,
            category: assistant.category || '',
            icon: assistant.icon || '🤖',
            sample_prompts: assistant.sample_prompts || [],
            tags: assistant.tags || [],
            visibility: assistant.visibility,
            welcome_message: assistant.welcome_message || '',
            avatar_color: assistant.avatar_color || '#6366f1',
            preferred_model: assistant.preferred_model || '',
            context_questions: assistant.context_questions || [],
        });
        setEditDialogOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            system_prompt: '',
            category: '',
            icon: '🤖',
            sample_prompts: [],
            tags: [],
            visibility: 'private',
            welcome_message: '',
            avatar_color: '#6366f1',
            preferred_model: '',
            context_questions: [],
        });
        setEditingAssistant(null);
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
                        <Bot className="w-8 h-8 text-purple-600" />
                        {ta('title')}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {ta('description')}
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)} size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    {ta('createAssistant')}
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={ta('searchPlaceholder')}
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
                    {assistants.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-muted-foreground">
                                    {searchQuery
                                        ? ta('noAssistantsFound')
                                        : activeTab === 'private'
                                            ? ta('noPrivateAssistants')
                                            : activeTab === 'team'
                                                ? ta('noTeamAssistants')
                                                : ta('noCommunityAssistants')}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {assistants.map((assistant) => (
                                <Card key={assistant.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <span className="text-2xl">{assistant.icon}</span>
                                                    {assistant.name}
                                                    <Badge className={getVisibilityColor(assistant.visibility)} variant="secondary">
                                                        {getVisibilityIcon(assistant.visibility)}
                                                    </Badge>
                                                </CardTitle>
                                                <CardDescription className="mt-1">{assistant.description}</CardDescription>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleToggleFavorite(assistant.id)}
                                                >
                                                    <Heart
                                                        className={`w-4 h-4 ${assistant.is_favorited ? 'fill-red-500 text-red-500' : ''
                                                            }`}
                                                    />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="icon" variant="ghost">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleDuplicateAssistant(assistant.id)}>
                                                            <Copy className="w-4 h-4 mr-2" />
                                                            {ta('duplicate')}
                                                        </DropdownMenuItem>
                                                        {assistant.user_id === user.id && (
                                                            <>
                                                                <DropdownMenuItem onClick={() => openEditDialog(assistant)}>
                                                                    <Pencil className="w-4 h-4 mr-2" />
                                                                    {t('edit')}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => openDeleteDialog(assistant.id)}
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    {t('delete')}
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {assistant.tags && assistant.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {assistant.tags.map((tag) => (
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
                                                    {assistant.usage_count}
                                                </span>
                                            </div>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(assistant.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={() => handleUseAssistant(assistant)}
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {ta('useAssistant')}
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
                        <DialogTitle>{ta('createDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {ta('createDialog.description')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.nameLabel')}</label>
                            <Input
                                placeholder={ta('createDialog.namePlaceholder')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {ta('createDialog.systemPromptLabel')} <span className="text-xs text-muted-foreground">({formData.system_prompt.length}/16000)</span>
                            </label>
                            <Textarea
                                placeholder={ta('createDialog.systemPromptPlaceholder')}
                                value={formData.system_prompt}
                                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                className="min-h-[200px]"
                                maxLength={16000}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.descriptionLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.descriptionPlaceholder')}
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
                                <label className="text-sm font-medium mb-2 block">{ta('createDialog.categoryLabel')} ({t('optional')})</label>
                                <Input
                                    placeholder={ta('createDialog.categoryPlaceholder')}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.tagsLabel')} ({t('optional')}, {t('commaSeparated')})</label>
                            <Input
                                placeholder="ej. contratos, análisis, automatización"
                                value={formData.tags.join(', ')}
                                onChange={(e) =>
                                    setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })
                                }
                            />
                        </div>

                        {/* Avatar Color */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.avatarColorLabel')}</label>
                            <div className="flex gap-2 flex-wrap">
                                {AVATAR_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${formData.avatar_color === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, avatar_color: color })}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Welcome Message */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.welcomeMessageLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.welcomeMessagePlaceholder')}
                                value={formData.welcome_message}
                                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                                className="min-h-[60px]"
                            />
                        </div>

                        {/* Sample Prompts */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.samplePromptsLabel')} ({t('optional')}, {t('commaSeparated')})</label>
                            <Textarea
                                placeholder={ta('createDialog.samplePromptsPlaceholder')}
                                value={formData.sample_prompts.join('\n')}
                                onChange={(e) =>
                                    setFormData({ ...formData, sample_prompts: e.target.value.split('\n').map(p => p.trim()).filter(Boolean) })
                                }
                                className="min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{ta('createDialog.samplePromptsHint')}</p>
                        </div>

                        {/* Context Questions */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.contextQuestionsLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.contextQuestionsPlaceholder')}
                                value={formData.context_questions.join('\n')}
                                onChange={(e) =>
                                    setFormData({ ...formData, context_questions: e.target.value.split('\n').map(q => q.trim()).filter(Boolean) })
                                }
                                className="min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{ta('createDialog.contextQuestionsHint')}</p>
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
                            onClick={handleCreateAssistant}
                            disabled={!formData.name || !formData.system_prompt}
                        >
                            {t('create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog - Similar structure */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{ta('editDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {ta('editDialog.description')}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Same form fields as create */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.nameLabel')}</label>
                            <Input
                                placeholder={ta('createDialog.namePlaceholder')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {ta('createDialog.systemPromptLabel')} <span className="text-xs text-muted-foreground">({formData.system_prompt.length}/16000)</span>
                            </label>
                            <Textarea
                                placeholder={ta('createDialog.systemPromptPlaceholder')}
                                value={formData.system_prompt}
                                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                className="min-h-[200px]"
                                maxLength={16000}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.descriptionLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.descriptionPlaceholder')}
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
                                <label className="text-sm font-medium mb-2 block">{ta('createDialog.categoryLabel')} ({t('optional')})</label>
                                <Input
                                    placeholder={ta('createDialog.categoryPlaceholder')}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.tagsLabel')} ({t('optional')}, {t('commaSeparated')})</label>
                            <Input
                                placeholder="ej. contratos, análisis, automatización"
                                value={formData.tags.join(', ')}
                                onChange={(e) =>
                                    setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })
                                }
                            />
                        </div>

                        {/* Avatar Color */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.avatarColorLabel')}</label>
                            <div className="flex gap-2 flex-wrap">
                                {AVATAR_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${formData.avatar_color === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, avatar_color: color })}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Welcome Message */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.welcomeMessageLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.welcomeMessagePlaceholder')}
                                value={formData.welcome_message}
                                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                                className="min-h-[60px]"
                            />
                        </div>

                        {/* Sample Prompts */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.samplePromptsLabel')} ({t('optional')}, {t('commaSeparated')})</label>
                            <Textarea
                                placeholder={ta('createDialog.samplePromptsPlaceholder')}
                                value={formData.sample_prompts.join('\n')}
                                onChange={(e) =>
                                    setFormData({ ...formData, sample_prompts: e.target.value.split('\n').map(p => p.trim()).filter(Boolean) })
                                }
                                className="min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{ta('createDialog.samplePromptsHint')}</p>
                        </div>

                        {/* Context Questions */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{ta('createDialog.contextQuestionsLabel')} ({t('optional')})</label>
                            <Textarea
                                placeholder={ta('createDialog.contextQuestionsPlaceholder')}
                                value={formData.context_questions.join('\n')}
                                onChange={(e) =>
                                    setFormData({ ...formData, context_questions: e.target.value.split('\n').map(q => q.trim()).filter(Boolean) })
                                }
                                className="min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{ta('createDialog.contextQuestionsHint')}</p>
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
                            onClick={handleUpdateAssistant}
                            disabled={!formData.name || !formData.system_prompt}
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
                            {ta('deleteDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteAssistant}>
                            {t('delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
