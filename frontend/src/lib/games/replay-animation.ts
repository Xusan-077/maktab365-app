/** CSS animatsiyani boshidan qo'yadi (klass qayta qo'shiladi, reflow bilan). */
export function replayAnimation(
  element: HTMLElement | null,
  className: string,
  ...others: string[]
) {
  if (!element) return;
  element.classList.remove(className, ...others);
  void element.offsetWidth;
  element.classList.add(className);
}
