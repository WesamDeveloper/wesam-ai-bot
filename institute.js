require('dotenv').config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
// 1. استيراد مكتبة جوجل جيميناي بدلاً من Groq
const { GoogleGenAI } = require("@google/genai");

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 بوت معهد اللغات يعمل بكفاءة على مدار الساعة!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running on port ${PORT}`);
});

// 2. تهيئة عميل Gemini الذكي
// استبدل المفتاح أدناه بمفتاح Gemini API الخاص بك من Google AI Studio
const apiKey = process.env.GEMINI_API_KEY; 
const ai = new GoogleGenAI({ apiKey: apiKey });

// إعدادات المعهد ورقم الإدارة المستلم لطلبات التسجيل
const INSTITUTE_NUMBER = "967773267572@s.whatsapp.net";
const INSTITUTE_RAW_PHONE = "+967773267572";
const INSTITUTE_NAME = "Alpha One";

// ==========================================
// 🔤 دليل دورات اللغة الإنجليزية المتاحة
// ==========================================

const INSTITUTE_COURSES = `
🎓 برنامج اللغة الإنجليزية العام (Regular Program)

📖 مرحلة التأسيس:
• Literacy - 12,000 ريال
• Access A - 15,000 ريال
• Access B - 15,000 ريال

📚 المرحلة الأساسية:
• Basic A - 18,000 ريال
• Basic B - 18,000 ريال

🚀 المرحلة المتوسطة:
• Level 1A - 20,000 ريال
• Level 1B - 20,000 ريال
• Level 2A - 22,000 ريال
• Level 2B - 22,000 ريال

✍️ مهارات الكتابة:
• Writing 1 - 18,000 ريال
• Writing 2 - 20,000 ريال
• Writing 3 - 22,000 ريال

🌟 المرحلة المتقدمة:
• Level 3A - 25,000 ريال
• Level 3B - 25,000 ريال
• Level 4A - 28,000 ريال
• Level 4B - 28,000 ريال

🏆 المستوى الاحترافي:
• QA - 30,000 ريال
• QB - 30,000 ريال
• QC - 35,000 ريال
• QD - 35,000 ريال

⚡ البرنامج المكثف (Intensive Program)

• Access A & B Intensive - 25,000 ريال
• Intensive Basic A & B - 30,000 ريال
• Intensive Level 1A & B - 35,000 ريال
• Intensive Level 2A & B - 38,000 ريال
• Intensive Level 3A & B - 42,000 ريال
• Intensive Level 4A & B - 45,000 ريال
• Intensive QA & QB - 50,000 ريال
• Intensive QC & QD - 55,000 ريال

🎁 العروض والتخفيضات الحالية:

🔥 خصم 15% عند التسجيل في مستويين أو أكثر.
👨‍👩‍👧‍👦 خصم 20% للمجموعات (3 طلاب فأكثر).
🎓 خصم 10% للطلاب المتفوقين.
🎉 اختبار تحديد مستوى مجاني.
📜 شهادة معتمدة مجانية عند اجتياز المستوى.
🎁 خصم 25% على التسجيل المبكر قبل بداية الدورة.

⏰ الفترات الدراسية المتاحة:

🌅 الفترة الصباحية:
• 08:00 صباحاً - 10:00 صباحاً
• 10:00 صباحاً - 12:00 ظهراً

🌤️ الفترة العصرية:
• 02:00 ظهراً - 04:00 عصراً

🌙 الفترة المسائية:
• 04:00 عصراً - 06:00 مساءً
• 06:00 مساءً - 08:00 مساءً

📅 أيام الدراسة:
• من السبت إلى الأربعاء

📍 مميزات البرنامج:
• مناهج عالمية معتمدة.
• اختبار تحديد مستوى مجاني.
• تطوير مهارات القراءة والكتابة والاستماع والمحادثة.
• مدربون متخصصون.
• شهادات اجتياز للمستويات.
• برنامج عادي وبرنامج مكثف حسب احتياج الطالب.

📍 الموقع:
شارع الزبيري، مقابل مستشفى الجمهورية، صنعاء، اليمن.
`;

// In-memory management structures
const sessions = {};
const messageQueues = {};
const processingLocks = {};

// دالة تحويل الأرقام المشرقية (العربية) إلى إنجليزية لتسهيل قراءتها
function normalizeArabicNumerals(text) {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return text.replace(/[٠-٩]/g, function (w) {
    return arabicNumbers.indexOf(w);
  });
}

// دالة توليد التعليمات (System Prompt) الموزونة والرسمية بشكل معتدل
function generateSystemPrompt() {
  return `
أنت موظف استقبال (Receptionist) ذكي، لبق، واحترافي لمعهد ${INSTITUTE_NAME} لتعليم اللغة الإنجليزية 🎓🔤.
تعتمد دراسة اللغة الإنجليزية في المعهد بشكل أساسي على منهج وتخصص (American English File).

===================================
🎯 قواعد الأسلوب وحجم الردود
===================================
1. **الترحيب الأول (إلزامي وحرفي):** في أول رسالة لك مع أي طالب جديد، رد عليه حرفياً بهذا النص فقط:
"أهلاً وسهلاً بك في ${INSTITUTE_NAME} 💛
أنت وصلت للمكان اللي بيغير علاقتك مع الإنجليزي تماماً 😎✋🏻
تفضل كيف نقدر نساعدك؟"
2. **منع التكرار:** إياك أن تكرر رسالة الترحيب السابقة أو أي عبارات ترحيبية أخرى في الرسائل التالية.
3. **اللغة (شرط صارم جداً):** تحدث باللغة العربية الفصحى السليمة فقط. ⚠️ يمنع منعاً باتاً استخدام أي حروف روسية أو لغات غريبة. إذا أردت أن تسأل العميل عما يهمه، قل "ما الذي يناسبك؟" ولا تستخدم أبداً كلمات مشوهة.
4. **قراءة تاريخ المحادثة:** ركّز جداً في الكلام السابق! لا تطلب معلومة قدمها الطالب مسبقاً.

===================================
🖼️ نظام إرسال صورة الدورات 
===================================
- استخدم الكلمة الدلالية SEND_COURSES_IMAGE **فقط** إذا طلب العميل صراحةً معرفة تفاصيل الدورات أو الأسعار.
- ⚠️ ضع الكلمة في سطر منفصل تماماً، ولا تدمجها وسط الكلام لكي لا يراها العميل.

===================================
🚨 نظام معالجة المشاكل والشكاوى
===================================
* **المشاكل والطلبات الخاصة:** أرسل هذا الرد بوضوح:
  "نعتذر عن أي إزعاج. يرجى التواصل مع الإدارة هاتفياً أو عبر الواتساب على الرقم: ${INSTITUTE_RAW_PHONE} 📞✨"

==================================
🚨 قانون جمع البيانات الإلزامية للحجز
==================================
اجمع البيانات التالية (اطلب الناقص فقط بأسلوب متسلسل):
1. الاسم الكامل.
2. رقم الهاتف (يجب أن يكون 9 أرقام).
3. الدورة المطلوبة.
4. الفترة الزمنية المفضلة (صباحي / عصري / مسائي).

⚠️ تحذير: لا تعرض كشف الحجز المبدئي أبداً إلا إذا اكتملت البيانات الأربعة.

========================
🔤 دليل دورات المعهد الحالي (للمعرفة فقط)
========================
${INSTITUTE_COURSES}

==================================
🧠 المرحلتين الهامتين للحجز
==================================
المرحلة 1: عند اكتمال البيانات، اعرض كشف الحجز واسأله: "هذه بيانات حجزك، يرجى مراجعتها وتأكيدها لنقوم بتثبيت المقعد لك ✨". 
⚠️ تحذير: ممنوع كتابة CONFIRMED_REGISTRATION هنا نهائياً.

المرحلة 2: عند موافقته الصريحة (تمام، ايوه، نعم، أكد، تم)، أرسل الفاتورة بالصيغة التالية حرفياً ودون أي كلام آخر:

CONFIRMED_REGISTRATION
👤 اسم الطالب الكامل:
[اسم الطالب]

📞 رقم الهاتف للتواصل:
[رقم الهاتف الذي قدمه الطالب ووافق عليه]

📚 البرنامج التدريبي:
[دورة الإنجليزي المختارة]

⏰ الفترة المفضلة:
[صباحي / عصري / مسائي]

💰 الرسوم الإجمالية: XXX ريال
`;
}

// معالجة الرسائل المتتالية بالتتابع
async function processUserQueue(from, sock) {
  if (processingLocks[from] || !messageQueues[from] || messageQueues[from].length === 0) return;

  processingLocks[from] = true;
  const currentMsg = messageQueues[from].shift();

  try {
    const normalizedText = normalizeArabicNumerals(currentMsg.text);
    let injectedText = normalizedText;

    // 🧠 نظام التحقق البرمجي الذكي للأرقام 
    const numbersInText = normalizedText.match(/\d+/g);
    if (numbersInText) {
      let foundValid = false;
      let foundInvalid = false;
      
      for (let num of numbersInText) {
        if (num.length === 9) {
          foundValid = true;
          injectedText += `\n\n[ملاحظة برمجية مخفية للبوت: العميل أدخل للتو رقم هاتف صحيح ومكتمل مكون من 9 أرقام وهو (${num}). اقبله فوراً ولا تقل أبداً أنه ناقص، وانتقل لطلب باقي البيانات.]`;
          break;
        } else if (num.length >= 6) { 
          foundInvalid = true;
        }
      }
      
      if (!foundValid && foundInvalid) {
        injectedText += `\n\n[ملاحظة برمجية مخفية للبوت: العميل حاول إدخال رقم هاتف ولكنه لا يتكون من 9 أرقام. اطلب منه بلطف إعادة كتابة الرقم ليكون 9 أرقام فقط.]`;
      }
    }

    if (!sessions[from]) {
      sessions[from] = [];
    }

    sessions[from].push({ role: "user", content: injectedText });

    if (sessions[from].length > 20) {
      sessions[from] = sessions[from].slice(-20);
    }

    // 3. تحويل مصفوفة الجلسات لتلائم بنية Gemini (أدوار: user و model)
    const geminiContents = sessions[from].map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 4. استدعاء Gemini بدلاً من Groq
    const responseAI = await ai.models.generateContent({
      model: "gemini-2.5-flash", // نموذج خفيف وسريع وممتاز للمحادثات
      contents: geminiContents,
      config: {
        systemInstruction: generateSystemPrompt(), // وضع التعليمات هنا بشكل صحيح
        temperature: 0.1
      }
    });

    let response = responseAI.text || "حدث خطأ أثناء معالجة طلبك.";
    
    // 🧹 فلتر التنظيف الإجباري (يمسح أي حروف روسية ويصلح الكلمة المشوهة)
    response = response.replace(/تтересك/g, "تناسبك");
    response = response.replace(/[а-яА-ЯёЁ]/g, ""); 

    sessions[from].pop(); 
    sessions[from].push({ role: "user", content: normalizedText }); 
    sessions[from].push({ role: "assistant", content: response }); 

    let sendImageFlag = false;
    if (/SEND_COURSES_IMAGE/.test(response)) {
      sendImageFlag = true;
      response = response.replace(/\**SEND_COURSES_IMAGE\**/g, "").trim();
    }

    if (/CONFIRMED_REGISTRATION/.test(response)) {
      let cleanOrder = response.split(/CONFIRMED_REGISTRATION/)[1] || response;
      
      const receiptMatch = cleanOrder.match(/(👤 اسم الطالب الكامل:[\s\S]*💰 الرسوم الإجمالية:[^\n]*)/);
      if (receiptMatch && receiptMatch[1]) {
         cleanOrder = receiptMatch[1].trim();
      } else {
         cleanOrder = cleanOrder.trim();
      }

      cleanOrder = cleanOrder.replace(/\*\*/g, "");

      let cleanNumber = (currentMsg.rawMsg.key.participant || from).split(':')[0].split('@')[0];
      
      if (currentMsg.rawMsg.pushName) {
         console.log(`🎓 English Student registration approved: ${currentMsg.rawMsg.pushName}`);
      }

      const finalMessage = `🚨 طلب حجز كورس إنجليزي جديد - معهد ${INSTITUTE_NAME} 🎓\n\n${cleanOrder}\n\n🤖 معرف النظام الاحتياطي:\n${cleanNumber}\n\n📍 حالة الطلب:\nبانتظار الحضور للمعهد لإجراء تحديد المستوى وتثبيت الحجز`;

      await sock.sendMessage(INSTITUTE_NUMBER, { text: finalMessage });
      await sock.sendMessage(from, { text: "✅ تم تسجيل حجزك المبدئي بنجاح وإرسال بياناتك للإدارة. يرجى زيارة المعهد خلال 48 ساعة لتثبيت المقعد وبدء الدراسة. يسعدنا انضمامك إلينا! 🚀✨" });
      
      delete sessions[from]; 
      console.log(`🗑️ Session dynamic cleanup completed for [${from}].`);

    } else if (sendImageFlag) {
      try {
        await sock.sendMessage(from, { 
          image: { url: './courses.jpg' }, 
          caption: response || '✨ هذه قائمة بالدورات والأسعار المتاحة في المعهد'
        });
      } catch (imgError) {
        console.error("❌ فشل إرسال الصورة، تأكد من وجود ملف courses.jpg:", imgError);
        await sock.sendMessage(from, { text: response + "\n\n⚠️ (لم نتمكن من إرفاق الصورة، يرجى قراءة النص أعلاه)" });
      }
    } else {
      await sock.sendMessage(from, { text: response });
    }

  } catch (apiError) {
    console.error(`❌ Gemini Processing Engine Exception for [${from}]:`, apiError);
    await sock.sendMessage(from, { text: "⚠️ نعتذر منك، يواجه النظام ضغطاً بسيطاً حالياً. يرجى إعادة إرسال رسالتك الأخيرة وسنقوم بخدمتك فوراً! ✨" });
  } finally {
    processingLocks[from] = false;
    setTimeout(() => processUserQueue(from, sock), 200);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.0"] 
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode("967778498987"); 
        console.log("\n==================================================");
        console.log(`🔑🔑 KEY PAIRING CODE: ${code} 🔑🔑`);
        console.log("==================================================\n");
      } catch (err) {
        console.error("❌ فشل طلب كود الربط من السيرفر:", err);
      }
    }, 6000); 
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("⚠️ Connection closed due to:", lastDisconnect?.error?.message || "Unknown error");

      if (shouldReconnect) {
        console.log("🔄 Reconnecting session...");
        startBot();
      } else {
        console.log("❌ Logged out completely. Delete 'auth' folder and rescan QR.");
      }
    } else if (connection === "open") {
      console.log("==================================================");
      console.log("✅ English Institute Bot successfully connected. Gemini Engine active!");
      console.log("==================================================");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message || msg.key.fromMe || msg.key.remoteJid === "status@broadcast") return;

      const from = msg.key.remoteJid;

      if (from.endsWith("@g.us")) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption;

      if (!text) return;

      if (text.length > 600) {
        await sock.sendMessage(from, { text: "⚠️ عذراً، يرجى اختصار استفسارك لكي يتمكن النظام من فهمك ومساعدتك بشكل صحيح." });
        return;
      }

      console.log(`💬 Inbound buffered message from [${from}]: ${text}`);

      if (!messageQueues[from]) {
        messageQueues[from] = [];
      }

      messageQueues[from].push({ text, rawMsg: msg });
      processUserQueue(from, sock);

    } catch (error) {
      console.error("❌ Critical error intercepted inside message handler event:", error);
    }
  });
}

process.on("unhandledRejection", (reason, promise) => {
    console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("🚨 Uncaught Exception caught to prevent loop crashes:", error);
});

startBot();