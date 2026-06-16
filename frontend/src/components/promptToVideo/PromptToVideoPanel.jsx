import usePromptToVideo from '../../hooks/usePromptToVideo.js';
import PromptInput from './PromptInput.jsx';
import ProgressTracker from './ProgressTracker.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import VideoHistory from './VideoHistory.jsx';
import TransformerArchitecturePanel from './TransformerArchitecturePanel.jsx';

export default function PromptToVideoPanel() {
  const {
    prompt,
    setPrompt,
    view,
    setView,
    steps,
    examples,
    qualities,
    quality,
    setQuality,
    currentStep,
    progress,
    loading,
    error,
    result,
    script,
    scenePreviews,
    jobs,
    loadingJobs,
    wsStatus,
    generate,
    cancel,
    refreshJobs,
    setResult,
  } = usePromptToVideo();

  const handleSelectJob = (job) => {
    setResult({
      jobId: job.id,
      title: job.title,
      mood: job.mood,
      videoUrl: `/api/v1/prompt-to-video/jobs/${job.id}/video`,
      thumbnailUrl: job.thumbnail_url || `/api/v1/prompt-to-video/jobs/${job.id}/thumbnail`,
    });
    setView('player');
  };

  return (
    <div className="space-y-8 py-4">
      <div className="flex justify-end gap-2 px-2">
        {['home', 'history', 'architecture'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setView(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              view === tab || (view === 'generate' && tab === 'home') || (view === 'player' && tab === 'home')
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200'
                : 'text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {(view === 'home' || view === 'generate') && (
        <PromptInput
          prompt={prompt}
          onChange={setPrompt}
          onSubmit={() => generate()}
          onExample={(ex) => {
            setPrompt(ex);
            generate(ex);
          }}
          loading={loading}
          examples={examples}
          qualities={qualities}
          quality={quality}
          onQualityChange={setQuality}
        />
      )}

      {view === 'generate' && loading && (
        <div className="mx-auto max-w-2xl">
          <ProgressTracker
            steps={steps}
            currentStep={currentStep}
            progress={progress}
            scenePreviews={scenePreviews}
            wsStatus={wsStatus}
          />
          <button
            type="button"
            onClick={cancel}
            className="mt-4 w-full rounded-lg border border-stone-300 py-2 text-sm text-slate-600 dark:border-slate-600"
          >
            Cancel generation
          </button>
        </div>
      )}

      {view === 'generate' && script?.scenes?.length > 0 && (
        <div className="mx-auto max-w-2xl rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Script preview — {script.title}
          </h3>
          <p className="mt-1 text-xs text-teal-600">{script.scenes.length} scenes · {script.mood} mood</p>
          <ol className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-500">
            {script.scenes.map((s) => (
              <li key={s.sceneNumber}>
                <span className="font-medium text-teal-600">Scene {s.sceneNumber}:</span>{' '}
                {s.narratorText?.slice(0, 100)}…
              </li>
            ))}
          </ol>
        </div>
      )}

      {view === 'player' && result && (
        <div className="mx-auto max-w-3xl">
          <VideoPlayer
            result={result}
            onRegenerate={() => {
              setView('home');
              generate();
            }}
            onEditScript={() => setView('home')}
          />
        </div>
      )}

      {view === 'history' && (
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">Video history</h2>
          <VideoHistory
            jobs={jobs}
            loading={loadingJobs}
            onRefresh={refreshJobs}
            onSelect={handleSelectJob}
          />
        </div>
      )}

      {view === 'architecture' && (
        <div className="mx-auto max-w-3xl">
          <TransformerArchitecturePanel />
        </div>
      )}
    </div>
  );
}
