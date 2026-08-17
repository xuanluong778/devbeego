/** URL trang Luyện nói / Beego Speaking AI */
export const SPEAKING_PATH = "/luyen-noi";

/** URL trang Luyện nghe 5 phút */
export const LISTENING_PATH = "/luyen-nghe";

export function isSpeakingPath(pathname = "") {
  return pathname === SPEAKING_PATH || pathname.startsWith(`${SPEAKING_PATH}/`);
}

export function isListeningPath(pathname = "") {
  return pathname === LISTENING_PATH || pathname.startsWith(`${LISTENING_PATH}/`);
}
