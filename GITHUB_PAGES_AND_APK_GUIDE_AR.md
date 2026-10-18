# نشر منصة AQL على GitHub Pages وإنشاء APK

## رابط HTTPS
1. أنشئ مستودع GitHub جديدًا باسم `AQL-Inspection` واجعله Public (GitHub Free يتطلب مستودعًا عامًا لـ Pages).
2. ارفع **محتويات هذا المجلد** إلى جذر المستودع، وليس المجلد الخارجي نفسه. يجب أن يكون `index.html` ظاهرًا مباشرة في تبويب Code.
3. افتح Settings → Pages. من Build and deployment اختر Deploy from a branch، ثم اختر `main` و`/(root)` واضغط Save.
4. انتظر انتهاء النشر، وافتح الرابط الذي يظهر في Settings → Pages. سيكون غالبًا `https://USERNAME.github.io/AQL-Inspection/`.
5. تحقق أن الموقع يفتح على الهاتف، ثم من Chrome اختر Install app أو Add to Home screen.

## ملف APK
1. بعد رفع الملفات، افتح تبويب Actions.
2. اختر Build AQL Android APK ثم Run workflow، أو انتظر تشغيله بعد push.
3. افتح آخر تشغيل ناجح، ومن Artifacts نزّل `AQL-Android-debug-APK`.
4. فك الضغط لتحصل على `app-debug.apk`. هذا APK تجريبي للتثبيت المباشر، وليس نسخة موقعة للنشر في Google Play.

## تحقق مهم قبل الاعتماد
- لا تعتبر الموقع منشورًا حتى يظهر Deploy ناجحًا في Actions ويفتح الرابط فعليًا.
- لا تعتبر APK جاهزًا حتى يكتمل workflow بنجاح ويظهر Artifact.
- إعدادات Supabase الحالية داخل المنصة قد تشير إلى مشروع قديم؛ راجع Settings داخل AQL وضع Project URL وpublishable/anon key للمشروع الصحيح. لا تستخدم أبدًا service_role أو secret key داخل الموقع.
- شغّل ملف `AQL_Supabase_Setup.sql` في SQL Editor للمشروع الصحيح، واختبر تسجيل الدخول والمزامنة والصور على جهاز فعلي.
- GitHub Pages ينشر الملفات علنًا. لا ترفع بيانات تفتيش حقيقية أو مفاتيح سرية أو ملفات حساسة للمستودع.


## نسخة الملفات المقسّمة (لتجنّب كبر index.html)
تم فصل مكتبات JavaScript وملف التنسيق إلى ملفات مستقلة. ارفع جميع الملفات والمجلدات كما هي، ولا ترفع index.html وحده. يجب أن يبقى مجلد vendor ومجلد src ومجلد icons في نفس المستودع.
