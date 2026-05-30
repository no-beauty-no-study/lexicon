/* Top-level "book" chapters. Each one points at a chapterIllustrations
   entry; sub-pages (Europe / Asia) carry their own illustrationId so the
   reading page can show a specific painted UI background. */
const CHAPTERS = [
  { id: "universe",            number: "01", title: "The Universe",
    tagline: "The beginning of everything — singularity, light, and the first dawn.",
    description: "宇宙的起点 · The First Light",
    illustrationKey: "universe",
    defaultIllustrationId: "universe-main",
    firstSection: "1.1" },
  { id: "earth-history",       number: "02", title: "Earth History",
    tagline: "From molten birth to forests deep — the long ages of our world.",
    description: "Mountains, rivers and the long ages of Earth.",
    illustrationKey: "earth-history",
    defaultIllustrationId: "earth-history-main",
    firstSection: "2.1" },
  { id: "africa",              number: "03", title: "Africa",
    tagline: "The cradle of humanity, savanna kingdoms, and Nile sands.",
    description: "Savannas, kingdoms and the cradle of life.",
    illustrationKey: "africa",
    defaultIllustrationId: "africa-main",
    firstSection: "3.1" },
  { id: "antarctica",          number: "04", title: "Antarctica",
    tagline: "A white silence at the bottom of the world, kept by ice and stars.",
    description: "Ice, silence and the southern night.",
    illustrationKey: "antarctica",
    defaultIllustrationId: "antarctica-main",
    firstSection: "4.1" },
  { id: "australia-pacific",   number: "05", title: "Australia & Pacific",
    tagline: "Coral seas, ancient stories, and islands strewn like jewels.",
    description: "Coral seas and distant southern shores.",
    illustrationKey: "australia-pacific",
    defaultIllustrationId: "australia-pacific-main",
    firstSection: "5.1" },
  { id: "oceans",              number: "06", title: "Oceans",
    tagline: "Tides, depths, and the long singing of whales.",
    description: "Tides, depths and the singing of whales.",
    illustrationKey: "oceans",
    defaultIllustrationId: "oceans-main",
    firstSection: "6.1" },
  { id: "south-america",       number: "07", title: "South America",
    tagline: "Andes peaks, rainforest breath, and the heartbeat of ruins.",
    description: "The Andes and the breath of the rainforest.",
    illustrationKey: "south-america",
    defaultIllustrationId: "south-america-main",
    firstSection: "7.1" },
  { id: "asia",                number: "08", title: "Asia",
    tagline: "Pagodas, monsoons, silk roads, and ten thousand years of memory.",
    description: "Pagodas, monsoons and ancient roads.",
    illustrationKey: "asia",
    defaultIllustrationId: "asia-china",
    firstSection: "8.1" },
  { id: "europe",              number: "09", title: "Europe",
    tagline: "Cathedrals, courts, and the long age of light.",
    description: "Cathedrals, courts and the age of light.",
    illustrationKey: "europe",
    defaultIllustrationId: "europe-france",
    firstSection: "9.1" },
  { id: "north-america",       number: "10", title: "North America",
    tagline: "Prairies, great rivers, and a new world's restless dawn.",
    description: "Prairies, rivers and the new world.",
    illustrationKey: "north-america",
    defaultIllustrationId: "north-america-main",
    firstSection: "10.1" },
];

const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));
function getChapter(id) { return CHAPTERS_BY_ID[id]; }
function getChapterOrDefault(id) { return CHAPTERS_BY_ID[id] || CHAPTERS[0]; }

/** Resolve the reading-page background image for a chapter + sub-page id.
    If chapterIllustrations.js is loaded, uses that mapping; otherwise
    returns null. */
function getChapterBackground(chapterId, illustrationId) {
  const c = CHAPTERS_BY_ID[chapterId];
  if (!c) return null;
  const subId = illustrationId || c.defaultIllustrationId;
  if (typeof getChapterIllustration === "function") {
    const r = getChapterIllustration(c.illustrationKey || c.id, subId);
    if (r) return r.src;
  }
  return null;
}
