require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino"); // للتحكم في سجلات النظام
const qrcode = require("qrcode-terminal");
const Groq = require("groq-sdk");

// ==========================================
// 1. إعدادات النظام (Configuration)
// ==========================================
const CONFIG = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_MODEL: "llama-3.3-70b-versatile",
  MAX_HISTORY_LENGTH: 20, // أقصى عدد للرسائل المحفوظة لكل مستخدم لمنع استهلاك الذاكرة
  OWNER: {
    RAW_PHONE: "+967775904988",
    NAME: "وسام الجنيد",
    BRAND: "Wesam Technology"
  }
};

// التأكد من وجود مفتاح API
if (!CONFIG.GROQ_API_KEY) {
  console.error("❌ خطأ: مفتاح GROQ_API_KEY مفقود في ملف .env");
  process.exit(1);
}

// ==========================================
// 2. التعليمات الأساسية (System Prompt)
// ==========================================
const SYSTEM_PROMPT = `
أنت مساعد ذكاء اصطناعي احترافي خاص بـ ${CONFIG.OWNER.NAME} 👨‍💻
صاحب علامة "${CONFIG.OWNER.BRAND}".

========================
🎯 معلومات عن وسام الجنيد
========================
* مطور تطبيقات ومواقع.
* يعمل باستخدام Flutter و React وتقنيات الذكاء الاصطناعي.
* يصنع محتوى تقني وبرمجي على السوشيال ميديا.

========================
🧠 مهامك الأساسية
========================
* الرد على العملاء والمتابعين بطريقة احترافية وودية.
* شرح خدمات وسام التقنية بشكل واضح.
* مساعدة العملاء في طلب تصميم أو برمجة تطبيقات ومواقع.
* مساعدة الناس في معرفة خدمات البرمجة والتصميم والذكاء الاصطناعي.

========================
💼 الخدمات المتوفرة
========================
📱 تطوير تطبيقات Flutter
🌐 تصميم وبرمجة مواقع إلكترونية
🤖 مشاريع ذكاء اصطناعي
🎨 تصميم واجهات UI/UX
💬 بوتات واتساب ذكية

========================
🗣️ طريقة الرد
========================
* تكلم باللهجة العربية الودية.
* كن احترافي لكن بسيط ولا تطل في الردود.
* استخدم إيموجيات خفيفة: 🚀 💻 🤖 ⚡

========================
💰 الأسعار
========================
إذا سأل أحد عن الأسعار قل:
"يعتمد السعر على تفاصيل المشروع 👍
ارسل فكرتك كاملة وسيتم تحديد التكلفة المناسبة."

========================
📞 التواصل المباشر
========================
إذا طلب العميل التواصل المباشر أعطه الرقم التالي:
${CONFIG.OWNER.RAW_PHONE}

========================
⚠️ قواعد مهمة
========================
* لا تخترع معلومات غير موجودة.
* إذا كان السؤال خارج اختصاص وسام قل بلطف أنك غير متأكد.
`;

// ==========================================
// 3. الفئة الأساسية للبوت (Bot Class)
// ==========================================
class WesamAIBot {
  constructor() {
    this.groq = new Groq({ apiKey: CONFIG.GROQ_API_KEY });
    this.sessions = new Map();
    this.sock = null;
  }

  /**
   * تهيئة البوت وتشغيل الاتصال
   */
  async start() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) // إخفاء السجلات المزعجة
    });

    this.sock.ev.on("creds.update", saveCreds);
    this.sock.ev.on("connection.update", this.handleConnection.bind(this));
    this.sock.ev.on("messages.upsert", this.handleMessages.bind(this));
  }

  /**
   * معالجة حالة الاتصال (QR, Disconnect, Connect)
   */
  handleConnection({ qr, connection, lastDisconnect }) {
    if (qr) {
      console.log("\n📸 امسح رمز QR لتسجيل الدخول:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("\n⚠️ انقطع الاتصال بالواتساب");

      if (shouldReconnect) {
        console.log("🔄 جاري إعادة الاتصال...");
        this.start(); // إعادة التشغيل
      } else {
        console.log("❌ تم تسجيل الخروج. يرجى حذف مجلد auth وإعادة مسح الرمز.");
      }
    } else if (connection === "open") {
      console.log("\n==================================");
      console.log("✅ تم تشغيل مساعد وسام الجنيد بنجاح");
      console.log("==================================\n");
    }
  }

  /**
   * استقبال ومعالجة الرسائل الواردة
   */
  async handleMessages({ messages }) {
    try {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return; // تجاهل رسائل البوت نفسه

      const from = msg.key.remoteJid;
      if (from === "status@broadcast") return; // تجاهل الحالات

      // استخراج النص من أنواع الرسائل المختلفة
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption;

      if (!text) return;

      const senderName = msg.pushName || from.split("@")[0];
      console.log(`💬 رسالة من [${senderName}]: ${text}`);

      await this.processAIResponse(from, text);
    } catch (error) {
      console.error("❌ خطأ في معالجة الرسالة:", error.message);
    }
  }

  /**
   * تجهيز الجلسة والتواصل مع Groq AI
   */
  async processAIResponse(from, userText) {
    // 1. تهيئة الجلسة إذا لم تكن موجودة
    if (!this.sessions.has(from)) {
      this.sessions.set(from, [
        { role: "system", content: SYSTEM_PROMPT }
      ]);
    }

    const currentSession = this.sessions.get(from);

    // 2. إضافة رسالة المستخدم
    currentSession.push({ role: "user", content: userText });

    try {
      // 3. طلب الرد من الذكاء الاصطناعي
      const chatCompletion = await this.groq.chat.completions.create({
        messages: currentSession,
        model: CONFIG.AI_MODEL,
        temperature: 0.6
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content || "⚠️ لم أتمكن من صياغة الرد.";

      // 4. حفظ رد الذكاء الاصطناعي في الجلسة
      currentSession.push({ role: "assistant", content: aiResponse });

      // 5. إدارة الذاكرة: حذف الرسائل القديمة إذا تجاوزت الحد المسموح
      if (currentSession.length > CONFIG.MAX_HISTORY_LENGTH) {
        // نحتفظ بأول رسالة (System Prompt) ونحذف أقدم رسالتين (سؤال وجواب)
        currentSession.splice(1, 2); 
      }

      // 6. إرسال الرد عبر الواتساب
      await this.sock.sendMessage(from, { text: aiResponse });

    } catch (aiError) {
      console.error("❌ خطأ في Groq API:", aiError.message);
      await this.sock.sendMessage(from, { text: "⚠️ النظام مشغول حالياً أو أن هناك تحديثات. يرجى المحاولة بعد قليل." });
      
      // إزالة آخر رسالة للمستخدم من الجلسة لتجنب تراكم الأسئلة بدون إجابات
      currentSession.pop(); 
    }
  }
}

// ==========================================
// 4. تشغيل التطبيق
// ==========================================
const bot = new WesamAIBot();
bot.start();