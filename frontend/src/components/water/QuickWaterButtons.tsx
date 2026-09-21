import { Button } from "../Button";

const QUICK_AMOUNTS = [100, 250, 500, 750, 1000];

interface QuickWaterButtonsProps {
  onAdd: (amountMl: number) => void;
  isAdding?: boolean;
}

export function QuickWaterButtons({ onAdd, isAdding }: QuickWaterButtonsProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">Quick Add</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <Button key={amount} variant="outline" size="sm" onClick={() => onAdd(amount)} disabled={isAdding}>
            {amount} ml
          </Button>
        ))}
      </div>
    </div>
  );
}
