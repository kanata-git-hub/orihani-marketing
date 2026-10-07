export interface BlogGenerationResult {
  blog: string;
  imageSuggestion?: string;
  instaTitle: string;
  instaContent: string;
  videoScript: string[];
  youtubeTtsScript: string;
  youtubeTitle: string;
  youtubeHashtags: string;
  youtubeNarration?: string;
  sources?: { uri: string; title: string }[];
  rawResponse?: string;
}

// Normalize labels only. Blog HTML/Markdown and prompt bodies retain their formatting.
const labelText = (line: string) => line.trim()
  .replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '')
  .replace(/\*\*|__|`/g, '').trim();
const cleanMetadata = (text: string) => text.replace(/\*\*|__/g, '').trim();
const trimSection = (lines: string[]) => lines.join('\n').trim()
  .replace(/(?:\n\s*(?:---+|\*\*\*+|___+))+$/, '').trim();

function blogParts(text: string) {
  const parts = new Map<number, string[]>();
  let current: number | undefined;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = labelText(line).match(/^\[Part\s+(\d+)\s*[:：][^\]]+\]\s*#*$/i);
    if (heading) {
      current = Number(heading[1]);
      parts.set(current, []);
    } else if (current !== undefined) {
      parts.get(current)!.push(line);
    }
  }
  return new Map([...parts].map(([number, lines]) => [number, trimSection(lines)]));
}

function metadataFields(text: string) {
  const fields = new Map<string, string[]>();
  let current = '';
  for (const line of text.split('\n')) {
    const normalized = labelText(line);
    const match = normalized.match(/^(Insta Title|Insta Content|Video Script|YouTube Title|YouTube Hashtags|YouTube Narration)\s*[:：]\s*(.*)$/i);
    if (match) {
      current = match[1].toLowerCase();
      fields.set(current, [match[2]]);
    } else if (current) {
      fields.get(current)!.push(line);
    }
  }
  return new Map([...fields].map(([key, lines]) => [key, cleanMetadata(trimSection(lines))]));
}

export function parseBlogResponse(text: string, fallbackTitle = ''): BlogGenerationResult {
  const parts = blogParts(text);
  const insta = metadataFields(parts.get(2) || '');
  const video = metadataFields(parts.get(3) || '');
  const youtube = metadataFields(parts.get(5) || '');
  const blog = parts.get(1) || '';
  const instaTitle = (insta.get('insta title') || '').split('\n').find(line => line.trim())?.trim() || fallbackTitle.trim();
  const instaContent = insta.get('insta content') || '';
  const videoScript = (video.get('video script') || '').split('\n')
    .map(line => line.trim().match(/^\d+[.)]\s*(.+)$/)?.[1] || '').filter(Boolean);

  if (!blog || !instaTitle || !instaContent || !videoScript.length) {
    throw new Error('생성된 글에서 본문·제목·요약·영상 대본을 모두 읽지 못했습니다. 블로그의 포스팅 생성하기를 다시 눌러주세요.');
  }
  return {
    blog, instaTitle, instaContent, videoScript,
    imageSuggestion: parts.get(0) || '',
    youtubeTtsScript: (parts.get(4) || '').replace(/<생각>[\s\S]*?<\/생각>\s*/gi, '').trim(),
    youtubeTitle: youtube.get('youtube title') || '',
    youtubeHashtags: youtube.get('youtube hashtags') || '',
    youtubeNarration: (youtube.get('youtube narration') || '').replace(/^["']|["']$/g, ''),
    rawResponse: text,
  };
}

// Old parsing sometimes stored the entire response in blog, but only "**" as title.
// Repair on read, without deleting or overwriting the original saved history.
export function restoreBlogResult(result: BlogGenerationResult, topic: string): BlogGenerationResult {
  if (result.rawResponse || /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\[Part\s+1:/im.test(result.blog)) {
    try {
      return { ...result, ...parseBlogResponse(result.rawResponse || result.blog, topic) };
    } catch {
      // Preserve older partial drafts even if the source cannot fully restore them.
    }
  }
  return {
    ...result,
    instaTitle: cleanMetadata(result.instaTitle || '') || topic,
    instaContent: cleanMetadata(result.instaContent || ''),
  };
}

export function parseScenarioResponse(text: string, characters: { id: string; name: string }[]) {
  const sections = new Map<number, string[]>();
  let current: number | undefined;
  let characterText = '';
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const normalized = labelText(line);
    const heading = normalized.match(/^([012])[.)]\s+(?:Planning\b|Image\b|Video\b)/i);
    const cast = normalized.match(/^출연\s*캐릭터\s*[:：]\s*(.*)/);
    if (cast) characterText = cast[1];
    if (heading) {
      current = Number(heading[1]);
      sections.set(current, []);
    } else if (current !== undefined) {
      sections.get(current)!.push(line);
    }
  }
  const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const castIds = (characterText.match(/[a-z]+(?:-[a-z]+)*/gi) || []).map(canonical);
  return {
    imagePrompt: trimSection(sections.get(1) || []),
    videoPrompt: trimSection(sections.get(2) || []),
    characters: characters.filter(c => castIds.some(id => id === canonical(c.id) || id === canonical(c.name))).map(c => c.id),
  };
}

export const canSaveScenario = (imagePrompt: string, videoPrompt: string) =>
  Boolean(cleanMetadata(imagePrompt) && cleanMetadata(videoPrompt));
