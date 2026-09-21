import { Sparkles, FlaskConical } from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";

interface InsightCardProps {
  title: string;
  content: string | null;
  disclaimer?: string;
  source?: string;
  generatedAt?: string;
  isLoading: boolean;
  onGenerate: () => void;
  generateLabel: string;
}

export function InsightCard({
  title,
  content,
  disclaimer,
  source,
  generatedAt,
  isLoading,
  onGenerate,
  generateLabel,
}: InsightCardProps) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-brand-600" />
          {title}
        </h3>
        <Button variant="outline" size="sm" onClick={onGenerate} isLoading={isLoading}>
          {generateLabel}
        </Button>
      </div>

      {content ? (
        <div>
          <p className="whitespace-pre-line text-sm text-slate-700">{content}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              {generatedAt && new Date(generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
            {source === "mock" && (
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3 w-3" />
                Rule-based (development)
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Click "{generateLabel}" to generate an insight from your logged data.</p>
      )}

      {disclaimer && content && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">{disclaimer}</p>}
    </Card>
  );
}
