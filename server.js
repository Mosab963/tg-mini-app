const express = require('express');
const cors = require('cors');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const apiId = parseInt(process.env.API_ID || "0", 10);
const apiHash = process.env.API_HASH || "";
const phoneNumber = process.env.TEST_PHONE || "";

// حفظ العميل مؤقتاً في الذاكرة لكي لا يفقد الاتصال
let activeClients = {};

app.post('/api/send-code', async (req, res) => {
  try {
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
    });
    
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phoneNumber,
        apiId: apiId,
        apiHash: apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    // تخزين العميل والـ Hash مؤقتاً برقم الهاتف
    activeClients[phoneNumber] = {
      client: client,
      phoneCodeHash: result.phoneCodeHash
    };

    res.json({
      success: true,
      message: 'تم إرسال رمز التحقق بنجاح',
      phoneCodeHash: result.phoneCodeHash,
      phone: phoneNumber
    });

  } catch (error) {
    console.error('خطأ في إرسال الرمز:', error);
    res.status(500).json({ success: false, error: error.errorMessage || error.message });
  }
});

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
    console.log('SESSION STRING:', savedSession);

    // حذف العميل من الذاكرة بعد النجاح
    delete activeClients[phoneNumber];

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح واستخراج الجلسة',
      sessionString: savedSession
    });

  } catch (error) {
    console.error('خطأ في التحقق:', error);
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return res.json({ success: false, needPassword: true, message: 'الحساب محمي بكلمة مرور (2FA)' });
    }
    res.status(400).json({ success: false, error: error.errorMessage || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`السيرفر يعمل بنجاح على البورت http://localhost:${PORT}`);
});
