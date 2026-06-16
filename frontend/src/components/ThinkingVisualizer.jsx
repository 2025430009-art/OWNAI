import { useState } from 'react';
import './ThinkingVisualizer.css';

const MODE_LABELS = {
  chain_of_thought: 'Step-by-step reasoning',
  tree_of_thoughts: 'Multi-branch exploration',
  react: 'Tool-augmented reasoning',
  self_refine: 'Self-improving answer',
  extended: 'Deep thinking',
  debate: 'Balanced debate analysis',
  socratic: 'Socratic method',
  direct: 'Direct answer',
};

function confidenceColor(score) {
  if (score > 80) return '#1D9E75';
  if (score > 60) return '#BA7517';
  return '#E24B4A';
}

function ScorePill({ score, label = 'score' }) {
  if (score == null) return null;
  const bg = score > 75 ? '#E1F5EE' : score > 50 ? '#FAEEDA' : '#FCEBEB';
  const color = score > 75 ? '#085041' : score > 50 ? '#633806' : '#791F1F';
  return (
    <span className="score-pill" style={{ backgroundColor: bg, color }}>
      {score} {label}
    </span>
  );
}

function ConfidenceBar({ score }) {
  if (score == null) return null;
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="confidence-bar">
      <div
        className="bar-fill"
        style={{ width: `${safeScore}%`, backgroundColor: confidenceColor(safeScore) }}
      />
      <span className="bar-label">{safeScore}% confident</span>
    </div>
  );
}

function ModeHeader({ mode, confidence }) {
  const modeKey = (mode || 'extended').replace(/_/g, '-');
  return (
    <div className="mode-header">
      <span className={`mode-badge mode-${modeKey}`}>
        {MODE_LABELS[mode] || mode}
      </span>
      <ConfidenceBar score={confidence} />
    </div>
  );
}

function COTVisualizer({ data }) {
  return (
    <div className="cot-steps">
      <div className="section-label">Reasoning steps</div>
      {(data.steps || []).map((step, i) => (
        <div key={step.step_number ?? i} className="cot-step">
          <div className="step-number">{step.step_number ?? i + 1}</div>
          <div className="step-content">
            {step.title && <div className="step-title">{step.title}</div>}
            {step.reasoning && <div className="step-reasoning">{step.reasoning}</div>}
            {step.result && <div className="step-result">Result: {step.result}</div>}
            {step.confidence != null && <ConfidenceBar score={step.confidence} />}
          </div>
        </div>
      ))}
      {!data.steps?.length && data.problem_restatement && (
        <div className="step-reasoning">{data.problem_restatement}</div>
      )}
    </div>
  );
}

function TOTVisualizer({ data }) {
  const [expanded, setExpanded] = useState(data.selected_branch || null);

  return (
    <div className="tot-branches">
      <div className="section-label">Explored {data.branches?.length || 0} approaches</div>
      {(data.branches || []).map((branch) => (
        <div
          key={branch.branch_id}
          className={`branch ${branch.branch_id === data.selected_branch ? 'selected' : ''}`}
          onClick={() => setExpanded(expanded === branch.branch_id ? null : branch.branch_id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setExpanded(expanded === branch.branch_id ? null : branch.branch_id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="branch-header">
            <span className="branch-id">{branch.branch_id}</span>
            <span className="branch-name">{branch.approach_name}</span>
            <ScorePill score={branch.score} />
            {branch.branch_id === data.selected_branch && (
              <span className="chosen-badge">Chosen</span>
            )}
          </div>
          {expanded === branch.branch_id && (
            <div className="branch-detail">
              {branch.reasoning && <div className="branch-reasoning">{branch.reasoning}</div>}
              <div className="pros-cons">
                <div className="pros">
                  {(branch.pros || []).map((p, i) => <div key={i}>+ {p}</div>)}
                </div>
                <div className="cons">
                  {(branch.cons || []).map((c, i) => <div key={i}>- {c}</div>)}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {data.selection_reason && (
        <div className="selection-reason">Selected because: {data.selection_reason}</div>
      )}
    </div>
  );
}

function ReActVisualizer({ data }) {
  return (
    <div className="react-cycles">
      <div className="section-label">Tool-use reasoning ({data.cycles?.length || 0} cycles)</div>
      {(data.cycles || []).map((cycle, i) => (
        <div key={cycle.cycle ?? i} className="react-cycle">
          <div className="cycle-num">Cycle {cycle.cycle ?? i + 1}</div>
          {cycle.thought && (
            <div className="thought-block">
              <span className="label">Thought</span>
              {cycle.thought}
            </div>
          )}
          {cycle.action?.tool && cycle.action.tool !== 'none' && (
            <div className="action-block">
              <span className="label">Action</span>
              <span className="tool-name">{cycle.action.tool}</span>
              <code>{JSON.stringify(cycle.action.input || {})}</code>
            </div>
          )}
          {cycle.observation && (
            <div className="observation-block">
              <span className="label">Observation</span>
              <pre>{JSON.stringify(cycle.observation, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
      {data.tools_used?.length > 0 && (
        <div className="selection-reason">Tools used: {data.tools_used.join(', ')}</div>
      )}
    </div>
  );
}

function SelfRefineVisualizer({ data }) {
  const delta = data.improvement_delta ?? 0;
  const iterations = data.iterations || [];

  return (
    <div className="refine-iterations">
      <div className="section-label">
        Self-improvement: {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
        {delta !== 0 && ` (+${delta} score points)`}
      </div>
      {iterations.map((it, i) => {
        const score = it.critique?.score ?? it.score;
        const draft = it.draft || '';
        return (
          <div key={it.iteration ?? i} className="iteration">
            <div className="iter-header">
              <span>Iteration {it.iteration ?? i + 1}</span>
              <ScorePill score={score} />
            </div>
            {draft && (
              <div className="iter-draft">
                {draft.length > 200 ? `${draft.slice(0, 200)}…` : draft}
              </div>
            )}
            {it.critique?.weaknesses?.length > 0 && (
              <div className="iter-critique">
                Issues: {it.critique.weaknesses.join(' · ')}
              </div>
            )}
          </div>
        );
      })}
      {data.score_progression?.length > 0 && (
        <div className="selection-reason">
          Score progression: {data.score_progression.join(' → ')}
        </div>
      )}
    </div>
  );
}

function ExtendedVisualizer({ data }) {
  const [showScratch, setShowScratch] = useState(false);

  return (
    <div className="extended-thinking">
      <button
        type="button"
        className="toggle-scratch"
        onClick={() => setShowScratch(!showScratch)}
      >
        {showScratch ? 'Hide' : 'Show'} thinking scratchpad ({data.scratchpad?.length || 0} entries)
      </button>
      {showScratch && (
        <div className="scratchpad">
          {(data.scratchpad || []).map((entry, i) => (
            <div key={i} className={`scratch-entry type-${entry.type || 'exploration'}`}>
              <span className="entry-type">{entry.type}</span>
              <span className="entry-content">{entry.content}</span>
              {entry.reason_abandoned && (
                <span className="abandoned">Abandoned: {entry.reason_abandoned}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {data.key_insight && (
        <div className="key-insight">Key insight: {data.key_insight}</div>
      )}
      {data.remaining_uncertainty && (
        <div className="selection-reason">Uncertainty: {data.remaining_uncertainty}</div>
      )}
    </div>
  );
}

function DebateVisualizer({ data }) {
  return (
    <div className="debate-view">
      {data.thesis && <div className="selection-reason">Thesis: {data.thesis}</div>}
      <div className="sides">
        <div className="side side-a">
          <div className="side-label">Side A: {data.side_a?.position}</div>
          {(data.side_a?.arguments || []).map((a, i) => (
            <div key={i} className="argument">
              <span>{a.point}</span>
              <ScorePill score={a.strength} label="strength" />
            </div>
          ))}
        </div>
        <div className="side side-b">
          <div className="side-label">Side B: {data.side_b?.position}</div>
          {(data.side_b?.arguments || []).map((a, i) => (
            <div key={i} className="argument">
              <span>{a.point}</span>
              <ScorePill score={a.strength} label="strength" />
            </div>
          ))}
        </div>
      </div>
      {data.synthesis && <div className="synthesis">Synthesis: {data.synthesis}</div>}
      {data.verdict && !data.synthesis && (
        <div className="synthesis">Verdict: {data.verdict}</div>
      )}
    </div>
  );
}

function SocraticVisualizer({ data }) {
  return (
    <div className="socratic-view">
      {data.clarifying_questions?.length > 0 && (
        <div className="socratic-block">
          <div className="section-label">Clarifying questions</div>
          {data.clarifying_questions.map((q, i) => (
            <div key={i} className="socratic-item">
              <strong>{q.question}</strong>
              {q.why_needed && <div>{q.why_needed}</div>}
            </div>
          ))}
        </div>
      )}
      {data.foundational_concepts?.length > 0 && (
        <div className="socratic-block">
          <div className="section-label">Foundations</div>
          {data.foundational_concepts.map((c, i) => (
            <div key={i} className="socratic-item">
              <strong>{c.concept}</strong>: {c.definition}
            </div>
          ))}
        </div>
      )}
      {data.reasoning_chain?.length > 0 && (
        <div className="socratic-block">
          <div className="section-label">Reasoning chain</div>
          {data.reasoning_chain.map((link, i) => (
            <div key={i} className="socratic-item">
              {link.from} → {link.to}: {link.logic}
            </div>
          ))}
        </div>
      )}
      {data.teaching_summary && (
        <div className="key-insight">{data.teaching_summary}</div>
      )}
    </div>
  );
}

function DirectRenderer({ data }) {
  const text = data.scratchpad?.[0]?.content || data.raw_thinking || '';
  if (!text) return null;
  return (
    <div className="direct-renderer">
      <div className="section-label">Reasoning</div>
      <pre>{text}</pre>
    </div>
  );
}

function FinalAnswer({ answer }) {
  if (!answer?.trim()) return null;
  return (
    <div className="final-answer">
      <div className="final-label">Final answer</div>
      <div className="answer-content">{answer}</div>
    </div>
  );
}

const MODE_RENDERERS = {
  chain_of_thought: COTVisualizer,
  tree_of_thoughts: TOTVisualizer,
  react: ReActVisualizer,
  self_refine: SelfRefineVisualizer,
  extended: ExtendedVisualizer,
  debate: DebateVisualizer,
  socratic: SocraticVisualizer,
};

export default function ThinkingVisualizer({
  thinkingResult,
  isStreaming = false,
  hideFinalAnswer = false,
  collapsed = false,
}) {
  if (!thinkingResult) return null;

  const { thinking_mode: mode, confidence_overall: confidence } = thinkingResult;
  const Renderer = MODE_RENDERERS[mode] || DirectRenderer;

  return (
    <div className={`thinking-visualizer${isStreaming ? ' is-streaming' : ''}`}>
      <ModeHeader mode={mode} confidence={confidence} />
      {!collapsed && (
        <>
          <Renderer data={thinkingResult} />
          {!hideFinalAnswer && <FinalAnswer answer={thinkingResult.final_answer} />}
        </>
      )}
    </div>
  );
}

export {
  MODE_LABELS,
  ConfidenceBar,
  ScorePill,
  ModeHeader,
};
