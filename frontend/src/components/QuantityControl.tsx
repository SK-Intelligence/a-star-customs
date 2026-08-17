import { Minus, Plus } from 'lucide-react';

interface QuantityControlProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}

export function QuantityControl({ value, onChange, compact }: QuantityControlProps) {
  return (
    <div className={compact ? 'quantity-control quantity-control--compact' : 'quantity-control'}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus aria-hidden="true" />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= 10}
        onClick={() => onChange(Math.min(10, value + 1))}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

