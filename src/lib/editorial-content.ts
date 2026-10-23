import type { SiteContent } from '../../supabase/functions/_shared/schema';

/** Upgrade known demo copy at presentation time; never replace authored values. */
export function editorialContent(source: SiteContent): SiteContent {
  const replace = (value: string, old: string[], next: string) => old.includes(value) ? next : value;
  return {
    ...source,
    hero: {...source.hero,
      eyebrow: replace(source.hero.eyebrow, ['A PERSONAL SPACE FOR CURIOUS THINGS'], 'INDEPENDENT THOUGHTS. TANGIBLE IDEAS.'),
      line1: replace(source.hero.line1, ['把想法，','把想法'], '讓想法，'),
      line2: replace(source.hero.line2, ['留在這裡。','留在這裡'], '有了形狀。'),
      description: replace(source.hero.description, ['關於設計、程式，還有那些值得被留下的小事。\n這是我的創作空間，也是持續探索的紀錄。'], '在設計、程式與日常觀察之間，\n把一個念頭，推進成可以感受的事物。'),
    },
    about: {...source.about,
      title: replace(source.about.title, ['保持好奇，\n慢慢做出喜歡的事。'], '好奇，\n是一種工作方式。'),
      body: replace(source.about.body, ['我喜歡在設計與技術之間尋找平衡，讓想法成為可以被看見、被使用的作品。\n\n這個空間收集我的探索，也保留還沒完成的可能。你可以在作者模式中，把這段介紹換成自己的故事。'], '我在設計與技術的交界，練習把感受說清楚，也把想法做出來。從一個畫面的節奏，到一次操作的回應，細節讓抽象的念頭逐漸成形。\n\n這裡收集完成的作品，也保留思考的過程。讓觀察成為起點，讓實作帶來下一個問題。'),
    },
    contact: {...source.contact, headline: replace(source.contact.headline, ['有個想法？\n一起聊聊。'], '讓下一個想法，\n從對話開始。')},
    notes: source.notes.map(note => ({...note,
      title: replace(note.title, ['為什麼我開始保留一些留白','讓工具回到剛剛好的位置'], note.title==='為什麼我開始保留一些留白'?'關於留白，也關於選擇':'讓工具，剛好接住想法'),
      excerpt: replace(note.excerpt,
      ['好的留白，讓重要的事情被看見。這是一篇可以替換成你自己文字的示範筆記。','記錄一些關於簡單、專注與持續創作的想法。點選作者模式，就能換成你的故事。'],
      note.excerpt.startsWith('好的留白') ? '留白不是空著不做，而是替重要的內容留出位置。當畫面不再急著填滿，視線才有機會停留，層次也開始出現。\n\n設計裡的取捨，往往比增加更需要耐心。' : '工具應該接住想法，而不是打斷它。把常用的操作放在直覺的位置，把不必要的步驟拿開，創作才有餘裕繼續。\n\n剛剛好的工具，是讓人專注於正在做的事。')})),
  };
}
