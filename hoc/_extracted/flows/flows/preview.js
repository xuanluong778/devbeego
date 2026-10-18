(() => {
  const id = location.pathname.split('/').pop().slice(0,2);
  const root = document.getElementById('beego-preview');
  if (!root) return;
  const phrases = ['Bạn là thiên tài! 🧠','Bạn là cao thủ rồi! 🏆','Bạn rất pro! 😎','Mượt như mật ong luôn! 🍯','Đỉnh của chóp luôn! 🚀','Beego xin phép vỗ cánh khen! 🐝'];
  let praise = 0, sound = false, ctx;
  const button = (action,label,style='') => `<button type="button" data-action="${action}" class="${style}">${label}</button>`;
  const progress = n => `<div class="progress" aria-label="Tiến độ minh họa ${n}%"><span style="width:${n}%"></span></div>`;
  const configs = {
    '01': ['Sẵn sàng bay tiếp chưa?', 'Một bước nhỏ hôm nay, tự tin hơn ngày mai.', `<div class="screen-card"><span class="eyebrow">Chặng 1 · Chào hỏi</span><h3>Chào bạn, mình là Beego!</h3><p>Tập giới thiệu tên và chào một người bạn mới.</p>${progress(25)}<p class="muted">Bài 2 / 8 · Khoảng 5 phút · Tiến độ minh họa</p><div class="actions">${button('start','Học tiếp →','primary')}${button('load-error','Thử tình huống tải lỗi')}</div></div>`, ['Thấy ngay bài nên học.', 'Bấm Học tiếp để xem ví dụ bài học.', 'Thử tải lỗi và thử lại.']],
    '02': ['Âm thanh theo ý bạn', 'Một tiếng ting nhỏ cho mỗi bước tiến.', `<div class="screen-card"><h3>Âm hiệu ứng</h3><p>Bật âm rồi bấm nghe thử. Âm chỉ phát sau thao tác của bạn.</p><div class="actions"><button type="button" data-action="sound" aria-pressed="false">🔕 Bật âm hiệu ứng</button>${button('ding','Nghe âm trả lời đúng','gold')}${button('quiet','Mô phỏng đang nghe bài')}</div><p class="muted">Tùy chọn này chỉ áp dụng cho bản minh họa.</p></div>`, ['Bật hoặc tắt âm.', 'Nghe thử âm đúng.', 'Thử ưu tiên lời đọc để thấy hiệu ứng bị chặn.']],
    '03': ['Thử tài cùng Beego', 'Chọn một đáp án để nhận phản hồi ngay.', `<div class="screen-card"><span class="eyebrow">Câu hỏi minh họa · Từ vựng</span><h3>“Hello” có nghĩa là gì?</h3><div class="choices">${button('correct','<span class="choice-icon">👋</span>Xin chào')}${button('wrong','<span class="choice-icon">🌙</span>Chúc ngủ ngon')}</div><div class="actions">${button('praise','Xem câu khen tiếp theo ✨','gold')}</div></div>`, ['Chọn đúng để xem lời khen.', 'Chọn sai để xem giải thích.', 'Bấm xem tiếp để thử nhiều câu hài hước.']],
    '04': ['Bạn vừa hoàn thành một bài!', 'Một giọt mật mới cho hành trình học.', `<div class="screen-card" style="text-align:center"><span class="badge">🏆</span><h3>Chào hỏi thật tự tin</h3><p>Bạn đã luyện giới thiệu tên và nói lời chào.</p><div class="metric-grid"><div class="metric"><b>8/10</b>Câu đúng</div><div class="metric"><b>+15</b>XP mẫu</div><div class="metric"><b>5 phút</b>Thời gian mẫu</div></div><div class="actions">${button('save','Lưu kết quả mẫu','primary')}${button('save-error','Thử lưu thất bại')}</div></div>`, ['Xem điều vừa học được.', 'Thử lưu thành công hoặc thất bại.', 'Lưu lại không cộng thưởng lần hai.']],
    '05': ['Khám phá vườn tri thức', 'Mỗi bông hoa là một điều bạn sẽ làm được.', `<div class="screen-card"><span class="eyebrow">Chặng 1 · Khu vườn chào hỏi</span><div class="map">${button('done-node','✓')}${button('current-node','🐝','current')}${button('locked-node','🔒')}${button('locked-node','🌸')}${button('locked-node','🏆')}</div><p class="map-label">Đã học → Đang học → Chưa mở → Thử thách</p></div>`, ['Bấm dấu ✓ để xem bài đã học.', 'Bấm ong để xem bài hiện tại.', 'Bấm khóa hoặc hoa để xem điều kiện mở.']],
    '06': ['Tổ ong đang lớn mỗi ngày', 'Một chút chăm chỉ, cả vườn hoa rực rỡ.', `<div class="screen-card"><span class="eyebrow">Mục tiêu ngày minh họa</span><h3>Thu thập 30 XP hôm nay</h3><div id="goal-progress">${progress(50)}</div><p id="goal-label">15 / 30 XP</p><div class="actions">${button('goal','Hoàn thành thêm một bài mẫu','primary')}</div></div><div class="screen-card"><span class="badge" id="reward">🌱</span><h3 id="reward-title">Hạt giống chăm chỉ</h3><p>Đạt mục tiêu để xem khoảnh khắc ăn mừng.</p></div>`, ['Xem tiến độ mục tiêu.', 'Hoàn thành thêm bài mẫu.', 'Đạt mốc, nhận huy hiệu rồi có thể nghỉ.']],
    '07': ['Biến lỗi cũ thành điểm mạnh', 'Mình ôn nhẹ một câu nhé!', `<div class="screen-card"><span class="eyebrow">Gợi ý ôn tập minh họa</span><h3>Chọn câu giới thiệu tên đúng</h3><p>Lý do ôn: bạn từng nhầm cách dùng “am”.</p><div class="choices">${button('review-right','I am Beego.')}${button('review-wrong','I is Beego.')}</div><div class="actions">${button('no-review','Thử trạng thái không có bài ôn')}</div></div>`, ['Hiểu vì sao cần ôn.', 'Thử trả lời đúng hoặc sai.', 'Xem trạng thái chưa có nội dung đến hạn.']],
    '08': ['Tìm điểm xuất phát của bạn', 'Không cần biết hết. Mình bắt đầu từ chỗ phù hợp.', `<div class="screen-card" id="placement"><span class="eyebrow">Kiểm tra đầu vào</span><h3>Bạn muốn bắt đầu thế nào?</h3><p>Ví dụ này rút gọn để bạn hình dung. Không phải bài xếp lớp thật.</p><div class="actions">${button('placement-start','Thử một câu đánh giá','primary')}${button('basic','Học từ cơ bản')}</div></div>`, ['Chọn đánh giá hoặc học cơ bản.', 'Làm câu ví dụ để xem màn kết quả.', 'Xác nhận điểm xuất phát mẫu.']],
    '09': ['Mỗi người một nhịp bay', 'Cùng một mục tiêu, mức hỗ trợ khác nhau.', `<div class="screen-card"><h3>Chọn hồ sơ học viên mẫu</h3><div class="actions">${button('support','Cần củng cố')}${button('steady','Đang ổn định')}${button('challenge','Sẵn sàng thử thách')}${button('unknown','Chưa có dữ liệu')}</div><div id="adaptive"><p class="muted">Chọn một hồ sơ để xem bài được điều chỉnh như thế nào.</p></div></div>`, ['Thử các hồ sơ mẫu.', 'So sánh gợi ý và hoạt động.', 'Chưa có dữ liệu thì không gán trình độ.']],
    '10': ['Lỡ mất mạng cũng đừng hoảng', 'Beego chỉ báo đã lưu khi có xác nhận.', `<div class="screen-card"><span class="eyebrow">Phiên học minh họa</span><h3>Ghi nhận kết quả bài học</h3><p id="network-state">🟢 Kết nối mẫu đang sẵn sàng</p><div class="actions">${button('offline','Mô phỏng mất mạng')}${button('retry','Kết nối lại và thử lưu','primary')}${button('retry','Thử gửi lại lần nữa')}</div></div>`, ['Mô phỏng mất mạng khi lưu.', 'Kết nối lại để thử tiếp.', 'Gửi lại không cộng thưởng trùng.']]
  };
  const c = configs[id];
  if (!c) return;
  root.innerHTML = `<section class="demo" aria-label="Giao diện minh họa tương tác"><div class="demo-label"><b>✦ GIAO DIỆN MINH HỌA · BẤM THỬ ĐƯỢC</b><span>Dữ liệu ví dụ, không lưu vào Beego</span></div><div class="demo-grid"><div class="app-screen"><div class="app-bar"><span class="brand">🐝 beego</span><div class="pills"><span class="pill">🔥 3 ngày mẫu</span><span class="pill">🍯 120 mẫu</span></div></div><div class="welcome"><span class="bee" aria-hidden="true">🐝</span><div><h2>${c[0]}</h2><p>${c[1]}</p></div></div>${c[2]}<div class="feedback" role="status" aria-live="polite" id="demo-feedback"><strong>Đến lượt bạn!</strong>Bấm các nút phía trên để xem trải nghiệm.</div><p class="demo-footer">Bản xem trước độc lập. Phần gọi gia sư AI không được mô phỏng hoặc thay đổi.</p></div><aside class="demo-aside"><h3>💡 Bạn có thể thử</h3><ol>${c[3].map(x=>`<li>${x}</li>`).join('')}</ol><p>Phía dưới là sơ đồ chi tiết và các quy tắc cần giữ khi triển khai.</p>${button('reset','↺ Thử lại từ đầu')}</aside></div></section>`;
  let saved=false,quiet=false,goal=15;
  function feedback(title,text,tone='right') {
    const box=root.querySelector('#demo-feedback');
    box.replaceChildren();
    const heading=document.createElement('strong');heading.textContent=title;
    box.append(heading,document.createTextNode(text));box.dataset.tone=tone;
    box.classList.remove('confetti');void box.offsetWidth;box.classList.add('confetti');
  }
  function ding(){
    if(!sound||quiet)return false;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    ctx ||= new Audio();ctx.resume().catch(()=>{});
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(990,ctx.currentTime+.16);
    gain.gain.setValueAtTime(.045,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);osc.start();osc.stop(ctx.currentTime+.23);return true;
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button[data-action]');if(!b)return;
    const a=b.dataset.action;
    if(a==='reset'){location.reload();return;}
    const simple={
      start:['Bài học đã sẵn sàng!','Ví dụ: luyện “Hello! My name is Beego.” Đây là bước chuyển sang bài học.'],
      'load-error':['Chưa tải được lộ trình','Tiến độ cũ vẫn được giữ. Bấm Thử lại để tải lại dữ liệu mẫu.','wrong'],
      retryload:['Đã tải lại lộ trình mẫu','Bài 2: Chào bạn, mình là Beego! Bạn có thể chọn Học tiếp.'],
      wrong:['Chưa đúng, mình thử lại nhé!','“Hello” là “Xin chào”. “Chúc ngủ ngon” là “Good night”.','wrong'],
      'done-node':['Bài 1 · Lời chào đầu tiên','Đã hoàn thành trong ví dụ. Có thể ôn lại; không nhận thưởng trùng.'],
      'current-node':['Bài 2 · Giới thiệu tên','Bài đang mở trong ví dụ. Mục tiêu: tự nói tên của mình.'],
      'locked-node':['Bông hoa đang chờ bạn!','Hoàn thành bài đang học để mở bài tiếp theo. Bạn vẫn xem được mục tiêu.','wrong'],
      'review-right':['Bạn vừa sửa được lỗi cũ! 🌟','Dùng “am” sau “I”: I am Beego. Tiến bộ thật đấy!'],
      'review-wrong':['Suýt nữa rồi!','Sau “I”, mình dùng “am”, không dùng “is”. Cùng nhớ: I am Beego.','wrong'],
      'no-review':['Chưa có nội dung đến hạn','Ở trạng thái này, Beego gợi ý bạn học bài mới thay vì tạo bài ôn giả.'],
      basic:['Bắt đầu từ nền tảng 🌱','Điểm xuất phát mẫu: chặng Chào hỏi. Không cần làm kiểm tra đầu vào.'],
      'placement-confirm':['Đã chọn điểm bắt đầu mẫu','Bạn bắt đầu tại Chào hỏi. Lựa chọn này không thay đổi dữ liệu học thật.'],
      'save-error':['Chưa lưu được kết quả','Bản xem trước giữ kết quả để thử lại. Chưa xác nhận thưởng.','wrong'],
      offline:['Chưa nhận được xác nhận lưu','Hãy kết nối lại và thử lưu. Không tự cộng XP khi mất mạng.','wrong']
    };
    if(simple[a])feedback(...simple[a]);
    if(a==='load-error'&&!root.querySelector('[data-action=retryload]'))b.insertAdjacentHTML('afterend',button('retryload','Thử lại','primary'));
    if(a==='correct'||a==='praise')feedback(phrases[praise++%phrases.length],'Chính xác! “Hello” có nghĩa là “Xin chào”.');
    if(a==='sound'){sound=!sound;quiet=false;b.setAttribute('aria-pressed',String(sound));b.textContent=sound?'🔔 Tắt âm hiệu ứng':'🔕 Bật âm hiệu ứng';feedback(sound?'Âm hiệu ứng đã bật':'Âm hiệu ứng đã tắt','Thiết lập chỉ áp dụng cho trang minh họa đang mở.');}
    if(a==='ding'){const ok=ding();feedback(ok?'Ting! Chuẩn không cần chỉnh!':'Chỉ hiển thị phản hồi',ok?'Bạn vừa nghe âm minh họa trả lời đúng.':quiet?'Đang ưu tiên lời đọc mô phỏng. Bật lại âm để nghe thử.':'Hãy bật âm hiệu ứng trước; trình duyệt cần hỗ trợ phát âm.');}
    if(a==='quiet'){quiet=true;feedback('Ưu tiên lời đọc bài học','Đây là trạng thái mô phỏng: bấm nghe âm đúng sẽ không phát hiệu ứng. Bật lại âm để kết thúc trạng thái này.');}
    if(a==='save'||a==='retry'){feedback(saved?'Kết quả đã được ghi nhận trước đó':'Lưu kết quả mẫu thành công! 🎉',saved?'Không cộng thưởng lần hai. Tiến độ giữ nguyên.':'Ví dụ đã xác nhận +15 XP. Bài tiếp theo đã sẵn sàng.');saved=true;if(id==='10')root.querySelector('#network-state').textContent='🟢 Đã kết nối lại · Kết quả mẫu đã lưu';}
    if(a==='offline')root.querySelector('#network-state').textContent='🔴 Mất mạng mô phỏng · Chưa xác nhận lần gửi này';
    if(a==='goal'){goal=30;root.querySelector('#goal-progress').innerHTML=progress(100);root.querySelector('#goal-label').textContent='30 / 30 XP · Đã đạt mục tiêu mẫu';root.querySelector('#reward').textContent='🌻';root.querySelector('#reward-title').textContent='Bông hoa chăm chỉ';feedback('Đạt mục tiêu rồi! Bạn rất pro!','Tổ ong có thêm một bông hoa. Bạn có thể nghỉ hoặc học tiếp.');b.disabled=true;b.textContent='✓ Đã đạt mục tiêu';}
    if(a==='placement-start'){root.querySelector('#placement').innerHTML=`<span class="eyebrow">Một câu minh họa</span><h3>“Good morning” nghĩa là gì?</h3><div class="choices">${button('placement-right','Chào buổi sáng')}${button('placement-wrong','Tạm biệt')}</div>`;feedback('Thử một câu nhé','Bản thật cần nhiều câu và nhiều kỹ năng; ví dụ này không tính trình độ.');}
    if(a==='placement-right'||a==='placement-wrong'){root.querySelector('#placement').innerHTML=`<span class="eyebrow">Kết quả minh họa</span><h3>Điểm bắt đầu gợi ý: Chào hỏi</h3><p>Chưa đánh giá trình độ thực tế. Kỹ năng nói: chưa đánh giá.</p>${button('placement-confirm','Chọn điểm bắt đầu mẫu','primary')}`;feedback(a==='placement-right'?'Đúng rồi!':'Đáp án là “Chào buổi sáng”','Một câu không đủ để xếp lớp. Đây chỉ là ví dụ màn kết quả.');}
    const profiles={support:['Cùng củng cố nền tảng','Nghe chậm, xem tranh và mẫu “I am…”, rồi hoàn thành câu có gợi ý.'],steady:['Đang vào nhịp rồi!','Giảm gợi ý, xen câu mới và lỗi cần ôn. Tự sắp xếp “My name is Beego”.'],challenge:['Cao thủ thử sức nào!','Tự giới thiệu tên và sở thích trong tình huống mới. Thử thách thêm có thể bỏ qua.'],unknown:['Mình tìm nhịp học phù hợp nhé','Chưa có đủ dữ liệu. Dùng mức khởi đầu thận trọng, không gán điểm thành thạo.']};
    if(profiles[a]){for(const x of root.querySelectorAll('#adaptive ~ button'))x.remove();const box=root.querySelector('#adaptive');box.replaceChildren();const p=document.createElement('p');p.textContent=profiles[a][1];box.append(p);for(const x of root.querySelectorAll('.actions button'))x.setAttribute('aria-pressed',String(x===b));feedback(...profiles[a]);}
  });
  window.addEventListener('pagehide',()=>{if(ctx)ctx.close().catch(()=>{});});
})();
