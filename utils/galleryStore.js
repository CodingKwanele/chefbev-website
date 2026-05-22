export const categories = [
  { key: "all", label: "All" },
  { key: "wedding", label: "Wedding" },
  { key: "birthday", label: "Birthday" },
  { key: "corporate", label: "Corporate" },
  { key: "other", label: "Other" },
];

export const galleryItems = [
  {
    id: "cake-1",
    title: "Elegant Floral Cake",
    tag: "Custom",
    category: "other",
    src: "/img/gallery/cake-1.jpg",
  },
];

export const fallbackGalleryItems = galleryItems;

export async function getGalleryItems() {
  return galleryItems;
}
