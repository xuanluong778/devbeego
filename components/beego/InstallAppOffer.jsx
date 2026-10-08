"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/beego/native-bridge";
import {
  INSTALL_CARD_DISMISS_KEY,
  detectInstallPlatform,
  emptyInstallStatus,
  installOfferModel,
} from "@/lib/beego/install-app";

function formatViDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function isHomeScreenApp() {
  if (typeof window === "undefined") return false;
  if (window.navigator.standalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function IosSteps() {
  return (
    <ol className="beego-install-offer__steps">
      <li>Mở bằng Safari</li>
      <li>Chia sẻ</li>
      <li>Thêm vào Màn hình chính</li>
    </ol>
  );
}

export default function InstallAppOffer({ variant = "card" }) {
  const [platform, setPlatform] = useState(null);
  const [info, setInfo] = useState(null);
  const [hidden, setHidden] = useState(variant === "card");

  useEffect(() => {
    setPlatform(detectInstallPlatform(navigator.userAgent || ""));
    if (variant === "card") {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(INSTALL_CARD_DISMISS_KEY) === "1";
      } catch {
        dismissed = false;
      }
      setHidden(dismissed || isNativeApp() || isHomeScreenApp());
    } else if (variant === "page") {
      setHidden(isNativeApp());
    } else {
      setHidden(false);
    }

    let cancelled = false;
    fetch("/api/app/install", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setInfo(json?.data?.apkAvailable === true ? json.data : emptyInstallStatus());
      })
      .catch(() => {
        if (!cancelled) setInfo(emptyInstallStatus());
      });
    return () => {
      cancelled = true;
    };
  }, [variant]);

  if (variant !== "page" && (hidden || !platform || !info)) return null;
  if (variant === "page" && (!platform || !info)) {
    return (
      <div className="beego-install-offer beego-install-offer--page" aria-busy="true">
        <p className="beego-install-offer__text">Đang tải…</p>
      </div>
    );
  }
  if (variant === "page" && hidden) {
    return (
      <section className="beego-install-offer beego-install-offer--page">
        <p className="beego-install-offer__text">Bạn đang dùng ứng dụng Beego.</p>
      </section>
    );
  }

  const model = installOfferModel(platform, info);
  const showApkButton = model.showApkButton;
  const showComingSoon = model.showComingSoon;

  const dismiss = () => {
    try {
      localStorage.setItem(INSTALL_CARD_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const TitleTag = variant === "page" ? "h1" : "h3";

  return (
    <section
      className={`beego-install-offer beego-install-offer--${variant}`}
      aria-label="Cài ứng dụng Beego"
    >
      <div className="beego-install-offer__brand">
        <img
          src="/icons/beego-192.png"
          alt=""
          width={72}
          height={72}
          className="beego-install-offer__appIcon"
          decoding="async"
        />
        <div className="beego-install-offer__head">
        <TitleTag className="beego-install-offer__title">Cài ứng dụng Beego</TitleTag>
        {variant === "card" ? (
          <button type="button" className="beego-install-offer__dismiss" onClick={dismiss}>
            Đóng
          </button>
        ) : null}
        </div>
      </div>

      {platform === "ios" ? (
        <>
          <p className="beego-install-offer__text">Thêm Beego vào màn hình chính:</p>
          <IosSteps />
        </>
      ) : null}

      {platform === "android" ? (
        <>
          <p className="beego-install-offer__text">Tải và cài Beego trên điện thoại Android.</p>
          {showApkButton ? (
            <ol className="beego-install-offer__steps">
              <li>Bấm <strong>Tải APK</strong> bên dưới</li>
              <li>Mở file vừa tải (thường trong thư mục Tải xuống)</li>
              <li>Cho phép cài từ nguồn này nếu máy hỏi</li>
              <li>Bấm <strong>Cài đặt</strong> và mở Beego</li>
            </ol>
          ) : null}
        </>
      ) : null}

      {platform === "desktop" ? (
        <>
          <p className="beego-install-offer__text">
            Android: {info.apkAvailable ? `phiên bản ${info.version}` : "Sắp ra mắt"}. iPhone: mở
            bằng Safari → Chia sẻ → Thêm vào Màn hình chính.
          </p>
        </>
      ) : null}

      {showApkButton ? (
        <div className="beego-install-offer__actions">
          <a
            className="beego-install-offer__apk"
            href={info.href}
            download={`beego-${info.version || "android"}.apk`}
            rel="noopener"
          >
            Tải APK
          </a>
          <p className="beego-install-offer__meta">
            Phiên bản {info.version} · Cập nhật {formatViDate(info.updatedAt)}
          </p>
        </div>
      ) : null}

      {showComingSoon && platform === "android" ? (
        <p className="beego-install-offer__soon">Sắp ra mắt</p>
      ) : null}
    </section>
  );
}
