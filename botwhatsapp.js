require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
// 🚀 استيراد مكتبة Groq الرسمية
const Groq = require("groq-sdk");

// 🌐 سيرفر الويب المخصص لمنصة Render لضمان بقاء البوت حياً 24 ساعة
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 البوت شغال ومستيقظ زي اللوز 24 ساعة!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running on port ${PORT}`);
});

// تهيئة عميل Groq الذكي (يقرأ المفتاح تلقائياً من إعدادات السيرفر للحماية)
const apiKey = process.env.GROQ_API_KEY; // تم التعديل إلى GROQ_API_KEY
const groq = new Groq({ apiKey: apiKey });

// Destination restaurant JID and details
const RESTAURANT_NUMBER = "967773267572@s.whatsapp.net";
const RESTAURANT_RAW_PHONE = "+967773267572";
const RESTAURANT_NAME = " Alpha One ";

// ==========================================
// 🍔 المنيو الرسمي القابل للتعديل والتغيير
// ==========================================
const RESTAURANT_MENU = `
🌯 الشاورما والصاج (إذا طلب العميل "صاج" يقصد عربي لحم او دجاج):
* صاروخ صغير (أو صاج عادي): 500 ريال
* صاروخ دبل (أو صاج دبل): 900 ريال
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

🥤 المشروبات (الموزع / الحبة / البارد):
* بيبسي: 300 ريال
* سفن: 300 ريال
* ميرندا: 300 ريال
* ماء (مشلي): 200 ريال

🧄 الصوصات والمقبلات المجانية (تأتي مع الطلب حسب الرغبة):
* ثوم (ثومية)، جبنة, باربكيو، رانش، صوص حار (بسباس / شطة)

➕ إضافات مدفوعة (يتم إضافة سعرها للإجمالي):
* جبنة إضافية (أو دبل جبن): 200 ريال
* بطاطس (بطاط): 500 ريال
* مشروب إضافي (بارد زيادة): 300 ريال

🔥 التخصيصات والمصطلحات المدعومة (مجانية):
* حار / بسباس / شطة / عشار (تعني إضافة فلفل حار)
* بدون بسباس / بارد / بدون شطة (تعني إلغاء الحار تماماً)
* بدون كتشب / بدون مخلل / بدون مايونيز
* بدون كبزرة / بدون خضار / بدون طماطم
`;

// In-memory management structures
const sessions = {};
const messageQueues = {};
const processingLocks = {};

// Function to generate the System Prompt with dynamic menu integration
function generateSystemPrompt() {
  return `
أنت موظف ذكاء اصطناعي احترافي، مبهج، ودود جداً، وصارم في نفس الوقت لمطعم ${RESTAURANT_NAME} 🍔.

===================================
🎨 قواعد صياغة الرسائل والأسلوب البصري (مهم جداً لسعادة العميل)
===================================
* يجب أن تكون ردودك قصيرة، مقسمة إلى فقرات واضحة، ومريحة جداً للعين. تجنب نهائياً الجدران النصية الطويلة المملة.
* استخدم الإيموجيات (Emojis) بكثرة وتناسق في بداية ونهاية السطور لتضفي حيوية ومرحاً (مثل: 🍔, 🌯, 🍕, 🤤, 🔥, ✨, 🎉, ❤️, 🥤).
* تحدث بلهجة ترحيبية يمنية لطيفة جداً تفتح نفس العميل للأكل (استخدم كلمات مثل: نورتنا، يا غالي، على كيف كيفك، من عيوني، تدلل، يدق في الرأس).
* اجعل استعراض المأكولات مشوقاً وشهياً (مثال: برجر يقطر جبنة 🧀، بيتزا تمط 🤤).

===================================
🚨 قاعدة التعامل مع الطلبات الخارجة عن المنيو (حاسم جداً)
===================================
* إذا طلب العميل أي صنف، مأكولات، أو مشروبات غير متواجدة في المنيو الموضح أدناه (مثل: مندي، كبسة، كبة، مقبلات أخرى، عصائر طبيعية، إلخ):
  - يجب عليك الاعتذار منه فوراً وبكل لباقة ولطف بالعامية اليمنية.
  - قل له حرفياً ما يشبه هذا المعنى: "العفو منك يا غالي، هذا الطلب غير موجود حالياً في منيو المطعم 💔، المنيو حقنا متخصص بـ (الشاورما اللذيذة 🌯، البرجر المنفجر بالجبنة 🍔، والبيتزا الرهيبة 🍕)".
  - اختم كلامك دائماً بسؤال تفاعلي يسعده: "هل تشتي تختار شيء ثاني يفتح النفس من المنيو؟ ✨".

===================================
🇾🇪 دليل وفهم اللهجة العامية اليمنية
===================================
يجب عليك فهم الكلمات العامية التي يكتبها العميل وترجمتها فوراً في عقلك دون تصحيحها للعميل، بل تعامل معها بذكاء:
* "بسباس" أو "شطة" أو "عشار" = صوص حار أو فلفل حار.
* "بدون بسباس" أو "شتوا بارد" = الغاء الحار تماماً.
* "صاج" أو "سندويش" = يقصد بها فئة الشاورما أو العربي الموضحة بالمنيو.
* "بطاط" = بطاطس مقلية.
* "موزع" أو "بارد" أو "حبة" = يقصد بها المشروبات الغازية (بيبسي، سفن، ميرندا).
* "مشلي" = ماء.
* "قطّب" أو "استعجل" = جهز الطلب سريعاً (رد عليه بلطف وثقة).

========================
🎯 مهمتك الأساسية
========================
* استقبال العملاء باحتراف ومساعدتهم في اختيار الطلبات من المنيو بدقة تامة وبأسلوب يفتح النفس.
* فهم اللهجة العربية والعامية اليمنية والتخصيصات المعقدة.
* حساب الأسعار الإجمالية وتجهيز الفاتورة برياضيات دقيقة 100% بناءً على الأسعار المحددة في المنيو فقط. لا تخترع أسعاراً أبداً.

==================================
🚨 قانون جمع البيانات الإلزامية والصارمة
==================================
قبل استكمال الطلب وعرض الفاتورة المبدئية، يجب عليك التأكد من جمع وحيازة البيانات التالية بالكامل من العميل:
1. الاسم الكامل للعميل.
2. رقم هاتف العميل.
3.  نوع الطلب: (محلي) أو (توصيل) أو (استلام من المطعم).
   - إذا كان الطلب (توصيل): يجب حتماً أخذ العنوان بالتفصيل والموقع بشكل واضح جداً.

⚠️ تحذير حاسم: ممنوع منعاً باتاً الانتقال إلى "المرحلة 1" (عرض الفاتورة المبدئية وسؤال العميل إن كان يؤكد الطلب) طالما هناك نقص في أي من هذه البيانات الأساسية. إذا حدد العميل طلباته ولم يعطك بياناته، اطلبها منه فوراً بلطف وحماس يمني.

⚠️ تنبيه بخصوص أرقام الهواتف: لا تقم بتحليل أو فحص أو تدقيق صحة أرقام الهواتف بنفسك مطلقاً ولا تدخل في جدال مع العميل حول الأرقام (هناك نظام برمجيات خلفي يقوم بفحص الرقم تلقائياً وحظر العميل إن أرسل رقماً خاطئاً). أي رقم يرسله العميل، اعتبره مقبولاً في حوارك طالما ذكر الاسم وطريقة التوصيل، ثم انتقل فوراً لعرض الفاتورة المبدئية.

==================================================
⚠️ إدارة المشاكل، الشكاوى، والطلبات السابقة (مهم جداً)
==================================================
إذا سأل العميل عن طلب متأخر, أو يشتكي من مشكلة في طلب سابق، أو يستفسر عن حالة طلب قديم، أو لديه شكوى عامة؛ لا تحاول اختراع إجابة أو تخمين حالة الطلب. بدلاً من ذلك، قم بالرد فوراً وبكل لطف بتوجيهه للتواصل مع إدارة المطعم مباشرة عبر الهاتف أو الواتساب على الرقم التالي:
${RESTAURANT_RAW_PHONE}

========================
🍔 المنيو الرسمي الحالي للمطعم
========================
${RESTAURANT_MENU}

==================================
🧠 قواعد الحوار والمرحلتين الهامتين
==================================

المرحلة 1: المراجعة وعرض الفاتورة المبدئية للعميل (لا تستخدم كلمة CONFIRMED_ORDER هنا أبداً)
عند اكتمال البيانات الإلزامية تماماً (الاسم، رقم الهاتف، نوع الطلب، والعنوان بالتفصيل إن كان توصيل)، اعرض له الفاتورة بشكل منسق مع الإجمالي واسأله صراحة: "هل تؤكد الطلب يا غالي؟". 
⚠️ تحذير: في هذه المرحلة ممنوع منعاً باتاً كتابة الكلمة الدلالية CONFIRMED_ORDER. انتظر رد العميل أولاً بعد التحقق الكامل.

المرحلة 2: التأكيد النهائي والإرسال للمطعم
فقط عندما يرد العميل بكلمة موافقة واضحة وصريحة تلي عرض الفاتورة المبدئية مثل (نعم، أكد، تأكيد، موافق، تم, ايوه، تمام)، يجب عليك صياغة الرد ليتضمن الكلمة الدلالية متبوعة بالفاتورة مباشرة.
⚠️ تنبيه صارم وحاسم: ممنوع تماماً كتابة أي كلام ودي، أو ترحيب، أو تحديث، أو شكر، أو جمل حوارية (مثل: تمام سأقوم بالتأكيد، أو سيتم التوصيل بعد ساعة) قبل أو بعد الفاتورة في هذه المرحلة. التزم بالهيكل والأيقونات التالية حرفياً دون زيادة أو نقصان حرف واحد:

CONFIRMED_ORDER
👤 الاسم:
[اسم العميل]

📞 رقم هاتف العميل للتواصل:
[رقم الهاتف المكون من 9 أرقام الذي قدمه العميل]

🛵 نوع الطلب:
[محلي / توصيل / استلام من المطعم]

📍 العنوان:
[العنوان بالتفصيل، أو اكتب "استلام من المطعم" إذا كان سفري]

🍔 الطلبات:
[قائمة الطلبات مع التخصيصات، كل طلب في سطر منفصل]
...

💰 الإجمالي: XXX ريال
`;
}

// 🛠️ دالة التحقق البرمجي الصارم من أرقام الهواتف اليمنية المكونة من 9 أرقام فقط
function validateYemeniPhoneNumber(text) {
  let numbersOnly = text.replace(/\D/g, '');

  if (!numbersOnly || numbersOnly.length < 5) return { isValid: true };

  if (numbersOnly.startsWith('967')) {
    numbersOnly = numbersOnly.substring(3);
  } else if (numbersOnly.startsWith('00967')) {
    numbersOnly = numbersOnly.substring(5);
  }
  
  if (numbersOnly.startsWith('0')) {
    numbersOnly = numbersOnly.substring(1);
  }

  const yemeniRegex = /^(77|71|73|78)\d{7}$/;
  
  if (!yemeniRegex.test(numbersOnly)) {
    return {
      isValid: false,
      errorReason: "⚠️ عذراً منك يا غالي، رقم الهاتف الذي أرسلته غير صحيح! 📞\n\nتأكد أن الرقم يتكون من 9 أرقام تماماً (لا ينقص ولا يزيد) ويبدأ بـ (77 أو 71 أو 73 أو 78). أرسل رقمك الصحيح الآن لكي نعتمد الفاتورة والطلب فوراً! ✨"
    };
  }

  return { isValid: true };
}

// Helper function to process queues sequentially for each user
async function processUserQueue(from, sock) {
  if (processingLocks[from] || !messageQueues[from] || messageQueues[from].length === 0) return;

  processingLocks[from] = true;
  const currentMsg = messageQueues[from].shift();

  try {
    const validation = validateYemeniPhoneNumber(currentMsg.text);
    if (!validation.isValid) {
      await sock.sendMessage(from, { text: validation.errorReason });
      return; 
    }

    // 🛠️ تعديل هيكلة مصفوفة الجلسات (Sessions) لتناسب Groq
    if (!sessions[from]) {
      sessions[from] = [];
    }

    sessions[from].push({ role: "user", content: currentMsg.text });

    // 🛠️ استدعاء Groq API 
    const responseAI = await groq.chat.completions.create({
      messages: [
        { role: "system", content: generateSystemPrompt() },
        ...sessions[from]
      ],
      model: "llama-3.3-70b-versatile", // موديل قوي جداً للتعامل مع التعليمات المعقدة والعربية
      temperature: 0.15 
    });

    const response = responseAI.choices[0]?.message?.content || "حدث خطأ أثناء معالجة الطلب.";
    
    // تسجيل رد البوت في الجلسة بالهيكلة الجديدة
    sessions[from].push({ role: "assistant", content: response }); 

    if (response.includes("CONFIRMED_ORDER")) {
      let cleanOrder = response.split("CONFIRMED_ORDER")[1] || response;
      
      const receiptMatch = cleanOrder.match(/(👤 الاسم:[\s\S]*💰 الإجمالي:[^\n]*)/);
      if (receiptMatch && receiptMatch[1]) {
         cleanOrder = receiptMatch[1].trim();
      } else {
         cleanOrder = cleanOrder.trim();
      }

      let cleanNumber = (currentMsg.rawMsg.key.participant || from).split(':')[0].split('@')[0];
      
      if (currentMsg.rawMsg.pushName) {
         console.log(`👤 Verified active customer checkout: ${currentMsg.rawMsg.pushName}`);
      }

      const finalMessage = `🚨 طلب جديد - ${RESTAURANT_NAME} 🍔\n\n${cleanOrder}\n\n🤖 معرف النظام الاحتياطي:\n${cleanNumber}\n\n📍 حالة الطلب:\nبانتظار التحضير`;

      await sock.sendMessage(RESTAURANT_NUMBER, { text: finalMessage });
      await sock.sendMessage(from, { text: "✅ تم تأكيد طلبك وإرساله للمطعم بنجاح، نورتنا وألف صحة وهنا على قلبك مسبقاً! ❤️ جنبك وعيننا عليك وجاري التجهيز... 🚀" });
      
      delete sessions[from]; 
      console.log(`🗑️ Session dynamic cleanup completed for [${from}].`);
    } else {
      await sock.sendMessage(from, { text: response });
    }

  } catch (groqError) {
    console.error(`❌ Groq Processing Engine Exception for [${from}]:`, groqError);
    await sock.sendMessage(from, { text: "⚠️ نعتذر منك يا غالي، هناك ضغط حالي على النظام. يرجى إعادة إرسال رسالتك الأخيرة وسأخدمك فوراً من عيوني! ✨" });
  } finally {
    processingLocks[from] = false;
    setTimeout(() => processUserQueue(from, sock), 200);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  // 🚀 إعداد الاتصال لطلب كود نصي بدلاً من الـ QR
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.0"] 
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔑 طلب كود الربط إذا لم يكن مسجلاً مسبقاً وطباعته بشكل ضخم في الـ Logs
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
      console.log("✅ Bot successfully connected. Groq Engine active!");
      console.log("==================================================");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message || msg.key.fromMe || msg.key.remoteJid === "status@broadcast") return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption;

      const from = msg.key.remoteJid;

      if (!text) return;

      if (text.length > 600) {
        await sock.sendMessage(from, { text: "⚠️ عذراً يا غالي، الرجاء كتابة طلبك باختصار وبشكل واضح في رسالة قصيرة ليتمكن النظام من قراءتها بدقة وتجهيزها لك سريعاً! ✨" });
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