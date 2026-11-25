import type { Alert } from "./data";
import { RiskBadge, STATUS_LABEL, STATUS_STYLE, TYPE_LABEL } from "./RiskBadge";

export function AlertTable({ rows, onSelect }: { rows: Alert[]; onSelect?: (id: string) => void }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No alerts to show.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="bg-muted text-left text-muted-foreground">
          {["Severity", "Alert", "Type", "Score", "Raised", "Status", "Owner"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold first:rounded-l-md last:rounded-r-md">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onSelect?.(r.id)} className={`border-b last:border-0 ${onSelect ? "cursor-pointer hover:bg-muted/50" : ""}`}>
              <td className="px-3 py-2.5"><RiskBadge level={r.risk_level} /></td>
              <td className="px-3 py-2.5"><div className="font-medium">{r.title}</div><div className="font-mono text-[10px] text-muted-foreground">{r.code}</div></td>
              <td className="px-3 py-2.5 whitespace-nowrap">{TYPE_LABEL[r.alert_type] ?? r.alert_type}</td>
              <td className="px-3 py-2.5 font-mono">{r.score}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-ZA")}</td>
              <td className={`px-3 py-2.5 whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{r.owner ?? <span className="text-muted-foreground">Unassigned</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
