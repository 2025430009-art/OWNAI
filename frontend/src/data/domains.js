/** sklearn-style domain cards for homepage */
export const DOMAINS = [
  {
    id: 'text-generation',
    title: 'Text generation',
    description: 'LLM inference for chat, completion, and structured output.',
    applications: 'Chatbots, code assistants, content drafting.',
    backends: 'Fabric LLM, Llama, OpenAI-compatible API.',
    slug: 'text-generation',
    visual: 'llm',
  },
  {
    id: 'speech',
    title: 'Speech & audio',
    description: 'Automatic speech recognition, synthesis, and full voice pipelines.',
    applications: 'Voice assistants, transcription, accessibility tools.',
    backends: 'Whisper, NVIDIA Parakeet, GGML TTS.',
    slug: 'transcription',
    visual: 'speech',
  },
  {
    id: 'vision',
    title: 'Vision & multimodal',
    description: 'OCR, image classification, and vision-language reasoning.',
    applications: 'Document scanning, robotics, visual Q&A.',
    backends: 'ONNX Runtime, GGML, Fabric LLM.',
    slug: 'ocr',
    visual: 'vision',
  },
  {
    id: 'generative-media',
    title: 'Image & video generation',
    description: 'Text-to-image, image-to-image, and text-to-video synthesis.',
    applications: 'Content creation, prototyping, media pipelines.',
    backends: 'Customized Diffusion backend.',
    slug: 'image-generation',
    visual: 'diffusion',
  },
  {
    id: 'rag',
    title: 'RAG & embeddings',
    description: 'Vector embeddings and retrieval-augmented generation workflows.',
    applications: 'Semantic search, knowledge bases, document Q&A.',
    backends: 'Fabric LLM, QVAC RAG, HyperDB.',
    slug: 'rag',
    visual: 'rag',
  },
  {
    id: 'platform',
    title: 'Training & integration',
    description: 'Fine-tuning, P2P inference, and ecosystem integration.',
    applications: 'Domain adapters, local deployment, API migration.',
    backends: 'LoRA, Holepunch P2P, OpenAI-compatible HTTP.',
    slug: 'fine-tuning',
    visual: 'platform',
  },
];

export const NEWS = [
  { date: 'June 2026', title: 'OWN AI 1.0.0 released', detail: 'Full QVAC SDK integration with 14 AI capabilities.' },
  { date: 'June 2026', title: 'OpenAI-compatible /v1 API', detail: 'Drop-in replacement for chat completions endpoints.' },
  { date: 'On-going', title: 'OWN AI 1.1 (roadmap)', detail: 'WebSocket streaming, model marketplace, multi-GPU.' },
];

export const TESTIMONIALS = [
  { org: 'Edge deployers', quote: 'We run inference entirely on-device — no cloud API keys required.' },
  { org: 'ML engineers', quote: 'One JavaScript SDK for LLM, speech, vision, and diffusion. Finally unified.' },
  { org: 'Startups', quote: 'OpenAI-compatible API let us migrate off SaaS in a weekend.' },
];
