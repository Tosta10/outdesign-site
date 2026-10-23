import type { CSSProperties, ReactNode } from 'react';
import { defaultDesign } from '../../supabase/functions/_shared/schema';
import type { SectionProps } from './ContentSection';
import { CanvasPanels } from './CanvasPanels';
import { EditableText } from './EditableText';
import { SourceValue } from './SourceValue';
import { SiteSettings } from './SiteSettings';
import { Icon } from './Icon';
import { GearIcon } from './GearIcon';
import { assetUrl } from '../lib/content';
import { copyDefaults, elementProps, presentationCopy } from '../lib/presentation';
import { editorialContent } from '../lib/editorial-content';
import type { SitePage } from './SiteRenderer';
import '../styles/editorial.css';

export function EditorialSite({content: source, api='', base='/', editing=false, selected='', privateAssets={}, page='home'}: SectionProps & {page?: Exclude<SitePage,'work'>}) {
  const c = editorialContent(source);
  const url = (route='') => `${base.replace(/\/$/,'')}/${route}${route ? '/' : ''}`;
  const img = (value:string) => assetUrl(value,api,base,privateAssets);
  const prop = (id:string) => elementProps(c,id,editing);
  const text = (id:string, fallback:string) => <EditableText content={c} id={id} editing={editing} selected={selected} fallback={fallback}/>;
  const value = (path:string) => <SourceValue content={c} path={path} editing={editing}/>;
  const links = [['home','首頁','HOME'],['work','作品','WORK'],['about','關於','ABOUT'],['journal','筆記','JOURNAL'],['resources','資源','RESOURCES']].filter(([key])=>key!=='journal'||c.settings.showNotes);
  const layout = c.workspace?.pages?.[page];
  const builtins = layout?.builtins !== false;
  const panels = <CanvasPanels content={source} page={page} api={api} base={base} editing={editing} selected={selected} privateAssets={privateAssets}/>;
  const artDefault = ['/assets/prism.svg','/assets/lunar-landscape.webp','/assets/lunar-dawn-light.webp',''].includes(c.hero.image);
  const art = artDefault ? '' : img(c.hero.image);
  const emailValid = !c.contact.email.endsWith('@example.com');
  const styles = { '--workspace-gap': `${layout?.gap ?? 24}px`, '--workspace-padding': `${layout?.padding ?? 32}px`, '--radius': `${c.design?.radius ?? defaultDesign.radius}px`, '--page-width': `${c.design?.width ?? defaultDesign.width}px` } as CSSProperties;
  const designVars: Record<string,string> = {background:'--color-bg',surface:'--color-surface',raised:'--color-raised',text:'--color-text',muted:'--color-muted',accent:'--color-accent',width:'--page-width',radius:'--radius'};
  for (const [key,val] of Object.entries(c.design||{})) if(designVars[key])
    (styles as Record<string,string>)[designVars[key]] = typeof val==='number'?`${val}px`:val;
  const missionArt = c.presentation?.missionImage && !['/assets/lunar-landscape.webp','/assets/lunar-dawn-light.webp'].includes(c.presentation.missionImage) ? c.presentation.missionImage : '';
  const palette = {background:'--folio-paper',surface:'--folio-wash',text:'--folio-ink',muted:'--folio-muted',accent:'--folio-accent'} as const;
  for (const [key,variable] of Object.entries(palette)) {
    const field = key as keyof typeof palette;
    if (c.design?.[field] && c.design[field] !== defaultDesign[field])
      (styles as Record<string,string>)[variable] = c.design[field];
  }
  if(c.design?.raised && c.design.raised!==defaultDesign.raised) (styles as Record<string,string>)['--folio-raised']=c.design.raised;
  const artFigure = (compact=false) => art ? <figure className={`folio-art${compact?' folio-art-slice':''}`} {...prop(compact?'about-study':'hero-image')}>
    <div className="folio-art-arrival" data-folio-reveal><div className="folio-art-motion" data-folio-parallax><img src={art} alt={artDefault?'霧銀折帶的形體研究':c.hero.alt} width="1280" height="1280" decoding="async" fetchPriority={compact?'auto':'high'}/></div></div>
    <figcaption><span>FIG. 01 / {text('folio.art.label','FORM IN PROGRESS')}</span><span aria-hidden="true">＋</span></figcaption>
  </figure> : null;
  const introCopy = {
    about:['01 / A WAY OF SEEING','關於','從觀察開始，讓想法找到自己的語言。'],
    journal:['02 / NOTES IN THE MAKING','筆記','記錄創作中的選擇、發現，與還想追問的事。'],
    resources:['03 / AN OPEN SHELF','資源','把整理好的檔案與工具，留在容易找到的地方。'],
    home:['00 / INDEPENDENT PRACTICE','首頁',''],
  }[page];
  const legacyIntro = (part:string, fallback:string) => {
    const key=`intro.${page}.${part}`, saved=c.presentation?.copy?.[key];
    return saved!==undefined && saved!==copyDefaults[key] ? saved : fallback;
  };
  const hasLegacyTitle=['first','second'].some(part=>legacyIntro(part,'')!=='');
  const introTitle=hasLegacyTitle ? ['first','second'].map(part=>presentationCopy(c,`intro.${page}.${part}`)).join('') : introCopy[1];
  const sectionOrder = c.layout?.sections || ['about','contact','notes','attachments'];
  const sections: Record<string,ReactNode> = {
    about: <section className="folio-about" id="about" data-layout="section:about" {...prop('about')} data-edit={editing?'about':undefined}>
      <div className="folio-section-meta" data-folio-reveal><span>01 / PERSPECTIVE</span><span>{text('folio.about.label','持續靠近，還沒定義的可能。')}</span></div>
      <div className="folio-about-grid"><h2 className="folio-statement preserve-lines" data-folio-reveal>{value('about.title')}</h2><div className="folio-prose" data-folio-reveal><p className="preserve-lines">{value('about.body')}</p><ul className="folio-tags" aria-label="創作領域">{c.about.tags.map(tag=><li key={tag}>{tag}</li>)}</ul></div></div>
      {art ? artFigure(true) : <div className="folio-pullquote" data-folio-reveal><span className="folio-micro">A PRACTICE, NOT A FINISH LINE.</span><p>{text('folio.about.pullquote','每一次實作，\n都是下一個問題的起點。')}</p><span className="folio-pullquote-mark" aria-hidden="true">↘</span></div>}
      <div className="folio-methods"><div className="folio-section-meta"><span>THE PRACTICE</span><span>{text('folio.method.label','想法到形狀之間。')}</span></div>{[['01','觀察','從細小的差異，找到值得追問的問題。'],['02','組織','把複雜的線索，整理成清楚的方向。'],['03','實作','讓想法接受真實操作，再回到下一次思考。']].map(([n,title,body])=><article key={n} data-folio-reveal><span>{n}</span><h3>{text(`folio.method.${n}.title`,title)}</h3><p>{text(`folio.method.${n}.body`,body)}</p></article>)}</div>
      {c.settings.showMusic && c.music.url && <div className="folio-listening" {...prop('music')} data-edit={editing?'music':undefined}><button className="music-play" data-audio-toggle aria-label="播放音樂" aria-pressed="false"><span data-play-icon><Icon name="play" size={18}/></span><span data-pause-icon hidden><Icon name="pause" size={18}/></span></button><div><span className="folio-micro">A LITTLE ROOM TO THINK</span><p>{value('music.title')}</p><small>{value('music.artist')}</small></div><span className="folio-listening-label">{text('folio.music.label','給思考一點空間')}</span><audio data-site-audio preload="none" src={img(c.music.url)}/><p data-audio-feedback role="status"/></div>}
    </section>,
    contact: <section className="folio-contact" id="contact" data-layout="section:contact" {...prop('contact')} data-edit={editing?'contact':undefined} data-folio-reveal>
      <p className="folio-micro">NEXT CONVERSATION</p><h2 className="preserve-lines">{value('contact.headline')}</h2>
      <div className="folio-contact-links">{emailValid ? <a className="folio-inline" href={`mailto:${c.contact.email}`}>{value('contact.email')}<Icon name="diagonal"/></a>:<p>{text('folio.contact.pending','聯絡方式整理中。先從作品與筆記，認識彼此。')}</p>}{c.contact.github&&<a href={c.contact.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}{c.contact.instagram&&<a href={c.contact.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}</div>
    </section>,
    notes: c.settings.showNotes ? <section className="folio-notes" id="notes" data-layout="section:notes" {...prop('notes')}><div className="folio-section-meta"><span>READING INDEX</span><span>{String(c.notes.length).padStart(2,'0')} {text('folio.notes.count','篇思考紀錄')}</span></div>
      <div className="notes-list">{c.notes.map((note,i)=><div key={note.id} className="folio-note-wrap" data-layout={`note:${note.id}`} {...prop(`note-${note.id}`)} data-folio-reveal><details className="note-item folio-note" data-edit={editing?`note:${note.id}`:undefined}><summary><span className="folio-note-no">{String(i+1).padStart(2,'0')}</span><div><span className="folio-note-meta">{value(`notes.${note.id}.date`)}<span> / </span>{value(`notes.${note.id}.tag`)}</span><h2>{value(`notes.${note.id}.title`)}</h2></div><span className="folio-note-action" aria-hidden="true">＋</span></summary><div className="note-body folio-note-body"><p className="preserve-lines">{value(`notes.${note.id}.excerpt`)}</p>{note.url&&<a className="folio-inline" href={note.url} target="_blank" rel="noopener noreferrer">閱讀完整文章<Icon name="diagonal" size={16}/></a>}</div></details></div>)}</div>
      {c.notes.length===0&&<div className="folio-empty"><span className="folio-empty-symbol" aria-hidden="true">／</span><h2>{text('folio.notes.empty','第一篇思考，正在路上。')}</h2><p>{text('folio.notes.empty.body','有些發現需要一點時間，才適合被寫下來。')}</p></div>}
      <p className="folio-endnote">{text('folio.notes.end','NOT EVERYTHING NEEDS AN ANSWER. SOME THINGS NEED A NOTE.')}</p>
    </section>:<section className="folio-empty"><h2>筆記暫未公開。</h2><p>新的觀察，留待下次分享。</p></section>,
    attachments: <section className="folio-resources" id="attachments" data-layout="section:attachments" {...prop('attachments')} data-edit={editing?'attachments':undefined}><div className="folio-section-meta"><span>THE OPEN SHELF</span><span>{String(c.attachments.length).padStart(2,'0')} FILES</span></div>
      {c.attachments.length ? <div className="folio-files">{c.attachments.map((a,i)=><a key={a.id} className="folio-file" href={img(a.url)} target="_blank" rel="noopener noreferrer" {...prop(`attachment-${a.id}`)} data-folio-reveal><span className="folio-file-number">{String(i+1).padStart(2,'0')}</span><span className="folio-file-name">{value(`attachments.${a.id}.name`)}<small>{value(`attachments.${a.id}.label`)}</small></span><span className="folio-file-action">開啟檔案<Icon name="diagonal" size={18}/></span></a>)}</div>:<div className="folio-empty" data-folio-reveal><div className="folio-shelf" aria-hidden="true"><i/><i/><i/><i/></div><span className="folio-micro">A SPACE FOR USEFUL THINGS</span><h2>{text('folio.resources.empty','好用的事物，慢慢整理。')}</h2><p>{text('folio.resources.empty.body','這裡會收錄可分享的檔案與創作資源。\n目前尚無公開附件，之後再來看看。')}</p></div>}
      <div className="folio-resource-foot"><span>USE WITH INTENTION.</span><p>{text('folio.resources.usage','每份資源的用途與使用方式，會隨檔案一併說明。')}</p></div>
    </section>,
  };
  const allowed = page==='about'?['about','contact']:page==='journal'?['notes']:page==='resources'?['attachments']:[];
  return <div className={`site editorial-site page-${page}`} data-site-theme={c.workLab?.options.theme||'light'} data-editing={editing} data-press="false" style={styles}>
    <a className="skip-link" href="#main">跳至主要內容</a>
    <header className="folio-header" {...prop('header')}><a className="wordmark folio-brand" href={editing?'#top':url()} {...prop('brand')} data-edit={editing?'settings':undefined} aria-label={`${c.settings.name} 首頁`}><img className="brand-mark" src={img(c.presentation?.logo||'/assets/outdesign-mark.webp')} width="32" height="32" alt="" {...prop('brand-logo')}/>{value('settings.name')}<span className="folio-brand-sub">PERSONAL / CREATIVE PRACTICE</span></a><span className="folio-header-note">{text('folio.header.note','介於想法與實作之間。')}</span><button className="menu-toggle navigation-trigger" data-menu-toggle aria-label="開啟選單" aria-expanded="false" aria-controls="site-navigation" {...prop('menu-button')}><span aria-hidden="true">☰</span><small>{text("lab.menu","導覽")}</small></button></header>
    <main id="main">
      {layout?.position==='before'&&panels}
      {builtins&&(page==='home'?<>
        <section className="folio-hero" id="top" {...prop('hero')} data-edit={editing?'hero':undefined}>
          <div className="folio-hero-top"><p className="folio-micro">{value('hero.eyebrow')}</p><span className="folio-micro">OUTDESIGN — PERSONAL SPACE</span></div>
          <div className={`folio-hero-stage${art?' has-custom-art':''}`}><div className="hero-copy folio-hero-copy" {...prop('hero-copy')}><span className="folio-chapter">00 — A PRACTICE IN BECOMING</span><h1 data-folio-reveal><span>{value('hero.line1')}</span><span>{value('hero.line2')}</span></h1></div>{art ? artFigure() : <div className="folio-hero-aside" data-folio-reveal><span className="folio-aside-mark" aria-hidden="true">↘</span><p className="preserve-lines">{value('hero.description')}</p><span className="folio-micro">PERSONAL / CREATIVE PRACTICE</span></div>}</div>
          {art&&<p className="folio-custom-description preserve-lines">{value('hero.description')}</p>}
          <div className="folio-type-window" aria-hidden="true"><div className="folio-type-track" data-folio-parallax><span>THOUGHT</span><i>↔</i><span>FORM</span></div><span className="folio-type-caption">A SPACE BETWEEN.</span></div>
          <div className="folio-hero-bottom" {...prop('hero-bottom')}><span>DESIGN / DEVELOPMENT / EXPLORATION</span><a href="#selected-entry">往下閱讀 <span aria-hidden="true">↓</span></a></div>
        </section>
        <section className="folio-work-entry" id="selected-entry" data-folio-reveal><div className="folio-section-meta"><span>SELECTED / EXPERIMENTAL</span><span>THE WORK</span></div><a className="mission-card folio-work-link" {...prop('mission')} href={url('work')} data-page-target="work" data-edit={editing?'about':undefined}><div><span className="folio-micro">{text('folio.work.kicker','把念頭，放進真實的互動裡。')}</span><h2 className="preserve-lines">{value('about.title')}</h2></div>{missionArt&&<img className="folio-mission-image" src={img(missionArt)} alt={c.presentation?.missionAlt||""} width="160" height="160" loading="lazy" {...prop("mission-image")}/>}<span className="folio-work-cta">{text('folio.work.enter','進入作品')}<Icon name="arrow" size={40}/></span></a></section>
        <section className="folio-directory" aria-label="繼續閱讀"><div className="folio-directory-intro" data-folio-reveal><span className="folio-micro">ELSEWHERE IN THIS SPACE</span><h2>{text('folio.directory.title','創作之外，\n也是創作。')}</h2><p>{text('folio.directory.body','一些想法的來處，與正在發生的事。')}</p></div><div>{[['about','01','關於','一種看待事物的方式。'],...(c.settings.showNotes?[['journal','02','筆記','留住還在發酵的思考。']]:[]),['resources','03','資源','把順手的，也分享出去。']].map(([key,n,label,description])=><a className="folio-directory-row" key={key} href={url(key)} data-page-target={key} data-folio-reveal><span>{n}</span><div><h3>{text(`nav.${key}`,label)}</h3><p>{text(`folio.directory.${key}`,description)}</p></div><Icon name="diagonal" size={28}/></a>)}</div></section>
      </>:<><section className={`folio-page-intro folio-intro-${page}`} id="top" {...prop('page-intro')}><p className="folio-micro" data-folio-reveal>{introCopy[0]}</p><div className="folio-page-title" data-folio-reveal><h1>{text(`folio.${page}.title`,introTitle)}<em>{page==='about'?'About':page==='journal'?'Journal':'Resources'}</em></h1><span aria-hidden="true">{page==='about'?'01':page==='journal'?'02':'03'}</span></div><p className="folio-page-description" data-folio-reveal>{text(`folio.${page}.description`,legacyIntro("description",introCopy[2]))}</p></section>{sectionOrder.filter(key=>allowed.includes(key)).map(key=><div key={key}>{sections[key]}</div>)}</>)}
      {layout?.position!=='before'&&panels}
    </main>
    <footer className="folio-footer" {...prop('footer')}><div className="folio-footer-top"><span>{text('folio.footer.note','STAY CURIOUS. KEEP MAKING.')}</span><a href="#top" aria-label="回到頂端" {...prop('footer-top')}>回到頂端 ↑</a></div><div className="footer-meta"><span>{text("footer.copyright",`© ${new Date().getUTCFullYear()} ${c.settings.name}`)}</span><button className="author-link" data-studio-launch><Icon name="lock" size={12}/>{text("footer.author","作者模式")}</button><span className="folio-footer-status"><i/>{text('folio.footer.status','持續創作中')}</span></div></footer>
    <dialog className="nav-drawer folio-navigation" id="site-navigation" aria-label="網站導覽"><div className="drawer-top"><span>OUTDESIGN / INDEX</span><button data-close-dialog aria-label="關閉選單"><Icon name="close"/></button></div><nav aria-label="主要導覽">{links.map(([key,label,en],i)=><a href={url(key==='home'?'':key)} data-page-target={key} aria-current={page===key?'page':undefined} key={key}><span className="nav-index">0{i+1}</span><span>{text(`nav.${key}`,label)}<small>{en}</small></span><Icon name="diagonal" size={20}/></a>)}</nav><button className="site-settings-button" data-site-settings aria-label="開啟全站設定"><GearIcon/><span>全站設定</span></button></dialog>
    <SiteSettings dialogOnly/>
    {!editing&&c.workspace?.scripts?.some(s=>s.page===page&&s.enabled)&&<script type="application/json" data-site-logic dangerouslySetInnerHTML={{__html:JSON.stringify(c.workspace.scripts.filter(s=>s.page===page&&s.enabled)).replaceAll('<','\\u003c')}}/>}
  </div>;
}





