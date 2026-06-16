import { useState } from 'react';
import {
  createResearchDerivation,
  createResearchSimulation,
  createResearchPaper,
  updateSimulationResults,
} from '../api/client.js';
import {
  extractTheoremBlock,
  extractCodeBlocks,
  extractTabularBlock,
  extractPaperCandidates,
} from '../utils/researchContentDetect.js';

export default function useResearchActions(projectId) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (actionId, content) => {
    if (!projectId) {
      setStatus('Create or select a research project first.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      if (actionId === 'save-derivation') {
        const theorem = extractTheoremBlock(content);
        if (!theorem) throw new Error('No theorem block found.');
        await createResearchDerivation(projectId, theorem);
        setStatus('Derivation saved to research project.');
        return;
      }

      if (actionId === 'save-simulation') {
        const blocks = extractCodeBlocks(content);
        if (!blocks.length) throw new Error('No code blocks found.');
        for (const block of blocks) {
          const runRecord = await createResearchSimulation(projectId, {
            tool: block.tool,
            parameters: { source: 'chat' },
          });
          await updateSimulationResults(runRecord.run.id, {
            status: 'done',
            results: { code: block.code, imported_from: 'chat' },
          });
        }
        setStatus(`Saved ${blocks.length} simulation run(s).`);
        return;
      }

      if (actionId === 'save-table') {
        const table = extractTabularBlock(content);
        if (!table) throw new Error('No tabular block found.');
        const runRecord = await createResearchSimulation(projectId, {
          tool: 'latex',
          parameters: { type: 'results_table' },
        });
        await updateSimulationResults(runRecord.run.id, {
          status: 'done',
          results: { table_latex: table },
        });
        setStatus('Results table saved to simulation runs.');
        return;
      }

      if (actionId === 'import-papers') {
        const papers = extractPaperCandidates(content);
        if (!papers.length) throw new Error('No bibliography entries found.');
        for (const paper of papers) {
          await createResearchPaper(projectId, paper);
        }
        setStatus(`Imported ${papers.length} paper(s) to literature.`);
        return;
      }

      throw new Error('Unknown research action.');
    } catch (error) {
      setStatus(error.message || 'Research action failed.');
    } finally {
      setBusy(false);
    }
  };

  return { run, status, busy, clearStatus: () => setStatus('') };
}
