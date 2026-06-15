const iconClass = 'h-5 w-5 shrink-0';

export function LogoMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-teal-600" />
      <path
        d="M9 22V10l7 6 7-6v12h-3.5V14.8L16 19.5l-3.5-4.7V22H9z"
        className="fill-white"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className={iconClass}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5A2.5 2.5 0 0 1 13.5 13H9l-3.5 3v-3H6.5A2.5 2.5 0 0 1 4 10.5v-5z" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-8z" strokeLinejoin="round" />
    </svg>
  );
}

export function ShapesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <circle cx="7" cy="7" r="3" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
      <path d="M14 3L17 8H11L14 3z" strokeLinejoin="round" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
      <circle cx="7" cy="6" r="1.5" className="fill-current stroke-none" />
      <circle cx="13" cy="10" r="1.5" className="fill-current stroke-none" />
      <circle cx="9" cy="14" r="1.5" className="fill-current stroke-none" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M6 6L3 10l3 4M14 6l3 4-3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M10 3a7 7 0 1 0 6.5 9.6c-.4 1.4-1.6 2.4-3 2.4H12a2 2 0 0 1-2 2v.5" strokeLinejoin="round" />
      <circle cx="7.5" cy="8.5" r="1" className="fill-current stroke-none" />
      <circle cx="10.5" cy="6.5" r="1" className="fill-current stroke-none" />
      <circle cx="13" cy="9" r="1" className="fill-current stroke-none" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5L17 17" strokeLinecap="round" />
    </svg>
  );
}

export function PanelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M3.5 10 16 4l-2.2 6H16v4h-2.2L16 16 3.5 10z" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="7.5" y="3" width="5" height="9" rx="2.5" />
      <path d="M5 9.5a5 5 0 0 0 10 0M10 14.5V17" strokeLinecap="round" />
    </svg>
  );
}

export function AttachIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M8 11.5l4-4a2.5 2.5 0 0 1 3.5 3.5l-5.2 5.2a4 4 0 0 1-5.7-5.7l6.5-6.5" strokeLinecap="round" />
    </svg>
  );
}

export function WriteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" strokeLinejoin="round" />
    </svg>
  );
}

export function LearnIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 7l7-4 7 4-7 4-7-4z" strokeLinejoin="round" />
      <path d="M6 9v4c0 1.5 2.2 3 4 3s4-1.5 4-3V9" strokeLinecap="round" />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.9 4.9l2.1 2.1M13 13l2.1 2.1M4.9 15.1l2.1-2.1M13 7l2.1-2.1" strokeLinecap="round" />
    </svg>
  );
}

export function LifeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 3v2M6 5l1.5 1.5M14 5L12.5 6.5" strokeLinecap="round" />
      <path d="M5 11a5 5 0 0 1 10 0v3H5v-3z" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M4 4h5v12H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M9 4h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9V4z" strokeLinejoin="round" />
      <path d="M6 7h1M6 10h1M12 7h3M12 10h3" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClass}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v14H5.5A1.5 1.5 0 0 1 4 15.5v-11z" strokeLinejoin="round" />
      <path d="M4 15.5A1.5 1.5 0 0 0 5.5 17H16" strokeLinecap="round" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.25" />
      <circle cx="10" cy="10" r="1.25" />
      <circle cx="15" cy="10" r="1.25" />
    </svg>
  );
}
