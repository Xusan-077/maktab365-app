import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MainNav } from "./MainNav";
import { PanelSearch } from "./PanelSearch";
import { TextSizeControl } from "./TextSizeControl";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function SiteHeader() {
  return (
    <header className="border-border bg-background present:hidden sticky top-0 z-40 border-b print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <MainNav />
        <div className="ml-auto flex items-center gap-2">
          <PanelSearch />
          <LanguageSwitcher className="hidden lg:inline-flex" />
          <TextSizeControl className="hidden lg:inline-flex" />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
