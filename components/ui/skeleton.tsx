import { cn } from "@/lib/utils"

// A single shimmering placeholder bar. Tinted from muted-foreground rather than
// muted: the app's --muted is a cream barely a shade off white, so bars filled
// with it vanish on the page and completely disappear on a muted table header.
//
// Decorative by design -- loading screens announce themselves once on their
// wrapper, so bars stay out of the accessibility tree instead of reading out as
// a wall of blanks.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted-foreground/15 animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
