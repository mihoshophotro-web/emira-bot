// api/webhook.js
const VERIFY_TOKEN = "emira_wedding_secret_2024";

export default async function handler(req, res) {
  // 1. XÁC THỰC WEBHOOK (Facebook gọi cái này để kiểm tra)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Forbidden");
    }
    return;
  }

  // 2. XỬ LÝ TIN NHẮN (Khách hàng chat)
  if (req.method === "POST") {
    const body = req.body;
    if (body.object === "page") {
      for (const entry of body.entry) {
        const webhook_event = entry.messaging[0];
        const sender_psid = webhook_event.sender.id;

        if (webhook_event.message) {
          await handleMessage(sender_psid, webhook_event.message);
        } else if (webhook_event.postback) {
          await handlePostback(sender_psid, webhook_event.postback);
        }
      }
      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.status(404).send();
    }
  }
}

// --- LOGIC XỬ LÝ CỦA EMIRA WEDDING ---
const IMAGES = {
  ONE_DAY: "https://drive.google.com/uc?export=view&id=1LrUvjhhEFVWQf3f2w76ZDrU_WySJA6SV", 
  TWO_DAYS: "https://drive.google.com/uc?export=view&id=1GuGpGPiW4ZpAqs5IQWGwb9TbOenqcHv4"
};

async function handleMessage(sender_psid, received_message) {
  const text = received_message.text ? received_message.text.toLowerCase() : "";
  let response;

  // 1. Khách chào hoặc hỏi giá
  if (text.includes("chào") || text.includes("giá") || text.includes("tư vấn")) {
    response = {
      text: "Dạ Emira Wedding xin chào ạ! Em là AI tư vấn của Emira. 🥰\n\nDạ cho em hỏi là mình dự kiến tổ chức các lễ (Ăn hỏi, Cưới) trong cùng 1 ngày hay là 2 ngày khác nhau ạ?",
      quick_replies: [
        { content_type: "text", title: "1 Ngày", payload: "CHON_1_NGAY" },
        { content_type: "text", title: "2 Ngày", payload: "CHON_2_NGAY" }
      ]
    };
  }
  // 2. Khách trả lời số ngày bằng tin nhắn
  else if (text.includes("1 ngày") || text.includes("một ngày")) {
    await handlePostback(sender_psid, { payload: "CHON_1_NGAY" });
    return;
  }
  else if (text.includes("2 ngày") || text.includes("hai ngày")) {
    await handlePostback(sender_psid, { payload: "CHON_2_NGAY" });
    return;
  }
  // 3. Khách nhập địa điểm (Tin nhắn dài > 5 ký tự) -> Xác nhận để gửi ảnh
  else if (text.length > 5) {
     response = {
      text: "Dạ em đã nhận thông tin ạ. Để em gửi đúng bảng giá cho mình, Anh/Chị xác nhận lại giúp em mình chọn gói nào nhé 👇",
      quick_replies: [
        { content_type: "text", title: "Gửi báo giá 1 Ngày", payload: "GUI_GIA_1_NGAY" },
        { content_type: "text", title: "Gửi báo giá 2 Ngày", payload: "GUI_GIA_2_NGAY" }
      ]
    };
  }

  if (response) {
    await callSendAPI(sender_psid, response);
  }
}

async function handlePostback(sender_psid, received_postback) {
  const payload = received_postback.payload;
  
  // Logic nút bấm
  if (payload === "CHON_1_NGAY" || payload === "CHON_2_NGAY") {
    const replyText = "Dạ vâng ạ, em gửi anh chị xem qua sản phẩm bên em:\n- Link ảnh: https://emirawedding.mypixieset.com/photos/\n- Link clip: https://emirawedding.mypixieset.com/videos/\n\nDạ để em kiểm tra lịch trống và báo phí di chuyển chính xác nhất, Anh/Chị cho em xin thêm thông tin về NGÀY TỔ CHỨC và ĐỊA ĐIỂM (Quận/Huyện) của 2 nhà mình được không ạ?";
    await callSendAPI(sender_psid, { text: replyText });
  } 
  else if (payload === "GUI_GIA_1_NGAY") {
    await sendImage(sender_psid, IMAGES.ONE_DAY);
  } 
  else if (payload === "GUI_GIA_2_NGAY") {
    await sendImage(sender_psid, IMAGES.TWO_DAYS);
  }
}

// HÀM GỬI DỮ LIỆU SANG FACEBOOK
async function callSendAPI(sender_psid, response) {
  const requestBody = { recipient: { id: sender_psid }, message: response };
  await sendToFB(requestBody);
}

async function sendImage(sender_psid, imageUrl) {
  const requestBody = {
    recipient: { id: sender_psid },
    message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } }
  };
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