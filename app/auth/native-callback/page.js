import { Suspense } from "react";
import NativeAuthCallbackPage from "./NativeAuthCallbackClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 48, textAlign: "center" }}>Đang tải…</main>}>
      <NativeAuthCallbackPage />
    </Suspense>
  );
}
