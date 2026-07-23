import lookbooksData from "@/data/lookbooks.json";
import type { Lookbook } from "@/types";

const lookbooks = lookbooksData as Lookbook[];

export async function getAllLookbooks(): Promise<Lookbook[]> {
  return lookbooks;
}

export async function getLookbookBySlug(slug: string): Promise<Lookbook | undefined> {
  return lookbooks.find((l) => l.slug === slug);
}
