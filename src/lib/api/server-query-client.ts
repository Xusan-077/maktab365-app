import { cache } from "react";
import { createQueryClient } from "./query-client";

/** So'rov (request) ichida bitta QueryClient; server komponentlarda prefetch uchun. */
export const getServerQueryClient = cache(createQueryClient);
