"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, Field } from "./Field";
import {
  filterOptions,
  findTypeaheadMatch,
  initialActiveIndex,
  isTypeaheadKey,
  nextTypeahead,
  resolveListKey,
  toggleMulti,
  type SelectOption,
  type TypeaheadState,
} from "./select-logic";

export type { SelectOption } from "./select-logic";

/** Shu sondan ko'p variantda qidiruv maydoni o'zi paydo bo'ladi (`searchable` berilmasa). */
const AUTO_SEARCH_THRESHOLD = 8;
const POPUP_MAX_HEIGHT = 288;
const POPUP_GAP = 4;
const SHEET_QUERY = "(max-width: 639px)";

interface CommonProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  name?: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** `true` — doim, `false` — hech qachon; berilmasa variantlar ko'p bo'lsa. */
  searchable?: boolean;
  /** `label` berilmasa, `aria-label` majburiy. */
  "aria-label"?: string;
  onBlur?: () => void;
  /** React Hook Form `field.ref` shu yerga ulanadi: fokus tugmaga tushadi. */
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}

export interface SelectProps extends CommonProps {
  value: string;
  onChange: (value: string) => void;
  /** Tugma boshidagi ikonka (masalan, til tanlagichdagi globus). */
  icon?: ReactNode;
}

export interface MultiSelectProps extends CommonProps {
  value: string[];
  onChange: (value: string[]) => void;
}

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

function computePosition(anchor: HTMLElement): Position {
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - POPUP_GAP - 8;
  const above = rect.top - POPUP_GAP - 8;
  const flip = below < 200 && above > below;
  const maxHeight = Math.min(POPUP_MAX_HEIGHT, flip ? above : below);
  return flip
    ? {
        left: rect.left,
        width: rect.width,
        maxHeight,
        bottom: window.innerHeight - rect.top + POPUP_GAP,
      }
    : { left: rect.left, width: rect.width, maxHeight, top: rect.bottom + POPUP_GAP };
}

interface PopupProps {
  anchorRef: { current: HTMLElement | null };
  options: SelectOption[];
  selected: string[];
  multi: boolean;
  searchable: boolean;
  sheet: boolean;
  title: ReactNode;
  listboxId: string;
  /** Yopiq tugmada bosilgan harf: ochilishi bilan shu harfga o'tiladi. */
  initialChar?: string;
  onPick: (value: string) => void;
  onClose: (restoreFocus: boolean) => void;
}

function SelectPopup({
  anchorRef,
  options,
  selected,
  multi,
  searchable,
  sheet,
  title,
  listboxId,
  initialChar,
  onPick,
  onClose,
}: PopupProps) {
  const t = useTranslations("ui");
  const reduceMotion = useReducedMotion();
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef<TypeaheadState>({ buffer: "", at: 0 });
  const [query, setQuery] = useState(searchable ? (initialChar ?? "") : "");
  const [position, setPosition] = useState<Position | null>(null);

  const visible = useMemo(() => filterOptions(options, query), [options, query]);
  const [active, setActive] = useState(() => {
    if (searchable) return initialActiveIndex(filterOptions(options, initialChar ?? ""), selected);
    const start = initialActiveIndex(options, selected);
    const match = initialChar
      ? findTypeaheadMatch(options, initialChar.toLocaleLowerCase(), -1)
      : -1;
    return match >= 0 ? match : start;
  });

  // Joylashuv hisoblanguncha yashirin element fokus olmaydi
  const ready = sheet || position !== null;
  useEffect(() => {
    if (!ready) return;
    typeahead.current = {
      buffer: searchable ? "" : (initialChar?.toLocaleLowerCase() ?? ""),
      at: Date.now(),
    };
    (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [ready, searchable, initialChar]);

  useLayoutEffect(() => {
    if (sheet) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const update = () => setPosition(computePosition(anchor));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, sheet]);

  useEffect(() => {
    if (sheet) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchorRef, onClose, sheet]);

  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheet]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, position]);

  const activeId = active >= 0 && active < visible.length ? `${listboxId}-${active}` : undefined;

  function onKeyDown(event: KeyboardEvent) {
    const result = resolveListKey(event.key, { options: visible, active, searching: searchable });
    if (result) {
      if (result.type === "tab") {
        onClose(true);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (result.type === "move") setActive(result.active);
      else if (result.type === "close") onClose(true);
      else if (active >= 0 && visible[active]) onPick(visible[active].value);
      return;
    }
    if (!searchable && isTypeaheadKey(event.nativeEvent)) {
      event.preventDefault();
      const typed = nextTypeahead(typeahead.current, event.key, Date.now());
      typeahead.current = typed;
      const match = findTypeaheadMatch(visible, typed.buffer, active);
      if (match >= 0) setActive(match);
    }
  }

  const duration = reduceMotion ? 0 : 0.14;
  const rowHeight = sheet ? "min-h-12" : "min-h-10";

  const list = (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      tabIndex={searchable ? undefined : -1}
      aria-label={typeof title === "string" ? title : undefined}
      aria-multiselectable={multi || undefined}
      aria-activedescendant={searchable ? undefined : activeId}
      onKeyDown={searchable ? undefined : onKeyDown}
      className="min-h-0 flex-1 overflow-y-auto p-1 focus:outline-none"
    >
      {visible.map((option, index) => {
        const isSelected = selected.includes(option.value);
        return (
          <li
            key={option.value}
            id={`${listboxId}-${index}`}
            role="option"
            data-index={index}
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onPointerMove={() => !option.disabled && active !== index && setActive(index)}
            onClick={() => !option.disabled && onPick(option.value)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
              rowHeight,
              index === active && "bg-subtle",
              isSelected && "text-link font-medium",
              option.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="flex-1">{option.label}</span>
            {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
          </li>
        );
      })}
      {visible.length === 0 && (
        <li role="presentation" className="text-muted px-3 py-3 text-sm">
          {t("select.noResults")}
        </li>
      )}
    </ul>
  );

  const search = searchable && (
    <div className="border-border relative border-b p-2">
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={searchRef}
        type="search"
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label={t("select.search")}
        placeholder={t("select.search")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          const next = filterOptions(options, event.target.value);
          setActive(initialActiveIndex(next, selected));
        }}
        onKeyDown={onKeyDown}
        className="border-border bg-background text-foreground placeholder:text-muted h-10 w-full rounded-md border pr-3 pl-9 text-sm"
      />
    </div>
  );

  if (sheet) {
    return (
      <div className="fixed inset-0 z-[60]">
        <motion.div
          aria-hidden
          className="bg-overlay absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          onClick={() => onClose(true)}
        />
        <motion.div
          ref={popupRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          className="bg-surface border-border absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-lg"
          initial={reduceMotion ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2">
            <p className="text-base font-semibold">{title}</p>
            <button
              type="button"
              onClick={() => onClose(true)}
              aria-label={t("close")}
              className="text-muted hover:bg-subtle hover:text-foreground -m-2 inline-flex size-10 items-center justify-center rounded-lg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {search}
          {list}
          {multi && (
            <div className="border-border border-t p-3">
              <button
                type="button"
                onClick={() => onClose(true)}
                className="bg-primary-600 hover:bg-primary-700 h-12 w-full rounded-lg text-base font-medium text-white"
              >
                {t("select.done")}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={popupRef}
      style={{
        position: "fixed",
        left: position?.left,
        width: position?.width,
        top: position?.top,
        bottom: position?.bottom,
        maxHeight: position?.maxHeight,
        visibility: position ? "visible" : "hidden",
      }}
      className="border-border bg-surface z-[60] flex flex-col overflow-hidden rounded-lg border shadow-lg"
      initial={reduceMotion ? false : { opacity: 0, y: position?.bottom === undefined ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration }}
    >
      {search}
      {list}
    </motion.div>
  );
}

interface BaseProps extends CommonProps {
  multi: boolean;
  selected: string[];
  onPick: (value: string) => void;
  /** Tugmada ko'rinadigan matn; `null` — hech narsa tanlanmagan (placeholder). */
  display: ReactNode | null;
  icon?: ReactNode;
  chips?: ReactNode;
}

function SelectBase({
  multi,
  selected,
  onPick,
  display,
  icon,
  chips,
  label,
  hint,
  error,
  id,
  name,
  options,
  placeholder,
  disabled,
  searchable,
  onBlur,
  ref,
  className,
  ...aria
}: BaseProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listboxId = `${triggerId}-listbox`;
  const t = useTranslations("ui");
  const sheet = useMediaQuery(SHEET_QUERY);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [initialChar, setInitialChar] = useState<string>();
  // Modal <dialog> ichida bo'lsak, popup ham shu yerga qo'yiladi (aks holda dialog uni inert qiladi)
  const [host, setHost] = useState<Element | null>(null);

  const showSearch = searchable ?? options.length > AUTO_SEARCH_THRESHOLD;
  const title = label ?? aria["aria-label"] ?? "";

  function setRefs(node: HTMLButtonElement | null) {
    triggerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  function openPopup(char?: string) {
    if (disabled) return;
    setHost(anchorRef.current?.closest("dialog") ?? document.body);
    setInitialChar(char);
    setOpen(true);
  }

  function closePopup(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function pick(value: string) {
    onPick(value);
    if (!multi) closePopup(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      openPopup();
    } else if (isTypeaheadKey(event.nativeEvent)) {
      event.preventDefault();
      openPopup(event.key);
    }
  }

  const invalid = Boolean(error);

  return (
    <Field id={triggerId} label={label} hint={hint} error={error}>
      <div
        ref={anchorRef}
        data-invalid={invalid || undefined}
        className={cn(
          controlClasses,
          "flex h-auto min-h-10 items-center gap-2 py-1 pr-2",
          "focus-within:border-primary-300 data-[invalid=true]:border-danger",
          disabled && "hover:border-border cursor-not-allowed opacity-50",
          className,
        )}
      >
        {icon && (
          <span className="text-muted flex shrink-0" aria-hidden>
            {icon}
          </span>
        )}
        {chips}
        <button
          ref={setRefs}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(triggerId, { hint, error })}
          aria-label={aria["aria-label"]}
          disabled={disabled}
          onBlur={onBlur}
          onClick={() => (open ? closePopup(false) : openPopup())}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "flex min-h-8 min-w-16 flex-1 cursor-pointer items-center justify-between gap-2 text-left text-sm disabled:cursor-not-allowed",
            display === null && "text-muted",
          )}
        >
          <span className="truncate">{display ?? placeholder ?? " "}</span>
          <ChevronDown
            className={cn("text-muted size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {name &&
          (selected.length > 0 ? selected : [""]).map((value) => (
            <input key={value} type="hidden" name={name} value={value} />
          ))}
      </div>
      {host &&
        createPortal(
          <AnimatePresence>
            {open && (
              <SelectPopup
                key="popup"
                anchorRef={anchorRef}
                options={options}
                selected={selected}
                multi={multi}
                searchable={showSearch}
                sheet={sheet}
                title={title}
                listboxId={listboxId}
                initialChar={initialChar}
                onPick={pick}
                onClose={closePopup}
              />
            )}
          </AnimatePresence>,
          host,
        )}
      <span className="sr-only" aria-live="polite">
        {multi ? t("select.selectedCount", { count: selected.length }) : null}
      </span>
    </Field>
  );
}

/** Bitta qiymat tanlanadigan ro'yxat. `value === ""` — tanlanmagan (yoki bo'sh qiymatli variant). */
export function Select({ value, onChange, icon, options, placeholder, ...props }: SelectProps) {
  const current = options.find((option) => option.value === value);
  return (
    <SelectBase
      {...props}
      options={options}
      placeholder={placeholder}
      multi={false}
      selected={current ? [current.value] : []}
      onPick={onChange}
      display={current ? current.label : null}
      icon={icon}
    />
  );
}

/** Bir nechta qiymat: tanlanganlar chip sifatida ko'rinadi, har birini alohida olib tashlash mumkin. */
export function MultiSelect({ value, onChange, options, ...props }: MultiSelectProps) {
  const t = useTranslations("ui");
  const labels = new Map(options.map((option) => [option.value, option.label]));
  return (
    <SelectBase
      {...props}
      options={options}
      multi
      selected={value}
      onPick={(picked) => onChange(toggleMulti(value, picked, options))}
      display={null}
      chips={value.map((item) => (
        <span
          key={item}
          className="bg-primary-soft text-link inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-3 text-sm font-medium"
        >
          {labels.get(item) ?? item}
          <button
            type="button"
            disabled={props.disabled}
            aria-label={t("select.remove", { label: labels.get(item) ?? item })}
            onClick={() => onChange(value.filter((other) => other !== item))}
            className="hover:bg-primary-200/60 inline-flex size-5 items-center justify-center rounded-full"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
    />
  );
}
