import { ErrorState } from "@/components/layout/ErrorState";

/** Layout (header yoki sidebar) saqlanadi: faqat kontent o'rni almashadi. */
export default function GroupNotFound() {
  return <ErrorState variant="notFound" standalone={false} />;
}
