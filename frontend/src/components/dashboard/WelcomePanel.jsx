import {
  WriteIcon,
  LearnIcon,
  CodeIcon,
  LifeIcon,
  SparkIcon,
} from './DashboardIcons.jsx';

const PROMPT_CATEGORIES = [
  { id: 'write', label: 'Write', icon: WriteIcon, prompt: 'Help me write a clear, professional email about ' },
  { id: 'learn', label: 'Learn', icon: LearnIcon, prompt: 'Explain the key concepts of ' },
  { id: 'code', label: 'Code', icon: CodeIcon, prompt: 'Write a JavaScript function that ' },
  { id: 'life', label: 'Life stuff', icon: LifeIcon, prompt: 'Give me practical advice on ' },
  { id: 'suggest', label: 'OWNAI pick', icon: SparkIcon, prompt: 'Suggest something useful I can build with local AI today' },
];

export default function WelcomePanel({ onPromptSelect, userName }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = userName || 'there';

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-[12vh]">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-600/20">
          <span className="text-lg font-bold">O</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white sm:text-3xl">
          {greeting}, {name}
        </h1>
      </div>

      <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Prompt categories">
        {PROMPT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onPromptSelect(cat.prompt)}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-800 dark:hover:bg-teal-950/50"
              >
                <Icon />
                <span>{cat.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { PROMPT_CATEGORIES };
