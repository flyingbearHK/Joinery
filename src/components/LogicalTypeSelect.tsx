import { COMMON_LOGICAL_TYPES } from "../domain/model";
import { useProjectStore } from "../state/projectStore";

interface LogicalTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  id?: string;
  className?: string;
  title?: string;
}

/**
 * Closed dropdown for logical types: the common set plus any types defined in
 * the project's type library. A current value that isn't in the list (e.g.
 * imported legacy text) is kept as an option so it never renders blank.
 */
export function LogicalTypeSelect({
  value,
  onChange,
  ariaLabel,
  id,
  className = "compact-select",
  title,
}: LogicalTypeSelectProps) {
  const customTypes = useProjectStore((state) => state.project.model.logicalTypes);
  const options = [
    ...COMMON_LOGICAL_TYPES,
    ...Object.values(customTypes).map((logicalType) => logicalType.name),
  ];
  const known = new Set(options);
  const extras = value && !known.has(value) ? [value] : [];

  return (
    <select
      id={id}
      className={className}
      value={value}
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {!value && <option value="">—</option>}
      {options.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
      {extras.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  );
}
