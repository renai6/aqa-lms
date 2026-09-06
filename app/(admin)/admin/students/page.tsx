// app/(admin)/admin/students/page.tsx
import { Suspense } from "react";
import { type Gender } from "@prisma/client";
import { getStudentsPage, STUDENTS_PAGE_SIZE } from "@/lib/students/queries";
import { getCourseOptions } from "@/lib/courses/queries";
import { pageHref } from "@/lib/pagination";
import { PageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { FilterBar } from "./filter-bar";
import { StudentTable } from "./student-table";

type Props = {
  searchParams: Promise<{ course?: string; gender?: string; page?: string }>;
};

export const metadata = { title: "Students — AQA Admin" };

export default async function StudentsPage({ searchParams }: Props) {
  const { course, gender, page } = await searchParams;

  const validGender =
    gender === "MALE" || gender === "FEMALE" ? (gender as Gender) : undefined;

  // The filters that travel on every link out of this page. The page number is
  // not one of them: changing a filter restarts at page 1.
  const filters = { course, gender: validGender };

  const [result, courses] = await Promise.all([
    getStudentsPage(
      { courseId: course, gender: validGender },
      Number(page) || 1,
    ),
    getCourseOptions(),
  ]);

  // Exports the whole filtered roster, never just the page on screen.
  const exportHref = pageHref("/api/admin/students/export", filters, 1);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Students" />
      <Suspense fallback={null}>
        <FilterBar
          courses={courses}
          currentCourse={course}
          currentGender={gender}
          exportHref={exportHref}
        />
      </Suspense>
      <StudentTable students={result.students} courseId={course} />
      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={STUDENTS_PAGE_SIZE}
        hrefFor={(p) => pageHref("/admin/students", filters, p)}
        noun="students"
      />
    </div>
  );
}
