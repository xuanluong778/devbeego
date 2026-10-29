"use client";

import { useEffect, useRef } from "react";

const READ_SRC = "/uploads/mascots/beego-gau-doc-sach.html?embed=1&bridge=auto";
const CLAP_SRC = "/uploads/mascots/beego-gau-vo-tay-trai-tim.html";
const SIGH_SRC = "/uploads/mascots/beego-gau-tho-dai-vo-tran.html";

const BEAR = {
  correct: { src: CLAP_SRC, title: "Gấu vỗ tay", className: "beego-lesson-bear beego-lesson-bear--celebrate" },
  wrong: { src: SIGH_SRC, title: "Gấu thở dài", className: "beego-lesson-bear beego-lesson-bear--sigh" },
  read: { src: READ_SRC, title: "Gấu Beego", className: "beego-lesson-bear" },
};

/**
 * Reading bear while the activity is open.
 * After Kiểm tra, a correct result swaps in the clapping bear and a wrong result swaps in the sighing bear.
 * The reading file follows existing lesson audio. This component does not start a second voice.
 */
export default function LessonListenBear({ mood = "read" }) {
  const frameRef = useRef(null);
  const bear = BEAR[mood] || BEAR.read;
  const src = bear.src;

  useEffect(() => {
    const frame = frameRef.current;
    return () => {
      try {
        if (frame) frame.src = "about:blank";
      } catch {
        /* The frame is already detached. */
      }
    };
  }, []);

  return (
    <div className={bear.className}>
      <iframe
        ref={frameRef}
        className="beego-lesson-bear__frame"
        src={src}
        title={bear.title}
      />
    </div>
  );
}
