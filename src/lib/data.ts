import { licenseRates } from "./license-rates";
import art1 from "@/assets/art1.jpg";
import art2 from "@/assets/art2.jpg";
import art3 from "@/assets/art3.jpg";
import gallery from "@/assets/gallery.jpg";
import artSadu from "@/assets/art-sadu.jpg";
import artQatt from "@/assets/art-qatt.jpg";
import artPottery from "@/assets/art-pottery.jpg";

export const categories = ["Painting", "Photography", "Calligraphy", "Sadu", "Qatt", "Pottery", "Illustration", "Digital", "Print"] as const;
export type Category = (typeof categories)[number];

export type VariantKind = "original" | "print" | "license";
export type Variant = {
  id: string; kind: VariantKind; price: number;
  size?: string; material?: string; edition?: number; sold?: number;
  license?: "personal" | "commercial" | "extended";
};
export const PRINT_SIZES = ["20×25 cm", "30×40 cm", "50×70 cm", "70×100 cm"];
export const PRINT_MATERIALS = ["Fine art paper", "Canvas", "Aluminium", "Framed paper"];
export const MATERIAL_AR: Record<string, string> = { "Fine art paper": "ورق فني", Canvas: "قماش كانفس", Aluminium: "ألمنيوم", "Framed paper": "ورق مؤطّر" };

export type Listing = {
  id: string; title: string; titleAr?: string; creatorId: string; category: Category;
  images: string[]; price: number; medium: string; mediumAr?: string; year: number;
  description: string; descriptionAr?: string; formats: string[]; createdAt: number;
  auction?: { currentBid: number; endsIn: string; bids: number };
  status?: ListingStatus;
  variants?: Variant[];
};
export type ListingStatus = "draft" | "published" | "archived";
export type Artwork = Listing & { image: string; artist: string; artistAr?: string; artistId: string; variants: Variant[] };

export type Creator = { id: string; name: string; nameAr: string; city: string; cityAr: string; discipline: string; disciplineAr: string; image: string; bio: string; bioAr: string; followers: number };

export const artists: Creator[] = [
  { id: "layla-haddad", name: "Layla Haddad", nameAr: "ليلى حداد", city: "Beirut", cityAr: "بيروت", discipline: "Painter", disciplineAr: "رسامة", image: art1, followers: 12400,
    bio: "Layla paints large abstract fields inspired by the Mediterranean coast. Her work is held in private collections across Europe and the Gulf.",
    bioAr: "ترسم ليلى مساحات تجريدية واسعة مستوحاة من ساحل المتوسط، وأعمالها ضمن مجموعات خاصة في أوروبا والخليج." },
  { id: "omar-rahman", name: "Omar Rahman", nameAr: "عمر رحمن", city: "Dubai", cityAr: "دبي", discipline: "Photographer", disciplineAr: "مصوّر", image: art2, followers: 30100,
    bio: "Omar photographs the deserts of the Arabian Peninsula at the edges of the day, printing each edition by hand on archival paper.",
    bioAr: "يصوّر عمر صحارى الجزيرة العربية عند أطراف النهار، ويطبع كل إصدار يدويًا على ورق أرشيفي." },
  { id: "noor-al-sayed", name: "Noor Al-Sayed", nameAr: "نور السيد", city: "Cairo", cityAr: "القاهرة", discipline: "Calligrapher", disciplineAr: "خطّاطة", image: art3, followers: 8900,
    bio: "Noor reimagines classical Arabic scripts as contemporary compositions in gold leaf and ink.",
    bioAr: "تعيد نور تخيّل الخطوط العربية الكلاسيكية في تكوينات معاصرة بورق الذهب والحبر." },
];

const prints = (base: number, edition = 50): Variant[] => PRINT_SIZES.slice(0, 3).flatMap((size, i) =>
  PRINT_MATERIALS.slice(0, 3).map((material, j) => ({ id: `p-${i}-${j}`, kind: "print" as const, size, material, price: Math.round(base * (1 + i * 0.8) * (1 + j * 0.35)), edition, sold: (i * 7 + j * 3) % 12 })));
const licenses = (base: number): Variant[] => [
  { id: "l-personal", kind: "license", license: "personal", price: base },
  { id: "l-commercial", kind: "license", license: "commercial", price: base * 4 },
  { id: "l-extended", kind: "license", license: "extended", price: base * 10 },
];

const d = (n: number) => Date.UTC(2026, 8, n);
export const seedListings: Listing[] = [
  { id: "ochre-tide", title: "Ochre Tide", titleAr: "مدّ المغرة", creatorId: "layla-haddad", category: "Painting", images: [art1, gallery], medium: "Oil on canvas, 120×150cm", mediumAr: "زيت على قماش، ١٢٠×١٥٠ سم", year: 2026, price: 4800, createdAt: d(20), formats: ["Original", "Limited print (1/50)", "Digital license"],
    description: "Thick palette-knife layers of ochre give way to a deep teal undertow. Signed on the reverse, shipped stretched and ready to hang.",
    descriptionAr: "طبقات كثيفة من المغرة بسكين الرسم تنساب نحو تيار فيروزي عميق. موقّعة من الخلف، وتُشحن مشدودة وجاهزة للتعليق.",
    variants: [{ id: "orig", kind: "original", price: 4800, edition: 1, sold: 0 }, ...prints(90), ...licenses(60)] },
  { id: "rose-dunes", title: "Rose Dunes", titleAr: "كثبان وردية", creatorId: "omar-rahman", category: "Photography", images: [art2], medium: "Archival pigment print", mediumAr: "طباعة صبغية أرشيفية", year: 2025, price: 650, createdAt: d(18), formats: ["Fine art print", "Canvas", "Digital download"],
    description: "Captured minutes after sunset in the Empty Quarter. Printed on Hahnemühle Photo Rag with certificate of authenticity.",
    descriptionAr: "التُقطت بعد دقائق من الغروب في الربع الخالي. مطبوعة على ورق Hahnemühle مع شهادة أصالة.",
    variants: [...prints(120, 25), ...licenses(40)] },
  { id: "the-line", title: "The Line", titleAr: "الخط", creatorId: "noor-al-sayed", category: "Calligraphy", images: [art3], medium: "Gold ink on paper", mediumAr: "حبر ذهبي على ورق", year: 2026, price: 2300, createdAt: d(22), formats: ["Original", "Gold-foil print"],
    description: "A single vertical stroke anchors a composition of stacked letterforms, rendered in 24k gold ink.",
    descriptionAr: "ضربة عمودية واحدة تثبّت تكوينًا من الحروف المتراصّة، منفّذة بحبر ذهب عيار ٢٤.",
    variants: [{ id: "orig", kind: "original", price: 2300, edition: 1, sold: 0 }, ...prints(150, 30)] },
  { id: "teal-quiet", title: "Teal Quiet", titleAr: "سكون فيروزي", creatorId: "layla-haddad", category: "Painting", images: [art1], medium: "Oil on linen", mediumAr: "زيت على كتان", year: 2025, price: 3100, createdAt: d(10), formats: ["Original", "Digital license"],
    description: "A quieter study from the same series as Ochre Tide, dominated by cool greens.", descriptionAr: "دراسة أهدأ من سلسلة «مدّ المغرة» تغلب عليها الخضرة الباردة.",
    variants: [{ id: "orig", kind: "original", price: 3100, edition: 1, sold: 0 }, ...licenses(50)] },
  { id: "empty-quarter", title: "Empty Quarter", titleAr: "الربع الخالي", creatorId: "omar-rahman", category: "Print", images: [art2], medium: "Giclée print", mediumAr: "طباعة جيكليه", year: 2024, price: 420, createdAt: d(5), formats: ["Fine art print", "Digital download"],
    description: "Open edition print available in multiple sizes and papers.", descriptionAr: "مطبوعة بإصدار مفتوح بمقاسات وأنواع ورق متعددة.",
    variants: [...prints(80, 0), ...licenses(30)] },
  { id: "alif", title: "Alif", titleAr: "ألف", creatorId: "noor-al-sayed", category: "Calligraphy", images: [art3], medium: "Ink on handmade paper", mediumAr: "حبر على ورق مصنوع يدويًا", year: 2025, price: 1800, createdAt: d(14), formats: ["Original", "Print"],
    description: "The first letter of the alphabet, studied in a hundred rhythms.", descriptionAr: "الحرف الأول من الأبجدية، مدروسًا في مئة إيقاع.",
    variants: [{ id: "orig", kind: "original", price: 1800, edition: 1, sold: 0 }, ...prints(70, 40)] },
  { id: "sadu-bands", title: "Sadu Bands", titleAr: "أشرطة السدو", creatorId: "noor-al-sayed", category: "Sadu", images: [artSadu], medium: "Hand-woven wool (Al Sadu)", mediumAr: "صوف منسوج يدويًا (السدو)", year: 2026, price: 1800, createdAt: d(24), formats: ["Original"],
    description: "Red, black and ochre bands woven on a ground loom in the Bedouin Sadu tradition, listed by UNESCO as intangible heritage.", descriptionAr: "أشرطة بالأحمر والأسود والمغرة منسوجة على النول الأرضي وفق تقاليد السدو البدوية المدرجة في قائمة اليونسكو للتراث غير المادي.",
    variants: [{ id: "orig", kind: "original", price: 1800, edition: 1, sold: 0 }] },
  { id: "asir-colours", title: "Colours of Asir", titleAr: "ألوان عسير", creatorId: "layla-haddad", category: "Qatt", images: [artQatt], medium: "Mineral paint on plaster panel", mediumAr: "ألوان معدنية على لوح جصّي", year: 2026, price: 2600, createdAt: d(23), formats: ["Original", "Limited print"],
    description: "Triangles and stripes in the Al-Qatt Al-Asiri tradition, the wall painting once made by the women of Asir.", descriptionAr: "مثلثات وخطوط على طريقة القط العسيري، فن الجدران الذي أبدعته نساء عسير.",
    variants: [{ id: "orig", kind: "original", price: 2600, edition: 1, sold: 0 }, ...prints(110, 30)] },
  { id: "najd-vessel", title: "Najd Vessel", titleAr: "جرّة نجدية", creatorId: "omar-rahman", category: "Pottery", images: [artPottery], medium: "Hand-built incised clay", mediumAr: "طين مشكّل يدويًا بنقوش محفورة", year: 2025, price: 950, createdAt: d(21), formats: ["Original"],
    description: "A hand-built clay vessel with incised Najdi triangles, fired in a traditional kiln.", descriptionAr: "جرّة طينية مشكّلة يدويًا بمثلثات نجدية محفورة، مشويّة في فرن تقليدي.",
    variants: [{ id: "orig", kind: "original", price: 950, edition: 1, sold: 0 }] },
];

// ---------- Saudi art supplies (sample catalogue — replace with real products/brands) ----------
export type Supply = { id: string; name: string; nameAr: string; maker: string; makerAr: string; city: string; cityAr: string; type: "paint" | "brush" | "canvas" | "calligraphy" | "clay" | "textile"; price: number; swatch: string; description: string; descriptionAr: string };
export const supplyTypes = ["paint", "brush", "canvas", "calligraphy", "clay", "textile"] as const;
export const supplies: Supply[] = [
  { id: "najdi-clay-red", name: "Najdi Clay Red — oil paint 60 ml", nameAr: "أحمر الطين النجدي — زيتي ٦٠ مل", maker: "Diriyah Pigments", makerAr: "أصباغ الدرعية", city: "Riyadh", cityAr: "الرياض", type: "paint", price: 9, swatch: "oklch(0.52 0.14 35)", description: "Earth pigment inspired by the mud walls of At-Turaif.", descriptionAr: "صبغة ترابية مستوحاة من جدران الطين في حي الطريف." },
  { id: "palm-green", name: "Palm Green — acrylic 75 ml", nameAr: "أخضر النخيل — أكريليك ٧٥ مل", maker: "Al-Ahsa Colour Works", makerAr: "ألوان الأحساء", city: "Al-Ahsa", cityAr: "الأحساء", type: "paint", price: 7, swatch: "oklch(0.45 0.09 150)", description: "Deep green from the world's largest palm oasis.", descriptionAr: "أخضر عميق من أكبر واحة نخيل في العالم." },
  { id: "desert-gold", name: "Desert Gold — oil paint 60 ml", nameAr: "ذهبي الصحراء — زيتي ٦٠ مل", maker: "Diriyah Pigments", makerAr: "أصباغ الدرعية", city: "Riyadh", cityAr: "الرياض", type: "paint", price: 11, swatch: "oklch(0.75 0.13 85)", description: "Warm ochre-gold for dune light.", descriptionAr: "ذهبي مغرّي دافئ لضوء الكثبان." },
  { id: "qatt-set", name: "Al-Qatt Al-Asiri set — 6 mineral colours", nameAr: "طقم القط العسيري — ٦ ألوان معدنية", maker: "Abha Heritage Studio", makerAr: "استوديو أبها للتراث", city: "Abha", cityAr: "أبها", type: "paint", price: 38, swatch: "oklch(0.7 0.16 95)", description: "The bright yellow, green, red and blue of Asir wall painting.", descriptionAr: "الأصفر والأخضر والأحمر والأزرق الزاهية في فن جدران عسير." },
  { id: "palm-fibre-brushes", name: "Palm-fibre brush set (5)", nameAr: "طقم فرش من ليف النخيل (٥)", maker: "Qassim Craft House", makerAr: "دار القصيم للحرف", city: "Buraydah", cityAr: "بريدة", type: "brush", price: 24, swatch: "oklch(0.6 0.07 70)", description: "Hand-tied brushes for texture and wide washes.", descriptionAr: "فرش مربوطة يدويًا للملمس والمساحات العريضة." },
  { id: "linen-canvas", name: "Stretched linen canvas 50×70 cm", nameAr: "كانفس كتان مشدود ٥٠×٧٠ سم", maker: "Jeddah Frame Co.", makerAr: "إطارات جدة", city: "Jeddah", cityAr: "جدة", type: "canvas", price: 42, swatch: "oklch(0.9 0.03 85)", description: "Primed linen on kiln-dried wood, ready to paint.", descriptionAr: "كتان مجهّز على خشب مجفف، جاهز للرسم." },
  { id: "qalam-set", name: "Reed qalam set with ink", nameAr: "طقم أقلام قصب مع حبر", maker: "Madinah Khatt Supplies", makerAr: "مستلزمات الخط بالمدينة", city: "Madinah", cityAr: "المدينة المنورة", type: "calligraphy", price: 29, swatch: "oklch(0.25 0.02 60)", description: "Three cut reeds and a bottle of soot ink for Naskh and Thuluth.", descriptionAr: "ثلاثة أقلام قصب مبرية وقارورة حبر للنسخ والثلث." },
  { id: "gold-ink", name: "24k-look gold calligraphy ink 30 ml", nameAr: "حبر خط ذهبي ٣٠ مل", maker: "Madinah Khatt Supplies", makerAr: "مستلزمات الخط بالمدينة", city: "Madinah", cityAr: "المدينة المنورة", type: "calligraphy", price: 18, swatch: "oklch(0.78 0.14 88)", description: "Luminous metallic ink for illumination.", descriptionAr: "حبر معدني لامع للتذهيب." },
  { id: "hasa-clay", name: "Al-Ahsa pottery clay 5 kg", nameAr: "طين فخار الأحساء ٥ كغ", maker: "Al-Ahsa Colour Works", makerAr: "ألوان الأحساء", city: "Al-Ahsa", cityAr: "الأحساء", type: "clay", price: 22, swatch: "oklch(0.6 0.11 45)", description: "Red earthenware clay from the oasis kilns.", descriptionAr: "طين فخاري أحمر من أفران الواحة." },
  { id: "sadu-yarn", name: "Sadu wool yarn bundle", nameAr: "حزمة صوف السدو", maker: "Hail Weavers", makerAr: "نسّاجات حائل", city: "Hail", cityAr: "حائل", type: "textile", price: 34, swatch: "oklch(0.45 0.16 28)", description: "Hand-spun sheep wool dyed in the classic red, black and white.", descriptionAr: "صوف أغنام مغزول يدويًا مصبوغ بالأحمر والأسود والأبيض." },
];

/** Legacy listings (made before variants) get options derived from their price. */
export function variantsOf(l: Listing): Variant[] {
  if (!l.variants?.length) return [{ id: "orig", kind: "original", price: l.price, edition: 1, sold: 0 }];
  const personal = l.variants.find((v) => v.kind === "license" && v.license === "personal");
  if (!personal) return l.variants;
  // Commercial/extended license prices follow the admin-configured multipliers.
  return l.variants.map((v) => v.kind === "license" && (v.license === "commercial" || v.license === "extended")
    ? { ...v, price: Math.round(personal.price * licenseRates[v.license]) } : v);
}
export const minPrice = (l: Listing) => Math.min(...variantsOf(l).map((v) => v.price));

export const creatorOf = (id: string) => artists.find((a) => a.id === id);
export const toArtwork = (l: Listing): Artwork => {
  const c = creatorOf(l.creatorId);
  return { ...l, status: l.status ?? "published", image: l.images[0] ?? "", artist: c?.name ?? "Unknown", ...(c ? { artistAr: c.nameAr } : {}), artistId: l.creatorId, variants: variantsOf(l) };
};
export const artworks: Artwork[] = seedListings.map(toArtwork);

// ---------------- Auctions ----------------
export type Auction = { id: string; listingId: string; startBid: number; reserve: number; increment: number; startOffsetH: number; endOffsetH: number; seedBids: { bidder: string; amount: number; hoursAgo: number }[] };
/** Offsets are hours from the start of the current UTC day, so the demo always has live auctions. */
export const auctions: Auction[] = [
  { id: "ochre-tide-auction", listingId: "ochre-tide", startBid: 3000, reserve: 5500, increment: 100, startOffsetH: -48, endOffsetH: 52,
    seedBids: [{ bidder: "Collector 1142", amount: 3000, hoursAgo: 40 }, { bidder: "Sara K.", amount: 3800, hoursAgo: 30 }, { bidder: "Collector 1142", amount: 4400, hoursAgo: 12 }, { bidder: "Gallery Nour", amount: 5200, hoursAgo: 3 }] },
  { id: "the-line-auction", listingId: "the-line", startBid: 1500, reserve: 2500, increment: 50, startOffsetH: -24, endOffsetH: 20,
    seedBids: [{ bidder: "Faisal A.", amount: 1500, hoursAgo: 20 }, { bidder: "Collector 88", amount: 2100, hoursAgo: 9 }, { bidder: "Faisal A.", amount: 2950, hoursAgo: 1 }] },
  { id: "alif-auction", listingId: "alif", startBid: 900, reserve: 1400, increment: 50, startOffsetH: 30, endOffsetH: 120, seedBids: [] },
  { id: "teal-quiet-auction", listingId: "teal-quiet", startBid: 1800, reserve: 3500, increment: 100, startOffsetH: -96, endOffsetH: -6,
    seedBids: [{ bidder: "Collector 7", amount: 1800, hoursAgo: 80 }, { bidder: "Hana M.", amount: 2600, hoursAgo: 20 }] },
];

// ---------------- Exhibitions ----------------
export type Exhibition = {
  id: string; title: string; titleAr: string; type: "Physical" | "Virtual"; venue: string; venueAr: string; image: string;
  startDay: number; days: number; closedWeekday?: number; slots: string[]; capacity: number;
  tickets: { id: "adult" | "student" | "vip"; price: number }[];
  description: string; descriptionAr: string;
  rooms: { id: string; name: string; nameAr: string; x: number; y: number; w: number; h: number; works: string[] }[];
};
export const exhibitions: Exhibition[] = [
  { id: "light-of-the-east", title: "Light of the East", titleAr: "نور الشرق", type: "Physical", venue: "Alserkal Avenue, Dubai", venueAr: "السركال أفينيو، دبي", image: gallery,
    startDay: 0, days: 45, closedWeekday: 1, slots: ["10:00", "12:00", "14:00", "16:00", "18:00"], capacity: 40,
    tickets: [{ id: "adult", price: 25 }, { id: "student", price: 12 }, { id: "vip", price: 80 }],
    description: "Contemporary painters of the Levant and the Gulf, in three rooms around a central courtyard.",
    descriptionAr: "رسامون معاصرون من الشام والخليج، في ثلاث قاعات حول فناء مركزي.",
    rooms: [
      { id: "a", name: "Room A · Coastlines", nameAr: "القاعة أ · السواحل", x: 10, y: 10, w: 180, h: 110, works: ["ochre-tide", "teal-quiet"] },
      { id: "b", name: "Room B · Deserts", nameAr: "القاعة ب · الصحارى", x: 210, y: 10, w: 180, h: 110, works: ["rose-dunes", "empty-quarter"] },
      { id: "c", name: "Room C · Script", nameAr: "القاعة ج · الخط", x: 110, y: 140, w: 180, h: 90, works: ["the-line", "alif"] },
    ] },
  { id: "digital-desert", title: "Digital Desert", titleAr: "الصحراء الرقمية", type: "Virtual", venue: "Online 3D room", venueAr: "قاعة ثلاثية الأبعاد عبر الإنترنت", image: art2,
    startDay: -3, days: 60, slots: ["Any time"], capacity: 500, tickets: [{ id: "adult", price: 0 }],
    description: "A walk-through online room of desert photography, open around the clock.", descriptionAr: "قاعة افتراضية لتصوير الصحراء، مفتوحة على مدار الساعة.",
    rooms: [{ id: "v", name: "Main hall", nameAr: "القاعة الرئيسية", x: 10, y: 10, w: 380, h: 220, works: ["rose-dunes", "empty-quarter", "ochre-tide"] }] },
  { id: "script-and-soul", title: "Script & Soul", titleAr: "الخط والروح", type: "Physical", venue: "Darb 1718, Cairo", venueAr: "درب ١٧١٨، القاهرة", image: art3,
    startDay: 10, days: 45, closedWeekday: 5, slots: ["11:00", "15:00", "19:00"], capacity: 25,
    tickets: [{ id: "adult", price: 15 }, { id: "student", price: 8 }],
    description: "Arabic calligraphy between tradition and the contemporary.", descriptionAr: "الخط العربي بين التراث والمعاصرة.",
    rooms: [
      { id: "a", name: "Hall of Letters", nameAr: "قاعة الحروف", x: 10, y: 10, w: 240, h: 220, works: ["the-line", "alif"] },
      { id: "b", name: "Workshop", nameAr: "الورشة", x: 270, y: 10, w: 120, h: 220, works: [] },
    ] },
];

// ---------------- Saudi banks collection ----------------
export type Bank = { id: string; name: string; nameAr: string; code: string; color: string; founded: number; collection?: string; category?: string; categoryAr?: string; tags?: string[]; description?: string | undefined; descriptionAr?: string | undefined; preview?: string | null; kind?: string };
/** Placeholder artwork only — these are NOT the banks' official logos. */
export const saudiBanks: Bank[] = [
  { id: "snb", name: "Saudi National Bank", nameAr: "البنك الأهلي السعودي", code: "SNB", color: "#0f6b4f", founded: 1953 },
  { id: "alrajhi", name: "Al Rajhi Bank", nameAr: "مصرف الراجحي", code: "ARB", color: "#1b3f8f", founded: 1957 },
  { id: "riyad", name: "Riyad Bank", nameAr: "بنك الرياض", code: "RB", color: "#5a2d82", founded: 1957 },
  { id: "sab", name: "Saudi Awwal Bank", nameAr: "البنك السعودي الأول", code: "SAB", color: "#b3122e", founded: 1926 },
  { id: "bsf", name: "Banque Saudi Fransi", nameAr: "البنك السعودي الفرنسي", code: "BSF", color: "#13294b", founded: 1977 },
  { id: "anb", name: "Arab National Bank", nameAr: "البنك العربي الوطني", code: "ANB", color: "#0a7a3b", founded: 1979 },
  { id: "albilad", name: "Bank Albilad", nameAr: "بنك البلاد", code: "BLD", color: "#c96a12", founded: 2004 },
  { id: "aljazira", name: "Bank AlJazira", nameAr: "بنك الجزيرة", code: "BJZ", color: "#0b5a8a", founded: 1975 },
  { id: "saib", name: "Saudi Investment Bank", nameAr: "البنك السعودي للاستثمار", code: "SAIB", color: "#2c6e8f", founded: 1976 },
  { id: "alinma", name: "Alinma Bank", nameAr: "مصرف الإنماء", code: "ALN", color: "#7a4b1e", founded: 2006 },
];

export const heroImage = gallery;
export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Demo: authorized sales agents acting for an owner. Replace with DB records when agent onboarding exists. */
export type Agent = { id: string; name: string; nameAr: string; agency: string; agencyAr: string; licenseNo: string; validUntil: string; scope: ("original" | "print" | "license")[] };
export const agentsByListing: Record<string, Agent> = Object.fromEntries(
  seedListings.filter((_, i) => i % 3 === 1).map((l) => [l.id, {
    id: `agent-${l.id}`, name: "Noura Al-Qahtani", nameAr: "نورة القحطاني", agency: "Diriyah Art Representation", agencyAr: "الدرعية لتمثيل الفنانين",
    licenseNo: `AUTH-${l.id.slice(0, 6).toUpperCase()}-2026`, validUntil: "2027-06-30", scope: ["original", "print", "license"],
  }]),
);

/** Short medium label used for filtering, e.g. "Oil on canvas, 120×150cm" → "Oil on canvas". */
export const mediumGroup = (m: string) => m.split(",")[0]!.trim();
