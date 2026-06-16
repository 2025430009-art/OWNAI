import { apiUrl } from '../../utils/apiConfig.js';

export default function VideoPlayer({ result, onRegenerate, onEditScript }) {
  if (!result?.jobId) {
    return (
      <p className="text-sm text-slate-400">No video ready yet.</p>
    );
  }

  const videoSrc = apiUrl(result.videoUrl || `/api/v1/prompt-to-video/jobs/${result.jobId}/video`);
  const posterSrc = result.thumbnailUrl
    ? apiUrl(result.thumbnailUrl)
    : apiUrl(`/api/v1/prompt-to-video/jobs/${result.jobId}/thumbnail`);
  const shareUrl = `${window.location.origin}${window.location.pathname}?ptv=${result.jobId}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoSrc;
    link.download = `${result.title || 'prompt-to-video'}.mp4`;
    link.click();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {result.title || 'Your video'}
        </h2>
        {result.mood && (
          <p className="mt-1 text-sm text-slate-500 capitalize">Mood: {result.mood}</p>
        )}
        {result.quality && (
          <p className="mt-0.5 text-xs text-slate-400">Quality: {result.quality}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-black dark:border-slate-700">
        <video
          src={videoSrc}
          poster={posterSrc}
          controls
          className="aspect-video w-full"
          playsInline
        >
          <track kind="captions" />
        </video>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleDownload} className="btn-primary">
          Download MP4
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Copy share link
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg border border-teal-300 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300"
          >
            Regenerate
          </button>
        )}
        {onEditScript && (
          <button
            type="button"
            onClick={onEditScript}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
          >
            Edit script
          </button>
        )}
      </div>
    </div>
  );
}
