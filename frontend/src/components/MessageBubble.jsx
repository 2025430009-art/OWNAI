import FormattedText from './FormattedText.jsx';

export default function MessageBubble({ role, content, isStreaming }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-teal-600 text-white rounded-br-md'
            : 'bg-white text-slate-800 rounded-bl-md border border-stone-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
        }`}
      >
        <p className="text-xs font-medium mb-1 opacity-70">
          {isUser ? 'You' : 'AI'}
        </p>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {isUser ? content : <FormattedText text={content} />}
          {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-teal-400 animate-pulse" />}
        </div>
      </div>
    </div>
  );
}
