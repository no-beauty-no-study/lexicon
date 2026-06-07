/* Chapter illustration assets. Each book maps to one or more images.
   These 13 images ALSO serve as the full reading-page UI background
   (one painted page per chapter), so a chapter's "active illustration"
   = the reading page's background-image.
*/
const CHAPTER_ILLUSTRATIONS = {
  universe: {
    title: "The Universe",
    images: [
      { id: "universe-main", label: "Universe",
        src: "assets/illustrations/content/universe.jpg" },
    ],
  },
  "earth-history": {
    title: "Earth History",
    images: [
      { id: "earth-history-main", label: "Earth History",
        src: "assets/illustrations/content/earth-history.jpg" },
    ],
  },
  africa: {
    title: "Africa",
    images: [
      { id: "africa-main", label: "Africa",
        src: "assets/illustrations/content/africa.jpg" },
      { id: "africa-egypt", label: "Egypt (the Nile)",
        src: "assets/illustrations/content/africa-egypt.jpg" },
    ],
  },
  antarctica: {
    title: "Antarctica",
    images: [
      { id: "antarctica-main", label: "Antarctica",
        src: "assets/illustrations/content/antarctica.jpg" },
    ],
  },
  "australia-pacific": {
    title: "Australia & Pacific",
    images: [
      { id: "australia-pacific-main", label: "Australia & Pacific",
        src: "assets/illustrations/content/australia-pacific.jpg" },
    ],
  },
  "south-america": {
    title: "South America",
    images: [
      { id: "south-america-main", label: "South America",
        src: "assets/illustrations/content/south-america.jpg" },
    ],
  },
  asia: {
    title: "Asia",
    images: [
      { id: "asia-china", label: "China",
        src: "assets/illustrations/content/asia-china.jpg" },
    ],
  },
  oceans: {
    title: "Oceans",
    images: [
      { id: "oceans-main", label: "Oceans",
        src: "assets/illustrations/content/oceans.jpg" },
    ],
  },
  europe: {
    title: "Europe",
    images: [
      { id: "europe-france", label: "France",
        src: "assets/illustrations/content/europe-france.jpg" },
      { id: "europe-empress", label: "Empress",
        src: "assets/illustrations/content/europe-empress.jpg" },
      { id: "europe-alice", label: "Alice (the lantern)",
        src: "assets/illustrations/content/europe-alice.jpg" },
    ],
  },
  "north-america": {
    title: "North America",
    images: [
      { id: "north-america-main", label: "North America",
        src: "assets/illustrations/content/north-america.jpg" },
    ],
  },
};

/** Resolve the active illustration src for a chapter + optional sub-id.
    Falls back to images[0] if id is missing or unknown. */
function getChapterIllustration(chapterId, illustrationId) {
  const entry = CHAPTER_ILLUSTRATIONS[chapterId];
  if (!entry || !entry.images || !entry.images.length) return null;
  if (illustrationId) {
    const m = entry.images.find(x => x.id === illustrationId);
    if (m) return m;
  }
  return entry.images[0];
}
