import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialContent } from '../src/lib/editorial-content.ts';
import { initialContent } from '../supabase/functions/_shared/seed.ts';

test('editorial copy removes known demo instructions without mutating stored content', () => {
  const original = structuredClone(initialContent);
  const content = editorialContent(initialContent);
  assert.equal(content.hero.line1, '讓想法，');
  assert.equal(content.about.title, '好奇，\n是一種工作方式。');
  assert.equal(content.about.body.includes('作者模式'), false);
  assert.equal(content.notes.some(note=>note.excerpt.includes('示範筆記')||note.excerpt.includes('作者模式')), false);
  assert.deepEqual(initialContent, original);
  assert.deepEqual(editorialContent(content), content);
});
test('editorial copy preserves author content, media, work, contact and resources', () => {
  const content = structuredClone(initialContent);
  content.hero.line1='我的想法'; content.hero.image='asset:author-photo';
  content.about.body='真實且自訂的介紹'; content.notes[0].excerpt='我的手寫觀察';
  content.contact.email='real@outdesign.test'; content.contact.headline='談談新計畫';
  const rendered = editorialContent(content);
  assert.equal(rendered.hero.line1,content.hero.line1);
  assert.equal(rendered.hero.image,content.hero.image);
  assert.equal(rendered.about.body,content.about.body);
  assert.equal(rendered.notes[0].excerpt,content.notes[0].excerpt);
  assert.deepEqual(rendered.workLab,content.workLab);
  assert.deepEqual(rendered.contact,content.contact);
  assert.deepEqual(rendered.attachments,content.attachments);
});
