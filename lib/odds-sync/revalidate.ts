import { revalidatePath } from "next/cache";

export function revalidateOddsSyncPaths() {
  revalidatePath("/r/[code]/dashboard", "page");
  revalidatePath("/r/[code]/admin", "page");
  revalidatePath("/r/[code]/match/[id]", "page");
}
