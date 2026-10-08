// Marks a kid profile wherever staff see a student, and names the parent. The
// contact shown beside it may be the kid's own (a linked kid with their own
// login) or the parent's, which the surface marks with "(parent)".
export function KidNote({ parentName }: { parentName: string | null }) {
  if (!parentName) return null
  return (
    <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
      <span className="mr-1.5 inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-800 uppercase">
        Kid
      </span>
      Parent: {parentName}
    </span>
  )
}
