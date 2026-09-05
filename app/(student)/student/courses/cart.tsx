"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BookOpen, Check, ChevronDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchasableCourse } from "@/lib/purchases/queries";
import { groupCourses } from "@/lib/courses/grouping";
import { priceSuffix } from "@/lib/courses/format";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
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
  const entries = groupCourses(filtered);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Browse Programs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select one or more programs.
          </p>
        </div>
        <Button
          onClick={checkout}
          disabled={selected.size === 0}
          className="shrink-0"
        >
          Proceed to payment ({selected.size})
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
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              typeFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No courses available to purchase right now.
        </p>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => {
            if (entry.kind === "group") {
              const { groupName, slug, levels } = entry;
              const isOpen = expanded.has(slug);
              const selectedCount = levels.filter((l) =>
                selected.has(l.id),
              ).length;
              const cover = levels.find(
                (l) => l.imageUrl && /^https?:\/\//.test(l.imageUrl),
              );
              const prices = levels
                .map((l) => l.tuitionFee)
                .filter((f): f is number => f != null);
              const minPrice = prices.length ? Math.min(...prices) : null;
              return (
                <div
                  key={slug}
                  className={[
                    "flex flex-col overflow-hidden rounded-xl border-2 transition-colors",
                    selectedCount > 0
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <div className="bg-muted relative h-72 w-full">
                    {cover ? (
                      <Image
                        src={cover.imageUrl!}
                        alt={groupName}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                        <Layers className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                    <span className="bg-gold text-gold-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      Multiple Levels
                    </span>
                    {selectedCount > 0 && (
                      <div className="bg-primary text-primary-foreground absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold shadow">
                        {selectedCount}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-foreground font-semibold">{groupName}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {levels.length} levels available
                      {selectedCount > 0 && ` • ${selectedCount} selected`}
                    </p>
                    <p className="text-foreground mt-auto pt-2 text-sm font-bold">
                      {minPrice != null ? (
                        <>
                          <span className="text-muted-foreground font-normal">
                            From{" "}
                          </span>
                          ₱{minPrice.toLocaleString("en-PH")}
                        </>
                      ) : (
                        "Contact us for pricing"
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(slug)}
                      aria-expanded={isOpen}
                      className="border-border hover:border-primary/40 mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      {isOpen ? "Hide levels" : "View levels"}
                      <ChevronDown
                        className={[
                          "text-muted-foreground h-4 w-4 transition-transform",
                          isOpen ? "rotate-180" : "",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-border space-y-2 border-t p-3">
                      {levels.map((c) => {
                        const isSel = selected.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggle(c.id)}
                            aria-pressed={isSel}
                            className={[
                              "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                              isSel
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40",
                            ].join(" ")}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="text-foreground block text-sm font-medium">
                                {c.level != null && (
                                  <span className="text-muted-foreground">
                                    Level {c.level} •{" "}
                                  </span>
                                )}
                                {c.title}
                              </span>
                              <span className="text-foreground block text-sm font-bold">
                                {c.tuitionFee != null ? (
                                  <>
                                    ₱{c.tuitionFee.toLocaleString("en-PH")}
                                    {c.paymentFrequency && (
                                      <span className="text-muted-foreground ml-1 font-normal">
                                        {priceSuffix(c.paymentFrequency)}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  "Contact us for pricing"
                                )}
                              </span>
                            </span>
                            <span
                              className={[
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                                isSel
                                  ? "bg-primary text-primary-foreground"
                                  : "border-border border",
                              ].join(" ")}
                            >
                              {isSel && (
                                <Check className="h-4 w-4" aria-hidden="true" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const c = entry.course;
            const isSel = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={isSel}
                className={[
                  "group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors",
                  isSel
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40",
                ].join(" ")}
              >
                <div className="bg-muted relative aspect-video h-72 w-full">
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                      <BookOpen className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  {/* Type badge */}
                  <span
                    className={[
                      "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      c.courseType === "ONLINE"
                        ? "bg-blue-600 text-white"
                        : "bg-amber-600 text-white",
                    ].join(" ")}
                  >
                    {c.courseType === "ONLINE" ? "Online" : "On-Site"}
                  </span>
                  {isSel && (
                    <div className="bg-primary text-primary-foreground absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full shadow">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-foreground font-semibold">{c.title}</p>
                  {c.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {c.description}
                    </p>
                  )}
                  <p className="text-foreground mt-auto pt-2 text-sm font-bold">
                    {c.tuitionFee != null ? (
                      <>
                        ₱{c.tuitionFee.toLocaleString("en-PH")}
                        {c.paymentFrequency && (
                          <span className="text-muted-foreground ml-1 font-normal">
                            {priceSuffix(c.paymentFrequency)}
                          </span>
                        )}
                      </>
                    ) : (
                      "Contact us for pricing"
                    )}
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
