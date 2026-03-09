"use client";

import { useMemo, useState } from "react";

import { AIActionButton } from "@/components/assistant/AIActionButton";
import { ResultPanel } from "@/components/assistant/ResultPanel";
import { aiActions } from "@/data/demoData";

export function AssistantDemo() {
  const [selectedActionId, setSelectedActionId] = useState(aiActions[0]?.id ?? "");

  const selectedAction = useMemo(
    () => aiActions.find((item) => item.id === selectedActionId) ?? aiActions[0],
    [selectedActionId]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">AIアクション</h2>
        <div className="space-y-3">
          {aiActions.map((action) => (
            <AIActionButton
              key={action.id}
              title={action.title}
              promptLabel={action.promptLabel}
              isActive={action.id === selectedActionId}
              onClick={() => setSelectedActionId(action.id)}
            />
          ))}
        </div>
      </section>

      {selectedAction ? <ResultPanel action={selectedAction} /> : null}
    </div>
  );
}
