import { ProcessStatus } from "@/types/domain";
import { STATUS_LABEL } from "@/constants/defaults";

export function StatusBadge({ status }: { status: ProcessStatus }) {
  const className = `status-badge status-${status.toLowerCase()}`;
  return <span className={className}>{STATUS_LABEL[status] ?? status}</span>;
}
