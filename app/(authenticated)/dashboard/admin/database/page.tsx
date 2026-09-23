'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface TableStats {
  tablename: string;
  total_size: string;
  data_size: string;
  index_size: string;
  row_count: string;
}

interface DatabaseSummary {
  totalTables: number;
  totalSize: number;
  totalRows: number;
  poolConnections: number;
  poolIdle: number;
  poolWaiting: number;
}

export default function DatabaseManagementPage() {
  const t = useTranslations('admin.database');
  const [stats, setStats] = useState<DatabaseSummary | null>(null);
  const [tables, setTables] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/database');
      const data = await response.json();
      setStats(data.summary);
      setTables(data.tables || []);
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
    setLoading(false);
  };

  const runAction = async (action: string) => {
    setActionLoading(action);
    try {
      const response = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error('Action failed');

      await loadStats();
    } catch (error) {
      console.error(`Failed to run ${action}:`, error);
      alert(`Failed: ${action}`);
    }
    setActionLoading(null);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Database Management</h1>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Total Tables</div>
            <div className="text-2xl font-bold">{stats.totalTables}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Total Size</div>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Total Rows</div>
            <div className="text-2xl font-bold">{stats.totalRows.toLocaleString()}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Connections</div>
            <div className="text-2xl font-bold">{stats.poolConnections}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Waiting</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.poolWaiting}</div>
          </div>
        </div>
      )}

      {/* Maintenance Actions */}
      <div className="bg-card p-6 rounded-lg border mb-8">
        <h2 className="text-xl font-semibold mb-4">Maintenance Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => runAction('analyze')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'analyze' ? 'Running...' : 'Analyze Tables'}
          </button>
          <button
            onClick={() => runAction('vacuum')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading === 'vacuum' ? 'Running...' : 'VACUUM ANALYZE'}
          </button>
          <button
            onClick={() => runAction('refresh-views')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {actionLoading === 'refresh-views' ? 'Running...' : 'Refresh Views'}
          </button>
          <button
            onClick={() => runAction('create-indexes')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {actionLoading === 'create-indexes' ? 'Running...' : 'Create Indexes'}
          </button>
        </div>
      </div>

      {/* Table Statistics */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-xl font-semibold mb-4">Table Statistics</h2>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Table</th>
                  <th className="text-right p-2">Total Size</th>
                  <th className="text-right p-2">Data Size</th>
                  <th className="text-right p-2">Index Size</th>
                  <th className="text-right p-2">Rows</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.tablename} className="border-b">
                    <td className="p-2 font-mono text-sm">{table.tablename}</td>
                    <td className="text-right p-2">{table.total_size}</td>
                    <td className="text-right p-2">{table.data_size}</td>
                    <td className="text-right p-2">{table.index_size}</td>
                    <td className="text-right p-2">{parseInt(table.row_count).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
