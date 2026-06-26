"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function MarketSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const applySearch = useCallback(
    (nextValue: string, mode: "push" | "replace" = "push") => {
      const query = nextValue.trim();
      const params = new URLSearchParams(searchParams.toString());

      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `/?${queryString}` : "/";

      if (mode === "replace" && pathname === "/") {
        router.replace(targetUrl, { scroll: false });
      } else {
        router.push(targetUrl, { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (pathname !== "/") return;

    const timeout = window.setTimeout(() => {
      applySearch(value, "replace");
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [applySearch, pathname, value]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch(value, "push");
  };

  const clearSearch = () => {
    setValue("");
    applySearch("", "replace");
  };

  return (
    <form
      className="relative w-full max-w-[420px]"
      onSubmit={submitSearch}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF8A00]" />

      <input
        aria-label="Search ARCM markets"
        className="focus-ring h-10 w-full rounded-lg border border-[#2B3139] bg-[#1E2329] pl-10 pr-10 text-sm font-medium text-[#EAECEF] outline-none transition placeholder:text-[#707A8A] hover:border-[#3A424D] focus:border-[#FF8A00]"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search ARCM markets"
        type="search"
        value={value}
      />

      {value ? (
        <button
          aria-label="Clear market search"
          className="focus-ring absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#707A8A] transition hover:bg-[#2B3139] hover:text-[#EAECEF]"
          onClick={clearSearch}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </form>
  );
}
