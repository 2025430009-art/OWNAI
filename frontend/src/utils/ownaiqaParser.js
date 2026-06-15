/**
 * Auto-detect question vs answer from pasted raw conversation text.
 * Supports common export formats (User/Human/You vs Assistant/OWN AI labels).
 *
 * @param {string} rawText
 * @returns {{ question: string, answer: string }}
 */
export function parseOwnAIExport(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { question: '', answer: '' };
  }

  const text = rawText.trim();
  if (!text) return { question: '', answer: '' };

  const userLabels = /^(?:you|user|human|me)\s*[:：]\s*/im;
  const aiLabels = /^(?:own\s*ai|ownai|assistant|ai)\s*[:：]\s*/im;

  const lines = text.split('\n');
  const blocks = [];
  let current = { role: null, lines: [] };

  const flush = () => {
    if (current.lines.length) {
      blocks.push({
        role: current.role,
        text: current.lines.join('\n').trim(),
      });
    }
    current = { role: null, lines: [] };
  };

  for (const line of lines) {
    if (userLabels.test(line)) {
      flush();
      current.role = 'user';
      current.lines.push(line.replace(userLabels, '').trim());
    } else if (aiLabels.test(line)) {
      flush();
      current.role = 'assistant';
      current.lines.push(line.replace(aiLabels, '').trim());
    } else if (current.role) {
      current.lines.push(line);
    } else {
      current.role = 'unknown';
      current.lines.push(line);
    }
  }
  flush();

  const userBlocks = blocks.filter((b) => b.role === 'user').map((b) => b.text);
  const aiBlocks = blocks.filter((b) => b.role === 'assistant').map((b) => b.text);

  if (userBlocks.length && aiBlocks.length) {
    return {
      question: userBlocks.join('\n\n'),
      answer: aiBlocks.join('\n\n'),
    };
  }

  if (blocks.length >= 2) {
    const midpoint = Math.ceil(blocks.length / 2);
    return {
      question: blocks.slice(0, midpoint).map((b) => b.text).join('\n\n'),
      answer: blocks.slice(midpoint).map((b) => b.text).join('\n\n'),
    };
  }

  const parts = text.split(/\n{2,}/);
  if (parts.length >= 2) {
    return {
      question: parts[0].trim(),
      answer: parts.slice(1).join('\n\n').trim(),
    };
  }

  return { question: text, answer: '' };
}
