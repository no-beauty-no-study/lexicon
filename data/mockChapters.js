/* Mock chapter index. Replace with real chapter list later.
   Each chapter has:
     id           — URL-safe id used in ?chapter=
     number       — "01" .. "10"
     title        — English title
     description  — short Chinese / English subtitle
     readingBg    — background image for reading page
*/
const CHAPTERS = [
  { id: "universe",            number: "01", title: "The Universe",
    description: "宇宙的起点 · The First Light",
    readingBg: "assets/bg/reading/01-universe.jpg" },
  { id: "earth-history",       number: "02", title: "Earth History",
    description: "Mountains, rivers and the long ages of Earth.",
    readingBg: "assets/bg/reading/02-earth-history.jpg" },
  { id: "africa",              number: "03", title: "Africa",
    description: "Savannas, kingdoms and the cradle of life.",
    readingBg: "assets/bg/reading/03-africa.jpg" },
  { id: "antarctica",          number: "04", title: "Antarctica",
    description: "Ice, silence and the southern night.",
    readingBg: "assets/bg/reading/04-antarctica.jpg" },
  { id: "australia-pacific",   number: "05", title: "Australia & Pacific",
    description: "Coral seas and distant southern shores.",
    readingBg: "assets/bg/reading/05-australia-pacific.jpg" },
  { id: "south-america",       number: "06", title: "South America",
    description: "The Andes and the breath of the rainforest.",
    readingBg: "assets/bg/reading/06-south-america.jpg" },
  { id: "asia",                number: "07", title: "Asia",
    description: "Pagodas, monsoons and ancient roads.",
    readingBg: "assets/bg/reading/07-asia.jpg" },
  { id: "oceans",              number: "08", title: "Oceans",
    description: "Tides, depths and the singing of whales.",
    readingBg: "assets/bg/reading/08-oceans.jpg" },
  { id: "europe",              number: "09", title: "Europe",
    description: "Cathedrals, courts and the age of light.",
    readingBg: "assets/bg/reading/09-europe.jpg" },
  { id: "north-america",       number: "10", title: "North America",
    description: "Prairies, rivers and the new world.",
    readingBg: "assets/bg/reading/10-north-america.jpg" },
];

const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));
function getChapter(id) { return CHAPTERS_BY_ID[id]; }
function getChapterOrDefault(id) { return CHAPTERS_BY_ID[id] || CHAPTERS[0]; }
