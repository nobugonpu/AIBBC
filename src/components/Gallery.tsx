import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, Copy, Check, Download, Trash2, HardDrive, AlertCircle, CheckCircle } from 'lucide-react';

interface MediaItem {
  id: string;
  media_type: 'photo' | 'video';
  file_path: string;
  description: string;
  ai_description: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

// Derives MIME type from stored path (e.g. "photos/abc.jpg.enc" → "image/jpeg").
// Falls back to type-based defaults for legacy files without extension in path.
function getMimeType(filePath: string, mediaType: 'photo' | 'video'): string {
  const ext = filePath.replace(/\.enc$/, '').split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };
  return map[ext] ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
}

// Derives the original filename for download (strips path prefix and .enc suffix).
function getExportFilename(filePath: string): string {
  return (filePath.split('/').pop() ?? 'file').replace(/\.enc$/, '');
}

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
      const mime = getMimeType(item.file_path, item.media_type);
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
      {/* Encrypted storage notice */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <HardDrive className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          表示中のメディアはアプリのデータフォルダ内にAES-256-GCMで暗号化保存されています。
          元ファイルを削除・移動しても表示・再生できます。
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pageItems.map(item => (
          <MediaCard
            key={item.id}
            item={item}
            copiedId={copiedId}
            onLoadBlob={getOrLoadBlob}
            onDelete={handleDelete}
            onCopyDescription={copyDescription}
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
  onCopyDescription,
}: {
  item: MediaItem;
  copiedId: string | null;
  onLoadBlob: (item: MediaItem) => Promise<string>;
  onDelete: (id: string) => void;
  onCopyDescription: (id: string, text: string) => void;
}) {
  const [blobUrl, setBlobUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    onLoadBlob(item).then(url => setBlobUrl(url));
  }, [item.id]);

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      // Rust decrypts the file, shows a native save dialog, writes the result.
      // Returns the saved filename, or null when the user cancels the dialog.
      const saved = await invoke<string | null>('export_media', { id: item.id });
      if (saved !== null) {
        setExportMsg({ type: 'success', text: `エクスポートしました: ${saved}` });
        setTimeout(() => setExportMsg(null), 4000);
      }
      // null = user cancelled the dialog; no message needed
    } catch (e) {
      setExportMsg({
        type: 'error',
        text: `エクスポートに失敗しました: ${typeof e === 'string' ? e : '不明なエラー'}`,
      });
    } finally {
      setExporting(false);
    }
  };

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

        {exportMsg && (
          <div className={`flex items-start gap-1.5 text-xs rounded-md px-2 py-1.5 ${
            exportMsg.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {exportMsg.type === 'success'
              ? <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              : <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
            <span>{exportMsg.text}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {item.description && (
            <button
              onClick={() => onCopyDescription(item.id, item.description)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
              title="説明文をクリップボードにコピー"
            >
              {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              説明文をコピー
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 disabled:opacity-50 transition-colors"
            title="復号してネイティブダイアログで保存"
          >
            {exporting
              ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <Download className="w-3 h-3" />}
            {exporting ? 'エクスポート中...' : 'エクスポート'}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 ml-auto transition-colors"
          >
            <Trash2 className="w-3 h-3" />
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
