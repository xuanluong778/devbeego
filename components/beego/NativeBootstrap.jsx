"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/beego/native-bridge";
import { bindBeegoAudioLifecycle, stopBeegoAudio, unlockBeegoAudio } from "@/lib/beego/audio-player";
import { stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import { stopLessonSfx } from "@/lib/beego/learn/lesson-sfx";
import { initNativePush } from "@/lib/beego/native-push";

/**
 * Capacitor bootstrap: status bar, splash, safe-area class, deep-link listen.
 * No secrets; uses shared API origin https://beego.vn
 */
export default function NativeBootstrap() {
  useEffect(() => {
    // Web + native: unlock + pause audio on background
    const unbindAudio = bindBeegoAudioLifecycle();

    if (!isNativeApp()) {
      return () => {
        unbindAudio();
      };
    }
    document.documentElement.classList.add("beego-native");
    void initNativePush();

    let removeAppState = null;
    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#FFF8E7" });
      } catch {
        /* web */
      }
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        /* web */
      }
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            const hostOk =
              u.hostname === "beego.vn" ||
              u.hostname === "www.beego.vn" ||
              u.protocol === "beego:";
            if (!hostOk) return;
            let path = u.pathname + u.search + u.hash;
            if (u.protocol === "beego:") {
              // beego://open/auth/native-callback?... → /auth/native-callback?...
              path = `/${u.host}${u.pathname}`.replace(/^\/open/, "") + u.search + u.hash;
              if (!path.startsWith("/")) path = `/${path}`;
            }
            if (path && path !== `${window.location.pathname}${window.location.search}`) {
              window.location.href = path.startsWith("/") ? path : `/${path}`;
            }
          } catch {
            /* ignore */
          }
        });
        const sub = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) {
            stopBeegoAudio();
            stopLessonTts();
            stopLessonSfx();
          } else unlockBeegoAudio();
        });
        removeAppState = () => {
          try {
            sub?.remove?.();
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* plugin missing */
      }
    })();

    return () => {
      unbindAudio();
      removeAppState?.();
      stopBeegoAudio();
    };
  }, []);

  return null;
}
