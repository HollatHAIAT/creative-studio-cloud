import art1 from "@/assets/art1.jpg";
import art2 from "@/assets/art2.jpg";
import art3 from "@/assets/art3.jpg";
import gallery from "@/assets/gallery.jpg";

export type Artwork = {
  id: string; title: string; artist: string; artistId: string; image: string;
  medium: string; year: number; price: number; formats: string[]; auction?: { currentBid: number; endsIn: string; bids: number };
};

export const artists = [
  { id: "layla-haddad", name: "Layla Haddad", city: "Beirut", discipline: "Painter", image: art1, works: 42, followers: 12400 },
  { id: "omar-rahman", name: "Omar Rahman", city: "Dubai", discipline: "Photographer", image: art2, works: 88, followers: 30100 },
  { id: "noor-al-sayed", name: "Noor Al-Sayed", city: "Cairo", discipline: "Calligrapher", image: art3, works: 27, followers: 8900 },
];

export const artworks: Artwork[] = [
  { id: "ochre-tide", title: "Ochre Tide", artist: "Layla Haddad", artistId: "layla-haddad", image: art1, medium: "Oil on canvas, 120×150cm", year: 2026, price: 4800, formats: ["Original", "Limited print (1/50)", "Digital license"], auction: { currentBid: 5200, endsIn: "2d 04h", bids: 17 } },
  { id: "rose-dunes", title: "Rose Dunes", artist: "Omar Rahman", artistId: "omar-rahman", image: art2, medium: "Archival pigment print", year: 2025, price: 650, formats: ["Fine art print", "Canvas", "Digital download"] },
  { id: "the-line", title: "The Line", artist: "Noor Al-Sayed", artistId: "noor-al-sayed", image: art3, medium: "Gold ink on paper", year: 2026, price: 2300, formats: ["Original", "Gold-foil print"], auction: { currentBid: 2950, endsIn: "11h 20m", bids: 9 } },
  { id: "teal-quiet", title: "Teal Quiet", artist: "Layla Haddad", artistId: "layla-haddad", image: art1, medium: "Oil on linen", year: 2025, price: 3100, formats: ["Original", "Digital license"] },
  { id: "empty-quarter", title: "Empty Quarter", artist: "Omar Rahman", artistId: "omar-rahman", image: art2, medium: "Photography", year: 2024, price: 420, formats: ["Fine art print", "Digital download"] },
  { id: "alif", title: "Alif", artist: "Noor Al-Sayed", artistId: "noor-al-sayed", image: art3, medium: "Ink on handmade paper", year: 2025, price: 1800, formats: ["Original", "Print"] },
];

export const exhibitions = [
  { id: "light-of-the-east", title: "Light of the East", type: "Physical", venue: "Alserkal Avenue, Dubai", dates: "Oct 12 – Nov 30, 2026", image: gallery, ticket: 25 },
  { id: "digital-desert", title: "Digital Desert", type: "Virtual", venue: "Online 3D room", dates: "Opens Oct 3, 2026", image: art2, ticket: 0 },
  { id: "script-and-soul", title: "Script & Soul", type: "Physical", venue: "Darb 1718, Cairo", dates: "Nov 5 – Dec 20, 2026", image: art3, ticket: 15 },
];

export const heroImage = gallery;
export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
