import { MARKETING_CONTAINER } from "@/components/layout/containers";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function Loading() {
  return (
    <div className={`${MARKETING_CONTAINER} py-8`}>
      <PageSkeleton />
    </div>
  );
}
