export default function LearnCallCharacter({ talking = false, label = "Gia sư Beego" }) {
  return (
    <svg
      className={`beego-call-character${talking ? " is-talking" : ""}`}
      viewBox="0 0 440 650"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="beegoCallHair" x2="0.7" y2="1">
          <stop stopColor="#d4b8ff" />
          <stop offset="1" stopColor="#9863ea" />
        </linearGradient>
      </defs>
      <path fill="url(#beegoCallHair)" d="M45 330Q18 66 209 52Q405 46 408 310L430 456Q433 474 412 474H31Q10 474 14 451Z" />
      <path fill="#493671" d="M166 400H276L303 650H128Z" />
      <path fill="#a675ef" d="M184 491Q220 531 260 491L274 650H162Z" />
      <path fill="#59427f" d="M168 438 0 566V637L186 497ZM274 438 440 557V625L259 496Z" />
      <path fill="#ffd1be" d="M125 143Q151 197 320 184Q359 183 365 218Q367 243 339 251V357Q339 402 291 402H126Z" />
      <path fill="#aa80ed" d="M125 144Q123 64 244 69Q338 86 355 184Q183 203 125 144Z" />
      <g className="beego-call-character__eyes">
        <path fill="#fff5e2" d="M126 246H205V296H126ZM223 246H315V296H223Z" />
        <path fill="#23363b" d="M147 249H184V264Q165 287 147 264ZM249 249H288V264Q268 286 249 264Z" />
        <path fill="#af81ef" d="M125 224Q162 198 206 224V252H125ZM223 220Q266 196 316 219V252H223Z" />
      </g>
      <path fill="#e8998d" d="M217 269Q188 305 204 318Q227 334 239 312Z" />
      <path className="beego-call-character__mouth-idle" d="M214 352Q238 337 258 353" stroke="#bb797c" strokeWidth="9" strokeLinecap="round" fill="none" />
      <g className="beego-call-character__mouth-talk">
        <path fill="#863b59" d="M204 342Q235 329 270 342Q264 382 236 382Q209 377 204 342Z" />
        <path fill="#fff5e2" d="M208 343Q237 334 265 344L262 352H211Z" />
        <path fill="#ec8596" d="M222 377Q231 360 254 374L251 380Z" />
      </g>
      <path fill="#c6a2fa" d="M80 145Q86 71 176 65Q107 97 103 196L86 377H53Z" />
    </svg>
  );
}
