require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const Groq = require("groq-sdk");

// ==========================================
// 1. Configuration & Environment Variables
// ==========================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("❌ ERROR: GROQ_API_KEY is missing in .env file.");
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

const RESTAURANT = {
  NUMBER: "967773267572@s.whatsapp.net",
  RAW_PHONE: "+967773267572",
  NAME: "شوارما هت",
};

const AI_MODEL = "llama-3.3-70b-versatile";

// ==========================================
// 2. State Management
// ==========================================
/** * Map to store active user sessions. 
 * Key: Remote JID (String) | Value: Chat History (Array) 
 */
const sessions = new Map();

// ==========================================
// 3. System Prompt
// ==========================================
const SYSTEM_PROMPT = `
أنت موظف ذكاء اصطناعي احترافي لمطعم ${RESTAURANT.NAME} 🍔.

========================
🎯 مهمتك الأساسية
========================
* استقبال العملاء باحتراف ومساعدتهم في اختيار الطلبات من المنيو بدقة.
* فهم اللهجة العربية والعامية والتخصيصات المعقدة.
* حساب الأسعار الإجمالية وتجهيز الفاتورة.
* معرفة ما إذا كان العميل يريد الطلب (تجهيز سفري للاستلام من المطعم) أو (توصيل).
* إذا اختار العميل (توصيل)، يجب عليك طلب عنوانه بالتفصيل وموقعه بشكل واضح.
* طلب اسم العميل ورقم هاتفه للتواصل قبل تأكيد الطلب.
* بعد التأكيد، قم بتجهيز فاتورة نهائية واضحة تشتمل على اسم العميل، ورقم هاتف التواصل، ونوع الطلب، والعنوان إن وجد.

==================================================
⚠️ إدارة المشاكل، الشكاوى، والطلبات السابقة
==================================================
إذا سأل العميل عن طلب متأخر، أو يشتكي من مشكلة في طلب سابق، أو يستفسر عن حالة طلب قديم؛ لا تحاول اختراع إجابة أو تخمين حالة الطلب. قم بالرد فوراً وبكل لطف بتوجيهه للتواصل مع إدارة المطعم مباشرة عبر الرقم التالي:
${RESTAURANT.RAW_PHONE}

========================
🍔 المنيو الرسمي
========================
🌯 الشاورما:
* صاروخ صغير: 500 ريال
* صاروخ دبل: 900 ريال
* زنجر: 700 ريال
* عربي دجاج: 600 ريال
* عربي لحم: 850 ريال
* مكسيكي حار: 950 ريال

🍔 البرجر:
* برجر لحم كلاسيك: 1200 ريال
* برجر دجاج كرسبي: 1000 ريال
* برجر دبل: 1700 ريال
* برجر جبنة: 1400 ريال

🍕 البيتزا:
* بيتزا مارجريتا: 1800 ريال
* بيتزا دجاج: 2300 ريال
* بيتزا خضار: 1700 ريال
* بيتزا ميكس: 2600 ريال

🥤 المشروبات:
* بيبسي/سفن/ميرندا: 300 ريال
* ماء: 200 ريال

🧄 الإضافات والصوصات:
* ثوم، جبنة، باربكيو، رانش، صوص حار
* جبنة إضافية: 200 ريال | بطاطس: 500 ريال | مشروب إضافي: 300 ريال

🔥 التخصيصات المدعومة:
* حار، حار جداً، بدون كتشب، بدون مخلل، بدون مايونيز

========================
🧠 قواعد العمل وتدفق الحوار
========================
1. افهم طلبات العميل الذاتية العشوائية وسجلها بدقة.
2. لا تكثر من الأسئلة المتكررة؛ إذا اتضح لك الطلب اسأل عن النواقص فقط.
3. اطلب الاسم ورقم الهاتف الفعلي، واسأل بوضوح: "استلام من المطعم أم توصيل؟".
4. في حال التوصيل، اطلب العنوان بدقة (الحي/الشارع/معلم بارز).
5. اعرض الفاتورة النهائية واسأل صراحة: "هل تؤكد الطلب؟".

========================
⚠️ شرط الإنهاء والتسليم التلقائي
========================
إذا وافق العميل وأكد الطلب بعبارات مثل (نعم، اكد، تم)، صِغ الرد ليبدأ حصرياً بالكلمة الدلالية التالية يتبعها التفاصيل:

CONFIRMED_ORDER
👤 الاسم: [اسم العميل]
📞 رقم الهاتف: [رقم التواصل]
🛵 نوع الطلب: [توصيل / استلام من المطعم]
📍 العنوان: [العنوان أو "استلام من المطعم"]
🍔 الطلبات: ...
💰 الإجمالي: ...
`;

// ==========================================
// 4. Core Bot Logic
// ==========================================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  // Connection Lifecycle
  sock.ev.on("connection.update", ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      console.log("\n📸 قم بمسح كود QR التالي لتسجيل الدخول:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`\n⚠️ انقطع الاتصال. السبب: ${lastDisconnect?.error?.message || "غير معروف"}`);

      if (shouldReconnect) {
        console.log("🔄 جاري محاولة إعادة الاتصال...");
        startBot();
      } else {
        console.log("❌ تم تسجيل الخروج بنجاح. احذف مجلد 'auth' وأعد مسح الـ QR للبدء من جديد.");
      }
    } else if (connection === "open") {
      console.log("\n==================================================");
      console.log("✅ تم الاتصال بنجاح. البوت جاهز لاستقبال الطلبات!");
      console.log("==================================================\n");
    }
  });

  // Message Handling
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      const from = msg.key.remoteJid;

      // Ignore self-messages, broadcasts, and empty messages
      if (!msg.message || msg.key.fromMe || from === "status@broadcast") return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption;

      if (!text) return;

      console.log(`💬 رسالة جديدة من [${from.split("@")[0]}]: ${text}`);

      // Initialize session if not exists
      if (!sessions.has(from)) {
        sessions.set(from, [{ role: "system", content: SYSTEM_PROMPT }]);
      }

      const currentSession = sessions.get(from);
      currentSession.push({ role: "user", content: text });

      try {
        // Fetch response from Groq AI
        const chatCompletion = await groq.chat.completions.create({
          messages: currentSession,
          model: AI_MODEL,
          temperature: 0.5,
        });

        const response = chatCompletion.choices[0]?.message?.content || "حدث خطأ غير متوقع أثناء معالجة الطلب.";
        currentSession.push({ role: "assistant", content: response });

        // Order Confirmation Logic
        if (response.includes("CONFIRMED_ORDER")) {
          const cleanOrder = response.replace("CONFIRMED_ORDER", "").trim();
          const cleanNumber = (msg.key.participant || from).split(":")[0].split("@")[0];
          const customerName = msg.pushName ? msg.pushName : "غير متوفر";

          console.log(`🛒 تم تأكيد طلب جديد للعميل: ${customerName}`);

          const finalMessage = `🚨 طلب جديد - ${RESTAURANT.NAME} 🍔\n\n${cleanOrder}\n\n🤖 معرف النظام:\n${cleanNumber}\n\n📍 حالة الطلب:\nبانتظار التحضير`;

          // Send to Restaurant
          await sock.sendMessage(RESTAURANT.NUMBER, { text: finalMessage });

          // Send to Customer
          await sock.sendMessage(from, { text: "✅ تم تأكيد طلبك وإرساله للمطعم بنجاح، نورتنا! ❤️" });

          // Clear session memory post-checkout
          sessions.delete(from);
          console.log(`🗑️ تم مسح بيانات الجلسة للرقم [${cleanNumber}] بعد إتمام الطلب.`);
          return;
        }

        // Standard AI Reply
        await sock.sendMessage(from, { text: response });

      } catch (aiError) {
        console.error("❌ خطأ في محرك Groq API:", aiError.message);
        await sock.sendMessage(from, { text: "⚠️ نعتذر، يوجد ضغط مؤقت على النظام. يرجى المحاولة مرة أخرى." });
      }

    } catch (runtimeError) {
      console.error("❌ خطأ برمجي حرج:", runtimeError);
    }
  });
}

// Start the application
startBot();