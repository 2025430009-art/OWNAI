export const CODE_GENERATORS = [
  {
    id: 'javascript',
    name: 'JavaScript',
    description: 'Functions, modules, and Node.js utilities',
    language: 'javascript',
    extension: '.js',
    temperature: 0.4,
    examples: [
      'Debounce function with cancel support',
      'Fetch wrapper with timeout and retries',
      'Parse CSV string into objects',
    ],
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    description: 'Typed interfaces, generics, and safe modules',
    language: 'typescript',
    extension: '.ts',
    temperature: 0.35,
    examples: [
      'Generic API response type with error union',
      'Typed React hook for async data',
      'Zod schema for user registration',
    ],
  },
  {
    id: 'react',
    name: 'React',
    description: 'Components, hooks, and UI patterns',
    language: 'jsx',
    extension: '.jsx',
    temperature: 0.45,
    examples: [
      'Accessible modal dialog component',
      'useLocalStorage hook with JSON parse',
      'Infinite scroll list with IntersectionObserver',
    ],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Scripts, data helpers, and CLI tools',
    language: 'python',
    extension: '.py',
    temperature: 0.4,
    examples: [
      'Read JSON file and flatten nested keys',
      'Argparse CLI for batch file rename',
      'Pandas groupby summary function',
    ],
  },
  {
    id: 'sql',
    name: 'SQL',
    description: 'Queries, indexes, and schema migrations',
    language: 'sql',
    extension: '.sql',
    temperature: 0.3,
    examples: [
      'PostgreSQL query: top users by monthly activity',
      'Create indexes for chat messages table',
      'Migration to add soft-delete columns',
    ],
  },
  {
    id: 'api',
    name: 'REST API',
    description: 'Express routes, validation, and handlers',
    language: 'javascript',
    extension: '.js',
    temperature: 0.4,
    examples: [
      'Express CRUD routes for /projects',
      'JWT auth middleware with role check',
      'Paginated list endpoint with filters',
    ],
  },
  {
    id: 'html-css',
    name: 'HTML & CSS',
    description: 'Responsive layouts and accessible markup',
    language: 'html',
    extension: '.html',
    temperature: 0.5,
    examples: [
      'Responsive pricing section with 3 tiers',
      'Accessible form with validation states',
      'Dark mode toggle with CSS variables',
    ],
  },
  {
    id: 'bash',
    name: 'Bash',
    description: 'Shell scripts for automation and DevOps',
    language: 'bash',
    extension: '.sh',
    temperature: 0.35,
    examples: [
      'Backup script with timestamped archives',
      'Health-check script for HTTP endpoints',
      'Rotate and compress application logs',
    ],
  },
];

export function getCodeGenerator(id) {
  return CODE_GENERATORS.find((g) => g.id === id) ?? null;
}
