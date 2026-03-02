"use client";

import PlannerApp from "../../components/PlannerApp";
import ProtectedWorkspace from "../../components/ProtectedWorkspace";

export default function TrackingPage() {
  return (
    <ProtectedWorkspace>
      <PlannerApp mode="tracking" />
    </ProtectedWorkspace>
  );
}
