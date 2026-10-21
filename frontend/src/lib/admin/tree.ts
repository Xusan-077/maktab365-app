import type { AdminChapter, AdminTopicItem, ReorderInput } from "./types";

export interface TreeChapter {
  id: string;
  slug: string;
  title: AdminChapter["title"];
  topics: AdminTopicItem[];
}

/** Server ma'lumotidan daraxt: boblar `order`, mavzular bob ichida `order` bo'yicha. */
export function buildTree(chapters: AdminChapter[], topics: AdminTopicItem[]): TreeChapter[] {
  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => ({
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      topics: topics.filter((t) => t.chapter === chapter.id).sort((a, b) => a.order - b.order),
    }));
}

function moveWithin<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(to, items.length - 1));
  if (from === target) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Bobni `toIndex` o'ringa ko'chiradi (o'zgarmasa o'sha massiv qaytadi). */
export function moveChapter(
  tree: TreeChapter[],
  chapterId: string,
  toIndex: number,
): TreeChapter[] {
  return moveWithin(
    tree,
    tree.findIndex((c) => c.id === chapterId),
    toIndex,
  );
}

/** Mavzuni `toChapterId` bobining `toIndex` o'ringa ko'chiradi (boshqa bobga ham mumkin). */
export function moveTopic(
  tree: TreeChapter[],
  topicId: string,
  toChapterId: string,
  toIndex: number,
): TreeChapter[] {
  const source = tree.find((c) => c.topics.some((t) => t.id === topicId));
  const target = tree.find((c) => c.id === toChapterId);
  if (!source || !target) return tree;
  const topic = source.topics.find((t) => t.id === topicId)!;

  if (source.id === target.id) {
    const topics = moveWithin(source.topics, source.topics.indexOf(topic), toIndex);
    return topics === source.topics
      ? tree
      : tree.map((c) => (c.id === source.id ? { ...c, topics } : c));
  }
  return tree.map((c) => {
    if (c.id === source.id) return { ...c, topics: c.topics.filter((t) => t.id !== topicId) };
    if (c.id !== target.id) return c;
    const topics = [...c.topics];
    topics.splice(Math.max(0, Math.min(toIndex, topics.length)), 0, { ...topic, chapter: c.id });
    return { ...c, topics };
  });
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);
const sameIds = (a: { id: string }[], b: { id: string }[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

/**
 * `before` → `after` o'zgarishidan reorder so'rovi: bob tartibi o'zgargan bo'lsa `chapters`,
 * tarkibi yoki tartibi o'zgargan boblar uchungina `topics`. O'zgarish yo'q bo'lsa `null`.
 */
export function diffToReorder(before: TreeChapter[], after: TreeChapter[]): ReorderInput | null {
  const input: ReorderInput = {};
  if (!sameIds(before, after)) input.chapters = ids(after);
  const topics: Record<string, string[]> = {};
  for (const chapter of after) {
    const old = before.find((c) => c.id === chapter.id);
    if (!old || !sameIds(old.topics, chapter.topics)) topics[chapter.id] = ids(chapter.topics);
  }
  if (Object.keys(topics).length > 0) input.topics = topics;
  return input.chapters || input.topics ? input : null;
}
