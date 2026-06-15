import MessageBubble from '../MessageBubble.jsx';

export default function ChatPanel({ session, loading }) {
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Start a new chat to begin
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-stone-200 px-6 py-3 dark:border-slate-800">
        <h2 className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {session.title}
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {session.messages.length === 0 && !loading && (
            <p className="text-center text-sm text-slate-400">
              Send a message to start this conversation
            </p>
          )}
          {session.messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.streaming}
            />
          ))}
          {loading && session.messages.length > 0 && !session.messages.at(-1)?.streaming && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
