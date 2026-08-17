/**
 * Nội dung mẫu cho Luyện nghe 5 phút — client-side, không đổi API.
 * Mỗi clip: đoạn nghe + 1 câu hỏi trắc nghiệm + transcript (ẩn cho đến khi trả lời).
 */

import { HEADWAY_LISTENING_CLIPS } from "@/lib/listening/headway-clips";

export const LISTENING_CLIPS = [
  {
    id: "cafe-order",
    title: "At the café",
    level: "A2",
    audioUrl: "",
    ttsText:
      "Good morning. Welcome to Sunny Café. What would you like today? I'd like a medium latte, please. Would you like anything else? Yes, a blueberry muffin. That will be eight dollars fifty. Here you go. Thank you!",
    keywords: ["latte", "muffin", "order"],
    question: {
      text: "What does the customer order?",
      options: ["Tea and cake", "Latte and muffin", "Espresso only", "Sandwich and juice"],
      correctIndex: 1,
      explanation: "The customer asks for a medium latte and a blueberry muffin.",
    },
    transcript:
      "Good morning. Welcome to Sunny Café. What would you like today? I'd like a medium latte, please. Would you like anything else? Yes, a blueberry muffin. That will be eight dollars fifty. Here you go. Thank you!",
    transcriptVi:
      "Chào buổi sáng. Chào mừng đến Sunny Café. Hôm nay bạn muốn gì? Tôi muốn một ly latte size vừa. Bạn có muốn thêm gì không? Có, một bánh muffin việt quất. Tổng cộng tám đô năm mươi cent. Đây ạ. Cảm ơn!",
  },
  {
    id: "airport-gate",
    title: "Airport announcement",
    level: "B1",
    audioUrl: "",
    ttsText:
      "Attention passengers. Flight BA two four seven to London is now boarding at gate twelve. Please have your boarding pass and passport ready. Final boarding will begin in fifteen minutes.",
    keywords: ["boarding", "gate", "passport"],
    question: {
      text: "Where should passengers go?",
      options: ["Gate ten", "Gate twelve", "Baggage claim", "Check-in desk"],
      correctIndex: 1,
      explanation: "The announcement says boarding is at gate twelve.",
    },
    transcript:
      "Attention passengers. Flight BA two four seven to London is now boarding at gate twelve. Please have your boarding pass and passport ready. Final boarding will begin in fifteen minutes.",
    transcriptVi:
      "Thông báo đến hành khách. Chuyến bay BA 247 đến London đang lên máy bay tại cổng mười hai. Vui lòng chuẩn bị thẻ lên máy bay và hộ chiếu. Lên máy bay lần cuối sẽ bắt đầu sau mười lăm phút.",
  },
  {
    id: "meeting-schedule",
    title: "Team meeting",
    level: "B1",
    audioUrl: "",
    ttsText:
      "Hi everyone. Let's start the weekly sync. First, design will share mockups on Friday. Engineering needs two more days for the API. Marketing launches the campaign next Monday. Any questions?",
    keywords: ["design", "API", "campaign"],
    question: {
      text: "When does marketing launch the campaign?",
      options: ["This Friday", "Next Monday", "Tomorrow", "Next month"],
      correctIndex: 1,
      explanation: "Marketing launches the campaign next Monday.",
    },
    transcript:
      "Hi everyone. Let's start the weekly sync. First, design will share mockups on Friday. Engineering needs two more days for the API. Marketing launches the campaign next Monday. Any questions?",
    transcriptVi:
      "Chào mọi người. Bắt đầu buổi họp tuần nhé. Trước hết, team design sẽ chia sẻ mockup vào thứ Sáu. Engineering cần thêm hai ngày cho API. Marketing ra mắt chiến dịch vào thứ Hai tuần sau. Có câu hỏi nào không?",
  },
  {
    id: "doctor-visit",
    title: "Doctor visit",
    level: "A2",
    audioUrl: "",
    ttsText:
      "How have you been feeling? I've had a sore throat for three days. Do you have a fever? A little, around thirty seven five. I'll prescribe some medicine. Drink warm water and rest.",
    keywords: ["sore throat", "fever", "medicine"],
    question: {
      text: "What symptom does the patient mention first?",
      options: ["Headache", "Sore throat", "Back pain", "Cough"],
      correctIndex: 1,
      explanation: "The patient says they've had a sore throat for three days.",
    },
    transcript:
      "How have you been feeling? I've had a sore throat for three days. Do you have a fever? A little, around thirty seven five. I'll prescribe some medicine. Drink warm water and rest.",
    transcriptVi:
      "Dạo này bạn thấy thế nào? Tôi bị đau họng ba ngày rồi. Bạn có sốt không? Có chút, khoảng 37,5 độ. Tôi sẽ kê thuốc. Uống nước ấm và nghỉ ngơi nhé.",
  },
  {
    id: "hotel-checkin",
    title: "Hotel check-in",
    level: "A2",
    audioUrl: "",
    ttsText:
      "Good evening. I have a reservation under Nguyen. Yes, a double room for two nights. Breakfast is from seven to ten. Your room is on the fourth floor, room four zero eight.",
    keywords: ["reservation", "breakfast", "room"],
    question: {
      text: "Which room is the guest assigned?",
      options: ["Room 408", "Room 418", "Room 308", "Room 480"],
      correctIndex: 0,
      explanation: "The receptionist says room four zero eight (408).",
    },
    transcript:
      "Good evening. I have a reservation under Nguyen. Yes, a double room for two nights. Breakfast is from seven to ten. Your room is on the fourth floor, room four zero eight.",
    transcriptVi:
      "Chào buổi tối. Tôi có đặt phòng tên Nguyễn. Vâng, phòng đôi hai đêm. Bữa sáng từ bảy đến mười giờ. Phòng của bạn ở tầng bốn, phòng 408.",
  },
  {
    id: "weather-forecast",
    title: "Weather forecast",
    level: "B1",
    audioUrl: "",
    ttsText:
      "Today's forecast: cloudy in the morning with light rain after noon. Temperatures between twenty two and twenty eight degrees. Take an umbrella if you go out this afternoon.",
    keywords: ["rain", "cloudy", "umbrella"],
    question: {
      text: "What should you bring this afternoon?",
      options: ["Sunglasses", "An umbrella", "A jacket", "A hat"],
      correctIndex: 1,
      explanation: "The forecast advises taking an umbrella if you go out this afternoon.",
    },
    transcript:
      "Today's forecast: cloudy in the morning with light rain after noon. Temperatures between twenty two and twenty eight degrees. Take an umbrella if you go out this afternoon.",
    transcriptVi:
      "Dự báo hôm nay: sáng nhiều mây, chiều mưa nhẹ. Nhiệt độ từ 22 đến 28 độ. Mang theo ô nếu bạn ra ngoài chiều nay.",
  },
];

/** Bài mẫu + Headway — Headway đánh số 1–N, bài mẫu ở cuối */
export const ALL_LISTENING_CLIPS = [...HEADWAY_LISTENING_CLIPS, ...LISTENING_CLIPS];

export function estimateClipDurationSec(clip) {
  const text = clip?.ttsText || clip?.transcript || "";
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(12, Math.round(words / 2.4));
}
