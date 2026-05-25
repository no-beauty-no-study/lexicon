/* Mock chapter index. Replace with real chapter list later.
   Each chapter has:
     id           — URL-safe id used in ?chapter=
     number       — "01" .. "10"
     title        — English title
     tagline      — short evocative one-liner (shown under title on TOC)
     description  — longer Chinese / English subtitle
     readingBg    — background image for reading page
     firstSection — anchor for first section, used by TOC "Open Chapter"
*/
const CHAPTERS = [
  { id: "universe",          number: "01", title: "The Universe",
    tagline: "The beginning of everything — singularity, light, and the first dawn.",
    description: "宇宙的起点 · The First Light",
    readingBg: "assets/bg/reading/01-universe.jpg",
    firstSection: "1.1" },
  { id: "earth-history",     number: "02", title: "Earth History",
    tagline: "From molten birth to forests deep — the long ages of our world.",
    description: "Mountains, rivers and the long ages of Earth.",
    readingBg: "assets/bg/reading/02-earth-history.jpg",
    firstSection: "2.1" },
  { id: "africa",            number: "03", title: "Africa",
    tagline: "The cradle of humanity, savanna kingdoms, and Nile sands.",
    description: "Savannas, kingdoms and the cradle of life.",
    readingBg: "assets/bg/reading/03-africa.jpg",
    firstSection: "3.1" },
  { id: "antarctica",        number: "04", title: "Antarctica",
    tagline: "A white silence at the bottom of the world, kept by ice and stars.",
    description: "Ice, silence and the southern night.",
    readingBg: "assets/bg/reading/04-antarctica.jpg",
    firstSection: "4.1" },
  { id: "australia-pacific", number: "05", title: "Australia & Pacific",
    tagline: "Coral seas, ancient stories, and islands strewn like jewels.",
    description: "Coral seas and distant southern shores.",
    readingBg: "assets/bg/reading/05-australia-pacific.jpg",
    firstSection: "5.1" },
  { id: "south-america",     number: "06", title: "South America",
    tagline: "Andes peaks, rainforest breath, and the heartbeat of ruins.",
    description: "The Andes and the breath of the rainforest.",
    readingBg: "assets/bg/reading/06-south-america.jpg",
    firstSection: "6.1" },
  { id: "asia",              number: "07", title: "Asia",
    tagline: "Pagodas, monsoons, silk roads, and ten thousand years of memory.",
    description: "Pagodas, monsoons and ancient roads.",
    readingBg: "assets/bg/reading/07-asia.jpg",
    firstSection: "7.1" },
  { id: "oceans",            number: "08", title: "Oceans",
    tagline: "Tides, depths, and the long singing of whales.",
    description: "Tides, depths and the singing of whales.",
    readingBg: "assets/bg/reading/08-oceans.jpg",
    firstSection: "8.1" },
  { id: "europe",            number: "09", title: "Europe",
    tagline: "Cathedrals, courts, and the long age of light.",
    description: "Cathedrals, courts and the age of light.",
    readingBg: "assets/bg/reading/09-europe.jpg",
    firstSection: "9.1" },
  { id: "north-america",     number: "10", title: "North America",
    tagline: "Prairies, great rivers, and a new world's restless dawn.",
    description: "Prairies, rivers and the new world.",
    readingBg: "assets/bg/reading/10-north-america.jpg",
    firstSection: "10.1" },
];

const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));
function getChapter(id) { return CHAPTERS_BY_ID[id]; }
function getChapterOrDefault(id) { return CHAPTERS_BY_ID[id] || CHAPTERS[0]; }
