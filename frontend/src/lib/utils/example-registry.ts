/** Sahifadagi bitta "yechilgan misol"ni klaviatura/tugma bilan boshqarish uchun qo'li. */
export interface ExampleHandle {
  /** Sahifadagi tartibni aniqlash uchun (yo'q bo'lsa, ro'yxatga olingan tartib). */
  element: Element | null;
  hasNext: () => boolean;
  hasPrevious: () => boolean;
  /** Keyingi qadamni ochadi. */
  next: () => void;
  /** Oxirgi ochilgan qadamni yashiradi. */
  previous: () => void;
}

const handles = new Set<ExampleHandle>();

/** Misolni ro'yxatga oladi; qaytgan funksiya ro'yxatdan chiqaradi. */
export function registerExample(handle: ExampleHandle): () => void {
  handles.add(handle);
  return () => {
    handles.delete(handle);
  };
}

function inPageOrder(): ExampleHandle[] {
  return [...handles].sort((a, b) => {
    if (!a.element || !b.element) return 0;
    return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/** Sahifadagi birinchi tugallanmagan misolning keyingi qadamini ochadi. Ochilgan bo'lsa `true`. */
export function revealNextStep(): boolean {
  const target = inPageOrder().find((handle) => handle.hasNext());
  target?.next();
  return Boolean(target);
}

/** Oxirgi ochilgan qadamni yashiradi (sahifadagi eng pastki misoldan boshlab). Yashirilgan bo'lsa `true`. */
export function hidePreviousStep(): boolean {
  const target = inPageOrder()
    .reverse()
    .find((handle) => handle.hasPrevious());
  target?.previous();
  return Boolean(target);
}
