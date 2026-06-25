import { type EnrollmentStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  getAdminPurchasesByStatus,
  getPurchaseStatusCounts,
} from "@/lib/purchases/queries";

type Props = { searchParams: Promise<{ tab?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Purchases — AQA Admin" };

export default async function PurchasesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ""] ?? "PENDING";

  const [rows, countMap] = await Promise.all([
    getAdminPurchasesByStatus(status),
    getPurchaseStatusCounts(),
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
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Approved
        </Badge>
      );
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Course Enrollment Requests" />

      <div className="flex gap-1 border-b -mt-2">
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
                  ? "border-b-2 border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="inline-block bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No {status.toLowerCase()} purchases.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Student
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Courses
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Submitted
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Status
                </th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{r.studentName}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.studentEmail}
                  </td>
                  <td className="px-4 py-2">{r.courseCount}</td>
                  <td className="px-4 py-2">
                    ₱{r.amountPaid.toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {dateFormatter.format(r.createdAt)}
                  </td>
                  <td className="px-4 py-2">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/admin/purchases/" + r.id}>
                        View{" "}
                        <ChevronRight
                          className="w-3 h-3 ml-1"
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
