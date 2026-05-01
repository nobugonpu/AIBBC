import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Gallery from './components/Gallery';
import Home from './components/Home';
import TreatmentScheduler from './components/TreatmentScheduler';
import PatientManager from './components/PatientManager';
import { NavigationBar } from './components/app/NavigationBar';
import { GuestView } from './components/app/GuestView';
import { MediaUploadForm } from './components/app/MediaUploadForm';
import { supabase } from './lib/supabase';
import { extractVideoFrame } from './utils/videoFrameExtractor';
import { CheckCircle, AlertCircle } from 'lucide-react';

type Page = 'home' | 'upload' | 'gallery' | 'treatment' | 'patients';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [guestPage, setGuestPage] = useState<'treatment' | 'patients'>('treatment');

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setAiPrompt('');
    }
  };

  const generatePromptForMedia = async (imageData: string, userDesc: string = '') => {
    if (!supabase) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`;

      const aiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData, apiKey: import.meta.env.VITE_OPENAI_API_KEY }),
      });

      if (!aiResponse.ok) {
        let errorMsg = 'Unknown error';
        const responseText = await aiResponse.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = responseText || errorMsg;
        }
        setMessage({ type: 'error', text: `画像の分析に失敗しました: ${errorMsg}` });
        return;
      }

      const aiData = await aiResponse.json();
      const aiDescription = aiData.description;

      if (aiResponse.ok) {
        const promptApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prompt`;
        const promptResponse = await fetch(promptApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aiDescription: aiDescription,
            userDescription: userDesc,
            apiKey: import.meta.env.VITE_OPENAI_API_KEY,
          }),
        });

        if (!promptResponse.ok) {
          let errorMsg = 'Unknown error';
          const responseText = await promptResponse.text();
          try {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.error || errorMsg;
          } catch (e) {
            errorMsg = responseText || errorMsg;
          }
          setMessage({ type: 'error', text: `プロンプトの生成に失敗しました: ${errorMsg}` });
          return;
        }

        const promptData = await promptResponse.json();
        setAiPrompt(promptData.prompt);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'ネットワークエラー: ' + (error instanceof Error ? error.message : '不明なエラー') });
    }
  };

  const handleDescriptionBlur = async () => {
    if (selectedFile && description.trim()) {
      setUploading(true);
      try {
        if (selectedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            await generatePromptForMedia(reader.result as string, description);
            setUploading(false);
          };
          reader.readAsDataURL(selectedFile);
        } else if (selectedFile.type.startsWith('video/')) {
          const frameData = await extractVideoFrame(selectedFile);
          if (frameData) {
            await generatePromptForMedia(frameData, description);
          }
          setUploading(false);
        }
      } catch (error) {
        console.error('Error generating prompt:', error);
        setUploading(false);
      }
    }
  };

  const handleGeneratePrompt = async () => {
    setUploading(true);
    try {
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          await generatePromptForMedia(reader.result as string, description);
          setUploading(false);
        };
        reader.readAsDataURL(selectedFile);
      } else if (selectedFile.type.startsWith('video/')) {
        const frameData = await extractVideoFrame(selectedFile);
        if (frameData) {
          await generatePromptForMedia(frameData, description);
        }
        setUploading(false);
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !session?.user || !supabase) return;

    try {
      setUploading(true);
      setMessage(null);

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const storagePath = `${session.user.id}/${fileName}`;

      const isVideo = selectedFile.type.startsWith('video/');
      const bucketName = isVideo ? 'videos' : 'photos';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      if (isVideo) {
        let aiDescription = '';
        try {
          const frameData = await extractVideoFrame(selectedFile);

          if (frameData) {
            const { data: sessionData } = await supabase.auth.getSession();

            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`;
            const aiResponse = await fetch(
              apiUrl,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${sessionData.session?.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imageData: frameData, apiKey: import.meta.env.VITE_OPENAI_API_KEY }),
              }
            );

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiDescription = aiData.description || '';
            }
          }
        } catch (aiError) {
          console.error('Error getting AI description for video:', aiError);
        }

        const { error: dbError } = await supabase
          .from('videos')
          .insert({
            user_id: session.user.id,
            video_url: publicUrl,
            storage_path: storagePath,
            description: description.trim(),
            ai_description: aiDescription,
          });

        if (dbError) throw dbError;
        setMessage({ type: 'success', text: '動画をアップロードしました' });
      } else {
        let aiDescription = '';
        try {
          const { data: sessionData } = await supabase.auth.getSession();

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`;
          const aiResponse = await fetch(
            apiUrl,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionData.session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ imageUrl: publicUrl, apiKey: import.meta.env.VITE_OPENAI_API_KEY }),
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiDescription = aiData.description || '';
          }
        } catch (aiError) {
          console.error('Error getting AI description:', aiError);
        }

        const { error: dbError } = await supabase
          .from('photos')
          .insert({
            user_id: session.user.id,
            photo_url: publicUrl,
            storage_path: storagePath,
            description: description.trim(),
            ai_description: aiDescription,
          });

        if (dbError) throw dbError;
        setMessage({ type: 'success', text: '写真をアップロードしました' });
      }

      setSelectedFile(null);
      setPreviewUrl('');
      setDescription('');
      setAiPrompt('');

      const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading media:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'メディアのアップロードに失敗しました。もう一度お試しください。'
      });
    } finally {
      setUploading(false);
    }
  };

  if (!supabase) {
    return (
      <GuestView
        guestPage={guestPage}
        onGuestPageChange={setGuestPage}
      />
    );
  }

  if (!session) {
    if (showAuth) {
      return <Auth />;
    }

    return (
      <GuestView
        guestPage={guestPage}
        onGuestPageChange={setGuestPage}
        onShowAuth={() => setShowAuth(true)}
      />
    );
  }

  const getPageTitle = () => {
    switch (currentPage) {
      case 'home': return 'ホーム';
      case 'upload': return 'メディアアップロード';
      case 'gallery': return 'ギャラリー';
      case 'treatment': return '治療スケジューラ';
      case 'patients': return '患者管理';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <NavigationBar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onSignOut={handleSignOut}
          />
        </div>

        {message && currentPage === 'upload' && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {currentPage === 'home' ? (
          <Home />
        ) : currentPage === 'treatment' ? (
          <TreatmentScheduler />
        ) : currentPage === 'patients' ? (
          <PatientManager />
        ) : currentPage === 'upload' ? (
          <MediaUploadForm
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            description={description}
            aiPrompt={aiPrompt}
            uploading={uploading}
            onFileChange={handleFileChange}
            onDescriptionChange={setDescription}
            onDescriptionBlur={handleDescriptionBlur}
            onGeneratePrompt={handleGeneratePrompt}
            onAiPromptChange={setAiPrompt}
            onUpload={handleUpload}
          />
        ) : (
          <Gallery />
        )}
      </div>
    </div>
  );
}

export default App;
