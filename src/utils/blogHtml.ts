import DOMPurify from 'dompurify';

export const convertToBlogHtml = (text: string) => {
  const cleanLines = (text || '').split('\n');
  let inBlockquote = false;
  let isFirstTextLine = true;
  const htmlParts: string[] = [];

  for (let i = 0; i < cleanLines.length; i++) {
    let htmlLine = DOMPurify.sanitize(cleanLines[i].trim(), {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'br', 'a'],
      ALLOWED_ATTR: ['href', 'title'],
    });

    // 빈 줄은 여백으로 유지
    if (!htmlLine) {
      if (inBlockquote) {
        htmlParts.push('</div>');
        inBlockquote = false;
      }
      htmlParts.push('<p><br></p>');
      continue;
    }

    // 첫 번째 줄은 대제목
    if (isFirstTextLine) {
      isFirstTextLine = false;
      htmlLine = htmlLine.replace(/^(제목|소제목):\s*/, '').replace(/^#+\s*/, '');
      htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
      htmlParts.push(`<p><span style="font-size: 24pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
      continue;
    }

    // 제목이나 소제목, 마크다운 #, 또는 질문(Q) 로 시작하는 경우 소제목(인용구 4 스타일) 처리
    if (/^(제목|소제목):\s*/.test(htmlLine) || htmlLine.startsWith('#') || /^[Q]\./i.test(htmlLine) || /^질문:/i.test(htmlLine)) {
      if (inBlockquote) { htmlParts.push('</div>'); inBlockquote = false; }
      htmlLine = htmlLine.replace(/^(제목|소제목):\s*/, '').replace(/^#+\s*/, '');
      htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
      // 네이버 블로그 인용구 4(상하단 선) 스타일을 시각적으로 구현 (기본 blockquote는 인용구 1로만 붙여넣기 됨)
      htmlParts.push(`<div style="border-top: 1px solid #000000; border-bottom: 1px solid #000000; padding: 20px 10px; margin: 30px 0;"><p><span style="font-size: 18pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p></div>`);
      continue;
    }

    // 3줄 요약 블록 시작
    if (htmlLine.includes('3줄 요약')) {
      if (inBlockquote) { htmlParts.push('</div>'); inBlockquote = false; }
      inBlockquote = true;
      htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
      htmlParts.push(`<div style="border: 2px solid #e5e7eb; padding: 20px; background-color: #f9fafb; margin: 20px 0;"><p><span style="font-size: 14pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
      continue;
    }

    // 3줄 요약 블록 내부
    if (inBlockquote) {
      htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
      htmlParts.push(`<p><span style="font-size: 11pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
      continue;
    }

    // 답변(A) 문구 볼드 처리
    if (/^[A]\./i.test(htmlLine) || /^답변:/i.test(htmlLine)) {
      if (!htmlLine.includes('**')) { 
        htmlLine = `**${htmlLine}**`;
      }
    }

    // 마크다운 볼드체(**)를 <b> 태그로 변환 (기존 로직 유지, LLM이 <b>를 주더라도 대응 가능하도록)
    htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    htmlParts.push(`<p>${htmlLine}</p>`);
  }

  if (inBlockquote) {
    htmlParts.push('</div>');
  }

  return DOMPurify.sanitize(htmlParts.join('\n'), {
    ALLOWED_TAGS: ['p', 'span', 'div', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'a'],
    ALLOWED_ATTR: ['style', 'href', 'title'],
  });
};
