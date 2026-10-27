/**
 * Gate 1 only: one short story per lesson for the final read-aloud activity.
 * Linh's first weeks at school. Each lesson is its own scene.
 * IPA comes from the same CMU General American helper as other passages.
 * A one-syllable word keeps the vowel, without an automatic stress mark.
 */
import { ipaForSentence } from "./passage-ipa.js";

const VOWEL = /aʊ|aɪ|eɪ|ɔɪ|oʊ|ɑ|æ|ʌ|ɔ|ə|ɚ|ɝ|ɪ|ʊ|e|i|o|u/g;

function relaxMonosyllableStress(ipa) {
  const raw = String(ipa || "");
  if (!raw) return raw;
  const nuclei = raw.replace(/[/ˈˌ]/g, "").match(VOWEL) || [];
  if (nuclei.length !== 1) return raw;
  return raw.replace(/[ˈˌ]/g, "");
}

function adjustTokens(tokens) {
  const wordIndexes = [];
  tokens.forEach((token, index) => {
    if (/[A-Za-z]/.test(token.text)) wordIndexes.push(index);
  });
  wordIndexes.forEach((index, order) => {
    const key = tokens[index].text.replace(/[^A-Za-z]/g, "").toLowerCase();
    const next = tokens[wordIndexes[order + 1]];
    if ((key === "a" || key === "an") && next) {
      tokens[index].ipa = key === "a" ? "/ə/" : "/ən/";
      return;
    }
    tokens[index].ipa = relaxMonosyllableStress(tokens[index].ipa);
  });
}

export function attachGate1Ipa(row) {
  const spoken = ipaForSentence(row.en);
  const tokens = spoken.tokens.map((token) => ({ ...token }));
  if (!spoken.missing.length) adjustTokens(tokens);
  const body = tokens
    .map((token) => token.ipa.replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .join(" ");
  return {
    text: row.en,
    vi: row.vi || "",
    ipa: body && !spoken.missing.length ? `/${body}/` : "",
    tokens,
    missingIpa: spoken.missing,
  };
}

const STORIES = {
  1: [
    { en: "Linh stands at the door of a new class.", vi: "Linh đứng ở cửa một lớp mới." },
    { en: "A girl looks up from her desk.", vi: "Một bạn nữ ngước lên từ bàn của mình." },
    { en: "Linh says, \"Hello.\"", vi: "Linh nói: \"Xin chào.\"" },
    { en: "The girl says hello too, and smiles.", vi: "Bạn ấy cũng chào lại, rồi mỉm cười." },
    { en: "Linh takes a breath.", vi: "Linh hít một hơi." },
    { en: "\"Let me introduce myself to my new classmate.\"", vi: "\"Để tôi tự giới thiệu với bạn cùng lớp mới.\"" },
    { en: "\"I am Linh.\"", vi: "\"Tôi là Linh.\"" },
    { en: "The girl says, \"I am Mai. Come and sit with me.\"", vi: "Bạn ấy nói: \"Tôi là Mai. Lại ngồi với tôi đi.\"" },
  ],
  2: [
    { en: "Mai opens her notebook.", vi: "Mai mở vở." },
    { en: "\"What is your full name?\" she asks.", vi: "\"Họ tên đầy đủ của bạn là gì?\" bạn ấy hỏi." },
    { en: "Linh says, \"My full name is Linh Tran.\"", vi: "Linh nói: \"Họ tên đầy đủ của tôi là Linh Tran.\"" },
    { en: "\"Tran is my surname.\"", vi: "\"Tran là họ của tôi.\"" },
    { en: "\"Linh is my first name.\"", vi: "\"Linh là tên riêng của tôi.\"" },
    { en: "Mai writes the names down.", vi: "Mai chép các tên đó lại." },
    { en: "\"My surname is Pham, and my first name is Mai.\"", vi: "\"Họ của tôi là Pham, và tên riêng của tôi là Mai.\"" },
    { en: "Linh reads both names and smiles.", vi: "Linh đọc cả hai tên rồi mỉm cười." },
  ],
  3: [
    { en: "The next morning, Mai brings a boy to the desk.", vi: "Sáng hôm sau, Mai dắt một bạn nam đến bàn." },
    { en: "\"This is Nam,\" she says.", vi: "\"Đây là Nam,\" bạn ấy nói." },
    { en: "Linh says, \"It is a pleasure to meet you.\"", vi: "Linh nói: \"Rất vui được gặp bạn.\"" },
    { en: "Nam smiles. \"It is a pleasure to meet you too.\"", vi: "Nam mỉm cười. \"Tôi cũng rất vui được gặp bạn.\"" },
    { en: "Linh looks at Mai.", vi: "Linh nhìn Mai." },
    { en: "\"I am glad to meet your friend too.\"", vi: "\"Tôi cũng vui khi gặp bạn của bạn.\"" },
    { en: "Nam pulls a chair close.", vi: "Nam kéo một chiếc ghế lại gần." },
    { en: "The three of them talk until the bell rings.", vi: "Ba người trò chuyện cho đến khi chuông reo." },
  ],
  4: [
    { en: "Linh wants each hello to fit the time of day.", vi: "Linh muốn mỗi lời chào đúng với thời điểm trong ngày." },
    { en: "In the morning, she sees Mai at the gate.", vi: "Buổi sáng, bạn ấy thấy Mai ở cổng." },
    { en: "\"Good morning,\" Linh says.", vi: "\"Chào buổi sáng,\" Linh nói." },
    { en: "Mai answers, \"Good morning.\"", vi: "Mai đáp: \"Chào buổi sáng.\"" },
    { en: "After lunch, they meet by the classroom.", vi: "Sau bữa trưa, hai bạn gặp nhau cạnh lớp." },
    { en: "Linh says, \"Good afternoon.\"", vi: "Linh nói: \"Chào buổi chiều.\"" },
    { en: "When the sky is dark, they walk to the gate.", vi: "Khi trời tối, hai bạn đi ra cổng." },
    { en: "\"Good evening,\" Mai says.", vi: "\"Chào buổi tối,\" Mai nói." },
    { en: "Linh waves. Three small hellos fill the day.", vi: "Linh vẫy tay. Ba lời chào nhỏ làm đầy một ngày." },
  ],
  5: [
    { en: "The teacher stops beside Linh.", vi: "Giáo viên dừng lại bên cạnh Linh." },
    { en: "\"How are you today?\" he asks.", vi: "\"Hôm nay bạn khỏe không?\" thầy hỏi." },
    { en: "Linh looks up.", vi: "Linh ngước nhìn." },
    { en: "\"I am well today.\"", vi: "\"Hôm nay tôi khỏe.\"" },
    { en: "\"Thanks for asking about me.\"", vi: "\"Cảm ơn thầy đã hỏi thăm tôi.\"" },
    { en: "The teacher smiles. \"I am well today too.\"", vi: "Thầy mỉm cười. \"Hôm nay tôi cũng khỏe.\"" },
    { en: "Linh says thanks once more.", vi: "Linh cảm ơn thêm một lần nữa." },
    { en: "She opens her book, and the lesson begins.", vi: "Bạn ấy mở sách, và bài học bắt đầu." },
  ],
  6: [
    { en: "At lunch, Mai takes Linh to the library.", vi: "Giờ trưa, Mai đưa Linh đến thư viện." },
    { en: "The room is quiet, with sun on the tables.", vi: "Căn phòng yên ắng, nắng nằm trên những chiếc bàn." },
    { en: "Mai says, \"I remember our first meeting.\"", vi: "Mai nói: \"Tôi nhớ lần gặp đầu của chúng ta.\"" },
    { en: "Linh asks, \"At the classroom door?\"", vi: "Linh hỏi: \"Ở cửa lớp à?\"" },
    { en: "Mai shakes her head.", vi: "Mai lắc đầu." },
    { en: "\"No. Our first meeting was here, at the library.\"", vi: "\"Không. Lần gặp đầu của chúng ta là ở đây, tại thư viện.\"" },
    { en: "Linh laughs. \"Then I will remember the library.\"", vi: "Linh cười. \"Vậy tôi sẽ nhớ thư viện.\"" },
    { en: "They choose one book and sit side by side.", vi: "Hai bạn chọn một cuốn sách và ngồi cạnh nhau." },
  ],
  7: [
    { en: "On the bus, Mai asks, \"Where do you come from?\"", vi: "Trên xe buýt, Mai hỏi: \"Bạn đến từ đâu?\"" },
    { en: "Linh looks out at the road.", vi: "Linh nhìn ra con đường." },
    { en: "\"I come from a small village.\"", vi: "\"Tôi đến từ một ngôi làng nhỏ.\"" },
    { en: "\"I love my hometown.\"", vi: "\"Tôi yêu quê nhà của mình.\"" },
    { en: "Mai asks, \"What is the village like?\"", vi: "Mai hỏi: \"Ngôi làng ấy thế nào?\"" },
    { en: "\"It has a river and green fields,\" Linh says.", vi: "\"Có một con sông và những cánh đồng xanh,\" Linh nói." },
    { en: "She smiles at the memory.", vi: "Bạn ấy mỉm cười khi nhớ lại." },
    { en: "For a minute, the hometown feels near.", vi: "Trong một phút, quê nhà như ở rất gần." },
  ],
  8: [
    { en: "In class, the teacher says, \"Find a partner.\"", vi: "Trong lớp, giáo viên nói: \"Hãy tìm một bạn cùng luyện.\"" },
    { en: "Linh turns to Mai.", vi: "Linh quay sang Mai." },
    { en: "\"Let us exchange a greeting,\" Mai says.", vi: "\"Chúng ta trao đổi một lời chào nhé,\" Mai nói." },
    { en: "Linh says, \"Hello. Good morning, partner.\"", vi: "Linh nói: \"Xin chào. Chào buổi sáng, bạn cùng luyện.\"" },
    { en: "Mai answers with the same greeting.", vi: "Mai đáp lại bằng chính lời chào đó." },
    { en: "They exchange it once more, slowly.", vi: "Hai bạn trao đổi thêm một lần nữa, chậm rãi." },
    { en: "Then Linh asks, \"What is your name?\"", vi: "Rồi Linh hỏi: \"Tên bạn là gì?\"" },
    { en: "Mai laughs. \"You know it. This is just for fun.\"", vi: "Mai cười. \"Bạn biết rồi mà. Lần này chỉ để vui thôi.\"" },
  ],
  9: [
    { en: "After school, a girl waits by the gate.", vi: "Tan học, một bạn nữ đứng đợi ở cổng." },
    { en: "Linh says, \"Mai, this is my friend Hoa.\"", vi: "Linh nói: \"Mai, đây là bạn tôi, Hoa.\"" },
    { en: "\"She is my neighbor.\"", vi: "\"Cô ấy là hàng xóm của tôi.\"" },
    { en: "\"She lives nearby.\"", vi: "\"Cô ấy sống ở gần.\"" },
    { en: "Hoa smiles. \"Hello, Mai.\"", vi: "Hoa mỉm cười. \"Xin chào, Mai.\"" },
    { en: "Mai says, \"Hello. You live nearby. That is nice.\"", vi: "Mai nói: \"Xin chào. Bạn sống ở gần. Hay quá.\"" },
    { en: "The three friends walk to the bus together.", vi: "Ba người bạn cùng đi ra xe buýt." },
    { en: "A neighbor from home is now a friend at school too.", vi: "Người hàng xóm ở nhà giờ cũng là bạn ở trường." },
  ],
  10: [
    { en: "A boy stands in the doorway and looks for a chair.", vi: "Một bạn nam đứng ở cửa và tìm một chiếc ghế." },
    { en: "Linh remembers her own first day.", vi: "Linh nhớ ngày đầu tiên của mình." },
    { en: "She says, \"Welcome to our class.\"", vi: "Bạn ấy nói: \"Chào mừng bạn đến lớp chúng tôi.\"" },
    { en: "\"You are a newcomer.\"", vi: "\"Bạn là người mới.\"" },
    { en: "She points to the empty chair.", vi: "Bạn ấy chỉ vào chiếc ghế trống." },
    { en: "\"There is a seat beside me.\"", vi: "\"Có một chỗ ngồi bên cạnh tôi.\"" },
    { en: "The boy sits and says, \"Thank you.\"", vi: "Bạn nam ngồi xuống và nói: \"Cảm ơn.\"" },
    { en: "The newcomer opens a book next to Linh.", vi: "Người mới mở sách ngay cạnh Linh." },
  ],
  11: [
    { en: "The new boy's name is hard to hear.", vi: "Tên của bạn nam mới hơi khó nghe." },
    { en: "Linh leans closer.", vi: "Linh nghiêng người lại gần." },
    { en: "\"Please repeat your name slowly.\"", vi: "\"Xin nhắc lại tên bạn thật chậm.\"" },
    { en: "He says, \"Minh.\"", vi: "Bạn ấy nói: \"Minh.\"" },
    { en: "Linh tries to spell it.", vi: "Linh thử đánh vần tên đó." },
    { en: "\"M, I, N, H. Is that right?\"", vi: "\"M, I, N, H. Đúng không?\"" },
    { en: "Minh nods. \"Yes. Please say it slowly with me.\"", vi: "Minh gật đầu. \"Đúng. Hãy nói chậm cùng tôi.\"" },
    { en: "They spell the name together and both smile.", vi: "Hai bạn cùng đánh vần cái tên và cùng mỉm cười." },
  ],
  12: [
    { en: "The next morning, a new student is about to arrive.", vi: "Sáng hôm sau, một học viên mới sắp đến." },
    { en: "She stops at the door and holds her bag.", vi: "Bạn ấy dừng ở cửa và giữ chặt chiếc cặp." },
    { en: "She looks shy.", vi: "Bạn ấy trông rụt rè." },
    { en: "Linh remembers that feeling.", vi: "Linh nhớ cảm giác ấy." },
    { en: "Linh gives her a small smile.", vi: "Linh dành cho bạn ấy một nụ cười nhỏ." },
    { en: "The girl sees the smile and steps in.", vi: "Bạn ấy thấy nụ cười và bước vào." },
    { en: "\"Hello,\" she says, still a little shy.", vi: "\"Xin chào,\" bạn ấy nói, vẫn còn hơi rụt rè." },
    { en: "Linh says, \"Hello. I am glad you arrived.\"", vi: "Linh nói: \"Xin chào. Tôi vui vì bạn đã đến.\"" },
  ],
  13: [
    { en: "At break, Minh sits with Linh and Mai.", vi: "Giờ ra chơi, Minh ngồi cùng Linh và Mai." },
    { en: "He wants a real conversation.", vi: "Bạn ấy muốn một cuộc trò chuyện thật sự." },
    { en: "Linh asks a simple question.", vi: "Linh hỏi một câu đơn giản." },
    { en: "\"What do you like after school?\"", vi: "\"Tan học bạn thích gì?\"" },
    { en: "Minh gives a clear answer.", vi: "Minh đưa ra một câu trả lời rõ ràng." },
    { en: "\"I like football with my brother.\"", vi: "\"Tôi thích đá bóng với anh trai.\"" },
    { en: "Mai asks one more question, and Minh answers.", vi: "Mai hỏi thêm một câu, và Minh trả lời." },
    { en: "The conversation is short, and everyone is smiling.", vi: "Cuộc trò chuyện ngắn, và mọi người đều đang mỉm cười." },
  ],
  14: [
    { en: "The last bell rings.", vi: "Chuông cuối cùng reo." },
    { en: "Linh packs her bag and stands up.", vi: "Linh cất cặp và đứng dậy." },
    { en: "\"I must leave now,\" she says.", vi: "\"Bây giờ tôi phải đi rồi,\" bạn ấy nói." },
    { en: "Mai looks up. \"So soon?\"", vi: "Mai ngước lên. \"Nhanh vậy sao?\"" },
    { en: "Linh nods. \"Goodbye, Mai.\"", vi: "Linh gật đầu. \"Tạm biệt, Mai.\"" },
    { en: "Mai says, \"Goodbye. See you tomorrow.\"", vi: "Mai nói: \"Tạm biệt. Hẹn gặp lại ngày mai.\"" },
    { en: "Linh waves to Minh. \"See you.\"", vi: "Linh vẫy Minh. \"Hẹn gặp lại.\"" },
    { en: "She walks to the gate, already glad for the next hello.", vi: "Bạn ấy đi ra cổng, trong lòng đã vui vì lời chào của ngày mai." },
  ],
  15: [
    { en: "On Saturday, someone knocks at Linh's door.", vi: "Thứ Bảy, có người gõ cửa nhà Linh." },
    { en: "It is Mai, a visitor for the afternoon.", vi: "Đó là Mai, một vị khách đến chơi buổi chiều." },
    { en: "Linh's mother opens the door. She is the host.", vi: "Mẹ Linh mở cửa. Bà là người đón tiếp." },
    { en: "The host greets the visitor with a handshake.", vi: "Người đón tiếp chào khách bằng một cái bắt tay." },
    { en: "Mai smiles and shakes hands.", vi: "Mai mỉm cười và bắt tay." },
    { en: "\"Welcome,\" Linh's mother says.", vi: "\"Chào mừng cháu,\" mẹ Linh nói." },
    { en: "Linh brings two glasses of water.", vi: "Linh mang ra hai cốc nước." },
    { en: "They sit by the window and talk about school.", vi: "Mọi người ngồi cạnh cửa sổ và nói chuyện về trường." },
  ],
  16: [
    { en: "Linh stands in front of the class again.", vi: "Linh lại đứng trước lớp." },
    { en: "She smiles before she speaks.", vi: "Bạn ấy mỉm cười trước khi nói." },
    { en: "\"Hello. Let me introduce myself.\"", vi: "\"Xin chào. Để tôi tự giới thiệu.\"" },
    { en: "Her voice is calm this time.", vi: "Lần này giọng bạn ấy bình tĩnh." },
    { en: "With daily practice, the words come more easily.", vi: "Nhờ luyện tập hằng ngày, các từ ra dễ hơn." },
    { en: "She notices her progress.", vi: "Bạn ấy nhận ra sự tiến bộ của mình." },
    { en: "\"I feel more confidence now,\" she says.", vi: "\"Bây giờ tôi cảm thấy tự tin hơn,\" bạn ấy nói." },
    { en: "Mai nods from the front row.", vi: "Mai gật đầu từ hàng ghế đầu." },
    { en: "Linh sits down, glad she spoke.", vi: "Linh ngồi xuống, vui vì mình đã nói." },
  ],
};

export function gate1StoryRows(meta = {}) {
  if (Number(meta.gateNumber) !== 1) return null;
  const lessonNumber = Number(meta.lessonNumber) || 0;
  const rows = STORIES[lessonNumber];
  return rows ? rows.map((row) => ({ en: row.en, vi: row.vi })) : null;
}
