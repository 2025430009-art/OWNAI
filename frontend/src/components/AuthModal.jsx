import AuthForm from './AuthForm.jsx';

export default function AuthModal({ open, onClose, onAuth }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-[#f7f6f3] shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-800"
          aria-label="Close sign in"
        >
          ×
        </button>
        <AuthForm
          onAuth={onAuth}
          subtitle="Sign in to use chat, PDF uploads, and AI features."
        />
      </div>
    </div>
  );
}
