"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: "popup";
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

const googleOf = () => (window as unknown as { google?: GoogleIdentity }).google;

function loadGsi(): Promise<void> {
  if (googleOf()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("gsi")), { once: true });
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * Kirgan foydalanuvchiga Google'ni ulash: Google Identity Services tugmasi `id_token` beradi
 * (yangi sessiya ochilmaydi), token backend'ga `/me/identities/google/` orqali boradi.
 */
export function GoogleLinkButton({
  clientId,
  onCredential,
  onError,
}: {
  clientId: string;
  onCredential: (idToken: string) => void;
  onError: () => void;
}) {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  }, [onCredential, onError]);

  useEffect(() => {
    let active = true;
    loadGsi()
      .then(() => {
        const google = googleOf();
        if (!active || !google || !host.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => handlers.current.onCredential(credential),
        });
        google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          locale,
        });
      })
      .catch(() => {
        if (active) handlers.current.onError();
      });
    return () => {
      active = false;
    };
  }, [clientId, locale]);

  return <div ref={host} data-testid="google-link" className="min-h-10" />;
}
