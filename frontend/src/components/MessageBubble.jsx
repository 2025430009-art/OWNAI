export default function MessageBubble({ role, content, isStreaming }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-slate-800 text-slate-100 rounded-bl-md border border-slate-700'
        }`}
      >
        <p className="text-xs font-medium mb-1 opacity-70">
          {isUser ? 'You' : 'AI'}
        </p>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {content}
          {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-primary-400 animate-pulse" />}
        </p>
      </div>
    </div>
  );
}
