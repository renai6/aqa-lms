import { type EnrollmentStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  getAdminPaymentsByStatus,
  getPaymentStatusCounts,
} from "@/lib/payments/queries";
import { describeBalance, peso } from "@/lib/payments/balance";

type Props = { searchParams: Promise<{ tab?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Payments — AQA Admin" };

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ""] ?? "PENDING";

  const [rows, countMap] = await Promise.all([
    getAdminPaymentsByStatus(status),
    getPaymentStatusCounts(),
  ]);

  const tabs = [
    {
      label: "Pending",
      value: "pending",
      enumStatus: "PENDING" as EnrollmentStatus,
    },
    {
      label: "Approved",
      value: "approved",
      enumStatus: "APPROVED" as EnrollmentStatus,
    },
    {
      label: "Rejected",
      value: "rejected",
      enumStatus: "REJECTED" as EnrollmentStatus,
    },
  ];

  const getStatusBadge = (s: EnrollmentStatus) => {
    if (s === "APPROVED")
      return (
        <Badge className="border-green-200 bg-green-100 text-green-800">
          Approved
        </Badge>
      );
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Payments" />

      <div className="-mt-2 flex gap-1 border-b">
        {tabs.map((t) => {
          const isActive = t.enumStatus === status;
          const count = countMap[t.enumStatus] ?? 0;
          return (
            <Link
              key={t.value}
              href={`?tab=${t.value}`}
              className={cn(
                "flex items-center gap-1.5 px-4 pb-3 text-sm transition-colors",
                isActive
                  ? "border-primary text-foreground border-b-2 font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="bg-muted text-muted-foreground inline-block rounded px-1.5 py-0.5 text-xs font-medium">
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
          <Inbox className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">No {status.toLowerCase()} payments.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Student
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Course
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Balance
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Submitted
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Status
                </th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.studentName}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.studentEmail}
                    </p>
                  </td>
                  <td className="px-4 py-2">{r.courseTitle}</td>
                  <td className="px-4 py-2">{peso(r.amount)}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {describeBalance(r.balance)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {dateFormatter.format(r.createdAt)}
                  </td>
                  <td className="px-4 py-2">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/admin/payments/" + r.id}>
                        View{" "}
                        <ChevronRight
                          className="ml-1 h-3 w-3"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
