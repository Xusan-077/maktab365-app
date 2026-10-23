"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Select } from "@/components/ui/Select";
import { getAdminApi } from "@/lib/admin/api";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import type { AdminUser, AdminUserCreated, UserRole } from "@/lib/admin/types";
import { USER_ROLES } from "@/lib/admin/user-params";
import { createUserSchema } from "@/lib/validation/admin";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface UserFormValues {
  email: string;
  display_name: string;
  password: string;
  role: UserRole;
}

function useRoleOptions() {
  const t = useTranslations("admin.roles");
  return USER_ROLES.map((role) => ({ value: role, label: t(role) }));
}

function CreateUserForm({
  onDone,
  onCreated,
}: {
  onDone: () => void;
  onCreated: (user: AdminUserCreated) => void;
}) {
  const t = useTranslations("admin.users.create");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const ta = useTranslations("authForm");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const roleOptions = useRoleOptions();
  const schema = useMemo(() => createUserSchema(), []);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<UserFormValues>,
    defaultValues: { email: "", display_name: "", password: "", role: "student" },
  });

  const create = useMutation({
    mutationFn: (values: UserFormValues) =>
      getAdminApi().createUser({
        email: values.email,
        role: values.role,
        display_name: values.display_name || undefined,
        password: values.password || undefined,
      }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      onCreated(user);
    },
  });

  const emailError = errors.email?.message
    ? tv(errors.email.message)
    : fieldErrorText(create.error, "email");
  const passwordError = errors.password?.message
    ? tv(errors.password.message)
    : fieldErrorText(create.error, "password");
  const fieldFailed = Boolean(emailError || passwordError);

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => create.mutate(values))}
      className="flex flex-col gap-4"
      data-testid="user-form"
    >
      <Input
        label={t("email")}
        type="email"
        autoComplete="off"
        error={emailError}
        {...register("email")}
      />
      <Input
        label={t("name")}
        autoComplete="off"
        error={errors.display_name?.message ? tv(errors.display_name.message) : undefined}
        {...register("display_name")}
      />
      <PasswordInput
        label={t("password")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        showLabel={ta("showPassword")}
        hideLabel={ta("hidePassword")}
        error={passwordError}
        {...register("password")}
      />
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <Select
            label={t("role")}
            value={field.value}
            options={roleOptions}
            searchable={false}
            onChange={(value) => field.onChange(value)}
          />
        )}
      />
      {create.isError && !fieldFailed && (
        <p role="alert" className="text-danger text-sm">
          {errorText(create.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {tc("create")}
        </Button>
      </div>
    </form>
  );
}

/** Bir martalik vaqtinchalik parol: faqat yaratilgan javobda keladi, keyin ko'rsatib bo'lmaydi. */
function TemporaryPassword({ user, onDone }: { user: AdminUserCreated; onDone: () => void }) {
  const t = useTranslations("admin.users.create");
  const tc = useTranslations("admin.common");
  const [copied, setCopied] = useState(false);
  const password = user.temporary_password ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard ruxsati yo'q: parol maydonda ko'rinib turibdi, qo'lda ko'chiriladi.
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="user-created">
      <p className="text-sm">{t("createdText", { email: user.email ?? "" })}</p>
      {password && (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={password}
              aria-label={t("temporaryPassword")}
              onFocus={(event) => event.currentTarget.select()}
              className="border-border bg-subtle h-10 min-w-0 flex-1 rounded-lg border px-3 font-mono text-sm"
            />
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
          <p className="text-muted text-sm">{t("temporaryPasswordNote")}</p>
        </>
      )}
      <div className="flex justify-end">
        <Button onClick={onDone}>{tc("done")}</Button>
      </div>
    </div>
  );
}

/** Foydalanuvchi qo'shish; vaqtinchalik parol yaratilgan bo'lsa, natija shu dialogda ko'rsatiladi. */
export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.users.create");
  const [created, setCreated] = useState<AdminUserCreated | null>(null);
  const close = () => {
    onOpenChange(false);
    setCreated(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t(created ? "createdTitle" : "title")}
    >
      {/* Yopilganda forma holati tozalansin: faqat ochiq bo'lganda chiziladi. */}
      {open &&
        (created ? (
          <TemporaryPassword user={created} onDone={close} />
        ) : (
          <CreateUserForm onDone={close} onCreated={setCreated} />
        ))}
    </Dialog>
  );
}

/** Rolni o'zgartirish: tanlov va tasdiqlash bitta dialogda. */
export function RoleDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const t = useTranslations("admin.users.role");
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()} title={t("title")}>
      {user && <RoleForm key={user.id} user={user} onClose={onClose} />}
    </Dialog>
  );
}

function RoleForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const t = useTranslations("admin.users.role");
  const tr = useTranslations("admin.roles");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const roleOptions = useRoleOptions();
  const [role, setRole] = useState<UserRole>(user.role);

  const save = useMutation({
    mutationFn: () => getAdminApi().updateUser(user.id, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      onClose();
    },
  });

  return (
    <div className="flex flex-col gap-4" data-testid="role-form">
      <p className="text-muted text-sm">
        {t("description", { email: user.email ?? "", role: tr(user.role) })}
      </p>
      <Select
        label={t("label")}
        value={role}
        options={roleOptions}
        searchable={false}
        onChange={(value) => setRole(value as UserRole)}
      />
      {save.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button
          loading={save.isPending}
          disabled={role === user.role}
          onClick={() => save.mutate()}
        >
          {t("confirm", { role: tr(role) })}
        </Button>
      </div>
    </div>
  );
}
