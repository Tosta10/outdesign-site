import type { SiteContent } from "./schema.ts";
export type Draft = {
  content: SiteContent;
  revision: number;
  updatedAt: string;
};
export type Version = { id: string; content: SiteContent; createdAt: string };
export type Session = {
  hash: string;
  expiresAt: number;
  credentialVersion: string;
};
export type Media = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "audio" | "file";
  path: string;
  isPublic: boolean;
  createdAt: string;
};
export interface StudioStore {
  getDraft(): Promise<Draft>;
  saveDraft(
    content: SiteContent,
    expectedRevision: number,
  ): Promise<Draft | null>;
  getPublished(): Promise<Version | null>;
  getVersion(id: string): Promise<Version | null>;
  listVersions(): Promise<Omit<Version, "content">[]>;
  publish(expectedRevision: number, id: string): Promise<Version | null>;
  getSession(hash: string): Promise<Session | null>;
  createSession(session: Session): Promise<void>;
  deleteSession(hash: string): Promise<void>;
  consumeLoginBudget(ipKey: string, now: number): Promise<boolean>;
  listMedia(): Promise<Media[]>;
  getMedia(id: string): Promise<Media | null>;
  putMedia(media: Media, bytes: Uint8Array): Promise<void>;
  readMedia(media: Media, range: string | null): Promise<Response>;
  deleteMedia(id: string): Promise<boolean>;
}
