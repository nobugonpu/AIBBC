export async function extractVideoFrame(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      resolve(null);
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
      canvas.remove();
    };

    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration;
      const targetTime = duration >= 60 ? 60 : duration / 2;

      video.currentTime = targetTime;
    });

    video.addEventListener('seeked', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              cleanup();
              resolve(reader.result as string);
            };
            reader.onerror = () => {
              cleanup();
              resolve(null);
            };
            reader.readAsDataURL(blob);
          } else {
            cleanup();
            resolve(null);
          }
        },
        'image/jpeg',
        0.8
      );
    });

    video.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });

    setTimeout(() => {
      if (video.readyState < 2) {
        cleanup();
        resolve(null);
      }
    }, 30000);
  });
}
