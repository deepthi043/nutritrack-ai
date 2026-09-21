import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Input } from "../Input";
import { Button } from "../Button";

interface WaterEntryFormProps {
  onAdd: (amountMl: number) => Promise<void>;
}

export function WaterEntryForm({ onAdd }: WaterEntryFormProps) {
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onAdd(Math.round(amountNum));
      setAmount("");
      setIsOpen(false);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Water
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <Input
        type="number"
        min={1}
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={error ?? undefined}
        className="max-w-[140px]"
        autoFocus
      />
      <span className="pt-2.5 text-sm text-slate-500">ml</span>
      <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isSaving}>
        Cancel
      </Button>
    </form>
  );
}
