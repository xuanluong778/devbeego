import { useId } from "react";

export default function LearnCallCharacter({ talking = false, mood = "idle", label = "Gia sư Beego" }) {
  const uid = useId().replace(/:/g, "");
  const id = (name) => `beegoBot${name}${uid}`;
  return (
    <svg
      className={`beego-call-character is-${mood}${talking ? " is-talking" : ""}`}
      viewBox="0 0 360 380"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={id("Shell")} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#ece9f8" />
          <stop offset="1" stopColor="#c4bce6" />
        </linearGradient>
        <linearGradient id={id("Visor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2150" />
          <stop offset="1" stopColor="#05071a" />
        </linearGradient>
        <linearGradient id={id("Ear")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b7bff" />
          <stop offset="1" stopColor="#5536c9" />
        </linearGradient>
        <filter id={id("Glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="beego-call-character__body">
        <ellipse cx="58" cy="342" rx="40" ry="58" fill={`url(#${id("Shell")})`} />
        <ellipse cx="302" cy="342" rx="40" ry="58" fill={`url(#${id("Shell")})`} />
        <ellipse cx="76" cy="334" rx="13" ry="36" fill="#262a46" />
        <ellipse cx="284" cy="334" rx="13" ry="36" fill="#262a46" />
        <path d="M78 380Q78 304 128 292H232Q282 304 282 380Z" fill={`url(#${id("Shell")})`} />
        <rect x="138" y="314" width="84" height="58" rx="20" fill="#f6f4fd" stroke="#d9d2f2" strokeWidth="2" />
        <g transform="translate(180 336)">
          <ellipse cx="-7" cy="-9" rx="8" ry="6" fill="#c9b8ff" transform="rotate(-25 -7 -9)" />
          <ellipse cx="7" cy="-9" rx="8" ry="6" fill="#c9b8ff" transform="rotate(25 7 -9)" />
          <ellipse cx="0" cy="3" rx="9" ry="11" fill="#ffc83d" />
          <path d="M-8 0H8M-7 6H7" stroke="#2a2340" strokeWidth="3" strokeLinecap="round" />
        </g>
        <rect className="beego-call-character__light" x="166" y="358" width="28" height="5" rx="2.5" fill="#5ef0ff" filter={`url(#${id("Glow")})`} />
      </g>

      <rect x="150" y="236" width="60" height="58" rx="12" fill="#262a46" />
      <ellipse cx="180" cy="290" rx="56" ry="11" fill="none" stroke="#5ef0ff" strokeWidth="4" opacity="0.85" filter={`url(#${id("Glow")})`} />

      <g className="beego-call-character__head">
        <rect x="42" y="104" width="44" height="84" rx="22" fill={`url(#${id("Ear")})`} />
        <rect x="274" y="104" width="44" height="84" rx="22" fill={`url(#${id("Ear")})`} />
        <ellipse className="beego-call-character__ear" cx="62" cy="146" rx="11" ry="27" fill="none" stroke="#5ef0ff" strokeWidth="4" filter={`url(#${id("Glow")})`} />
        <ellipse className="beego-call-character__ear" cx="298" cy="146" rx="11" ry="27" fill="none" stroke="#5ef0ff" strokeWidth="4" filter={`url(#${id("Glow")})`} />
        <rect x="68" y="28" width="224" height="222" rx="104" fill={`url(#${id("Shell")})`} />
        <ellipse cx="128" cy="62" rx="44" ry="16" fill="#ffffff" opacity="0.8" transform="rotate(-18 128 62)" />
        <rect x="94" y="82" width="172" height="128" rx="56" fill={`url(#${id("Visor")})`} stroke="#353a78" strokeWidth="3" />
        <path d="M112 112Q132 92 170 90" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="8" strokeLinecap="round" fill="none" />

        <g className="beego-call-character__eyes" filter={`url(#${id("Glow")})`}>
          <path d="M126 146Q145 122 164 146" stroke="#5ef0ff" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M196 146Q215 122 234 146" stroke="#5ef0ff" strokeWidth="9" strokeLinecap="round" fill="none" />
        </g>
        <g filter={`url(#${id("Glow")})`}>
          <path
            className="beego-call-character__mouth-idle"
            d="M164 172Q180 186 196 172"
            stroke="#5ef0ff"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <g className="beego-call-character__mouth-talk">
            <path d="M162 168Q180 164 198 168Q196 192 180 192Q164 192 162 168Z" fill="#5ef0ff" />
            <path d="M168 182Q180 176 192 182Q188 189 180 189Q172 189 168 182Z" fill="#1b9fc2" />
          </g>
        </g>
      </g>
    </svg>
  );
}
