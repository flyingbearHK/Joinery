import {
  CARDINALITY_OPTIONS,
  exactCardinalityCount,
  type Cardinality,
} from "../domain/model";

const EXACT_VALUE = "__exactly_n__";

interface CardinalitySelectProps {
  value: Cardinality;
  onChange: (cardinality: Cardinality) => void;
  ariaLabel?: string;
  className?: string;
}

export function CardinalitySelect({
  value,
  onChange,
  ariaLabel,
  className,
}: CardinalitySelectProps) {
  const exact = exactCardinalityCount(value);
  return (
    <div className="cardinality-field">
      <select
        className={className ?? "select-field"}
        aria-label={ariaLabel}
        value={exact !== null ? EXACT_VALUE : value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(
            next === EXACT_VALUE
              ? (`exactly-${exact ?? 2}` as Cardinality)
              : (next as Cardinality),
          );
        }}
      >
        {CARDINALITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.shortLabel})
          </option>
        ))}
        <option value={EXACT_VALUE}>
          {exact !== null ? `Exactly ${exact}` : "Exactly N…"}
        </option>
      </select>
      {exact !== null && (
        <input
          type="number"
          className="cardinality-count"
          aria-label={ariaLabel ? `${ariaLabel} count` : "Exact count"}
          min={1}
          max={999_999}
          value={exact}
          onChange={(event) => {
            const count = Math.max(
              1,
              Math.min(999_999, Math.floor(Number(event.target.value) || 1)),
            );
            onChange(`exactly-${count}`);
          }}
        />
      )}
    </div>
  );
}
