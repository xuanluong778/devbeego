"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuthMe } from "@/hooks/useAuthMe";

const PaywallModal = dynamic(() => import("./PaywallModal"), { ssr: false });

const PaywallContext = createContext(null);

export function PaywallProvider({ children }) {
  const { hideBillingUi } = useAuthMe();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");

  const openPaywall = useCallback(
    (input) => {
      if (hideBillingUi) return;
      if (typeof input === "string") {
        setMessage(input || "");
        setSource("");
      } else if (input && typeof input === "object") {
        setMessage(typeof input.message === "string" ? input.message : "");
        setSource(typeof input.source === "string" ? input.source : "");
      } else {
        setMessage("");
        setSource("");
      }
      setOpen(true);
    },
    [hideBillingUi]
  );

  const closePaywall = useCallback(() => {
    setOpen(false);
    setMessage("");
    setSource("");
  }, []);

  const value = useMemo(() => ({ openPaywall, closePaywall, hideBillingUi }), [openPaywall, closePaywall, hideBillingUi]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      {!hideBillingUi ? (
        <PaywallModal open={open} onClose={closePaywall} message={message} source={source} />
      ) : null}
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    return {
      openPaywall: () => {},
      closePaywall: () => {},
      hideBillingUi: false,
    };
  }
  return ctx;
}
