import { Suspense } from "react";
import Link from "next/link";
import { getUsersByRole } from "@/lib/users/queries";
import { TabSwitcher } from "./tab-switcher";
import { UserTable } from "./user-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function UsersPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const activeTab = tab === "teachers" ? "teachers" : "admins";
  const role = activeTab === "admins" ? "ADMIN" : "TEACHER";
  const roleLabel = activeTab === "admins" ? "Admin" : "Teacher";

  const users = await getUsersByRole(role);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Users"
        action={
          <Button asChild>
            <Link href={'/admin/users/new?role=' + role}>New {roleLabel}</Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>
      <UserTable users={users} role={activeTab} />
    </div>
  );
}
