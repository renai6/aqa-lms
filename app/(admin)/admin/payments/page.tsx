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
import { getMonthlyCourses, getCourseMonthlyMatrix } from "@/lib/payments/monthly-queries";
import { describeBalance, peso } from "@/lib/payments/balance";
import { MonthlyMatrixTable } from "./monthly/monthly-matrix";

type Props = { searchParams: Promise<{ tab?: string; courseId?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Payments — AQA Admin" };

const TABS = [
  { label: "Pending", value: "pending", enumStatus: "PENDING" as const },
  { label: "Approved", value: "approved", enumStatus: "APPROVED" as const },
  { label: "Rejected", value: "rejected", enumStatus: "REJECTED" as const },
  // Monthly is a view, not a review queue, so it carries no count badge.
  { label: "Monthly", value: "monthly", enumStatus: null },
];

function PaymentTabs({
  active,
  countMap,
}: {
  active: string;
  countMap: Record<string, number>;
}) {
  return (
    <div className="-mt-2 flex gap-1 border-b">
      {TABS.map((t) => {
        const isActive = t.value === active;
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
            {t.enumStatus && (
              <span className="bg-muted text-muted-foreground inline-block rounded px-1.5 py-0.5 text-xs font-medium">
                {countMap[t.enumStatus] ?? 0}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const { tab, courseId } = await searchParams;

  if (tab === "monthly") {
    const courses = await getMonthlyCourses();
    const selectedId = courseId ?? courses[0]?.id;
    const result = selectedId ? await getCourseMonthlyMatrix(selectedId) : null;

    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Payments" />
        <PaymentTabs active="monthly" countMap={await getPaymentStatusCounts()} />

        {courses.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
            <Inbox className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">No courses are billed monthly.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => (
                <Button
                  key={c.id}
                  asChild
                  size="sm"
                  variant={c.id === selectedId ? "default" : "outline"}
                >
                  <Link href={`?tab=monthly&courseId=${c.id}`}>{c.title}</Link>
                </Button>
              ))}
            </div>

            {result && (
              <>
                <p className="text-muted-foreground text-sm">
                  {result.course.title} ·{" "}
                  {result.course.tuitionFee === null ? (
                    <span className="text-amber-600">
                      No monthly fee set for this course, so months cannot be
                      marked paid or unpaid. Set a tuition fee on the course to
                      enable tracking.
                    </span>
                  ) : (
                    `${peso(result.course.tuitionFee)} / month`
                  )}
                </p>
                <MonthlyMatrixTable
                  matrix={result.matrix}
                  monthlyFee={result.course.tuitionFee}
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }

  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  // `Object.hasOwn`, not `in` or a bare lookup: `?tab=toString` resolves
  // through Object.prototype and would hand a FUNCTION to Prisma as the status
  // filter, which throws a 500 on a URL anyone can type.
  const status: EnrollmentStatus =
    tab !== undefined && Object.hasOwn(STATUS_MAP, tab)
      ? STATUS_MAP[tab]
      : "PENDING";
  const activeTab =
    tab !== undefined && TABS.some((t) => t.value === tab) ? tab : "pending";

  const [rows, countMap] = await Promise.all([
    getAdminPaymentsByStatus(status),
    getPaymentStatusCounts(),
  ]);

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

      <PaymentTabs active={activeTab} countMap={countMap} />

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
                    {r.monthlyLine ?? describeBalance(r.balance)}
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
