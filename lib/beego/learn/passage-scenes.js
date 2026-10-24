/** One scene per gate. The lesson model sentence sits in the middle, so the paragraph stays on that lesson. */

const line = (en, vi) => ({ en, vi });

export const GATE_SCENES = {
  1: {
    leads: [
      line("It is a new day at school.", "Đó là một ngày mới ở trường."),
      line("Two students meet before class.", "Hai học sinh gặp nhau trước giờ học."),
    ],
    close: line("They speak slowly and smile.", "Họ nói chậm và mỉm cười."),
  },
  2: {
    leads: [
      line("Linh writes a few facts about herself.", "Linh viết vài thông tin về bản thân."),
      line("A form asks for personal facts.", "Một mẫu đơn hỏi thông tin cá nhân."),
    ],
    close: line("She checks every word before she stops.", "Bạn ấy kiểm tra từng chữ trước khi dừng."),
  },
  3: {
    leads: [
      line("Linh talks about the people at home.", "Linh nói về những người ở nhà."),
      line("The family sits together after dinner.", "Gia đình ngồi cùng nhau sau bữa tối."),
    ],
    close: line("She says who each person is.", "Bạn ấy nói mỗi người là ai."),
  },
  4: {
    leads: [
      line("The class is working with numbers and time.", "Lớp đang học số và thời gian."),
      line("Linh looks at the clock and counts.", "Linh nhìn đồng hồ và đếm."),
    ],
    close: line("She says the numbers in order.", "Bạn ấy nói các số theo thứ tự."),
  },
  5: {
    leads: [
      line("Linh is at her desk in class.", "Linh ngồi ở bàn trong lớp."),
      line("The teacher points to things in the room.", "Giáo viên chỉ vào đồ vật trong phòng."),
    ],
    close: line("She names each thing she can see.", "Bạn ấy gọi tên từng thứ mình nhìn thấy."),
  },
  6: {
    leads: [
      line("Linh walks through her home.", "Linh đi trong nhà."),
      line("A friend asks where each room is.", "Một người bạn hỏi mỗi phòng ở đâu."),
    ],
    close: line("She answers with a clear place.", "Bạn ấy trả lời bằng một vị trí rõ."),
  },
  7: {
    leads: [
      line("This is a normal morning for Linh.", "Đây là một buổi sáng bình thường của Linh."),
      line("Linh talks about her day from start to end.", "Linh kể một ngày từ đầu đến cuối."),
    ],
    close: line("She does each thing in the same order.", "Bạn ấy làm từng việc theo cùng một thứ tự."),
  },
  8: {
    leads: [
      line("It is time to eat, and Linh is hungry.", "Đến giờ ăn, và Linh đang đói."),
      line("Linh chooses food with her family.", "Linh chọn đồ ăn cùng gia đình."),
    ],
    close: line("They eat slowly and talk.", "Họ ăn chậm và nói chuyện."),
  },
  9: {
    leads: [
      line("Linh is in a shop with a friend.", "Linh đang ở cửa hàng với một người bạn."),
      line("She looks at the price before she pays.", "Bạn ấy xem giá trước khi trả tiền."),
    ],
    close: line("She buys only what she needs.", "Bạn ấy chỉ mua thứ mình cần."),
  },
  10: {
    leads: [
      line("Linh is on her way across town.", "Linh đang đi ngang qua phố."),
      line("A friend asks how to get there.", "Một người bạn hỏi đường đến đó."),
    ],
    close: line("She gives a short, clear answer.", "Bạn ấy trả lời ngắn và rõ."),
  },
  11: {
    leads: [
      line("Linh looks out the window in the morning.", "Buổi sáng Linh nhìn ra cửa sổ."),
      line("The class talks about the day outside.", "Lớp nói về thời tiết bên ngoài."),
    ],
    close: line("She says what the day feels like.", "Bạn ấy nói ngày hôm đó thế nào."),
  },
  12: {
    leads: [
      line("After class, Linh talks about free time.", "Sau giờ học, Linh nói về thời gian rảnh."),
      line("Friends ask what Linh likes to do.", "Bạn bè hỏi Linh thích làm gì."),
    ],
    close: line("She explains why she likes it.", "Bạn ấy giải thích vì sao mình thích."),
  },
  13: {
    leads: [
      line("Linh wants a healthy week.", "Linh muốn một tuần khỏe."),
      line("The coach talks with the class.", "Huấn luyện viên nói chuyện với lớp."),
    ],
    close: line("She repeats the advice in her own words.", "Bạn ấy nhắc lại lời khuyên bằng lời của mình."),
  },
  14: {
    leads: [
      line("Linh wants to see her friends this week.", "Tuần này Linh muốn gặp bạn."),
      line("A friend sends a kind message.", "Một người bạn gửi một tin nhắn thân thiện."),
    ],
    close: line("They agree on a time and a place.", "Họ thống nhất giờ và nơi."),
  },
  15: {
    leads: [
      line("The phone rings while Linh is at home.", "Điện thoại reo khi Linh đang ở nhà."),
      line("Linh answers a call from a classmate.", "Linh nghe máy một bạn cùng lớp."),
    ],
    close: line("She keeps the call short and polite.", "Bạn ấy giữ cuộc gọi ngắn và lịch sự."),
  },
  16: {
    leads: [
      line("Linh is talking about school.", "Linh đang nói về trường."),
      line("A new student asks about the class.", "Một học sinh mới hỏi về lớp học."),
    ],
    close: line("She gives one clear example.", "Bạn ấy đưa một ví dụ rõ."),
  },
  17: {
    leads: [
      line("Linh visits a busy workplace.", "Linh đến một nơi làm việc bận rộn."),
      line("People at work explain their jobs.", "Mọi người ở chỗ làm giải thích công việc."),
    ],
    close: line("She listens and asks one question.", "Bạn ấy lắng nghe và hỏi một câu."),
  },
  18: {
    leads: [
      line("Linh is planning a short trip.", "Linh đang lên kế hoạch một chuyến đi ngắn."),
      line("At the desk, Linh asks for help.", "Ở quầy, Linh nhờ giúp đỡ."),
    ],
    close: line("She checks the plan once more.", "Bạn ấy kiểm tra kế hoạch thêm một lần."),
  },
  19: {
    leads: [
      line("Linh sits down at a small restaurant.", "Linh ngồi xuống ở một nhà hàng nhỏ."),
      line("The server comes to the table.", "Nhân viên phục vụ đến bàn."),
    ],
    close: line("She says what she wants, then thanks them.", "Bạn ấy nói mình muốn gì, rồi cảm ơn."),
  },
  20: {
    leads: [
      line("Linh is shopping on her phone.", "Linh đang mua sắm trên điện thoại."),
      line("She reads the page before she pays.", "Bạn ấy đọc trang đó trước khi trả tiền."),
    ],
    close: line("She only continues when the facts are clear.", "Bạn ấy chỉ tiếp tục khi thông tin đã rõ."),
  },
  21: {
    leads: [
      line("Linh is looking for a place to live.", "Linh đang tìm chỗ ở."),
      line("A neighbor meets Linh by the door.", "Một người hàng xóm gặp Linh ở cửa."),
    ],
    close: line("They talk until both sides understand.", "Họ nói đến khi cả hai hiểu."),
  },
  22: {
    leads: [
      line("Linh tells a friend about last week.", "Linh kể cho bạn về tuần trước."),
      line("The story starts with one clear moment.", "Câu chuyện bắt đầu bằng một thời điểm rõ."),
    ],
    close: line("She finishes by saying how it ended.", "Bạn ấy kết thúc bằng cách nói chuyện kết thúc ra sao."),
  },
  23: {
    leads: [
      line("Linh is making a plan for next month.", "Linh đang lập kế hoạch cho tháng sau."),
      line("She writes her goal in one sentence.", "Bạn ấy viết mục tiêu trong một câu."),
    ],
    close: line("Then she says what she will do first.", "Rồi bạn ấy nói mình sẽ làm gì trước."),
  },
  24: {
    leads: [
      line("The city is having a festival.", "Thành phố đang có một lễ hội."),
      line("Linh asks a friend about the custom.", "Linh hỏi bạn về phong tục đó."),
    ],
    close: line("She repeats what she learned.", "Bạn ấy nhắc lại điều mình đã học."),
  },
  25: {
    leads: [
      line("Linh wants to help in her town.", "Linh muốn giúp ích cho phố mình."),
      line("A group meets to plan the work.", "Một nhóm gặp nhau để lên kế hoạch."),
    ],
    close: line("They leave with one next step.", "Họ ra về với một bước tiếp theo."),
  },
  26: {
    leads: [
      line("Linh talks honestly with a close friend.", "Linh nói thật với một người bạn thân."),
      line("The two friends sit down after class.", "Hai người bạn ngồi xuống sau giờ học."),
    ],
    close: line("They listen before they answer.", "Họ lắng nghe trước khi trả lời."),
  },
  27: {
    leads: [
      line("Linh is thinking about daily habits.", "Linh đang nghĩ về thói quen hằng ngày."),
      line("The class discusses one change at home.", "Lớp bàn về một thay đổi ở nhà."),
    ],
    close: line("She chooses one habit to keep.", "Bạn ấy chọn một thói quen để giữ."),
  },
  28: {
    leads: [
      line("Linh reviews what she can already do.", "Linh ôn lại những gì mình đã làm được."),
      line("She presents a small project to the class.", "Bạn ấy trình bày một dự án nhỏ với lớp."),
    ],
    close: line("She ends with what she wants to learn next.", "Bạn ấy kết bằng điều muốn học tiếp."),
  },
  29: {
    leads: [
      line("Linh is preparing for an interview.", "Linh đang chuẩn bị một buổi phỏng vấn."),
      line("She practices her answers out loud.", "Bạn ấy luyện câu trả lời thành tiếng."),
    ],
    close: line("She keeps each answer short and true.", "Bạn ấy giữ mỗi câu trả lời ngắn và đúng."),
  },
  30: {
    leads: [
      line("Linh opens a message from work.", "Linh mở một tin nhắn từ chỗ làm."),
      line("She reads the email before she replies.", "Bạn ấy đọc email trước khi trả lời."),
    ],
    close: line("Her reply is polite and easy to follow.", "Câu trả lời lịch sự và dễ theo dõi."),
  },
  31: {
    leads: [
      line("The team is in a short meeting.", "Nhóm đang họp ngắn."),
      line("Linh speaks once, then lets others talk.", "Linh nói một lần, rồi để người khác nói."),
    ],
    close: line("The group agrees on the next task.", "Nhóm thống nhất việc tiếp theo."),
  },
  32: {
    leads: [
      line("Linh stands up to speak to the group.", "Linh đứng lên nói với nhóm."),
      line("She starts with one clear point.", "Bạn ấy bắt đầu bằng một ý rõ."),
    ],
    close: line("She closes and asks if anyone has a question.", "Bạn ấy kết thúc và hỏi có ai thắc mắc không."),
  },
  33: {
    leads: [
      line("A customer calls with a problem.", "Một khách hàng gọi vì một vấn đề."),
      line("Linh answers and listens first.", "Linh trả lời và lắng nghe trước."),
    ],
    close: line("She says what she can do next.", "Bạn ấy nói mình có thể làm gì tiếp."),
  },
  34: {
    leads: [
      line("Linh reads a warning on her screen.", "Linh đọc một cảnh báo trên màn hình."),
      line("A coworker asks if the link is safe.", "Một đồng nghiệp hỏi đường dẫn đó có an toàn không."),
    ],
    close: line("She checks before she clicks.", "Bạn ấy kiểm tra trước khi bấm."),
  },
  35: {
    leads: [
      line("Linh is deciding how to spend her money.", "Linh đang quyết định cách tiêu tiền."),
      line("She looks at the cost and the need.", "Bạn ấy xem chi phí và nhu cầu."),
    ],
    close: line("Then she chooses and says why.", "Rồi bạn ấy chọn và nói lý do."),
  },
  36: {
    leads: [
      line("Linh reads a news story on her phone.", "Linh đọc một tin trên điện thoại."),
      line("The headline is strong, so she reads on.", "Tiêu đề mạnh, nên bạn ấy đọc tiếp."),
    ],
    close: line("She checks the facts before she shares it.", "Bạn ấy kiểm tra sự thật trước khi chia sẻ."),
  },
  37: {
    leads: [
      line("The class is looking at one science question.", "Lớp đang xem một câu hỏi khoa học."),
      line("Linh explains what the group wants to learn.", "Linh giải thích nhóm muốn tìm hiểu gì."),
    ],
    close: line("They keep the question small and clear.", "Họ giữ câu hỏi nhỏ và rõ."),
  },
  38: {
    leads: [
      line("Linh is writing a note about health.", "Linh đang viết một ghi chú về sức khỏe."),
      line("She thinks about who will read it.", "Bạn ấy nghĩ về người sẽ đọc."),
    ],
    close: line("She chooses words those readers know.", "Bạn ấy chọn từ người đọc đó biết."),
  },
  39: {
    leads: [
      line("Linh opens a paper for class.", "Linh mở một bài báo cho lớp."),
      line("She does not read every line at first.", "Lúc đầu bạn ấy không đọc từng dòng."),
    ],
    close: line("She looks for the main point first.", "Bạn ấy tìm ý chính trước."),
  },
  40: {
    leads: [
      line("Two people sit down to reach a deal.", "Hai người ngồi xuống để đi đến một thỏa thuận."),
      line("Linh states what her side needs.", "Linh nêu điều phía mình cần."),
    ],
    close: line("She listens, then offers a next step.", "Bạn ấy lắng nghe, rồi đề nghị bước tiếp."),
  },
  41: {
    leads: [
      line("The project team meets to stay on track.", "Nhóm dự án họp để đi đúng hướng."),
      line("Linh describes what the work includes.", "Linh mô tả công việc gồm những gì."),
    ],
    close: line("They name one limit they will keep.", "Họ nêu một giới hạn sẽ giữ."),
  },
  42: {
    leads: [
      line("People from different places work together.", "Những người từ nhiều nơi làm việc cùng nhau."),
      line("Linh asks before she assumes.", "Linh hỏi trước khi giả định."),
    ],
    close: line("She treats each person as an individual.", "Bạn ấy đối xử với mỗi người như một cá nhân."),
  },
  43: {
    leads: [
      line("Linh stands in front of a new work of art.", "Linh đứng trước một tác phẩm mới."),
      line("She looks before she judges.", "Bạn ấy quan sát trước khi đánh giá."),
    ],
    close: line("Then she explains what she sees.", "Rồi bạn ấy giải thích điều mình thấy."),
  },
  44: {
    leads: [
      line("The class is studying one period of the past.", "Lớp đang học một giai đoạn trong quá khứ."),
      line("Linh puts the events in order.", "Linh sắp các sự kiện theo thứ tự."),
    ],
    close: line("She says what changed after that point.", "Bạn ấy nói điều gì đổi sau mốc đó."),
  },
  45: {
    leads: [
      line("The group faces a hard choice.", "Nhóm đứng trước một lựa chọn khó."),
      line("Linh names the values in conflict.", "Linh nêu các giá trị đang xung đột."),
    ],
    close: line("She does not rush to a simple answer.", "Bạn ấy không vội một câu trả lời đơn giản."),
  },
  46: {
    leads: [
      line("The town is planning for the years ahead.", "Thị trấn đang lên kế hoạch cho những năm tới."),
      line("Linh connects today's need with the future.", "Linh nối nhu cầu hôm nay với tương lai."),
    ],
    close: line("She asks what they can still protect.", "Bạn ấy hỏi họ vẫn có thể bảo vệ điều gì."),
  },
  47: {
    leads: [
      line("The team is looking at new tools at work.", "Nhóm đang xem các công cụ mới ở chỗ làm."),
      line("Linh separates machine work from human work.", "Linh tách việc của máy khỏi việc của người."),
    ],
    close: line("She says where a person must still decide.", "Bạn ấy nói chỗ nào con người vẫn phải quyết."),
  },
  48: {
    leads: [
      line("Linh listens to one side of an argument.", "Linh nghe một phía của lập luận."),
      line("She writes down the starting claim.", "Bạn ấy ghi lại luận điểm xuất phát."),
    ],
    close: line("Then she asks what would make it false.", "Rồi bạn ấy hỏi điều gì sẽ làm nó sai."),
  },
  49: {
    leads: [
      line("Linh is starting a short research paper.", "Linh đang bắt đầu một bài nghiên cứu ngắn."),
      line("She narrows the question before she writes.", "Bạn ấy thu hẹp câu hỏi trước khi viết."),
    ],
    close: line("The paper will answer that question only.", "Bài viết sẽ chỉ trả lời câu hỏi đó."),
  },
  50: {
    leads: [
      line("Linh presents her final project.", "Linh trình bày dự án cuối."),
      line("The audience asks who the work helps.", "Người nghe hỏi công việc này giúp ai."),
    ],
    close: line("She ends with one result and one next step.", "Bạn ấy kết bằng một kết quả và một bước tiếp."),
  },
};
