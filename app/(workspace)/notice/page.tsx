"use client";

import PlannerApp from "../../components/PlannerApp";
import ProtectedWorkspace from "../../components/ProtectedWorkspace";

export default function NoticePage() {
  return (
    <ProtectedWorkspace>
      <PlannerApp mode="notice" />
    </ProtectedWorkspace>
  );
}
