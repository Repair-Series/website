import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { slugify } from "@/lib/catalog/slug";

type NamedDoc = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
};

function matchesPath(docRow: NamedDoc, pathSegment: string): boolean {
  const seg = String(pathSegment ?? "").trim().toLowerCase();
  if (!seg) return false;
  if (docRow.id.toLowerCase() === seg) return true;
  const slug = String(docRow.slug ?? "").trim().toLowerCase();
  if (slug && slug === seg) return true;
  const name = String(docRow.name ?? docRow.title ?? "").trim();
  if (name && slugify(name) === seg) return true;
  return false;
}

async function resolveFromCollection<T extends NamedDoc>(
  db: Firestore,
  collectionName: string,
  pathSegment: string,
): Promise<T | null> {
  const seg = String(pathSegment ?? "").trim();
  if (!seg) return null;

  const byId = await getDoc(doc(db, collectionName, seg));
  if (byId.exists()) {
    return { id: byId.id, ...(byId.data() as Record<string, unknown>) } as T;
  }

  const col = collection(db, collectionName);
  const slugQ = query(col, where("slug", "==", seg));
  const slugSnap = await getDocs(slugQ);
  if (!slugSnap.empty) {
    const d = slugSnap.docs[0];
    return { id: d.id, ...(d.data() as Record<string, unknown>) } as T;
  }

  const allSnap = await getDocs(col);
  for (const d of allSnap.docs) {
    const row = { id: d.id, ...(d.data() as Record<string, unknown>) } as T;
    if (matchesPath(row, seg)) return row;
  }

  return null;
}

export async function resolveServiceByPath(
  db: Firestore,
  pathSegment: string,
) {
  return resolveFromCollection<NamedDoc & { image?: string; imageUrl?: string }>(
    db,
    "services",
    pathSegment,
  );
}

export async function resolveCategoryByPath(
  db: Firestore,
  pathSegment: string,
) {
  return resolveFromCollection<NamedDoc & { icon?: string; image?: string }>(
    db,
    "categories",
    pathSegment,
  );
}
