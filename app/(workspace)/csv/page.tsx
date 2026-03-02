"use client";

import PlannerApp from "../../components/PlannerApp";
import ProtectedWorkspace from "../../components/ProtectedWorkspace";

export default function CsvPage() {
  return (
    <ProtectedWorkspace>
      <PlannerApp mode="csv" />
    </ProtectedWorkspace>
  );
}
