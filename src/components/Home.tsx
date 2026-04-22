import { Camera, Video, Images, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-4">メディアギャラリーへようこそ</h2>
        <p className="text-blue-100 text-lg">
          写真や動画をアップロードし、AIによる説明を生成しましょう
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Camera className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">写真をアップロード</h3>
          <p className="text-gray-600">
            お気に入りの写真をアップロードして、AIによる説明を自動生成
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">動画をアップロード</h3>
          <p className="text-gray-600">
            動画を共有し、AIがキーフレームから説明を作成
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-pink-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">AIプロンプト</h3>
          <p className="text-gray-600">
            メディアからAI画像生成ツール用の最適化されたプロンプトを生成
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Images className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">ギャラリーを閲覧</h3>
            <p className="text-gray-600 mb-4">
              アップロードしたすべてのメディアを1か所で表示。各アイテムには、あなたの説明、
AI分析、そしてDALL-E、Midjourney、Stable Diffusionなどのツール用の画像生成プロンプトを作成する機能が含まれています。
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                写真と動画の自動AI説明
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                ワンクリックでAI画像プロンプトを生成
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                生成されたプロンプトを簡単にコピー
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
