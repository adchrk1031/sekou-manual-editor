"use client";

import PlannerWorkspace from "../../components/planner-shell/PlannerWorkspace";
import ProtectedWorkspace from "../../components/ProtectedWorkspace";

export default function EditorNextPage() {
  return (
    <ProtectedWorkspace>
      <PlannerWorkspace />
    </ProtectedWorkspace>
  );
}
