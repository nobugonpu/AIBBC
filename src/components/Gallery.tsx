import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Sparkles, Copy, Check } from 'lucide-react';

interface Photo {
  id: string;
  photo_url: string;
  description: string;
  ai_description: string;
  created_at: string;
}

interface Video {
  id: string;
  video_url: string;
  description: string;
  ai_description: string;
  created_at: string;
}

type MediaItem = (Photo & { type: 'photo' }) | (Video & { type: 'video' });

const ITEMS_PER_PAGE = 10;

export default function Gallery() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [generatingPrompt, setGeneratingPrompt] = useState<string | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadMedia();
  }, [currentPage]);

  const loadMedia = async () => {
    try {
      setLoading(true);

      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('id, photo_url, description, ai_description, created_at');

      if (photosError) throw photosError;

      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, video_url, description, ai_description, created_at');

      if (videosError) throw videosError;

      const photos: MediaItem[] = (photosData || []).map(p => ({ ...p, type: 'photo' as const }));
      const videos: MediaItem[] = (videosData || []).map(v => ({ ...v, type: 'video' as const }));

      const allMedia = [...photos, ...videos].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTotalItems(allMedia.length);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE;
      setMediaItems(allMedia.slice(from, to));
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const generateImagePrompt = async (item: MediaItem) => {
    try {
      setGeneratingPrompt(item.id);

      const { data: sessionData } = await supabase.auth.getSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prompt`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiDescription: item.ai_description,
          userDescription: item.description,
          apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedPrompts(prev => ({
          ...prev,
          [item.id]: data.prompt,
        }));
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
    } finally {
      setGeneratingPrompt(null);
    }
  };

  const copyToClipboard = (itemId: string, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mediaItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">まだメディアがありません。最初の写真または動画をアップロードしてください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mediaItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square overflow-hidden bg-gray-100">
              {item.type === 'photo' ? (
                <img
                  src={item.photo_url}
                  alt={item.description || 'Photo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.video_url}
                  controls
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-4 space-y-3">
              {item.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    あなたの説明
                  </p>
                  <p className="text-gray-700 text-sm line-clamp-2">
                    {item.description}
                  </p>
                </div>
              )}
              {item.ai_description && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                    AI分析
                  </p>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {item.ai_description}
                  </p>
                </div>
              )}

              {item.ai_description && (
                <div className="pt-2 border-t border-gray-100">
                  {!generatedPrompts[item.id] ? (
                    <button
                      onClick={() => generateImagePrompt(item)}
                      disabled={generatingPrompt === item.id}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {generatingPrompt === item.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate AI Prompt
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                          AI画像生成プロンプト
                        </p>
                        <button
                          onClick={() => copyToClipboard(item.id, generatedPrompts[item.id])}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-purple-600 transition-colors"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {generatedPrompts[item.id]}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages} ページ
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
