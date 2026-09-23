'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeam } from '@/hooks/use-team';
import { RagSidebar } from '@/components/rag-sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

type RagPackage = {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  totalChunks: number;
  createdAt: string;
};

export default function RagLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const currentRagId = params?.id as string | undefined;
  
  const { session } = useTeam();
  
  const [packages, setPackages] = useState<RagPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageDescription, setNewPackageDescription] = useState('');
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, router]);

  // Load RAG packages
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch('/api/rag/packages');
        const data = await res.json();
        
        if (data.success && data.packages) {
          setPackages(data.packages);
        }
      } catch (error) {
        console.error('Error fetching packages:', error);
      } finally {
        setLoadingPackages(false);
      }
    };

    if (session) {
      fetchPackages();
    }
  }, [session]);

  const createPackage = async () => {
    if (!newPackageName.trim()) return;

    setCreatingPackage(true);
    try {
      const res = await fetch('/api/rag/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPackageName,
          description: newPackageDescription
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPackages([data.package, ...packages]);
        setShowNewPackage(false);
        setNewPackageName('');
        setNewPackageDescription('');
        router.push(`/dashboard/rag/${data.package.id}`);
      }
    } catch (error) {
      console.error('Error creating package:', error);
    } finally {
      setCreatingPackage(false);
    }
  };

  return (
    <>
      {children}

      {/* New Package Dialog */}
      <Dialog open={showNewPackage} onOpenChange={setShowNewPackage}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neues RAG Paket erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newPackageName}
                onChange={(e) => setNewPackageName(e.target.value)}
                placeholder="z.B. Produktdokumentation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={newPackageDescription}
                onChange={(e) => setNewPackageDescription(e.target.value)}
                placeholder="Beschreiben Sie den Inhalt dieses RAG Pakets..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewPackage(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={createPackage}
                disabled={!newPackageName.trim() || creatingPackage}
              >
                {creatingPackage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Erstellen...
                  </>
                ) : (
                  'Erstellen'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
