const FEATURES = [
  {
    id: 'suite',
    title: 'Complete AI suite',
    description: 'All-in-one SDK: LLMs, fine-tuning, diffusion, speech, RAG, and more.',
    angle: -90,
  },
  {
    id: 'p2p',
    title: 'Peer-to-peer',
    description: 'Delegate inference to peers and build AI systems that work across P2P networks.',
    angle: -45,
  },
  {
    id: 'cross',
    title: 'Cross-platform',
    description:
      'Consistent developer experience across hardware, operating systems, and JavaScript runtimes — write code once, run it everywhere.',
    angle: 0,
  },
  {
    id: 'pluggable',
    title: 'Pluggable',
    description: 'Include only the capabilities your app needs, and extend the SDK with custom plugins.',
    angle: 45,
  },
  {
    id: 'opensource',
    title: 'Open source',
    description: '100% free to use and modify, released under Apache 2.0 license.',
    angle: 90,
  },
  {
    id: 'openai',
    title: 'OpenAI-compatible API',
    description:
      'Launch an HTTP server that exposes an OpenAI-compatible API for integration with the broader AI ecosystem.',
    angle: 135,
  },
  {
    id: 'unified',
    title: 'Unified JS/TS interface',
    description: 'Use one typed JavaScript SDK to run multiple AI capabilities from a single npm package.',
    angle: 180,
  },
  {
    id: 'local',
    title: 'Local-first',
    description:
      'Run AI models locally, without relying on third-party APIs, SaaS, or cloud infrastructure.',
    angle: 225,
  },
];

const DEVICE_ICONS = [
  { id: 'desktop', angle: -60, icon: DesktopIcon },
  { id: 'phone', angle: -20, icon: PhoneIcon },
  { id: 'laptop', angle: 20, icon: LaptopIcon },
  { id: 'server', angle: 60, icon: ServerIcon },
  { id: 'camera', angle: 100, icon: CameraIcon },
  { id: 'watch', angle: 140, icon: WatchIcon },
  { id: 'wifi', angle: 180, icon: WifiIcon },
  { id: 'robot', angle: 220, icon: RobotIcon },
];

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function FeatureCard({ feature, cx, cy, outerRadius, cardWidth, cardHeight }) {
  const anchor = polarToCartesian(cx, cy, outerRadius, feature.angle);
  const isLeft = feature.angle > 90 || feature.angle < -90;
  const isTop = feature.angle < -45 && feature.angle > -135;
  const isBottom = feature.angle > 45 && feature.angle < 135;

  let cardX = anchor.x;
  let cardY = anchor.y;
  let textAlign = 'left';

  if (isLeft) {
    cardX = anchor.x - cardWidth - 16;
    textAlign = 'right';
  } else if (!isTop && !isBottom) {
    cardX = anchor.x + 16;
  } else {
    cardX = anchor.x - cardWidth / 2;
    textAlign = 'center';
  }

  if (isTop) {
    cardY = anchor.y - cardHeight - 20;
  } else if (isBottom) {
    cardY = anchor.y + 20;
  } else {
    cardY = anchor.y - cardHeight / 2;
  }

  const lineEnd = polarToCartesian(cx, cy, outerRadius - 8, feature.angle);

  return (
    <g>
      <line
        x1={lineEnd.x}
        y1={lineEnd.y}
        x2={isLeft ? cardX + cardWidth : isTop || isBottom ? cardX + cardWidth / 2 : cardX}
        y2={isTop ? cardY + cardHeight : isBottom ? cardY : cardY + cardHeight / 2}
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.5"
      />
      <foreignObject
        x={cardX}
        y={cardY}
        width={cardWidth}
        height={cardHeight}
        className="overflow-visible"
      >
        <div
          className="feature-card h-full rounded-lg border border-teal-500/40 bg-slate-900/90 px-4 py-3 backdrop-blur-sm"
          style={{ textAlign }}
        >
          <h3 className="text-sm font-semibold text-teal-400">{feature.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{feature.description}</p>
        </div>
      </foreignObject>
    </g>
  );
}

function DesktopIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function PhoneIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function LaptopIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16v10H4z" />
      <path d="M2 18h20" />
    </svg>
  );
}

function ServerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="6" rx="1" />
      <rect x="4" y="10" width="16" height="6" rx="1" />
      <rect x="4" y="18" width="16" height="4" rx="1" />
    </svg>
  );
}

function CameraIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 8h4l2-3h4l2 3h4v11H4z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function WatchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="7" y="6" width="10" height="12" rx="3" />
      <path d="M9 6V4M15 6V4M9 18v2M15 18v2" />
      <path d="M12 10v2l1.5 1.5" />
    </svg>
  );
}

function WifiIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 12.5a14 14 0 0 1 14 0" />
      <path d="M8.5 16a8.5 8.5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function RobotIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="8" width="14" height="12" rx="2" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M12 2v4M8 4h8" />
    </svg>
  );
}

function CenterLogo() {
  return (
    <g>
      <rect x="-28" y="-28" width="56" height="56" rx="12" fill="#0f766e" opacity="0.2" />
      <path
        d="M-14 -8 L-14 16 L-2 16 L-2 4 L10 16 L22 16 L22 -8 L10 -8 L10 4 L-2 -8 Z"
        fill="#2dd4bf"
        opacity="0.9"
      />
      <text
        y="38"
        textAnchor="middle"
        className="fill-teal-400 text-[10px] font-bold tracking-widest"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        OWN AI
      </text>
    </g>
  );
}

function RadialDiagram() {
  const cx = 400;
  const cy = 400;
  const innerRadius = 90;
  const midRadius = 140;
  const outerRadius = 200;
  const cardWidth = 200;
  const cardHeight = 88;

  return (
    <svg
      viewBox="0 0 800 800"
      className="mx-auto h-auto w-full max-w-3xl"
      role="img"
      aria-label="OWN AI platform features diagram"
    >
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={280} fill="url(#hubGlow)" />

      <circle
        cx={cx}
        cy={cy}
        r={innerRadius}
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeDasharray="6 6"
        opacity="0.3"
      />
      <circle
        cx={cx}
        cy={cy}
        r={midRadius}
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeDasharray="6 6"
        opacity="0.4"
      />
      <circle
        cx={cx}
        cy={cy}
        r={outerRadius}
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeDasharray="6 6"
        opacity="0.5"
      />

      {DEVICE_ICONS.map(({ id, angle, icon: Icon }) => {
        const pos = polarToCartesian(cx, cy, midRadius - 20, angle);
        return (
          <g key={id} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="18" fill="#0f172a" stroke="#2dd4bf" strokeWidth="1" opacity="0.8" />
            <foreignObject x="-10" y="-10" width="20" height="20">
              <Icon className="h-5 w-5 text-teal-400" />
            </foreignObject>
          </g>
        );
      })}

      {FEATURES.map((feature) => {
        const dot = polarToCartesian(cx, cy, outerRadius, feature.angle);
        return (
          <circle key={`dot-${feature.id}`} cx={dot.x} cy={dot.y} r="4" fill="#2dd4bf" />
        );
      })}

      <g transform={`translate(${cx}, ${cy})`}>
        <CenterLogo />
      </g>

      {FEATURES.map((feature) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          cx={cx}
          cy={cy}
          outerRadius={outerRadius}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      ))}
    </svg>
  );
}

function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <div
          key={feature.id}
          className="feature-card rounded-xl border border-teal-500/30 bg-slate-900/80 p-5 transition-colors hover:border-teal-400/50"
        >
          <h3 className="text-sm font-semibold text-teal-400">{feature.title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

export default function FeaturesRadial() {
  return (
    <section className="features-section px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-teal-400">Features</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
          OWN AI is built on QVAC — a local-first, cross-platform AI SDK with a unified JavaScript
          interface for LLMs, speech, RAG, and more.
        </p>

        <div className="mt-10 hidden lg:block">
          <RadialDiagram />
        </div>

        <div className="mt-8 lg:hidden">
          <FeatureGrid />
        </div>
      </div>
    </section>
  );
}
