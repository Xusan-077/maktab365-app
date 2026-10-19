"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { array, object, string } from "yup";
import { Button } from "@/components/ui/Button";
import { MultiSelect, Select } from "@/components/ui/Select";

const LONG_LIST_SIZE = 14;

const schema = object({
  single: string().required("required"),
  multi: array().of(string().required()).min(1, "required").required(),
});
type FormValues = { single: string; multi: string[] };

/** Select/MultiSelect namunalari: oddiy, qidiruvli, o'chirilgan, xatoli va RHF + Yup (Controller). */
export function SelectDemos() {
  const t = useTranslations("dev");
  const [one, setOne] = useState("");
  const [many, setMany] = useState<string[]>(["2"]);
  const [long, setLong] = useState("3");

  const short = useMemo(
    () => [
      { value: "1", label: t("selectOne") },
      { value: "2", label: t("selectTwo") },
      { value: "3", label: t("selectDisabledOption"), disabled: true },
    ],
    [t],
  );
  const longList = useMemo(
    () =>
      Array.from({ length: LONG_LIST_SIZE }, (_, index) => ({
        value: String(index + 1),
        label: t("selectOption", { n: index + 1 }),
      })),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema) as never,
    defaultValues: { single: "", multi: [] },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("selectSingle")}
          hint={t("sampleHint")}
          placeholder={t("selectPlaceholder")}
          options={short}
          value={one}
          onChange={setOne}
        />
        <Select label={t("selectSearchable")} options={longList} value={long} onChange={setLong} />
        <MultiSelect
          label={t("selectMulti")}
          placeholder={t("selectPlaceholder")}
          options={longList}
          value={many}
          onChange={setMany}
        />
        <Select
          label={t("selectDisabled")}
          options={short}
          value="1"
          onChange={() => {}}
          disabled
        />
        <Select
          label={t("selectError")}
          placeholder={t("selectPlaceholder")}
          options={short}
          value=""
          onChange={() => {}}
          error={t("sampleError")}
        />
      </div>

      <form
        noValidate
        onSubmit={handleSubmit(() => {})}
        className="border-border flex flex-col gap-4 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">{t("selectForm")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="single"
            render={({ field }) => (
              <Select
                ref={field.ref}
                name={field.name}
                label={t("selectSingle")}
                placeholder={t("selectPlaceholder")}
                options={short}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.single && t("sampleError")}
              />
            )}
          />
          <Controller
            control={control}
            name="multi"
            render={({ field }) => (
              <MultiSelect
                ref={field.ref}
                name={field.name}
                label={t("selectMulti")}
                placeholder={t("selectPlaceholder")}
                options={longList}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.multi && t("sampleError")}
              />
            )}
          />
        </div>
        <div>
          <Button type="submit">{t("selectSubmit")}</Button>
        </div>
      </form>
    </div>
  );
}
