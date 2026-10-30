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
const defaultPhone = process.env.TEST_PHONE || "";

// خطوة واحدة: إرسال الكود
app.post('/api/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    const targetPhone = phone || defaultPhone;

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
    });
    
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: targetPhone,
        apiId: apiId,
        apiHash: apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      phone: targetPhone
    });

  } catch (error) {
    console.error('خطأ في إرسال الرمز:', error);
    res.status(500).json({ success: false, error: error.errorMessage || error.message });
  }
});

// خطوة واحدة: تأكيد الكود وتسجيل الدخول فوراً
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
        phoneCode: phoneCode.toString().trim(),
      })
    );

    const savedSession = client.session.save();
    console.log('SESSION STRING:', savedSession);

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
