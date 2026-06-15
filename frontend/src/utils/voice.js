/**
 * Voice input/output for OWNAI — browser Web Speech APIs (free, offline-capable).
 */

export class VoiceInput {
  constructor(onTranscript, onError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.supported = false;
      return;
    }
    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.listening = false;

    this.recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');
      if (e.results[e.results.length - 1].isFinal) {
        onTranscript?.(transcript.trim());
      }
    };

    this.recognition.onerror = (e) => onError?.(e.error);
    this.recognition.onend = () => { this.listening = false; };
  }

  start() {
    if (!this.supported || this.listening) return false;
    this.listening = true;
    this.recognition.start();
    return true;
  }

  stop() {
    if (!this.supported) return;
    this.recognition.stop();
    this.listening = false;
  }

  isListening() {
    return this.listening;
  }
}

export class VoiceOutput {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text, { rate = 1.0, pitch = 1.0, voice } = {}) {
    if (!this.supported || !text?.trim()) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  stop() {
    if (this.supported) window.speechSynthesis.cancel();
  }
}

const WAKE_PHRASE = 'hey ownai';

export class WakeWordListener {
  constructor(onWake) {
    this.voice = new VoiceInput((transcript) => {
      if (transcript.toLowerCase().includes(WAKE_PHRASE)) {
        onWake?.(transcript.replace(new RegExp(WAKE_PHRASE, 'i'), '').trim());
      }
    });
    this.active = false;
  }

  get supported() {
    return this.voice.supported;
  }

  start() {
    if (!this.voice.supported) return false;
    this.active = true;
    const loop = () => {
      if (!this.active) return;
      this.voice.recognition.onend = () => {
        this.voice.listening = false;
        if (this.active) setTimeout(loop, 300);
      };
      this.voice.start();
    };
    loop();
    return true;
  }

  stop() {
    this.active = false;
    this.voice.stop();
  }
}

export function isVoiceSupported() {
  return Boolean(
    window.SpeechRecognition
    || window.webkitSpeechRecognition
    || window.speechSynthesis,
  );
}
