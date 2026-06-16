import { apiUrl } from '../../utils/apiConfig.js';
import { deletePromptToVideoJob } from '../../api/client.js';

export default function VideoHistory({ jobs, loading, onSelect, onRefresh }) {
  if (loading) {
    return <p className="text-sm text-slate-400">Loading video history…</p>;
  }

  if (!jobs.length) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center dark:border-slate-600">
        <p className="text-sm text-slate-500">No videos generated yet.</p>
        <p className="mt-1 text-xs text-slate-400">Your completed PromptToVideo AI exports will appear here.</p>
      </div>
    );
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this video?')) return;
    try {
      await deletePromptToVideoJob(id);
      onRefresh?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => {
        const thumbUrl = job.thumbnail_url
          || (job.status === 'completed'
            ? apiUrl(`/api/v1/prompt-to-video/jobs/${job.id}/thumbnail`)
            : null);
        return (
          <button
            key={job.id}
            type="button"
            onClick={() => job.status === 'completed' && onSelect?.(job)}
            className="group overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition-colors hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="relative aspect-video bg-stone-900">
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={job.title || 'Video thumbnail'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl">🎬</div>
              )}
              <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                job.status === 'completed'
                  ? 'bg-teal-600 text-white'
                  : job.status === 'failed'
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-white'
              }`}
              >
                {job.status}
              </span>
            </div>
            <div className="p-4">
              <h3 className="truncate font-medium text-slate-800 dark:text-white">
                {job.title || job.prompt?.slice(0, 48) || 'Untitled'}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(job.created_at).toLocaleDateString()}
              </p>
              <button
                type="button"
                onClick={(e) => handleDelete(job.id, e)}
                className="mt-2 text-xs text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Delete
              </button>
            </div>
          </button>
        );
      })}
    </div>
  );
}
