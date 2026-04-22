import { Upload, Image as ImageIcon, Video } from 'lucide-react';

interface MediaUploadFormProps {
  selectedFile: File | null;
  previewUrl: string;
  description: string;
  aiPrompt: string;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionBlur: () => void;
  onGeneratePrompt: () => void;
  onAiPromptChange: (value: string) => void;
  onUpload: () => void;
}

export function MediaUploadForm({
  selectedFile,
  previewUrl,
  description,
  aiPrompt,
  uploading,
  onFileChange,
  onDescriptionChange,
  onDescriptionBlur,
  onGeneratePrompt,
  onAiPromptChange,
  onUpload
}: MediaUploadFormProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            写真または動画を選択 (MP4, WebM, MOV)
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              onChange={onFileChange}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100"
            >
              {previewUrl ? (
                selectedFile?.type.startsWith('video/') ? (
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain rounded-lg"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="flex items-center gap-3 mb-3">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">クリックして写真または動画をアップロード</p>
                  <p className="text-xs text-gray-500 mt-1">画像 (PNG, JPG, GIF) または動画 (MP4, WebM, MOV)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            説明
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onBlur={onDescriptionBlur}
            rows={4}
            placeholder="メディアの説明を追加してください..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
          />
          {selectedFile && description.trim() && !aiPrompt && (
            <button
              type="button"
              onClick={onGeneratePrompt}
              disabled={uploading}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'AIプロンプト生成中...' : 'AIプロンプトを生成'}
            </button>
          )}
        </div>

        <div>
          <label htmlFor="ai-prompt" className="block text-sm font-medium text-purple-700 mb-2">
            AI画像生成プロンプト
            {uploading && (
              <span className="ml-2 text-xs text-purple-600 font-normal">
                生成中...
              </span>
            )}
          </label>
          <textarea
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            rows={4}
            placeholder="説明を追加すると、AIが画像生成プロンプトを自動生成します..."
            className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-shadow bg-purple-50"
          />
          <p className="mt-2 text-xs text-gray-600">
            説明を入力し、説明フィールドの外をクリックするとプロンプトが自動生成されます。
          </p>
        </div>

        <button
          onClick={onUpload}
          disabled={!selectedFile || uploading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              アップロード中...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload Media
            </>
          )}
        </button>
      </div>
    </div>
  );
}
