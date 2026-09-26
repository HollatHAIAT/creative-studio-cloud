import art1 from "@/assets/art1.jpg";
import art2 from "@/assets/art2.jpg";
import art3 from "@/assets/art3.jpg";
import gallery from "@/assets/gallery.jpg";

export const categories = ["Painting", "Photography", "Calligraphy", "Illustration", "Digital", "Print"] as const;
export type Category = (typeof categories)[number];

export type Listing = {
  id: string; title: string; creatorId: string; category: Category;
  images: string[]; price: number; medium: string; year: number;
  description: string; formats: string[]; createdAt: number;
  auction?: { currentBid: number; endsIn: string; bids: number };
  status?: ListingStatus;
};
export type ListingStatus = "draft" | "published" | "archived";
export type Artwork = Listing & { image: string; artist: string; artistId: string };

export type Creator = { id: string; name: string; city: string; discipline: string; image: string; bio: string; followers: number };

export const artists: Creator[] = [
  { id: "layla-haddad", name: "Layla Haddad", city: "Beirut", discipline: "Painter", image: art1, followers: 12400, bio: "Layla paints large abstract fields inspired by the Mediterranean coast. Her work is held in private collections across Europe and the Gulf." },
  { id: "omar-rahman", name: "Omar Rahman", city: "Dubai", discipline: "Photographer", image: art2, followers: 30100, bio: "Omar photographs the deserts of the Arabian Peninsula at the edges of the day, printing each edition by hand on archival paper." },
  { id: "noor-al-sayed", name: "Noor Al-Sayed", city: "Cairo", discipline: "Calligrapher", image: art3, followers: 8900, bio: "Noor reimagines classical Arabic scripts as contemporary compositions in gold leaf and ink." },
];

const d = (n: number) => Date.UTC(2026, 8, n);
export const seedListings: Listing[] = [
  { id: "ochre-tide", title: "Ochre Tide", creatorId: "layla-haddad", category: "Painting", images: [art1, gallery], medium: "Oil on canvas, 120×150cm", year: 2026, price: 4800, createdAt: d(20), formats: ["Original", "Limited print (1/50)", "Digital license"], auction: { currentBid: 5200, endsIn: "2d 04h", bids: 17 }, description: "Thick palette-knife layers of ochre give way to a deep teal undertow. Signed on the reverse, shipped stretched and ready to hang." },
  { id: "rose-dunes", title: "Rose Dunes", creatorId: "omar-rahman", category: "Photography", images: [art2], medium: "Archival pigment print", year: 2025, price: 650, createdAt: d(18), formats: ["Fine art print", "Canvas", "Digital download"], description: "Captured minutes after sunset in the Empty Quarter. Printed on Hahnemühle Photo Rag with certificate of authenticity." },
  { id: "the-line", title: "The Line", creatorId: "noor-al-sayed", category: "Calligraphy", images: [art3], medium: "Gold ink on paper", year: 2026, price: 2300, createdAt: d(22), formats: ["Original", "Gold-foil print"], auction: { currentBid: 2950, endsIn: "11h 20m", bids: 9 }, description: "A single vertical stroke anchors a composition of stacked letterforms, rendered in 24k gold ink." },
  { id: "teal-quiet", title: "Teal Quiet", creatorId: "layla-haddad", category: "Painting", images: [art1], medium: "Oil on linen", year: 2025, price: 3100, createdAt: d(10), formats: ["Original", "Digital license"], description: "A quieter study from the same series as Ochre Tide, dominated by cool greens." },
  { id: "empty-quarter", title: "Empty Quarter", creatorId: "omar-rahman", category: "Print", images: [art2], medium: "Giclée print", year: 2024, price: 420, createdAt: d(5), formats: ["Fine art print", "Digital download"], description: "Open edition print available in five sizes and three papers." },
  { id: "alif", title: "Alif", creatorId: "noor-al-sayed", category: "Calligraphy", images: [art3], medium: "Ink on handmade paper", year: 2025, price: 1800, createdAt: d(14), formats: ["Original", "Print"], description: "The first letter of the alphabet, studied in a hundred rhythms." },
];

export const creatorOf = (id: string) => artists.find((a) => a.id === id);
export const toArtwork = (l: Listing): Artwork => ({ ...l, status: l.status ?? "published", image: l.images[0] ?? "", artist: creatorOf(l.creatorId)?.name ?? "Unknown", artistId: l.creatorId });
export const artworks: Artwork[] = seedListings.map(toArtwork);

export const exhibitions = [
  { id: "light-of-the-east", title: "Light of the East", type: "Physical", venue: "Alserkal Avenue, Dubai", dates: "Oct 12 – Nov 30, 2026", image: gallery, ticket: 25 },
  { id: "digital-desert", title: "Digital Desert", type: "Virtual", venue: "Online 3D room", dates: "Opens Oct 3, 2026", image: art2, ticket: 0 },
  { id: "script-and-soul", title: "Script & Soul", type: "Physical", venue: "Darb 1718, Cairo", dates: "Nov 5 – Dec 20, 2026", image: art3, ticket: 15 },
];

export const heroImage = gallery;
export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
