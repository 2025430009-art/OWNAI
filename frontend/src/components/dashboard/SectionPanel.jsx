import { useEffect, useState } from 'react';
import CodeGeneratorPanel from './CodeGeneratorPanel.jsx';
import PromptToVideoPanel from '../promptToVideo/PromptToVideoPanel.jsx';
import OwnAIReferencePanel from './OwnAIReferencePanel.jsx';
import CodeLibraryPanel from './CodeLibraryPanel.jsx';
import { listAlgorithms } from '../../api/client.js';

const SAMPLE_PROJECTS = [
  { id: 1, name: 'Research notes', chats: 4, updated: '2h ago', color: 'bg-amber-100 text-amber-800' },
  { id: 2, name: 'App prototype', chats: 7, updated: 'Yesterday', color: 'bg-sky-100 text-sky-800' },
  { id: 3, name: 'Study prep', chats: 12, updated: '3 days ago', color: 'bg-violet-100 text-violet-800' },
];

const SAMPLE_ARTIFACTS = [
  { id: 1, title: 'API integration guide', type: 'Document', date: 'Jun 12' },
  { id: 2, title: 'Landing page mockup', type: 'Design', date: 'Jun 10' },
  { id: 3, title: 'RAG pipeline script', type: 'Code', date: 'Jun 8' },
  { id: 4, title: 'Model comparison table', type: 'Spreadsheet', date: 'Jun 5' },
];

function SectionHeader({ title, description }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      {description && (
        <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}

function ChatsList({ sessions, onSelect }) {
  return (
    <div className="space-y-2">
      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">No chats yet. Start a new conversation from the sidebar.</p>
      ) : (
        sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-800"
          >
            <div>
              <p className="font-medium text-slate-800 dark:text-white">{s.title}</p>
              <p className="text-xs text-slate-400">
                {s.messages.length} messages · {new Date(s.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs text-teal-600">Open →</span>
          </button>
        ))
      )}
    </div>
  );
}

function ProjectsGrid({ onNewChat }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        type="button"
        onClick={onNewChat}
        className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-sm text-slate-500 transition-colors hover:border-teal-400 hover:text-teal-700 dark:border-slate-600 dark:hover:border-teal-600"
      >
        <span className="text-2xl">+</span>
        <span className="mt-1">New project</span>
      </button>
      {SAMPLE_PROJECTS.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${p.color}`}>
            Project
          </span>
          <h3 className="mt-3 font-semibold text-slate-800 dark:text-white">{p.name}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {p.chats} chats · Updated {p.updated}
          </p>
        </div>
      ))}
    </div>
  );
}

function ArtifactsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SAMPLE_ARTIFACTS.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-teal-600">{a.type}</p>
          <h3 className="mt-2 font-medium text-slate-800 dark:text-white">{a.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{a.date}</p>
        </div>
      ))}
    </div>
  );
}

function AlgorithmsPanel() {
  const [algorithms, setAlgorithms] = useState([]);

  useEffect(() => {
    listAlgorithms()
      .then((data) => setAlgorithms(data.algorithms || []))
      .catch(() => {});
  }, []);

  if (!algorithms.length) {
    return (
      <p className="text-sm text-slate-400">Loading OWNAI algorithms…</p>
    );
  }

  return (
    <div className="space-y-3">
      {algorithms.map((algo) => (
        <div
          key={algo.id}
          className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-slate-800 dark:text-white">{algo.name}</h3>
              <p className="mt-1 text-xs text-teal-600">{algo.tagline}</p>
            </div>
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800">
              v{algo.version}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{algo.description}</p>
          <p className="mt-2 text-xs text-slate-400">
            Intents: {algo.intents?.join(', ')}
          </p>
        </div>
      ))}
    </div>
  );
}

function CustomizePanel({ theme, onToggleTheme, temperature, onTemperatureChange }) {
  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Appearance</h3>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Dark mode</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              theme === 'dark' ? 'bg-teal-600' : 'bg-stone-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                theme === 'dark' ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Model behavior</h3>
        <label className="mt-4 block text-sm text-slate-600 dark:text-slate-400">
          Temperature: {temperature}
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="mt-2 w-full accent-teal-600"
          />
        </label>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">OWNAI algorithms</h3>
        <p className="mt-1 text-xs text-slate-400">Managed response engines available in the chat picker.</p>
        <div className="mt-4">
          <AlgorithmsPanel />
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Privacy</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Public sessions are stored locally in your browser. Sign in to sync across devices when auth is enabled.
        </p>
      </div>
    </div>
  );
}

function ProductWorkspace({ type, onStartPrompt }) {
  const isCode = type === 'code';
  const title = isCode ? 'Code' : 'Design';
  const description = isCode
    ? 'Generate, debug, and explain code with your local OWNAI models.'
    : 'Brainstorm layouts, UI copy, and visual concepts with AI assistance.';
  const starters = isCode
    ? [
        'Build a React hook for debounced search',
        'Explain this error: TypeError cannot read property',
        'Write unit tests for an Express API route',
      ]
    : [
        'Sketch a dashboard layout for an AI app',
        'Suggest a color palette for a fintech product',
        'Write microcopy for an onboarding flow',
      ];

  return (
    <div>
      <SectionHeader title={title} description={description} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onStartPrompt(prompt)}
            className="rounded-xl border border-stone-200 bg-white p-4 text-left text-sm text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SectionPanel({
  section,
  sessions,
  onSelectSession,
  onNewChat,
  onStartPrompt,
  theme,
  onToggleTheme,
  temperature,
  onTemperatureChange,
  selectedModel,
  saveToReferenceRef,
}) {
  const content = {
    chats: {
      title: 'All chats',
      description: 'Browse and reopen your recent conversations.',
      body: <ChatsList sessions={sessions} onSelect={onSelectSession} />,
    },
    projects: {
      title: 'Projects',
      description: 'Organize related chats into focused workspaces.',
      body: <ProjectsGrid onNewChat={onNewChat} />,
    },
    artifacts: {
      title: 'Artifacts',
      description: 'Documents, code, and outputs created in your sessions.',
      body: <ArtifactsGrid />,
    },
    customize: {
      title: 'Customize',
      description: 'Tune OWNAI to match how you work.',
      body: (
        <CustomizePanel
          theme={theme}
          onToggleTheme={onToggleTheme}
          temperature={temperature}
          onTemperatureChange={onTemperatureChange}
        />
      ),
    },
    code: {
      body: <CodeGeneratorPanel selectedModel={selectedModel} />,
    },
    reference: {
      body: <OwnAIReferencePanel onSaveFromChat={saveToReferenceRef} />,
    },
    'code-library': {
      body: <CodeLibraryPanel />,
    },
    design: {
      body: <ProductWorkspace type="design" onStartPrompt={onStartPrompt} />,
    },
    'prompt-to-video': {
      body: <PromptToVideoPanel />,
    },
  };

  const view = content[section];
  if (!view) return null;

  if (section === 'reference' || section === 'code-library' || section === 'prompt-to-video') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {view.body}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-4xl">
        {view.title && <SectionHeader title={view.title} description={view.description} />}
        {view.body}
      </div>
    </div>
  );
}
