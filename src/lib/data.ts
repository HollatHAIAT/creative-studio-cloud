import art1 from "@/assets/art1.jpg";
import art2 from "@/assets/art2.jpg";
import art3 from "@/assets/art3.jpg";
import gallery from "@/assets/gallery.jpg";

export const categories = ["Painting", "Photography", "Calligraphy", "Illustration", "Digital", "Print"] as const;
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
];

/** Legacy listings (made before variants) get options derived from their price. */
export function variantsOf(l: Listing): Variant[] {
  if (l.variants?.length) return l.variants;
  return [{ id: "orig", kind: "original", price: l.price, edition: 1, sold: 0 }];
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
export type Bank = { id: string; name: string; nameAr: string; code: string; color: string; founded: number };
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
