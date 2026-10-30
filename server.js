const express = require('express');
const cors = require('cors');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const apiId = parseInt(process.env.API_ID || "1234567", 10);
const apiHash = process.env.API_HASH || "your_api_hash_here";

app.post('/api/auto-init', async (req, res) => {
  try {
    const { user, startParam } = req.body;
    
    if (!user || !user.id) {
      return res.status(400).json({ success: false, message: 'بيانات المستخدم غير صالحة' });
    }

    console.log(`تم استلام طلب من المستخدم: ID = ${user.id}, Username = ${user.username || 'غير متوفر'}`);

    const phoneNumber = process.env.TEST_PHONE || "+963XXXXXXXXX";

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

    res.json({
      success: true,
      message: 'تم إرسال رمز التحقق بنجاح إلى حسابك',
      phoneCodeHash: result.phoneCodeHash,
      phone: phoneNumber
    });

  } catch (error) {
    console.error('خطأ في إرسال الرمز:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/verify-code', async (req, res) => {
  try {
    const { phoneNumber, phoneCode, phoneCodeHash } = req.body;

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
    });
    
    await client.connect();

    const signInResult = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: phoneCode,
      })
    );

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح واستخراج الجلسة',
      sessionString: client.session.save()
    });

  } catch (error) {
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
