
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ManageTagsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId: string;
    initialTags: string[];
    onTagsUpdated: (newTags: string[]) => void;
}

export function ManageTagsDialog({
    open,
    onOpenChange,
    documentId,
    initialTags,
    onTagsUpdated
}: ManageTagsDialogProps) {
    const t = useTranslations('dashboard.documentsPage');
    const [tags, setTags] = useState<string[]>(initialTags);
    const [newTag, setNewTag] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddTag = () => {
        const tag = newTag.trim();
        if (tag && !tags.includes(tag)) {
            setTags([...tags, tag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/documents/${documentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags })
            });

            if (!res.ok) throw new Error('Failed to update tags');

            onTagsUpdated(tags);
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating tags:', error);
            // Could show toast error here
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('manageTags')}</DialogTitle>
                    <DialogDescription>
                        {t('manageTagsDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="tag-input">{t('addTag')}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="tag-input"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('tagPlaceholder')}
                            />
                            <Button type="button" size="icon" variant="outline" onClick={handleAddTag}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[100px] p-4 border rounded-md bg-muted/20 content-start">
                        {tags.length === 0 && (
                            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground italic">
                                {t('noTags')}
                            </div>
                        )}
                        {tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="pl-2 pr-1 h-7 flex items-center gap-1">
                                {tag}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-transparent rounded-full"
                                    onClick={() => handleRemoveTag(tag)}
                                >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">Remove {tag}</span>
                                </Button>
                            </Badge>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
