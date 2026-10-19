import type { SiteContent } from "./schema.ts";

export const initialContent: SiteContent = {
  schemaVersion: 1,
  settings: {
    name: "OutDesign",
    siteTitle: "OutDesign — 個人創作空間",
    description: "OutDesign：一個收集作品、想法與日常靈感的個人空間。",
    theme: "prism",
    showNotes: true,
    showMusic: true,
  },
  hero: {
    eyebrow: "A PERSONAL SPACE FOR CURIOUS THINGS",
    line1: "把想法，",
    line2: "留在這裡。",
    description:
      "關於設計、程式，還有那些值得被留下的小事。\n這是我的創作空間，也是持續探索的紀錄。",
    image: "/assets/prism.svg",
    alt: "黑色空間中，一道虹彩光穿過銀色圓環",
  },
  projects: [
    {
      id: "1ee8784a-e0bf-42ee-a8a1-b56718272701",
      title: "Quiet Interfaces",
      category: "設計",
      description:
        "讓介面退後一步，讓內容與使用者走到前面。關於資訊層級、留白與閱讀節奏的介面概念。",
      year: "2026",
      image: "/assets/work-quiet.svg",
      alt: "深黑背景上的極簡排版介面概念",
      url: "",
      tone: "lilac",
      demo: true,
    },
    {
      id: "1ee8784a-e0bf-42ee-a8a1-b56718272702",
      title: "Field Notes",
      category: "開發",
      description:
        "把零散靈感整理成一個可以慢慢生長的空間。以輕量、易讀與容易維護為出發點的創作實驗。",
      year: "2026",
      image: "/assets/work-notes.svg",
      alt: "暖灰色紙張與黑色記事介面的組合",
      url: "",
      tone: "warm",
      demo: true,
    },
    {
      id: "1ee8784a-e0bf-42ee-a8a1-b56718272703",
      title: "In Between",
      category: "實驗",
      description:
        "探索材質、光與數位畫面的邊界。一組以純粹幾何和少量色彩建立的視覺研究。",
      year: "2026",
      image: "/assets/work-between.svg",
      alt: "黑色背景上的銀色幾何與虹彩光線",
      url: "",
      tone: "silver",
      demo: true,
    },
  ],
  notes: [
    {
      id: "2ee8784a-e0bf-42ee-a8a1-b56718272701",
      title: "為什麼我開始保留一些留白",
      excerpt:
        "好的留白，讓重要的事情被看見。這是一篇可以替換成你自己文字的示範筆記。",
      date: "2026.10.19",
      tag: "關於設計",
      url: "",
    },
    {
      id: "2ee8784a-e0bf-42ee-a8a1-b56718272702",
      title: "讓工具回到剛剛好的位置",
      excerpt:
        "記錄一些關於簡單、專注與持續創作的想法。點選作者模式，就能換成你的故事。",
      date: "2026.10.19",
      tag: "日常觀察",
      url: "",
    },
  ],
  about: {
    title: "保持好奇，\n慢慢做出喜歡的事。",
    body: "我喜歡在設計與技術之間尋找平衡，讓想法成為可以被看見、被使用的作品。\n\n這個空間收集我的探索，也保留還沒完成的可能。你可以在作者模式中，把這段介紹換成自己的故事。",
    tags: ["設計思考", "前端開發", "持續探索"],
  },
  contact: {
    headline: "有個想法？\n一起聊聊。",
    email: "hello@example.com",
    instagram: "",
    github: "",
  },
  music: {
    title: "A little room to think",
    artist: "OutDesign · 原創示範音訊",
    url: "/assets/ambient.wav",
  },
  attachments: [],
};
