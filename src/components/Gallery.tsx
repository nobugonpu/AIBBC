import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';

interface MediaItem {
  id: string;
  media_type: 'photo' | 'video';
  file_path: string;
  description: string;
  ai_description: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

export default function Gallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const data = await invoke<MediaItem[]>('get_media');
      setItems(data);
    } catch (e) {
      console.error('Failed to load media:', e);
    } finally {
      setLoading(false);
    }
  };

  const getOrLoadBlob = async (item: MediaItem): Promise<string> => {
    if (blobUrls[item.id]) return blobUrls[item.id];
    try {
      const b64: string = await invoke('read_media_file', { filePath: item.file_path });
      const mime = item.media_type === 'video' ? 'video/mp4' : 'image/jpeg';
      const blob = b64ToBlob(b64, mime);
      const url = URL.createObjectURL(blob);
      setBlobUrls(prev => ({ ...prev, [item.id]: url }));
      return url;
    } catch {
      return '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このメディアを削除してもよろしいですか？')) return;
    try {
      await invoke('delete_media', { id });
      setItems(prev => prev.filter(i => i.id !== id));
      setBlobUrls(prev => {
        const url = prev[id];
        if (url) URL.revokeObjectURL(url);
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error('Failed to delete media:', e);
    }
  };

  const copyDescription = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const pageItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          まだメディアがありません。アップロードページから追加してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pageItems.map(item => (
          <MediaCard
            key={item.id}
            item={item}
            copiedId={copiedId}
            onLoadBlob={getOrLoadBlob}
            onDelete={handleDelete}
            onCopy={copyDescription}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            前へ
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages} ページ
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            次へ
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function MediaCard({
  item,
  copiedId,
  onLoadBlob,
  onDelete,
  onCopy,
}: {
  item: MediaItem;
  copiedId: string | null;
  onLoadBlob: (item: MediaItem) => Promise<string>;
  onDelete: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    onLoadBlob(item).then(url => setBlobUrl(url));
  }, [item.id]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square overflow-hidden bg-gray-100">
        {blobUrl ? (
          item.media_type === 'photo' ? (
            <img src={blobUrl} alt={item.description} className="w-full h-full object-cover" />
          ) : (
            <video src={blobUrl} controls className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        {item.description && (
          <p className="text-sm text-gray-700 line-clamp-2">{item.description}</p>
        )}
        {item.ai_description && (
          <p className="text-xs text-gray-500 line-clamp-2">{item.ai_description}</p>
        )}
        <div className="flex gap-2 pt-1">
          {item.description && (
            <button
              onClick={() => onCopy(item.id, item.description)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
            >
              {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              コピー
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-400 hover:text-red-600 ml-auto"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

function b64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
