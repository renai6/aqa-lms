"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchasableCourse } from "@/lib/purchases/queries";

type TypeFilter = "ALL" | "ON_SITE" | "ONLINE";

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "On-Site", value: "ON_SITE" },
  { label: "Online", value: "ONLINE" },
];

export function CourseCart({ courses }: { courses: PurchasableCourse[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function checkout() {
    const ids = [...selected];
    if (ids.length === 0) return;
    router.push(`/student/checkout?ids=${ids.join(",")}`);
  }

  const filtered =
    typeFilter === "ALL"
      ? courses
      : courses.filter((c) => c.courseType === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Browse Courses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Select one or more courses to purchase.
          </p>
        </div>
        <Button
          onClick={checkout}
          disabled={selected.size === 0}
          className="shrink-0"
        >
          Proceed to checkout ({selected.size})
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setTypeFilter(f.value)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium border transition-colors",
              typeFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No courses available to purchase right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => {
            const isSel = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={isSel}
                className={[
                  "group flex flex-col overflow-hidden text-left rounded-xl border-2 transition-colors",
                  isSel
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40",
                ].join(" ")}
              >
                <div className="relative h-72 aspect-video w-full bg-muted">
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <BookOpen className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  {/* Type badge */}
                  <span
                    className={[
                      "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full",
                      c.courseType === "ONLINE"
                        ? "bg-blue-600 text-white"
                        : "bg-amber-600 text-white",
                    ].join(" ")}
                  >
                    {c.courseType === "ONLINE" ? "Online" : "On-Site"}
                  </span>
                  {isSel && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-semibold text-foreground">{c.title}</p>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-auto pt-2 text-sm font-bold text-foreground">
                    {c.tuitionFee != null
                      ? `₱${c.tuitionFee.toLocaleString("en-PH")}`
                      : "Contact us for pricing"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
