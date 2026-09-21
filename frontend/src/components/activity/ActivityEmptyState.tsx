import { Footprints } from "lucide-react";
import { EmptyState } from "../EmptyState";
import { Button } from "../Button";

interface ActivityEmptyStateProps {
  onAddActivity: () => void;
}

export function ActivityEmptyState({ onAddActivity }: ActivityEmptyStateProps) {
  return (
    <EmptyState
      icon={Footprints}
      title="No activity recorded today."
      description="Add your steps, distance, and active minutes to start tracking today's progress."
      action={
        <Button variant="primary" size="sm" onClick={onAddActivity}>
          Add Activity
        </Button>
      }
    />
  );
}
