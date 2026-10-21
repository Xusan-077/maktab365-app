const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin API id'lari UUID; URL'dagi qiymat boshqa shaklda bo'lsa so'rov yuborilmaydi (404). */
export const isUuid = (value: string | undefined): value is string =>
  typeof value === "string" && UUID.test(value);
