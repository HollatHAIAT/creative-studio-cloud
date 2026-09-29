import { useEffect } from "react";
import { actions, useStore } from "./store";
import { en2, ar2 } from "./i18n-extra";
import { textOverrides, useCmsVersion } from "./cms";

export type Locale = "en" | "ar";

const en = {
  "brand.name": "Arwiqa", "brand.tagline": "The global marketplace for art, prints, auctions and exhibitions.",
  "nav.explore": "Explore", "nav.advisor": "Art advisor", "nav.auctions": "Auctions", "nav.exhibitions": "Exhibitions", "nav.artists": "Artists",
  "nav.collections": "Saudi Banks", "nav.dashboard": "Dashboard", "nav.analytics": "Analytics", "nav.sell": "Start selling",
  "nav.favorites": "Favorites", "lang.switch": "العربية",
  "footer.buy": "Buy", "footer.sell": "Sell", "footer.company": "Company", "footer.originals": "Originals", "footer.prints": "Prints",
  "footer.licenses": "Digital licenses", "footer.storefronts": "Artist storefronts", "footer.about": "About", "footer.licensing": "Licensing", "footer.support": "Support",
  "home.eyebrow": "Art · Prints · Auctions · Exhibitions", "home.title": "Where the world collects art.",
  "home.sub": "Originals, limited editions, digital licenses and live auctions — from independent artists and galleries across 120 countries.",
  "home.explore": "Explore artworks", "home.live": "Live auctions", "home.new": "New this week", "home.viewAll": "View all",
  "home.exhibitions": "Exhibitions", "home.allExhibitions": "All exhibitions", "home.store": "Open your storefront.",
  "home.storeSub": "Sell originals, prints and licenses. Run auctions. Host exhibitions.", "home.becomeSeller": "Become a seller",
  "stat.artists": "Artists", "stat.artworks": "Artworks", "stat.exhibitions": "Exhibitions", "stat.paid": "Paid to creators",
  "home.banks": "Saudi Banks collection", "home.banksSub": "Free digital logo assets — pick, choose a format and download as ZIP.",
  "explore.title": "Artworks", "explore.sub": "Originals, editions, prints and licensed digital files.", "explore.search": "Search by title, artist or medium…",
  "explore.results": "results", "explore.none": "No artworks match your search.", "explore.all": "All",
  "sort.newest": "Newest", "sort.priceAsc": "Price: low to high", "sort.priceDesc": "Price: high to low", "sort.title": "Title A–Z",
  "cat.Painting": "Painting", "cat.Photography": "Photography", "cat.Calligraphy": "Calligraphy", "cat.Illustration": "Illustration", "cat.Digital": "Digital", "cat.Print": "Print", "cat.Sadu": "Sadu weaving", "cat.Qatt": "Al-Qatt Al-Asiri", "cat.Pottery": "Pottery", "cat.Heritage": "Heritage & antiquities replicas",
  "art.format": "Choose an option", "art.original": "Original artwork", "art.print": "Print", "art.license": "Digital license",
  "art.size": "Size", "art.material": "Material", "art.edition": "Edition", "art.left": "left", "art.soldOut": "Sold out", "art.buy": "Buy now",
  "art.added": "added to your cart", "art.cert": "Certificate of authenticity included. Worldwide shipping for physical works. Licenses delivered instantly.",
  "art.unavailable": "This listing isn't available.", "art.back": "Back to explore", "art.liveAuction": "This work is in a live auction", "art.goAuction": "Go to auction",
  "fav.eyebrow": "Saved", "fav.title": "Favorites", "fav.empty": "Nothing saved yet. Tap the heart on any artwork.", "fav.save": "Save to favorites", "fav.remove": "Remove from favorites",
  "artists.eyebrow": "Artists", "artists.title": "Featured creators", "artists.listings": "listings", "artists.followers": "followers", "artists.follow": "Follow",
  "auc.eyebrow": "Auctions", "auc.title": "Live now", "auc.sub": "Bid on originals. Reserve prices and closing times set by each artist.",
  "auc.current": "Current bid", "auc.start": "Starting bid", "auc.endsIn": "Ends in", "auc.ended": "Auction ended", "auc.bids": "bids",
  "auc.reserveMet": "Reserve met", "auc.reserveNot": "Reserve not met", "auc.placeBid": "Place bid", "auc.yourBid": "Your bid",
  "auc.min": "Minimum", "auc.history": "Bid history", "auc.you": "You", "auc.winning": "You're the highest bidder", "auc.outbid": "You've been outbid",
  "auc.tooLow": "Your bid must be at least", "auc.placed": "Bid placed", "auc.won": "Winning bid", "auc.noSale": "Reserve not met — no sale", "auc.view": "View auction",
  "auc.opens": "Opens in", "auc.upcoming": "Upcoming", "auc.live": "Live", "auc.closed": "Closed", "auc.none": "No bids yet — be the first.", "auc.increment": "Bid increment",
  "auc.demo": "Demo bidding: other bidders are simulated and no money changes hands.",
  "ex.eyebrow": "Exhibitions", "ex.title": "On view", "ex.sub": "Walk virtual rooms online or book tickets for shows near you.",
  "ex.physical": "Physical exhibition", "ex.virtual": "Virtual exhibition", "ex.tickets": "Get tickets", "ex.free": "Enter free", "ex.view": "View exhibition",
  "ex.schedule": "Schedule", "ex.book": "Book tickets", "ex.date": "Date", "ex.session": "Time slot", "ex.type": "Ticket type", "ex.qty": "Quantity",
  "ex.total": "Total", "ex.confirm": "Confirm booking", "ex.booked": "Booking confirmed", "ex.bookings": "Your bookings", "ex.left": "places left",
  "ex.map": "Exhibition map", "ex.works": "Works on view", "ex.room": "Room", "ex.enterVirtual": "Enter virtual room", "ex.cancel": "Cancel booking",
  "ex.full": "Full", "ex.adult": "Adult", "ex.student": "Student", "ex.vip": "VIP guided tour", "ex.ref": "Reference", "ex.soldOut": "This slot is full",
  "sell.eyebrow": "For artists & galleries", "sell.title": "Sell everywhere, from one studio.",
  "sell.sub": "One storefront for originals, editions, print-on-demand, digital licenses, auctions and exhibitions.",
  "banks.eyebrow": "Digital asset collection", "banks.title": "Saudi Banks", "banks.sub": "Free logo assets for the ten initial Saudi banks. Select one or many, choose a format, and download individually or as a ZIP.",
  "banks.placeholder": "Placeholder artwork — not the official logo", "banks.notice": "These are placeholder graphics generated by Arwiqa. They are not official bank logos. Official files will replace them once supplied by the rights holders.",
  "banks.selectAll": "Select all", "banks.clear": "Clear", "banks.selected": "selected", "banks.format": "Format", "banks.best": "Best available",
  "banks.download": "Download", "banks.zip": "Download ZIP", "banks.csv": "Export CSV metadata", "banks.license": "License", "banks.free": "Free",
  "banks.licenseText": "Free for editorial and personal use. Commercial use requires permission from the trademark owner. Do not alter or imply endorsement.",
  "banks.details": "License details", "banks.preparing": "Preparing download…", "banks.formats": "Available formats",
  "dash.title": "Your listings", "an.title": "Performance", "alerts.title": "Drop alerts", "reports.title": "Email reports", "delivery.title": "Delivery",
  "form.variants": "Product options", "form.original": "Sell the original", "form.originalPrice": "Original price (USD)", "form.prints": "Prints",
  "form.addPrint": "Add print option", "form.size": "Size", "form.material": "Material", "form.price": "Price", "form.edition": "Edition size (0 = open)",
  "form.licenses": "Digital licenses", "form.personal": "Personal", "form.commercial": "Commercial", "form.extended": "Extended",
  "form.remove": "Remove", "form.needOption": "Add at least one option to sell (original, print or license)",
  ...en2,
};
export type Key = keyof typeof en;

const ar: Record<Key, string> = {
  "brand.name": "أروقة", "brand.tagline": "السوق العالمي للفن والمطبوعات والمزادات والمعارض.",
  "nav.explore": "استكشف", "nav.advisor": "المستشار الفني", "nav.auctions": "المزادات", "nav.exhibitions": "المعارض", "nav.artists": "الفنانون",
  "nav.collections": "البنوك السعودية", "nav.dashboard": "لوحة التحكم", "nav.analytics": "التحليلات", "nav.sell": "ابدأ البيع",
  "nav.favorites": "المفضلة", "lang.switch": "English",
  "footer.buy": "الشراء", "footer.sell": "البيع", "footer.company": "الشركة", "footer.originals": "الأعمال الأصلية", "footer.prints": "المطبوعات",
  "footer.licenses": "التراخيص الرقمية", "footer.storefronts": "متاجر الفنانين", "footer.about": "من نحن", "footer.licensing": "التراخيص", "footer.support": "الدعم",
  "home.eyebrow": "فن · مطبوعات · مزادات · معارض", "home.title": "حيث يقتني العالم الفن.",
  "home.sub": "أعمال أصلية وإصدارات محدودة وتراخيص رقمية ومزادات حية — من فنانين ومعارض مستقلة في ١٢٠ دولة.",
  "home.explore": "استكشف الأعمال", "home.live": "المزادات الحية", "home.new": "جديد هذا الأسبوع", "home.viewAll": "عرض الكل",
  "home.exhibitions": "المعارض", "home.allExhibitions": "كل المعارض", "home.store": "افتح متجرك.",
  "home.storeSub": "بع الأعمال الأصلية والمطبوعات والتراخيص. أدر المزادات. استضف المعارض.", "home.becomeSeller": "كن بائعًا",
  "stat.artists": "فنان", "stat.artworks": "عمل فني", "stat.exhibitions": "معرض", "stat.paid": "مدفوعات للمبدعين",
  "home.banks": "مجموعة البنوك السعودية", "home.banksSub": "أصول شعارات رقمية مجانية — اختر وحدد الصيغة ونزّلها كملف ZIP.",
  "explore.title": "الأعمال الفنية", "explore.sub": "أعمال أصلية وإصدارات ومطبوعات وملفات رقمية مرخّصة.", "explore.search": "ابحث بالعنوان أو الفنان أو الوسيط…",
  "explore.results": "نتيجة", "explore.none": "لا توجد أعمال مطابقة لبحثك.", "explore.all": "الكل",
  "sort.newest": "الأحدث", "sort.priceAsc": "السعر: من الأقل", "sort.priceDesc": "السعر: من الأعلى", "sort.title": "العنوان أ–ي",
  "cat.Painting": "رسم", "cat.Photography": "تصوير", "cat.Calligraphy": "خط عربي", "cat.Illustration": "رسوم توضيحية", "cat.Digital": "رقمي", "cat.Print": "مطبوعات", "cat.Sadu": "نسيج السدو", "cat.Qatt": "القط العسيري", "cat.Pottery": "فخار", "cat.Heritage": "تراث ونسخ أثرية",
  "art.format": "اختر خيارًا", "art.original": "العمل الأصلي", "art.print": "مطبوعة", "art.license": "ترخيص رقمي",
  "art.size": "المقاس", "art.material": "الخامة", "art.edition": "الإصدار", "art.left": "متبقية", "art.soldOut": "نفدت الكمية", "art.buy": "اشترِ الآن",
  "art.added": "أُضيف إلى سلتك", "art.cert": "يشمل شهادة أصالة. شحن عالمي للأعمال المادية. تُسلَّم التراخيص فورًا.",
  "art.unavailable": "هذا العمل غير متاح.", "art.back": "العودة إلى الاستكشاف", "art.liveAuction": "هذا العمل في مزاد حي", "art.goAuction": "انتقل إلى المزاد",
  "fav.eyebrow": "المحفوظات", "fav.title": "المفضلة", "fav.empty": "لا شيء محفوظ بعد. اضغط على القلب في أي عمل.", "fav.save": "أضف إلى المفضلة", "fav.remove": "أزل من المفضلة",
  "artists.eyebrow": "الفنانون", "artists.title": "مبدعون مميزون", "artists.listings": "عمل", "artists.followers": "متابع", "artists.follow": "متابعة",
  "auc.eyebrow": "المزادات", "auc.title": "مباشر الآن", "auc.sub": "زايد على الأعمال الأصلية. يحدد كل فنان السعر الأدنى ووقت الإغلاق.",
  "auc.current": "المزايدة الحالية", "auc.start": "سعر البداية", "auc.endsIn": "ينتهي خلال", "auc.ended": "انتهى المزاد", "auc.bids": "مزايدة",
  "auc.reserveMet": "تم بلوغ الحد الأدنى", "auc.reserveNot": "لم يُبلغ الحد الأدنى", "auc.placeBid": "زايد", "auc.yourBid": "مزايدتك",
  "auc.min": "الحد الأدنى", "auc.history": "سجل المزايدات", "auc.you": "أنت", "auc.winning": "أنت صاحب أعلى مزايدة", "auc.outbid": "تمت المزايدة عليك",
  "auc.tooLow": "يجب ألا تقل مزايدتك عن", "auc.placed": "تم تسجيل المزايدة", "auc.won": "المزايدة الفائزة", "auc.noSale": "لم يُبلغ الحد الأدنى — لا بيع", "auc.view": "عرض المزاد",
  "auc.opens": "يفتح خلال", "auc.upcoming": "قادم", "auc.live": "مباشر", "auc.closed": "مغلق", "auc.none": "لا مزايدات بعد — كن الأول.", "auc.increment": "قيمة الزيادة",
  "auc.demo": "مزايدة تجريبية: المزايدون الآخرون محاكاة ولا تتم أي عملية دفع.",
  "ex.eyebrow": "المعارض", "ex.title": "المعروض الآن", "ex.sub": "تجوّل في القاعات الافتراضية أو احجز تذاكر المعارض القريبة منك.",
  "ex.physical": "معرض واقعي", "ex.virtual": "معرض افتراضي", "ex.tickets": "احجز التذاكر", "ex.free": "ادخل مجانًا", "ex.view": "عرض المعرض",
  "ex.schedule": "جدول المواعيد", "ex.book": "حجز التذاكر", "ex.date": "التاريخ", "ex.session": "الموعد", "ex.type": "نوع التذكرة", "ex.qty": "العدد",
  "ex.total": "الإجمالي", "ex.confirm": "تأكيد الحجز", "ex.booked": "تم تأكيد الحجز", "ex.bookings": "حجوزاتك", "ex.left": "مقعد متبقٍ",
  "ex.map": "خريطة المعرض", "ex.works": "الأعمال المعروضة", "ex.room": "قاعة", "ex.enterVirtual": "ادخل القاعة الافتراضية", "ex.cancel": "إلغاء الحجز",
  "ex.full": "مكتمل", "ex.adult": "بالغ", "ex.student": "طالب", "ex.vip": "جولة إرشادية VIP", "ex.ref": "رقم الحجز", "ex.soldOut": "هذا الموعد مكتمل",
  "sell.eyebrow": "للفنانين والمعارض", "sell.title": "بِع في كل مكان، من استوديو واحد.",
  "sell.sub": "متجر واحد للأعمال الأصلية والإصدارات والطباعة عند الطلب والتراخيص الرقمية والمزادات والمعارض.",
  "banks.eyebrow": "مجموعة أصول رقمية", "banks.title": "البنوك السعودية", "banks.sub": "أصول شعارات مجانية للبنوك السعودية العشرة الأولى. اختر بنكًا أو أكثر، وحدد الصيغة، ونزّلها منفردة أو كملف ZIP.",
  "banks.placeholder": "تصميم مؤقت — ليس الشعار الرسمي", "banks.notice": "هذه رسومات مؤقتة أنشأتها أروقة وليست شعارات رسمية للبنوك. ستُستبدل بالملفات الرسمية عند توفيرها من أصحاب الحقوق.",
  "banks.selectAll": "تحديد الكل", "banks.clear": "إلغاء التحديد", "banks.selected": "محدد", "banks.format": "الصيغة", "banks.best": "أفضل صيغة متاحة",
  "banks.download": "تنزيل", "banks.zip": "تنزيل ZIP", "banks.csv": "تصدير بيانات CSV", "banks.license": "الترخيص", "banks.free": "مجاني",
  "banks.licenseText": "مجاني للاستخدام التحريري والشخصي. يتطلب الاستخدام التجاري إذنًا من مالك العلامة التجارية. لا تُعدّل الشعار ولا توحِ بالتأييد.",
  "banks.details": "تفاصيل الترخيص", "banks.preparing": "جارٍ تجهيز التنزيل…", "banks.formats": "الصيغ المتاحة",
  "dash.title": "أعمالك", "an.title": "الأداء", "alerts.title": "تنبيهات الانخفاض", "reports.title": "تقارير البريد", "delivery.title": "التسليم",
  "form.variants": "خيارات المنتج", "form.original": "بيع العمل الأصلي", "form.originalPrice": "سعر العمل الأصلي (دولار)", "form.prints": "المطبوعات",
  "form.addPrint": "أضف خيار طباعة", "form.size": "المقاس", "form.material": "الخامة", "form.price": "السعر", "form.edition": "حجم الإصدار (0 = مفتوح)",
  "form.licenses": "التراخيص الرقمية", "form.personal": "شخصي", "form.commercial": "تجاري", "form.extended": "موسّع",
  "form.remove": "إزالة", "form.needOption": "أضف خيار بيع واحدًا على الأقل (أصلي أو مطبوعة أو ترخيص)",
  ...ar2,
};

const dicts = { en, ar };

export function useLocale() {
  const { locale } = useStore();
  const l: Locale = locale === "ar" ? "ar" : "en";
  useCmsVersion();
  const t = (k: Key) => textOverrides[l][k] ?? dicts[l][k] ?? en[k];
  /** Pick the Arabic field when available (e.g. titleAr). */
  const pick = <T extends Record<string, unknown>>(o: T, field: string) => (l === "ar" && typeof o[`${field}Ar`] === "string" ? (o[`${field}Ar`] as string) : (o[field] as string));
  const num = (n: number) => n.toLocaleString(l === "ar" ? "ar-SA" : "en-US");
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  return { locale: l, t, pick, num, money, dir: l === "ar" ? "rtl" : "ltr", toggle: () => actions.setLocale(l === "ar" ? "en" : "ar") };
}

/** Applies lang/dir to <html> so the whole page (including portals like dialogs) flips. */
export function useDocumentDirection() {
  const { locale, dir } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
}

/** Inline translated text, for places that just need a label. */
export function T({ k }: { k: Key }) { return useLocale().t(k); }

export const dictionaries = { en: en as Record<string, string>, ar: ar as Record<string, string> };
