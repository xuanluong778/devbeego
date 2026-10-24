"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnswerOption from "./AnswerOption";
import MatchPairsExercise from "./MatchPairsExercise";
import PassageReadExercise from "./PassageReadExercise";
import ListenDictationExercise from "./ListenDictationExercise";
import TranslationAnswer from "./TranslationAnswer";
import WordBankAnswer from "./WordBankAnswer";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import {
  isSpeechRecognitionSupported,
  startLessonSpeechCapture,
} from "@/lib/beego/learn/adapters/lesson-speech";
import { scoreSpeakingAttempt } from "@/lib/beego/learn/exercise-check";
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

  const play = useCallback(
    (rate) => {
      if (!text) return;
      setPlaybackError("");
      void playLessonTts({ text, url: exercise.audioUrl, lang: exercise.lang || "en", rate }).then((result) => {
        if (!showPlaybackError) return;
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
      <button type="button" className="beego-lesson-listen-btn" onClick={() => play(1)}>
        <span aria-hidden>🔊</span> Nghe
      </button>
      {allowSlow ? (
        <button type="button" className="beego-lesson-listen-btn" onClick={() => play(LISTEN_FILL_SLOW_RATE)}>
          Nghe chậm
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

function SpeakingExercise({ exercise, answer, onAnswerChange, feedback }) {
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
  const [status, setStatus] = useState("");
  const [interim, setInterim] = useState("");
  const [heardText, setHeardText] = useState(() => String(answer?.transcript || "").trim());
  const [revealed, setRevealed] = useState(!hideUntilHint);
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
  const ipa = String(exercise.ipa || exercise.extensions?.ipa || "").trim();
  const meaningVi = String(
    exercise.meaningVi || exercise.extensions?.translation || exercise.extensions?.meaningVi || ""
  ).trim();
  // Keep target visible once spoken (so learner can compare with what they said).
  const showWord =
    !isOpenPrompt && (revealed || Boolean(feedback) || Boolean(heardText));
  const expectedForMic = isOpenPrompt ? speakingHint || focusWords.join(" ") : target;
  const displayHeard = recording && interim ? interim : heardText;
  const wordMarks =
    !isOpenPrompt && target && heardText && !recording
      ? buildWordMarks(target, heardText)
      : [];

  useEffect(() => {
    setHeardText(String(answer?.transcript || "").trim());
    setInterim("");
    setStatus("");
    setRecording(false);
    setRevealed(!hideUntilHint);
  }, [exercise?.id, hideUntilHint]);

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

  const playModel = () => {
    const ttsText = target || speakingHint;
    if (!ttsText) return;
    void playLessonTts({ text: ttsText, lang: "en" });
  };

  const startRecord = () => {
    if (feedback) return;
    stopLessonTts();
    setStatus("");
    setInterim("");
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
        setInterim("");
        const heard = String(transcript || "").trim();
        // Keep last transcript visible even if empty recognition (show placeholder).
        setHeardText(heard);
        setRevealed(true);
        const scored = scoreSpeakingAttempt(exercise, heard);
        if (scored.softPass || scored.recordedOnly) {
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
        });
      },
      onError: (err) => {
        setRecording(false);
        setInterim("");
        setStatus(err?.message || "Không dùng được micro. Chọn lại hoặc thử trình duyệt khác.");
        // Keep previous heardText so learner still sees what they said before.
        onAnswerChange(null);
      },
    });
    if (!ctrl) {
      setRecording(false);
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
                onClick={playModel}
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
            onClick={playModel}
            aria-label="Nghe mẫu"
            disabled={!target}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M4 9.2v5.6h3.6L12 19V5L7.6 9.2H4z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 9.3a3.4 3.4 0 0 1 0 5.4" />
            </svg>
            <span className="beego-lesson-listen-word__said">
              {target || "—"}
              <span className="beego-lesson-listen-word__dots" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="beego-lesson-speaking__speaker-only"
            onClick={playModel}
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
      {isSpeechRecognitionSupported() ? (
        <button
          type="button"
          className="beego-lesson-listen-btn"
          onClick={startRecord}
          disabled={recording || !!feedback}
        >
          {recording ? "Đang nghe…" : heardText ? "🎤 Nói lại" : "🎤 Bắt đầu nói"}
        </button>
      ) : (
        <p className="beego-lesson-question__hint">
          Micro không hỗ trợ — nghe mẫu và tự luyện; bài vẫn yêu cầu hoàn thành trên thiết bị hỗ trợ.
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
                <p className="beego-lesson-dialogue__name">{turn.speaker}</p>
                <p className="beego-lesson-dialogue__text">
                  {turn.pending && !spoken ? "…" : spoken}
                </p>
                {spoken ? (
                  <button
                    type="button"
                    className="beego-lesson-listen-btn"
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
}) {
  if (!exercise) return null;

  const type = String(exercise.type || "unknown");
  const supported = SUPPORTED_EXERCISE_TYPES.has(type) && type !== "unknown";
  const visualPolicy = resolveLessonOptionVisualPolicy(exercise);
  const pictureChoice = Boolean(visualPolicy.pictureChoice && isPictureListeningExercise(exercise));
  const listenWordTiles = type === "translation" && exercise.extensions?.inputMode !== "text";

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

      {type === "story_comprehension" ? null : exercise.imageEmoji ? (
        <div className="beego-lesson-question__visual" aria-hidden>
          <span>{exercise.imageEmoji}</span>
        </div>
      ) : (
        <div
          className={[
            "beego-lesson-question__mascot",
            visualPolicy.compactDecorMascot ? "beego-lesson-question__mascot--compact" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          <span className="beego-lesson-question__bee">🐝</span>
        </div>
      )}

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
        />
      ) : null}

      {type === "translation" && supported ? (
        <>
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
        <ListeningControls exercise={exercise} allowSlow={pictureChoice} showModel={pictureChoice && !!feedback} />
      ) : null}

      {type === "listening_fill" && supported ? (
        <ListeningControls exercise={exercise} allowSlow showPlaybackError />
      ) : null}

      {type === "listening_dictation" && supported ? (
        <>
          <ListeningControls exercise={exercise} allowSlow showPlaybackError />
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
        />
      ) : null}

      {(type === "speaking" || type === "pronunciation") && supported ? (
        <SpeakingExercise
          exercise={exercise}
          answer={answer}
          onAnswerChange={onAnswerChange}
          feedback={feedback}
        />
      ) : null}
    </div>
  );
}
