import { Suspense } from "react";
import { getUsersByRole } from "@/lib/users/queries";
import { TabSwitcher } from "./tab-switcher";
import { UserTable } from "./user-table";
import { CreateUserForm } from "./create-user-form";
import { PageHeader } from "@/components/admin/page-header";

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
      <PageHeader title="Users" />
      <Suspense fallback={null}>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>
      <UserTable users={users} role={activeTab} />
      <CreateUserForm role={role} roleLabel={roleLabel} />
    </div>
  );
}
