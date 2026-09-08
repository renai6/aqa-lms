import { peso } from "@/lib/payments/balance";
import { monthKeyShort, monthKeyLabel } from "@/lib/time/manila";
import type { MonthlyMatrix, MonthCell } from "@/lib/payments/monthly";
import { cn } from "@/lib/utils";

// Status is carried in the cell's accessible name as well as its glyph, so it
// does not depend on telling a check from a cross.
function CellMark({ cell }: { cell: MonthCell }) {
  if (!cell.owed) {
    // Money can land in a month the student does not owe, because paying
    // ahead is offered. Showing the amount is the only place it appears.
    if (cell.paid > 0) {
      return (
        <span className="text-xs font-medium text-emerald-600">
          <span className="sr-only">
            {monthKeyLabel(cell.month)}: paid ahead,{" "}
          </span>
          {peso(cell.paid)}
        </span>
      );
    }
    return (
      <span className="text-muted-foreground/40" aria-label="Not enrolled">
        ·
      </span>
    );
  }
  const { status } = cell;
  const pending = cell.hasPending ? ", payment awaiting review" : "";
  const label = `${monthKeyLabel(cell.month)}: `;
  if (status.kind === "paid") {
    return (
      <span className="font-semibold text-emerald-600" title={peso(status.paid)}>
        <span className="sr-only">{label}paid{pending}</span>
        <span aria-hidden="true">✓</span>
      </span>
    );
  }
  if (status.kind === "partial") {
    return (
      <span
        className="font-semibold text-amber-600"
        title={`${peso(status.paid)} paid, ${peso(status.short)} short`}
      >
        <span className="sr-only">
          {label}partial, {peso(status.short)} short{pending}
        </span>
        <span aria-hidden="true">◐</span>
      </span>
    );
  }
  if (status.kind === "unscored") {
    return (
      <span className="text-muted-foreground" title={peso(status.paid)}>
        <span className="sr-only">
          {label}
          {peso(status.paid)} received, course has no fee set
        </span>
        <span aria-hidden="true">{status.paid > 0 ? "•" : "·"}</span>
      </span>
    );
  }
  return (
    <span className={cn("font-semibold", cell.hasPending ? "text-sky-600" : "text-destructive")}>
      <span className="sr-only">{label}unpaid{pending}</span>
      <span aria-hidden="true">{cell.hasPending ? "⋯" : "✕"}</span>
    </span>
  );
}

export function MonthlyMatrixTable({
  matrix,
  monthlyFee,
}: {
  matrix: MonthlyMatrix;
  monthlyFee: number | null;
}) {
  if (matrix.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No students are enrolled in this course yet.
      </p>
    );
  }

  return (
    // The student column is sticky and the months scroll. A course running two
    // years produces twenty-four columns, and letting the page go sideways
    // pushes the names out of view, which is the one thing an admin needs.
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th
              scope="col"
              className="bg-muted text-muted-foreground sticky left-0 z-10 px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
            >
              Student
            </th>
            <th
              scope="col"
              className="text-muted-foreground px-3 py-2 text-right text-xs font-medium tracking-wide uppercase"
            >
              Unassigned
            </th>
            {matrix.months.map((m) => (
              <th
                key={m}
                scope="col"
                className="text-muted-foreground px-3 py-2 text-center text-xs font-medium tracking-wide uppercase"
                title={monthKeyLabel(m)}
              >
                {monthKeyShort(m)}
              </th>
            ))}
            <th
              scope="col"
              className="text-muted-foreground px-4 py-2 text-right text-xs font-medium tracking-wide uppercase"
            >
              Behind
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {matrix.rows.map((row) => (
            <tr key={row.enrollmentId} className="hover:bg-muted/50 transition-colors">
              <th
                scope="row"
                className="bg-background sticky left-0 z-10 px-4 py-2 text-left font-normal"
              >
                <p className="font-medium">
                  {row.studentName}
                  {row.removedAt && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      removed
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{row.studentEmail}</p>
              </th>
              <td className="text-muted-foreground px-3 py-2 text-right text-xs">
                {row.unassigned > 0 ? peso(row.unassigned) : "—"}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.month} className="px-3 py-2 text-center">
                  <CellMark cell={cell} />
                </td>
              ))}
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {row.monthsBehind === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="text-destructive font-medium">
                    {row.monthsBehind} {row.monthsBehind === 1 ? "month" : "months"}
                    {monthlyFee !== null && ` · ${peso(row.amountBehind)}`}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/50 border-t">
          {(["paid", "partial", "unpaid"] as const).map((kind) => (
            <tr key={kind}>
              <th
                scope="row"
                className="bg-muted/50 text-muted-foreground sticky left-0 z-10 px-4 py-1.5 text-left text-xs font-medium capitalize"
              >
                {kind}
              </th>
              <td />
              {matrix.tallies.map((t) => (
                <td
                  key={t.month}
                  className="text-muted-foreground px-3 py-1.5 text-center text-xs"
                >
                  {t[kind]}
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
