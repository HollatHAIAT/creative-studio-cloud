// Editable texts for the About, Licensing and FAQ pages. Admins override them in /admin/content → Page texts.
// "{n}" is replaced at render time with a value from the platform settings.
const P = {
  "about.eyebrow": ["Company", "الشركة"],
  "about.title": ["Global art, crafted by Saudi hands", "فنٌّ عالمي بأيادٍ سعودية"],
  "about.sub": ["Arwiqa (أروقة, “galleries”) connects collectors worldwide with artists, galleries and heritage makers — with special strength in Saudi and Gulf art, calligraphy, Sadu, Al-Qatt Al-Asiri and pottery.", "أروقة سوق عالمي يربط المقتنين حول العالم بالفنانين والمعارض وصنّاع التراث، بقوة خاصة في الفن السعودي والخليجي والخط العربي والسدو والقط العسيري والفخار."],
  "about.p1.title": ["Buy", "اشترِ"], "about.p1.body": ["Originals, numbered prints and digital licenses, priced clearly.", "أعمال أصلية ومطبوعات مرقّمة وتراخيص رقمية بأسعار واضحة."],
  "about.p2.title": ["Bid", "زايد"], "about.p2.body": ["Live auctions — open or by invitation — with a full transaction log.", "مزادات مباشرة مفتوحة أو بدعوة مع سجل معاملات كامل."],
  "about.p3.title": ["Visit", "زُر"], "about.p3.body": ["Book exhibition tickets and get scannable entry codes.", "احجز تذاكر المعارض واحصل على رموز دخول قابلة للمسح."],
  "about.p4.title": ["Sell", "بِع"], "about.p4.body": ["Open a storefront, write listings with AI, and track sales.", "افتح متجرك واكتب إعلاناتك بالذكاء الاصطناعي وتابع مبيعاتك."],
  "about.commit.title": ["Our commitments", "التزاماتنا"],
  "about.commit.1": ["Prices are calculated on our servers, so what you see is what you pay.", "تُحسب الأسعار على خوادمنا، فما تراه هو ما تدفعه."],
  "about.commit.2": ["Provenance and condition are shown as the seller provided them — we mark what is documented and what is not.", "نعرض المصدر والحالة كما قدّمها البائع، ونوضح ما هو موثّق وما ليس كذلك."],
  "about.commit.3": ["Heritage listings go through staff review before they go live.", "تمر إعلانات التراث بمراجعة الفريق قبل نشرها."],
  "about.commit.4": ["Reviews, reports and appeals are moderated by people, with an audit trail.", "يراجع فريقنا التقييمات والبلاغات والاعتراضات مع سجل تدقيق."],
  "about.cta.support": ["Contact support", "تواصل مع الدعم"], "about.cta.licensing": ["Licensing terms", "شروط التراخيص"],

  "lic.title": ["Licensing", "التراخيص"],
  "lic.sub": ["Every license is non-exclusive. The artist keeps copyright; you get the right to use the work as described.", "كل الترخيصات غير حصرية؛ يحتفظ الفنان بحقوق المؤلف وتحصل أنت على حق الاستخدام الموضّح."],
  "lic.use": ["Use", "الاستخدام"], "lic.personal": ["Personal", "شخصي"], "lic.commercial": ["Commercial", "تجاري"], "lic.extended": ["Extended", "موسّع"],
  "lic.row1": ["Home, wallpaper, personal gifts", "المنزل وخلفيات الشاشة والهدايا الشخصية"],
  "lic.row2": ["Websites, social media, marketing", "المواقع ووسائل التواصل والتسويق"],
  "lic.row3": ["Print runs up to {n} copies", "طباعة حتى {n} نسخة"],
  "lic.row4": ["Products for resale (merch, packaging)", "منتجات لإعادة البيع (هدايا وتغليف)"],
  "lic.row5": ["Unlimited print runs", "طباعة غير محدودة"],
  "lic.note": ["Commercial is priced at {c}× and extended at {e}× the personal license. Not allowed with any license: reselling the file itself, trademarks, or AI training.", "الترخيص التجاري بـ{c} أضعاف الشخصي والموسّع بـ{e} أضعافه. غير مسموح بأي ترخيص: إعادة بيع الملف نفسه أو تسجيله علامة تجارية أو تدريب نماذج الذكاء الاصطناعي عليه."],
  "lic.how": ["How it works", "كيف يعمل"],
  "lic.step1": ["Open an artwork and choose a license", "افتح العمل واختر الترخيص"],
  "lic.step2": ["Pay at checkout", "ادفع عند إتمام الطلب"],
  "lic.step3": ["Download the file and certificate from your order", "حمّل الملف والشهادة من صفحة طلبك"],
  "lic.step4": ["Credit the artist where possible", "اذكر اسم الفنان متى أمكن"],
  "lic.cta.browse": ["Browse licensable works", "تصفّح الأعمال القابلة للترخيص"], "lic.cta.custom": ["Need a custom license?", "تحتاج ترخيصًا خاصًا؟"],

  "faq.title": ["Common questions", "أسئلة شائعة"],
  "faq.q1": ["How do I pay?", "كيف أدفع؟"], "faq.a1": ["By bank transfer to a Saudi bank. Your order page shows the details and reference; staff confirm the payment.", "بالتحويل إلى بنك سعودي. تظهر التفاصيل والرقم المرجعي في صفحة طلبك، ويؤكد الفريق الدفع."],
  "faq.q2": ["Where is my order?", "أين طلبي؟"], "faq.a2": ["Open My orders to see the status timeline and tracking once shipped.", "افتح «طلباتي» لترى مراحل الطلب ورقم التتبع بعد الشحن."],
  "faq.q3": ["Can I return an artwork?", "هل يمكنني إرجاع عمل؟"], "faq.a3": ["Request a return or refund from the order page within {n} days of delivery.", "اطلب الإرجاع أو الاسترداد من صفحة الطلب خلال {n} يومًا من الاستلام."],
  "faq.q4": ["I won an auction — what now?", "فزت بمزاد — ماذا الآن؟"], "faq.a4": ["You'll get a notification with a payment deadline. Pay from My auctions before it expires, or it passes to the next bidder.", "يصلك إشعار بمهلة الدفع. ادفع من «مزاداتي» قبل انتهائها، وإلا ينتقل العمل للمزايد التالي."],
  "faq.q5": ["How do exhibition tickets work?", "كيف تعمل تذاكر المعارض؟"], "faq.a5": ["Book a date and slot; each ticket gets a code scanned at the entrance.", "احجز التاريخ والفترة، ولكل تذكرة رمز يُمسح عند الدخول."],
  "faq.q6": ["How do I start selling?", "كيف أبدأ البيع؟"], "faq.a6": ["Use the AI listing writer, choose a review path, then manage stock and offers from the seller dashboard.", "استخدم كاتب الإعلان بالذكاء الاصطناعي، واختر مسار المراجعة، ثم أدِر المخزون والعروض من لوحة البائع."],
} as const satisfies Record<string, readonly [string, string]>;
type PK = keyof typeof P;

export const pageEn = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v[0]])) as Record<PK, string>;
export const pageAr = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v[1]])) as Record<PK, string>;
/** Fills {n}/{c}/{e} placeholders. */
export const fill = (s: string, vals: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => vals[k] ?? m);
