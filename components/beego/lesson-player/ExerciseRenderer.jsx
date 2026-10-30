"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LessonListenBear from "./LessonListenBear";
import AnswerOption from "./AnswerOption";
import MatchPairsExercise from "./MatchPairsExercise";
import PassageReadExercise from "./PassageReadExercise";
import ListenDictationExercise from "./ListenDictationExercise";
import TranslationAnswer from "./TranslationAnswer";
import WordBankAnswer from "./WordBankAnswer";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import { stopLessonSfx } from "@/lib/beego/learn/lesson-sfx";
import {
  isSpeechRecognitionSupported,
  startLessonSpeechCapture,
} from "@/lib/beego/learn/adapters/lesson-speech";
import { scoreSpeakingAttempt } from "@/lib/beego/learn/exercise-check";
import LessonAiConversation from "./LessonAiConversation";
import { SUPPORTED_EXERCISE_TYPES } from "@/lib/beego/learn/normalize-lesson-exercises";
import { resolveLessonOptionVisualPolicy } from "@/lib/beego/learn/lesson-option-visual-policy";
import { isPictureListeningExercise } from "@/lib/beego/learn/listen-picture-choice";
import { LISTEN_FILL_SLOW_RATE, listenFillPlaybackIssue } from "@/lib/beego/learn/listen-fill";
import { visibleDialogueTurns } from "@/lib/beego/learn/dialogue-response";
import { buildWordMarks } from "@/lib/client-pronunciation-eval";

function ActivityBadge({ activityType }) {
  if (!activityType) return null;
  return (
    <p className="beego-lesson-question__activity" data-activity={activityType}>
      Hoạt động: {activityType.replace(/_/g, " ")}
    </p>
  );
}

function ChoiceExercise({
  exercise,
  answer,
  onAnswerChange,
  feedback,
  layout,
  revealCorrectId,
  showOptionVisuals = true,
  pictureChoice = false,
  speakEachOption = false,
}) {
  const optionRefs = useRef([]);
  const correctId = revealCorrectId ?? null;
  const options = exercise.options || [];
  const optionState = (id) => {
    if (!feedback) return null;
    if (correctId != null && id === correctId) return "correct";
    if (id === answer && feedback === "wrong") return "wrong";
    if (id === answer && feedback === "correct") return "correct";
    return null;
  };

  const moveSelection = (delta) => {
    if (feedback || !options.length) return;
    const current = options.findIndex((opt) => opt.id === answer);
    const next = current < 0 ? 0 : (current + delta + options.length) % options.length;
    onAnswerChange(options[next].id);
    optionRefs.current[next]?.focus();
  };

  return (
    <div
      className={`beego-lesson-options${
        layout === "grid" ? " beego-lesson-options--grid" : ""
      }`}
      role={pictureChoice ? "radiogroup" : undefined}
      aria-label={pictureChoice ? "Chọn một hình" : undefined}
      onKeyDown={
        pictureChoice
          ? (event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveSelection(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveSelection(-1);
              }
            }
          : undefined
      }
    >
      {options.map((opt, index) => {
        const hasVisual = Boolean(opt?.imageUrl || opt?.imageEmoji);
        // Picture-listen: ẩn từ Anh trước khi chấm; luôn hiện nghĩa Việt (và emoji/ảnh nếu có).
        // Nếu thiếu ảnh/emoji thì không ẩn chữ — tránh ô trống như bug n01.
        const hideEnText = pictureChoice && !feedback && hasVisual;
        const showMeaningVi = pictureChoice && Boolean(opt?.meaningVi);
        const optionProps = {
          option: opt,
          selected: answer === opt.id,
          state: optionState(opt.id),
          onSelect: onAnswerChange,
          layout: layout === "grid" ? "grid" : "default",
          showVisual: showOptionVisuals,
          hideText: hideEnText,
          revealMeaning: showMeaningVi,
          role: pictureChoice ? "radio" : undefined,
          ariaLabel: pictureChoice
            ? `${opt.meaningVi || opt.text || `Lựa chọn ${index + 1}`}${
                feedback && opt.text ? ` (${opt.text})` : ""
              }`.trim()
            : undefined,
          buttonRef: (node) => {
            optionRefs.current[index] = node;
          },
        };
        if (!speakEachOption) {
          return <AnswerOption key={opt.id} {...optionProps} />;
        }
        return (
          <div className="beego-lesson-option-row" key={opt.id}>
            <AnswerOption {...optionProps} />
            <button
              type="button"
              className="beego-lesson-listen-btn"
              aria-label={`Nghe lựa chọn ${index + 1}`}
              onClick={() => playLessonTts({ text: opt.text, lang: "en" })}
            >
              Nghe
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ListeningControls({ exercise, allowSlow = false, showModel = false, showPlaybackError = false }) {
  const text = String(
    exercise.extensions?.gradingTarget ||
      exercise.extensions?.ttsText ||
      exercise.ttsText ||
      exercise.listenText ||
      exercise.extensions?.transcript ||
      exercise.extensions?.audioScript ||
      exercise.audioScript ||
      ""
  ).trim();
  const [playbackError, setPlaybackError] = useState("");
  const [playingRate, setPlayingRate] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const playToken = useRef(0);

  const play = useCallback(
    (rate) => {
      if (!text) return;
      const token = playToken.current + 1;
      playToken.current = token;
      setPlaybackError("");
      setHasPlayed(true);
      setPlayingRate(rate);
      void playLessonTts({ text, url: exercise.audioUrl, lang: exercise.lang || "en", rate }).then((result) => {
        if (playToken.current === token) setPlayingRate(0);
        if (!showPlaybackError || playToken.current !== token) return;
        const issue = listenFillPlaybackIssue(result);
        if (issue) setPlaybackError(issue);
      });
    },
    [exercise.audioUrl, text, exercise.lang, showPlaybackError]
  );

  if (!text) {
    return (
      <div className="beego-lesson-listen-wrap">
        <p className="beego-lesson-question__hint">Thiếu nội dung nghe — báo lỗi nội dung.</p>
      </div>
    );
  }

  return (
    <div className={`beego-lesson-listen-wrap${allowSlow ? " beego-lesson-listen-wrap--tools" : ""}`}>
      <button
        type="button"
        className={`beego-lesson-listen-btn${playingRate === 1 ? " is-playing" : ""}`}
        aria-pressed={playingRate === 1}
        onClick={() => play(1)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path fill="currentColor" d="M4 9.2v5.6h3.6L12 19V5L7.6 9.2H4z" />
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 9.3a3.4 3.4 0 0 1 0 5.4M17.6 7a6 6 0 0 1 0 10" />
        </svg>
        {playingRate === 1 ? "Đang phát" : hasPlayed ? "Nghe lại" : "Nghe"}
      </button>
      {allowSlow ? (
        <button
          type="button"
          className={`beego-lesson-listen-btn${playingRate === LISTEN_FILL_SLOW_RATE ? " is-playing" : ""}`}
          aria-pressed={playingRate === LISTEN_FILL_SLOW_RATE}
          onClick={() => play(LISTEN_FILL_SLOW_RATE)}
        >
          {playingRate === LISTEN_FILL_SLOW_RATE ? "Đang phát chậm" : "Nghe chậm"}
        </button>
      ) : null}
      {showModel ? (
        <button type="button" className="beego-lesson-listen-btn" onClick={() => play(1)}>
          Nghe phát âm mẫu
        </button>
      ) : null}
      {playbackError ? <p className="beego-lesson-question__hint">{playbackError}</p> : null}
      {!allowSlow && exercise.sentenceTemplate ? (
        <p className="beego-lesson-question__hint">{exercise.sentenceTemplate}</p>
      ) : null}
    </div>
  );
}

function SpeakingExercise({ exercise, answer, onAnswerChange, feedback, showMicClock = false }) {
  const gradingMode = String(exercise.extensions?.gradingMode || "");
  const isOpenPrompt = gradingMode === "communicative_rubric" || exercise.extensions?.pendingTeacherReview;
  // Listen-and-repeat: start with speaker only; reveal text + IPA on demand.
  const hideUntilHint = isOpenPrompt
    ? false
    : Boolean(
        exercise.hiddenTextUntilHint ??
          exercise.extensions?.hiddenTextUntilHint ??
          true
      );
  const [recording, setRecording] = useState(false);
  const [micPhase, setMicPhase] = useState("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recordStarted = useRef(0);
  const [status, setStatus] = useState("");
  const [interim, setInterim] = useState("");
  const [heardText, setHeardText] = useState(() => String(answer?.transcript || "").trim());
  const [revealed, setRevealed] = useState(!hideUntilHint);
  const [coach, setCoach] = useState(null);
  const [chunkOn, setChunkOn] = useState("");
  const missesRef = useRef(0);
  const ctrlRef = useRef(null);
  // Never invent "Hello" — open prompts have empty speakTarget on purpose.
  const target = String(
    exercise.speakTarget || exercise.extensions?.speakTarget || ""
  ).trim();
  const speakingHint = String(
    exercise.extensions?.speakingHint ||
      exercise.extensions?.sampleAnswer ||
      exercise.sampleAnswer ||
      ""
  ).trim();
  const focusWords = Array.isArray(exercise.extensions?.focusWords)
    ? exercise.extensions.focusWords.map((w) => String(w || "").trim()).filter(Boolean)
    : [];
  const chunks = Array.isArray(exercise.extensions?.practiceChunks)
    ? exercise.extensions.practiceChunks.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const activeChunk =
    chunkOn && chunks.some((item) => item.toLowerCase() === chunkOn.toLowerCase()) ? chunkOn : "";
  const shownTarget = activeChunk || target;
  const ipa = String(exercise.ipa || exercise.extensions?.ipa || "").trim();
  const meaningVi = String(
    exercise.meaningVi || exercise.extensions?.translation || exercise.extensions?.meaningVi || ""
  ).trim();
  // Keep target visible once spoken (so learner can compare with what they said).
  const showWord =
    !isOpenPrompt && (revealed || Boolean(feedback) || Boolean(heardText) || Boolean(activeChunk));
  const expectedForMic = isOpenPrompt ? speakingHint || focusWords.join(" ") : shownTarget;
  const displayHeard = recording && interim ? interim : heardText;
  const wordMarks =
    !isOpenPrompt && shownTarget && heardText && !recording
      ? buildWordMarks(shownTarget, heardText)
      : [];

  useEffect(() => {
    setHeardText(String(answer?.transcript || "").trim());
    setInterim("");
    setStatus("");
    setRecording(false);
    setMicPhase("idle");
    setElapsedMs(0);
    setRevealed(!hideUntilHint);
    setCoach(null);
    setChunkOn("");
    missesRef.current = 0;
  }, [exercise?.id, hideUntilHint]);

  useEffect(() => {
    if (!showMicClock || !recording) return undefined;
    recordStarted.current = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => setElapsedMs(Date.now() - recordStarted.current), 250);
    return () => clearInterval(timer);
  }, [recording, showMicClock]);

  useEffect(() => {
    const fromAnswer = String(answer?.transcript || "").trim();
    if (fromAnswer && fromAnswer !== heardText && !recording) {
      setHeardText(fromAnswer);
    }
  }, [answer?.transcript, heardText, recording]);

  useEffect(() => {
    return () => {
      try {
        ctrlRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      stopLessonTts();
    };
  }, []);

  const playModel = (text) => {
    const ttsText = String(text || activeChunk || target || speakingHint || "").trim();
    if (!ttsText) return;
    void playLessonTts({ text: ttsText, lang: "en" });
  };

  const startRecord = () => {
    if (feedback) return;
    stopLessonTts();
    stopLessonSfx();
    setStatus("");
    setInterim("");
    setMicPhase("listening");
    setRecording(true);
    try {
      ctrlRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    const ctrl = startLessonSpeechCapture({
      expectedText: expectedForMic,
      onInterim: (partial) => {
        const text = String(partial || "").trim();
        if (text) setInterim(text);
      },
      onResult: (transcript) => {
        setRecording(false);
        setMicPhase("result");
        setInterim("");
        const heard = String(transcript || "").trim();
        // Keep last transcript visible even if empty recognition (show placeholder).
        setHeardText(heard);
        setRevealed(true);
        const scored = scoreSpeakingAttempt(exercise, heard, {
          variantId: exercise.extensions?.reviewVariantId,
          practiceChunk: activeChunk,
        });
        if (!scored.passed && !scored.uncertain && !activeChunk) {
          missesRef.current += 1;
          if (missesRef.current >= 3 && chunks.length) {
            const missed = (scored.focusMissing || []).find((word) =>
              chunks.some((item) => item.toLowerCase() === String(word).toLowerCase())
            );
            setChunkOn(missed || chunks[0]);
          }
        }
        setCoach(scored);
        if (scored.uncertain) {
          setStatus(scored.feedbackVi);
        } else if (scored.notPronunciationAssessment) {
          setStatus(scored.feedbackVi || (scored.passed ? "Đủ từ trọng tâm." : "Hãy luyện từ còn thiếu."));
        } else if (scored.softPass || scored.recordedOnly) {
          setStatus(
            scored.passed
              ? `${scored.feedbackVi || "Đạt yêu cầu từ trọng tâm."} Nhấn Kiểm tra để tiếp tục.`
              : scored.feedbackVi || "Chưa đạt — hãy nói lại theo đề và dùng đủ từ khóa."
          );
        } else {
          setStatus(scored.passed ? `Tốt! (${scored.score}%)` : `Thử lại (${scored.score}%).`);
        }
        onAnswerChange({
          submitted: true,
          passed: scored.passed,
          score: scored.score,
          transcript: heard,
          softPass: Boolean(scored.softPass || scored.recordedOnly),
          feedbackVi: scored.feedbackVi || "",
          focusMissing: scored.focusMissing || [],
          practiceChunk: scored.practiceChunk || "",
          reviewVariantId: exercise.extensions?.reviewVariantId || "",
        });
      },
      onError: (err) => {
        setRecording(false);
        setInterim("");
        const code = String(err?.code || err?.message || "");
        const denied = code === "not-allowed" || code === "service-not-allowed";
        setMicPhase(denied ? "denied" : "error");
        setStatus(
          denied
            ? "Chưa có quyền micro. Hãy cho phép micro rồi thử lại."
            : code === "audio-capture"
              ? "Không tìm thấy micro."
              : "Không dùng được micro. Thử lại."
        );
        // Keep previous heardText so learner still sees what they said before.
        onAnswerChange(null);
      },
    });
    if (!ctrl) {
      setRecording(false);
      setMicPhase("error");
      setStatus("Nhận giọng nói không khả dụng — nghe mẫu và thử lại trên Chrome/Android.");
    } else {
      ctrlRef.current = ctrl;
    }
  };

  return (
    <div className={`beego-lesson-speaking${isOpenPrompt ? " beego-lesson-speaking--open" : ""}`}>
      <div className="beego-lesson-speaking__prompt">
        {isOpenPrompt ? (
          <div className="beego-lesson-speaking__open-card">
            <p className="beego-lesson-speaking__open-hint">
              Nói 3–4 câu ngắn theo tình huống. Máy sẽ kiểm tra bạn có dùng đủ từ trọng tâm
              bên dưới (không chấm phát âm từng âm).
            </p>
            {focusWords.length ? (
              <ul className="beego-lesson-speaking__focus" aria-label="Từ trọng tâm cần dùng">
                {focusWords.map((word) => (
                  <li key={word}>{word}</li>
                ))}
              </ul>
            ) : null}
            {speakingHint ? (
              <button
                type="button"
                className="beego-lesson-speaking__sample"
                onClick={() => playModel()}
                aria-label="Nghe câu gợi ý"
              >
                Gợi ý (đổi chi tiết, đừng chép nguyên): {speakingHint}
              </button>
            ) : null}
          </div>
        ) : showWord ? (
          <button
            type="button"
            className="beego-lesson-listen-word__bubble"
            onClick={() => playModel()}
            aria-label="Nghe mẫu"
            disabled={!shownTarget}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M4 9.2v5.6h3.6L12 19V5L7.6 9.2H4z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 9.3a3.4 3.4 0 0 1 0 5.4" />
            </svg>
            <span className="beego-lesson-listen-word__said">
              {shownTarget || "—"}
              <span className="beego-lesson-listen-word__dots" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="beego-lesson-speaking__speaker-only"
            onClick={() => playModel()}
            aria-label="Nghe mẫu — chữ đang ẩn"
            disabled={!target}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M4 9.2v5.6h3.6L12 19V5L7.6 9.2H4z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 9.3a3.4 3.4 0 0 1 0 5.4" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M17.2 7.2a6 6 0 0 1 0 9.6" />
            </svg>
            <span>Nghe</span>
          </button>
        )}
        {showWord && ipa ? (
          <p className="beego-lesson-speaking__ipa" lang="en-fonipa" aria-label="Phiên âm quốc tế">
            {ipa}
          </p>
        ) : null}
        {showWord && meaningVi ? (
          <p className="beego-lesson-speaking__vi">{meaningVi}</p>
        ) : null}
        {!isOpenPrompt && !showWord ? (
          <button type="button" className="beego-lesson-speaking__reveal" onClick={() => setRevealed(true)}>
            Hiện chữ &amp; phiên âm
          </button>
        ) : null}
      </div>
      <p className="beego-lesson-speaking__phase" role="status">
        {micPhase === "listening"
          ? "Đang nghe"
          : micPhase === "denied"
            ? "Chưa cấp quyền micro"
            : micPhase === "result"
              ? "Đã nhận lời nói"
              : micPhase === "error"
                ? "Micro chưa dùng được"
                : "Sẵn sàng nói"}
      </p>
      {coach && !isOpenPrompt ? (
        <div className="beego-lesson-speaking__coach">
          <p>{coach.feedbackVi}</p>
          {activeChunk ? <p>Đang luyện cụm ngắn: {activeChunk}</p> : null}
          {(coach.focusMissing || []).map((word) => (
            <button
              key={word}
              type="button"
              className="beego-lesson-listen-btn"
              onClick={() => playModel(word)}
            >
              Nghe: {word}
            </button>
          ))}
          <button type="button" className="beego-lesson-listen-btn" onClick={() => playModel()}>
            Nghe mẫu
          </button>
          <button type="button" className="beego-lesson-listen-btn" onClick={startRecord} disabled={recording || !!feedback}>
            Thử lại
          </button>
        </div>
      ) : null}
      {isSpeechRecognitionSupported() ? (
        <button
          type="button"
          className={`beego-lesson-mic beego-lesson-mic--${micPhase}`}
          onClick={startRecord}
          disabled={recording || !!feedback}
          aria-pressed={recording}
        >
          {recording
            ? showMicClock
              ? `Đang nghe ${String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:${String(Math.floor((elapsedMs / 1000) % 60)).padStart(2, "0")}`
              : "Đang nghe…"
            : heardText
              ? "Nói lại"
              : "Bắt đầu nói"}
        </button>
      ) : (
        <p className="beego-lesson-question__hint">
          Micro không hỗ trợ trên trình duyệt này. Nghe mẫu rồi thử lại trên Chrome hoặc Android.
        </p>
      )}
      {displayHeard || recording ? (
        <div
          className={`beego-lesson-speaking__heard${recording ? " is-live" : ""}${
            !recording && heardText && !answer?.passed && status.includes("Thử lại") ? " is-miss" : ""
          }`}
          aria-live="polite"
        >
          <p className="beego-lesson-speaking__heard-label">
            {recording ? "Đang nhận dạng…" : "Bạn vừa nói (giữ lại để so với câu mẫu):"}
          </p>
          {wordMarks.length ? (
            <p className="beego-lesson-speaking__heard-marks" lang="en">
              {wordMarks.map((mark, index) => (
                <span
                  key={`${mark.word}-${index}`}
                  className={`beego-lesson-speaking__mark${mark.ok ? " is-ok" : " is-bad"}`}
                  title={mark.ok ? "Khớp" : `Nghe được: ${mark.spoken || "—"}`}
                >
                  {mark.word}
                </span>
              ))}
            </p>
          ) : null}
          <p className="beego-lesson-speaking__heard-text" lang="en">
            {displayHeard || (recording ? "…" : "(Không nhận được lời nói)")}
          </p>
        </div>
      ) : null}
      {status ? <p className="beego-lesson-speaking__status">{status}</p> : null}
    </div>
  );
}

function StoryPassage({ exercise, feedback, storySupportVi }) {
  const story = exercise.storyText || exercise.extensions?.storyText || "";
  const vi = storySupportVi || "";
  const graded = feedback === "correct" || feedback === "wrong";
  if (!story && !vi) return null;
  return (
    <div className="beego-lesson-story">
      <p className="beego-lesson-story__label">
        {graded ? "Bản dịch hỗ trợ sau khi chấm" : "Lượt đánh giá đọc hiểu. Chưa hiện bản dịch."}
      </p>
      {graded && vi ? <p className="beego-lesson-story__vi">{vi}</p> : null}
      {story ? <p className="beego-lesson-story__en">{story}</p> : null}
    </div>
  );
}

function StoryExercise({
  exercise,
  answer,
  onAnswerChange,
  feedback,
  revealCorrectId,
  showOptionVisuals,
  choiceLayout,
}) {
  return (
    <>
      <ChoiceExercise
        exercise={exercise}
        answer={answer}
        onAnswerChange={onAnswerChange}
        feedback={feedback}
        revealCorrectId={revealCorrectId}
        layout={choiceLayout || "default"}
        showOptionVisuals={showOptionVisuals}
      />
    </>
  );
}

function DialogueExercise({
  exercise,
  answer,
  onAnswerChange,
  feedback,
  revealCorrectId,
  showOptionVisuals,
  choiceLayout,
}) {
  const playGen = useRef(0);
  const [playingId, setPlayingId] = useState("");
  const turns = visibleDialogueTurns(exercise, Boolean(feedback));

  const playTurn = (turn) => {
    const text = String(turn?.text || "").trim();
    if (!text) return;
    const token = playGen.current + 1;
    playGen.current = token;
    setPlayingId(turn.turnId);
    void playLessonTts({ text, lang: "en" }).then((result) => {
      if (playGen.current !== token) return;
      setPlayingId("");
      if (result?.via === "cancelled") return;
    });
  };

  return (
    <>
      <div className="beego-lesson-dialogue" aria-label="Hội thoại">
        {turns.map((turn) => {
          const mine = turn.speaker === "Beego";
          const spoken = String(turn.text || "").trim();
          return (
            <div
              key={turn.turnId}
              className={`beego-lesson-dialogue__turn${mine ? " beego-lesson-dialogue__turn--mine" : ""}`}
            >
              <span className="beego-lesson-dialogue__avatar" aria-hidden>
                {turn.avatar || "💬"}
              </span>
              <div className="beego-lesson-dialogue__bubble">
                <p className="beego-lesson-dialogue__role">{mine ? "Lượt của bạn" : "Nhân vật"}</p>
                <p className="beego-lesson-dialogue__name">{mine ? "Bạn" : turn.speaker}</p>
                <p className="beego-lesson-dialogue__text">
                  {turn.pending && !spoken ? "…" : spoken}
                </p>
                {spoken ? (
                  <button
                    type="button"
                    className={`beego-lesson-listen-btn${playingId === turn.turnId ? " is-playing" : ""}`}
                    aria-label={`Nghe lượt của ${turn.speaker}`}
                    aria-pressed={playingId === turn.turnId}
                    onClick={() => playTurn(turn)}
                  >
                    Nghe
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <ChoiceExercise
        exercise={exercise}
        answer={answer}
        onAnswerChange={onAnswerChange}
        feedback={feedback}
        revealCorrectId={revealCorrectId}
        layout={choiceLayout || "default"}
        showOptionVisuals={showOptionVisuals}
      />
      {feedback ? (
        <div className="beego-lesson-translation__result">
          <p>Hội thoại đã hoàn chỉnh.</p>
          {exercise.explanation ? <p>{exercise.explanation}</p> : null}
        </div>
      ) : null}
    </>
  );
}

function GreetingAiOffer({ lessonId }) {
  const [enabled, setEnabled] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancel = false;
    fetch("/api/learn/chat/status", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!cancel) setEnabled(Boolean(res.ok && json?.data?.enabled));
      })
      .catch(() => {
        if (!cancel) setEnabled(false);
      });
    return () => {
      cancel = true;
    };
  }, []);
  if (enabled == null) return null;
  if (!enabled) {
    return (
      <p className="beego-lesson-question__hint">
        AI chưa sẵn sàng. Hãy tự viết 1–2 câu ở ô bên dưới.
      </p>
    );
  }
  return (
    <div className="beego-lesson-speaking__coach">
      <button type="button" className="beego-lesson-listen-btn" onClick={() => setOpen(true)}>
        Nói một hội thoại ngắn với AI
      </button>
      {open ? (
        <LessonAiConversation
          lessonId={lessonId}
          onClose={() => {
            stopLessonTts();
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function UnknownExercise({ exercise }) {
  return (
    <p className="beego-lesson-question__hint">
      Loại bài «{exercise.type}» chưa hỗ trợ đầy đủ. Vui lòng cập nhật app hoặc quay lại lộ trình.
    </p>
  );
}

export default function ExerciseRenderer({
  exercise,
  lessonId,
  activityType,
  answer,
  onAnswerChange,
  feedback,
  storySupportVi = "",
  revealCorrectId = null,
  onCheck,
  livelyUi = false,
}) {
  if (!exercise) return null;

  const type = String(exercise.type || "unknown");
  const supported = SUPPORTED_EXERCISE_TYPES.has(type) && type !== "unknown";
  const visualPolicy = resolveLessonOptionVisualPolicy(exercise);
  const pictureChoice = Boolean(visualPolicy.pictureChoice && isPictureListeningExercise(exercise));
  const listenWordTiles = type === "translation" && exercise.extensions?.inputMode !== "text";

  const passageRead = type === "passage_read";
  const illustration =
    type !== "story_comprehension" && exercise.imageEmoji ? (
      <div className="beego-lesson-question__visual" aria-hidden>
        <span>{exercise.imageEmoji}</span>
      </div>
    ) : null;
  const decor = type === "story_comprehension" ? null : (
    <LessonListenBear
      key={exercise.id}
      mood={feedback === "correct" ? "correct" : feedback === "wrong" ? "wrong" : "read"}
    />
  );

  return (
    <div
      className={[
        "beego-lesson-question",
        visualPolicy.compactDecorMascot ? "beego-lesson-question--compact-visual" : "",
        listenWordTiles ? "beego-lesson-question--listen-word" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {passageRead ? illustration : null}
      <ActivityBadge activityType={activityType} />
      <p className="beego-lesson-question__skill">{exercise.skillLabel}</p>
      {exercise.extensions?.evaluationTurn ? (
        <p className="beego-lesson-story__label">Lượt đánh giá đọc hiểu</p>
      ) : exercise.extensions?.evidenceRole ? (
        <p className="beego-lesson-story__label">Lượt có hỗ trợ</p>
      ) : null}
      {type === "story_comprehension" ? (
        <StoryPassage exercise={exercise} feedback={feedback} storySupportVi={storySupportVi} />
      ) : null}
      <h2 className="beego-lesson-question__prompt">
        {type === "passage_read"
          ? "Đọc đoạn văn – Chấm phát âm"
          : type === "speaking" || type === "pronunciation"
          ? String(exercise.extensions?.gradingMode || "") === "communicative_rubric" ||
            exercise.extensions?.pendingTeacherReview
            ? exercise.prompt || "Tự nói theo tình huống."
            : "Nghe và nhắc lại."
          : exercise.prompt}
      </h2>

      {passageRead ? null : illustration}
      {decor}

      {type === "fill_blank" && exercise.sentenceTemplate ? (
        <p className="beego-lesson-question__sentence">{exercise.sentenceTemplate}</p>
      ) : null}

      {type === "listening_fill" && exercise.sentenceTemplate ? (
        <p className="beego-lesson-question__sentence">{exercise.sentenceTemplate}</p>
      ) : null}

      {type === "context_cloze" && exercise.sentenceTemplate ? (
        <p className="beego-lesson-question__sentence">{exercise.sentenceTemplate}</p>
      ) : null}

      {type === "context_cloze" && exercise.extensions?.inputMode === "text" ? (
        <input
          type="text"
          className="beego-lesson-keyboard-input"
          placeholder="Nhập từ còn thiếu"
          value={typeof answer === "string" ? answer : ""}
          disabled={!!feedback}
          onChange={(event) => onAnswerChange(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      ) : null}

      {!supported ? <UnknownExercise exercise={exercise} /> : null}

      {type === "word_order" ? (
        <WordBankAnswer
          question={exercise}
          selected={Array.isArray(answer) ? answer : []}
          onChange={onAnswerChange}
          state={feedback}
          speakOnPlace
        />
      ) : null}

      {type === "translation" && supported ? (
        <>
          {exercise.extensions?.offerAiDialogue ? <GreetingAiOffer lessonId={lessonId} /> : null}
          <TranslationAnswer
            exercise={exercise}
            answer={answer}
            onAnswerChange={onAnswerChange}
            feedback={feedback}
            onCheck={onCheck}
          />
          {exercise.extensions?.inputMode !== "text" ? (
            <WordBankAnswer
              question={exercise}
              selected={Array.isArray(answer) ? answer : []}
              onChange={onAnswerChange}
              state={feedback}
              speakOnPlace={exercise.extensions?.translationDirection === "vi-to-en"}
              lined
            />
          ) : null}
        </>
      ) : null}

      {type === "listening_choice" && supported ? (
        <ListeningControls exercise={exercise} allowSlow={pictureChoice} showModel={pictureChoice && !!feedback}  />
      ) : null}

      {type === "listening_fill" && supported ? (
        <ListeningControls exercise={exercise} allowSlow showPlaybackError  />
      ) : null}

      {type === "listening_dictation" && supported ? (
        <>
          <ListeningControls exercise={exercise} allowSlow showPlaybackError  />
          <ListenDictationExercise
            exercise={exercise}
            answer={answer}
            onAnswerChange={onAnswerChange}
            feedback={feedback}
            onCheck={onCheck}
          />
        </>
      ) : null}

      {(type === "multiple_choice" &&
        exercise.extensions?.meaningChoice &&
        exercise.extensions?.meaningDirection === "en-to-vi" &&
        exercise.extensions?.ttsText) ? (
        <div className="beego-lesson-listen-wrap beego-lesson-listen-wrap--tools">
          <button
            type="button"
            className="beego-lesson-listen-btn"
            onClick={() => playLessonTts({ text: exercise.extensions.ttsText, lang: "en" })}
          >
            Nghe
          </button>
        </div>
      ) : null}

      {(type === "multiple_choice" ||
        type === "vocabulary_choice" ||
        type === "fill_blank" ||
        type === "listening_fill" ||
        type === "listening_choice" ||
        (type === "context_cloze" && exercise.extensions?.inputMode !== "text")) &&
      type !== "story_comprehension" &&
      exercise.options ? (
        <ChoiceExercise
          exercise={exercise}
          answer={answer}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
          revealCorrectId={revealCorrectId}
          layout={visualPolicy.choiceLayout}
          showOptionVisuals={visualPolicy.showOptionVisuals}
          pictureChoice={pictureChoice}
          speakEachOption={
            type === "multiple_choice" && exercise.extensions?.meaningDirection === "vi-to-en"
          }
        />
      ) : null}

      {type === "listening_fill" && feedback ? (
        <div className="beego-lesson-listen-fill__result">
          <p>Từ đúng: {exercise.extensions?.gapWord}</p>
          <p>Câu đầy đủ: {exercise.extensions?.transcript}</p>
          {exercise.extensions?.meaning ? <p>Nghĩa: {exercise.extensions.meaning}</p> : null}
          {exercise.explanation ? <p>{exercise.explanation}</p> : null}
        </div>
      ) : null}

      {type === "context_cloze" && feedback ? (
        <div className="beego-lesson-translation__result">
          <p>Câu hoàn chỉnh: {exercise.extensions?.completedSentence}</p>
          {exercise.explanation ? <p>{exercise.explanation}</p> : null}
        </div>
      ) : null}

      {type === "dialogue_response" && supported ? (
        <DialogueExercise
          exercise={exercise}
          answer={answer}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
          revealCorrectId={revealCorrectId}
          showOptionVisuals={visualPolicy.showOptionVisuals}
          choiceLayout={visualPolicy.choiceLayout}
        />
      ) : null}

      {type === "story_comprehension" && supported ? (
        <StoryExercise
          exercise={exercise}
          answer={answer}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
          revealCorrectId={revealCorrectId}
          showOptionVisuals={visualPolicy.showOptionVisuals}
          choiceLayout={visualPolicy.choiceLayout}
        />
      ) : null}

      {type === "matching_pairs" && supported ? (
        <MatchPairsExercise exercise={exercise} onAnswerChange={onAnswerChange} />
      ) : null}

      {type === "passage_read" && supported ? (
        <PassageReadExercise
          exercise={exercise}
          lessonId={lessonId || exercise.lessonId}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
          showPlayback={livelyUi}
        />
      ) : null}

      {(type === "speaking" || type === "pronunciation") && supported ? (
        <SpeakingExercise
          exercise={exercise}
          answer={answer}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
          showMicClock={livelyUi}
        />
      ) : null}
    </div>
  );
}
