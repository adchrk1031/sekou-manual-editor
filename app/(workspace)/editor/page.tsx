"use client";

import PlannerApp from "../../components/PlannerApp";
import ProtectedWorkspace from "../../components/ProtectedWorkspace";

export default function EditorPage() {
  return (
    <ProtectedWorkspace>
      <PlannerApp mode="editor" />
    </ProtectedWorkspace>
  );
}
