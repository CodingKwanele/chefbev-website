export const categories = [
  { key: "all", label: "All" },
  { key: "wedding", label: "Wedding" },
  { key: "birthday", label: "Birthday" },
  { key: "corporate", label: "Corporate" },
  { key: "other", label: "Other" },
];

export const galleryItems = [
  {
    id: "white-cake",
    title: "Classic White Cake",
    tag: "Elegant",
    category: "other",
    src: "/img/gallery/white-cake.jpg",
  },
  {
    id: "graduation-cake",
    title: "Graduation Cake",
    tag: "Milestone",
    category: "other",
    src: "/img/gallery/graduation-cake.jpg",
  },
  {
    id: "fathers-day-cake",
    title: "Father's Day Cake",
    tag: "Celebration",
    category: "other",
    src: "/img/gallery/fathers-day.jpg",
  },
  {
    id: "barbie-girl-cake",
    title: "Barbie Girl Cake",
    tag: "Kids",
    category: "birthday",
    src: "/img/gallery/barbie-girl.jpg",
  },
  {
    id: "birthday-cake",
    title: "Birthday Cake",
    tag: "Birthday",
    category: "birthday",
    src: "/img/gallery/birthday-cake.jpg",
  },
  {
    id: "birthday-celebration-cake",
    title: "Birthday Celebration Cake",
    tag: "Birthday",
    category: "birthday",
    src: "/img/gallery/birthday-celebration.jpg",
  },
  {
    id: "cake-1",
    title: "Elegant Floral Cake",
    tag: "Custom",
    category: "other",
    src: "/img/gallery/cake-1.jpg",
  },
  {
    id: "anniversary-cake",
    title: "Couple Anniversary Cake",
    tag: "Anniversary",
    category: "wedding",
    src: "/img/gallery/couple-or-anniversary.jpg",
  },
  {
    id: "kids-cake",
    title: "Kids Celebration Cake",
    tag: "Kids",
    category: "birthday",
    src: "/img/gallery/kid-cake.jpg",
  },
  {
    id: "love-white-cake",
    title: "Love White Cake",
    tag: "Romantic",
    category: "wedding",
    src: "/img/gallery/love-white.jpg",
  },
];

export const fallbackGalleryItems = galleryItems;

export async function getGalleryItems() {
  return galleryItems;
}
