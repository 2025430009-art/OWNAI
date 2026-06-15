function Box({ x, y, width, height, title, subtitle, highlight = false }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={highlight ? 'rgba(45, 212, 191, 0.12)' : 'rgba(15, 23, 42, 0.95)'}
        stroke={highlight ? '#2dd4bf' : '#334155'}
        strokeWidth={highlight ? 1.5 : 1}
      />
      <text x={x + width / 2} y={y + 22} textAnchor="middle" className="arch-title">
        {title}
      </text>
      {subtitle && (
        <foreignObject x={x + 8} y={y + 30} width={width - 16} height={height - 36}>
          <p className="arch-subtitle">{subtitle}</p>
        </foreignObject>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label, labelX, labelY }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="1" markerEnd="url(#arrowhead)" />
      {label && (
        <text x={labelX ?? midX} y={labelY ?? midY - 6} textAnchor="middle" className="arch-label">
          {label}
        </text>
      )}
    </g>
  );
}

function DashedArrow({ x1, y1, x2, y2, label, labelX, labelY }) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeDasharray="5 4"
        opacity="0.6"
        markerEnd="url(#arrowhead-teal)"
      />
      {label && (
        <text x={labelX} y={labelY} textAnchor="middle" className="arch-label-teal">
          {label}
        </text>
      )}
    </g>
  );
}

export default function ArchitectureOverview() {
  return (
    <section className="architecture-section px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-teal-400">System overview</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
          OWN AI is built on QVAC — local-first AI with a unified JS SDK, OpenAI-compatible HTTP
          server, custom inference engines, and a distributed model registry.
        </p>

        <div className="mt-10 overflow-x-auto">
          <svg
            viewBox="0 0 1100 720"
            className="mx-auto h-auto w-full min-w-[900px] max-w-5xl arch-diagram"
            role="img"
            aria-label="QVAC system architecture overview"
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#475569" />
              </marker>
              <marker id="arrowhead-teal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#2dd4bf" />
              </marker>
              <style>{`
                .arch-title { fill: #f8fafc; font-size: 11px; font-weight: 600; font-family: Inter, sans-serif; }
                .arch-subtitle { margin: 0; font-size: 9px; line-height: 1.35; color: #94a3b8; font-family: Inter, sans-serif; }
                .arch-label { fill: #64748b; font-size: 8px; font-family: Inter, sans-serif; }
                .arch-label-teal { fill: #2dd4bf; font-size: 8px; font-family: Inter, sans-serif; }
                .arch-zone-title { fill: #94a3b8; font-size: 10px; font-weight: 500; font-family: Inter, sans-serif; }
                .arch-zone-sub { fill: #64748b; font-size: 9px; font-family: Inter, sans-serif; }
              `}</style>
            </defs>

            {/* Top layer — external */}
            <text x="24" y="28" className="arch-zone-title">External</text>

            <Box
              x={40}
              y={40}
              width={200}
              height={72}
              title="Your development environment"
            />
            <Box
              x={400}
              y={40}
              width={280}
              height={72}
              title="The application you will build"
              subtitle="React web app, Expo mobile, or any device running OWN AI"
            />
            <Box
              x={840}
              y={40}
              width={220}
              height={72}
              title="OpenAI-compatible API client"
              subtitle="Any system that speaks the OpenAI API"
            />

            <Arrow x1={140} y1={112} x2={140} y2={168} label="Uses tools from" labelX={140} labelY={138} />
            <Arrow x1={540} y1={112} x2={540} y2={248} label="Uses" labelX={555} labelY={175} />
            <Arrow x1={950} y1={112} x2={950} y2={248} label="Connects to" labelX={965} labelY={175} />

            {/* QVAC zone */}
            <rect
              x={24}
              y={168}
              width={1052}
              height={340}
              rx={12}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              opacity="0.5"
            />
            <text x={44} y={192} className="arch-zone-title" fill="#2dd4bf">
              QVAC / OWN AI Platform
            </text>

            {/* CLI */}
            <Box
              x={60}
              y={210}
              width={160}
              height={100}
              title="CLI"
              subtitle="Provides SDK tooling and the HTTP server"
            />

            {/* HTTP server */}
            <Box
              x={860}
              y={210}
              width={180}
              height={100}
              title="HTTP server"
              subtitle="Express API at /v1 — OpenAI-compatible endpoints"
            />

            {/* JS SDK — center hub */}
            <Box
              x={380}
              y={248}
              width={320}
              height={120}
              title="JS SDK (@qvac/sdk)"
              subtitle="Complete suite of AI tasks running on the device or your server — LLM, ASR, TTS, RAG, diffusion, and more"
              highlight
            />

            {/* Custom inference engines */}
            <Box
              x={60}
              y={400}
              width={220}
              height={88}
              title="Custom inference engines"
              subtitle="Fabric LLM and other backends optimized for edge devices"
            />

            {/* Distributed model registry */}
            <Box
              x={820}
              y={400}
              width={220}
              height={88}
              title="Distributed model registry"
              subtitle="P2P network maintaining all compatible AI models"
            />

            {/* Internal QVAC connections */}
            <DashedArrow x1={140} y1={310} x2={380} y2={300} label="Utilities for" labelX={250} labelY={292} />
            <DashedArrow x1={860} y1={260} x2={700} y2={280} label="Wraps" labelX={780} labelY={262} />
            <DashedArrow x1={380} y1={340} x2={170} y2={400} label="Runs" labelX={250} labelY={368} />
            <DashedArrow x1={700} y1={340} x2={930} y2={400} label="Fetches models from" labelX={820} labelY={368} />

            {/* Bottom layer — open source */}
            <line x1={24} y1={530} x2={1076} y2={530} stroke="#1e293b" strokeWidth="1" />
            <text x={24} y={552} className="arch-zone-title">
              Open-source software that powers QVAC
            </text>
            <text x={24} y={568} className="arch-zone-sub">
              Edge inference · P2P connectivity · Model catalog
            </text>

            <Box
              x={40}
              y={590}
              width={300}
              height={100}
              title="Edge inference engines"
              subtitle="Optimized for commodity hardware: GGML, ONNX, NVIDIA Parakeet, Whisper, Diffusion, and more"
            />
            <Box
              x={400}
              y={590}
              width={280}
              height={100}
              title="Holepunch stack"
              subtitle="P2P connectivity for delegated inference and model sharing across peers"
            />
            <Box
              x={740}
              y={590}
              width={300}
              height={100}
              title="AI models"
              subtitle="State-of-the-art GGUF and ONNX models that run on commodity hardware"
            />

            {/* Bottom connections */}
            <DashedArrow x1={170} y1={488} x2={170} y2={590} label="Built on" labelX={195} labelY={540} />
            <DashedArrow x1={540} y1={368} x2={540} y2={590} label="Connect via" labelX={565} labelY={480} />
            <DashedArrow x1={930} y1={488} x2={890} y2={590} label="Catalogs" labelX={940} labelY={540} />
            <DashedArrow x1={930} y1={488} x2={540} y2={590} label="Connect via" labelX={720} labelY={555} />
          </svg>
        </div>

        {/* Legend cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-sm font-semibold text-teal-400">Build with the SDK</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Use <code className="text-teal-300">@qvac/sdk</code> in your web app, mobile app, or
              Node.js backend. One typed interface for all 14 AI capabilities.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-sm font-semibold text-teal-400">Integrate via HTTP</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Connect any OpenAI-compatible client to <code className="text-teal-300">/v1/chat/completions</code>.
              Drop-in replacement for cloud APIs — runs locally.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-sm font-semibold text-teal-400">Models on demand</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Fetch models from the distributed registry or load local GGUF files. P2P sharing via
              Holepunch — no cloud lock-in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
