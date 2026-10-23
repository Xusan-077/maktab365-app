import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { PanelSearch } from "./PanelSearch";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/** Yupqa topbar: qidiruv, til, theme, avatar. Mobilda chapda logo belgisi (sidebar yo'q). */
export function AppTopbar() {
  return (
    <header
      data-app-topbar
      className="border-border bg-background present:hidden sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 sm:px-6 print:hidden"
    >
      <Logo variant="mark" height={22} className="lg:hidden" />
      <div className="ml-auto flex items-center gap-2">
        <PanelSearch />
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <ThemeToggle />
        <UserMenu variant="panel" />
      </div>
    </header>
  );
}
