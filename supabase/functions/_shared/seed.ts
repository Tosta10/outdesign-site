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
    image: "/assets/lunar-landscape.webp",
    alt: "銀色月光照亮黑色山脈與遠方行星",
  },
  projects: [],
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
