export default function LandingHero({ onGetStarted }) {
  return (
    <section className="relative overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(45,212,191,0.08)_0%,_transparent_70%)]" />
      <div className="relative mx-auto max-w-3xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-teal-400">
          Powered by QVAC SDK
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Local-first AI.
          <br />
          <span className="text-teal-400">Everywhere you build.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-slate-400">
          Run LLMs on your server, in the cloud, or on-device. One unified SDK for web, mobile, and
          backend — with OpenAI-compatible APIs and peer-to-peer inference.
        </p>
        <button onClick={onGetStarted} className="btn-primary mt-8 px-8 py-3 text-base">
          Start Chatting
        </button>
      </div>
    </section>
  );
}
