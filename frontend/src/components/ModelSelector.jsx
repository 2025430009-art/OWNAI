export default function ModelSelector({ models, selected, onChange, temperature, onTemperatureChange, maxTokens, onMaxTokensChange }) {
  return (
    <div className="card p-4 space-y-4">
      <h3 className="text-sm font-medium text-slate-300">Model Settings</h3>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Model</label>
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="input-field text-sm"
        >
          {models.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">
          Temperature: {temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full accent-primary-500"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Max Tokens</label>
        <input
          type="number"
          min="1"
          max="4096"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(parseInt(e.target.value, 10))}
          className="input-field text-sm"
        />
      </div>
    </div>
  );
}
