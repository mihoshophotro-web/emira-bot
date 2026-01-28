// api/webhook.js
const VERIFY_TOKEN = "emira_wedding_secret_2024";

// --- CẤU HÌNH ẢNH (ĐÃ CẬP NHẬT 4 LINK PNG MỚI NHẤT) ---
const IMAGES = {
  ONE_DAY: [
    "https://i.postimg.cc/QBH6fRxL/Baogia1ngay-01.png", // Ảnh 1 Ngày (Phần trên)
    "https://i.postimg.cc/06btVL5F/Baogia1ngay-02.png"  // Ảnh 1 Ngày (Phần dưới)
  ], 
  TWO_DAYS: [
    "https://i.postimg.cc/v1cP0pHF/Baogia2ngay-01.png", // Ảnh 2 Ngày (Phần trên)
    "https://i.postimg.cc/4Km8Wr4D/Baogia2ngay-02.png"  // Ảnh 2 Ngày (Phần dưới)
  ]
};

// Bộ nhớ tạm để lưu lựa chọn của khách
const userSessions = new Map();

export default async function handler(req, res) {
  // 1. XÁC THỰC WEBHOOK
  if (req.method === "GET") {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      res.status(403).send("Forbidden");
    }
    return;
  }

  // 2. XỬ LÝ TIN NHẮN ĐẾN
  if (req.method === "POST") {
    const body = req.body;
    if (body.object === "page") {
      for (const entry of body.entry) {
        const webhook_event = entry.messaging[0];
        const sender_psid = webhook_event.sender.id;

        // Ưu tiên xử lý nút bấm (Postback)
        if (webhook_event.postback) {
          await handlePostback(sender_psid, webhook_event.postback);
        } 
        // Xử lý tin nhắn chữ
        else if (webhook_event.message) {
            // Nếu là nút Quick Reply (nút trắng)
            if (webhook_event.message.quick_reply) {
                await handlePostback(sender_psid, { payload: webhook_event.message.quick_reply.payload });
            } else {
                await handleMessage(sender_psid, webhook_event.message);
            }
        }
      }
      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.status(404).send();
    }
  }
}

// --- LOGIC TRẢ LỜI ---

async function handleMessage(sender_psid, received_message) {
  const text = received_message.text ? received_message.text.toLowerCase() : "";
  
  // 1. Chào hỏi
  if (text.includes("chào") || text.includes("giá") || text.includes("tư vấn") || text.includes("bao nhiêu")) {
    userSessions.delete(sender_psid); // Reset bộ nhớ
    
    const response = {
      text: "Dạ Emira Wedding xin chào ạ! Em là tư vấn viên của Emira. 🥰\n\nDạ cho em hỏi là mình dự kiến tổ chức các lễ (Ăn hỏi, Cưới) trong cùng 1 ngày hay là 2 ngày khác nhau ạ?",
      quick_replies: [
        { content_type: "text", title: "1 Ngày", payload: "CHON_1_NGAY" },
        { content_type: "text", title: "2 Ngày", payload: "CHON_2_NGAY" }
      ]
    };
    await callSendAPI(sender_psid, response);
  }
  
  // 2. Logic khi khách nhắn tin (Địa điểm/Ngày)
  else if (text.length > 3) {
     const userChoice = userSessions.get(sender_psid); 
     let buttons = [];

     // Kiểm tra bộ nhớ để hiện đúng nút
     if (userChoice === "1_NGAY") {
         buttons = [{ content_type: "text", title: "👉 Xem Báo Giá 1 Ngày", payload: "XEM_GIA_1_NGAY" }];
     } 
     else if (userChoice === "2_NGAY") {
         buttons = [{ content_type: "text", title: "👉 Xem Báo Giá 2 Ngày", payload: "XEM_GIA_2_NGAY" }];
     } 
     else {
         // Nếu không nhớ thì hiện cả 2
         buttons = [
            { content_type: "text", title: "Xem Báo Giá 1 Ngày", payload: "XEM_GIA_1_NGAY" },
            { content_type: "text", title: "Xem Báo Giá 2 Ngày", payload: "XEM_GIA_2_NGAY" }
         ];
     }

     const response = {
      text: "Dạ em đã ghi nhận thông tin ạ. 👍\n\nMời Anh/Chị nhấn vào nút bên dưới để nhận bảng giá chi tiết ngay nhé:",
      quick_replies: buttons
    };
    await callSendAPI(sender_psid, response);
  }
}

async function handlePostback(sender_psid, received_postback) {
  const payload = received_postback.payload;
  
  // KHÁCH CHỌN GÓI -> LƯU VÀO BỘ NHỚ
  if (payload === "CHON_1_NGAY") {
    userSessions.set(sender_psid, "1_NGAY");
    await callSendAPI(sender_psid, { text: "Dạ vâng gói 1 Ngày ạ.\n\nAnh/Chị nhắn giúp em xin *NGÀY TỔ CHỨC* và *ĐỊA ĐIỂM* (Quận/Huyện) để em check lịch ngay nhé! 👇" });
  } 
  else if (payload === "CHON_2_NGAY") {
    userSessions.set(sender_psid, "2_NGAY");
    await callSendAPI(sender_psid, { text: "Dạ vâng gói 2 Ngày ạ.\n\nAnh/Chị nhắn giúp em xin *NGÀY TỔ CHỨC* và *ĐỊA ĐIỂM* (Quận/Huyện) để em check lịch ngay nhé! 👇" });
  }

  // KHÁCH BẤM XEM GIÁ -> GỬI 2 ẢNH LIÊN TIẾP
  else if (payload === "XEM_GIA_1_NGAY") {
    // Vòng lặp: Gửi lần lượt từng ảnh trong danh sách
    for (const url of IMAGES.ONE_DAY) {
        await sendImage(sender_psid, url);
    }
    // Gửi câu chốt
    setTimeout(async () => {
        await callSendAPI(sender_psid, { text: "Dạ đây là báo giá chi tiết gói 1 Ngày ạ (Gồm 2 ảnh trên).\n\nAnh chị tham khảo cần tư vấn thêm cứ nhắn em nhé! ❤️" });
    }, 1000);
  } 
  else if (payload === "XEM_GIA_2_NGAY") {
    // Vòng lặp: Gửi lần lượt từng ảnh trong danh sách
    for (const url of IMAGES.TWO_DAYS) {
        await sendImage(sender_psid, url);
    }
    // Gửi câu chốt
    setTimeout(async () => {
        await callSendAPI(sender_psid, { text: "Dạ đây là báo giá chi tiết gói 2 Ngày ạ (Gồm 2 ảnh trên).\n\nAnh chị tham khảo cần tư vấn thêm cứ nhắn em nhé! ❤️" });
    }, 1000);
  }
}

// CÁC HÀM GỬI DỮ LIỆU SANG FACEBOOK
async function sendImage(sender_psid, imageUrl) {
  const requestBody = {
    recipient: { id: sender_psid },
    message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } }
  };
  await sendToFB(requestBody);
}

async function callSendAPI(sender_psid, response) {
  const requestBody = { recipient: { id: sender_psid }, message: response };
  await sendToFB(requestBody);
}

async function sendToFB(body) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
