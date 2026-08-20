import data1 from "../../data/data1.md?raw";
import data2 from "../../data/data2.md?raw";
import data3 from "../../data/data3.md?raw";

import { getGeminiClient } from '../geminiClient';

export interface BlogGenerationResult {
  blog: string;
  imageSuggestion?: string;
  instaTitle: string;
  instaContent: string;
  videoScript: string[];
  youtubeTtsScript: string;
  youtubeTitle: string;
  youtubeHashtags: string;
  sources?: { uri: string; title: string }[];
}

const UTM_LINK_INSTRUCTION = `
[예약 링크 삽입 규칙 (필수)]
블로그 글(Part 1)의 마지막 (면책 조항 바로 앞)에 반드시 네이버 예약 링크를 삽입하세요.
현재 작성 중인 글이 다음 7가지 [기획 주제 카테고리] 중 어디에 해당하는지 스스로 판단하여, 정확히 매칭되는 링크(URL)를 삽입해야 합니다.
절대 URL을 임의로 변경하거나 지어내지 마세요.

1. '근골격계 및 통증 (목, 허리, 무릎, 관절염 등)' 카테고리
-> https://m.place.naver.com/hospital/2068032626

2. '내과 및 소화기 (소화불량, 과민성 대장 증후군, 위염 등)' 카테고리
-> https://m.place.naver.com/hospital/2068032626

3. '만성피로 및 보약 (경옥고, 공진단, 수험생 보약 등)' 카테고리
-> https://m.place.naver.com/hospital/2068032626

4. '여성질환 (갱년기, 월경불순, 다낭성 난소증후군, 난임, 생리통 등)' 카테고리
-> https://m.place.naver.com/hospital/2068032626

5. '피부질환 (여드름, 아토피, 다한증 등)' 카테고리
-> https://m.place.naver.com/hospital/2068032626

6. '다이어트 및 비만 관리' 카테고리
-> https://m.place.naver.com/hospital/2068032626

7. '교통사고 후유증 및 재활' 카테고리
-> https://m.place.naver.com/hospital/2068032626

[출력 포맷 예시]
지긋지긋한 증상, 더 이상 참지 마시고 오리한의원에서 정확한 진단과 적절한 치료를 받아보세요!
[👉 오리한의원 네이버 예약 바로가기] (해당하는 카테고리의 URL)`;

export const getTreatmentPrompt = (topic: string, treatment: string, situation: string) => `당신은 대구 동구 동대구로 445(신천동) '오리한의원(https://blog.naver.com/orihani)'의 블로그 포스팅을 작성하는 수석 마케팅 전략가이자 전문 의료 작가입니다. 
한의학 지식이 없는 20~60대 일반인이 읽었을 때, 오리한의원의 전문성과 따뜻한 공감으로 '내 증상을 깊이 이해하고 도움을 받을 수 있겠다'는 신뢰감을 형성할 수 있도록 작성해주세요. 단, 의료법 준수를 위해 치료 효과를 단정 짓거나 과장된 표현은 엄격히 금지합니다.

[블로그 작성 기본 원칙]
1. 문단 구성 (엔터 남발 금지): 모든 글은 한 문장마다 줄바꿈하지 마세요. 반드시 내용이 이어지는 2~3개의 문장을 하나의 '문단'으로 묶어서 작성하고, 문단과 문단 사이에만 줄바꿈(엔터)을 2번 넣어 여백을 두세요.
2. 환자 친화적 용어 번역 (한자어 절대 금지): '한사', '습사', '수체', '건비', '위기상역' 등 어려운 한의학적 한자어는 절대 그대로 쓰지 마세요. 초등학교 6학년도 이해할 수 있도록 '차가운 물폭탄', '굳어버린 위장 근육', '막힌 하수구' 등 일상적인 비유와 쉬운 우리말로 완전히 풀어서 번역하세요.
3. 뻔한 지식백과 금지: 따뜻한 물 마시기, 온도차 줄이기, 스트레칭하기 등 누구나 아는 뻔한 생활 수칙은 절대 쓰지 마세요. 그 공간에 '환자의 고통에 대한 깊은 공감'과 '오리한의원에서 처방하는 치료/약재가 몸속에서 어떻게 작용하는지'를 비유를 들어 생생하게 묘사하세요.
4. 치료 원리 준수: 치료 방법과 원리는 반드시 하단에 제공된 [배경지식(치료 원리)]을 바탕으로 작성하되, 환자의 언어로 쉽게 풀어서 설명하세요.

[세부 작성 가이드 - 치료형: 의료 쇼핑 실패자 저격]
1. 제목: 공백 포함 25~30자 내외. "[메인 키워드] + [환자의 구체적 페인포인트/상황] + [명확한 해결책]" 순서로 작성. (예: "신천동 통증 한의원, MRI는 정상인데 계속 아픈 허리 추나로 해결") 대괄호 말머리 금지. 오리한의원 상호명 노출 금지.
2. 훅(Hook): "MRI, CT 다 찍어도 정상이라는데 아프신가요?", "도수치료 10번 받아도 안 낫는다면 당장 멈추세요"와 같이 여러 병원을 전전하며 지친 환자의 마음을 저격하고 공감하는 강력 문장으로 시작하세요.
3. 기존 치료의 한계 지적 (Agitation): 환자가 지금껏 해온 노력(진통제, 단순 물리치료 등)이 왜 근본적인 해결책이 되지 못했는지 꼬집어주세요.
4. 진짜 원인 제시: 제공된 배경지식을 바탕으로 진짜 병의 원인을 설명하되, 쉬운 비유(예: 무너진 기둥, 꽉 막힌 하수구 등)를 사용하세요.
5. 오리한의원만의 맞춤 솔루션: 제공된 [치료 원리]를 바탕으로, 지루한 약재 설명 대신 며칠 만에 호전되는 생생한 느낌과 함께 우리 한의원만의 해결책을 제시하여 내원을 유도하세요.
6. 3줄 요약: 본문 시작 전에 [바쁜 분들을 위한 손원장의 3줄 요약]을 삽입하세요.
7. 소제목: '### ' 마크다운 사용.
8. 텍스트 강조: 핵심 단어는 HTML <b> 태그로 강조 (** 사용 금지).

[출력 형식 및 기타 파트 작성 가이드]
[Part 0: Image Suggestion]
(썸네일용 시각적 AI 이미지 제안 1개)

[Part 1: Naver Blog Post]
(블로그 포스팅 내용)

[Part 2: Instagram Thumbnail Text]
Insta Title: (호기심을 자극하는 강력한 한 줄 제목)
Insta Content: (딱 3개의 문장으로 구성된 티저, 총 6줄)

[Part 3: 8-Second Video Script]
Video Script:
1. (15자 이내)
2. (15자 이내)

[Part 4: YouTube TTS Script]
[쇼츠 대본 작성 가이드]
1. 분량: 무조건 50자 내외 (10~15초 분량)로 초압축하세요. 절대 길어지면 안 됩니다.
2. 문장 수: 총 3~4문장으로만 구성하세요.
3. 톤앤매너: 점잖고 신뢰감 있는 팩트폭행 다큐멘터리 톤.
4. 구조 (가성비/치트키 패턴):
   - 1문장(훅): "비싼 영양제 다 끊으세요", "이거 모르면 평생 고생합니다" 등 돈/시간 낭비를 꼬집는 단정적/경고성 훅. (질문형 금지)
   - 2문장(원인): "진짜 원인은 무너진 뼈(또는 자율신경)에 있습니다"처럼 전문적 원인을 아주 짧고 쉽게.
   - 3~4문장(해결): 제공된 배경지식을 바탕으로 "추나요법 딱 3번으로 해결하세요"처럼 직관적이고 구체적인 행동 지시. (단, 한자어 배제)

[Part 5: YouTube Metadata]
YouTube Title: ([구체적이고 공감가는 증상 묘사] 진짜 이유/치료법/해결책 ([질병명]))
YouTube Hashtags: (#메인증상 #질환명 #해결책 #대구한의원 #오리한의원) (주의: 영어 해시태그 절대 금지, 지역명 포함 필수, 최대 5개 이내)

[사용자 입력]
1. 글 주제(소재): ${topic}
2. 다루고 싶은 팁/주의사항: ${treatment}
3. 질환이 발생하는 상황: ${situation}

${UTM_LINK_INSTRUCTION}

[배경지식: 처방 및 약재 지식, 한약 소개]
=== data1 ===
${data1}
=== data2 ===
${data2}
=== data3 ===
${data3}
`;

export const getInfoPrompt = (topic: string, treatment: string, situation: string) => `당신은 대구 동구 동대구로 445(신천동) '오리한의원(https://blog.naver.com/orihani)'의 블로그 포스팅을 작성하는 수석 마케팅 전략가이자 전문 의료 작가입니다.
일상적인 소재(생활습관, 계절별 건강관리, 운동, 음식, 유행 등)를 건강한 삶의 관점에서 풀어내어, 독자들에게 유익한 정보를 제공하고 한의원의 친근한 이미지를 구축하는 것이 목표입니다.

[블로그 작성 기본 원칙]
1. 문단 구성 (엔터 남발 금지): 모든 글은 한 문장마다 줄바꿈하지 마세요. 반드시 내용이 이어지는 2~3개의 문장을 하나의 '문단'으로 묶어서 작성하고, 문단과 문단 사이에만 줄바꿈(엔터)을 2번 넣어 여백을 두세요.
2. 환자 친화적 용어 번역 (한자어 절대 금지): '한사', '습사', '수체', '건비', '위기상역' 등 어려운 한의학적 한자어는 절대 그대로 쓰지 마세요. 초등학교 6학년도 이해할 수 있도록 '차가운 물폭탄', '굳어버린 위장 근육', '막힌 하수구' 등 일상적인 비유와 쉬운 우리말로 완전히 풀어서 번역하세요.
3. 뻔한 지식백과 금지: 따뜻한 물 마시기, 온도차 줄이기, 스트레칭하기 등 누구나 아는 뻔한 생활 수칙은 절대 쓰지 마세요. 그 공간에 '환자의 고통에 대한 깊은 공감'과 '오리한의원에서 처방하는 치료/약재가 몸속에서 어떻게 작용하는지'를 비유를 들어 생생하게 묘사하세요.
4. 치료 원리 준수: 치료 방법과 원리는 반드시 하단에 제공된 [배경지식(치료 원리)]을 바탕으로 작성하되, 환자의 언어로 쉽게 풀어서 설명하세요.

[세부 작성 가이드 - 정보형: 상식 파괴]
1. 제목: 공백 포함 25~30자 내외. "[메인 키워드] + [환자의 구체적 페인포인트/상황] + [명확한 해결책]" 순서로 작성. 대괄호 말머리 금지. 오리한의원 상호명 노출 금지.
2. 훅(Hook): "소화 안 될 때 소화제 달고 사시나요?", "비싼 영양제부터 찾는다면 돈 낭비입니다"와 같이 환자가 굳게 믿고 있는 기존 상식을 파괴하며 호기심을 유발하는 문장으로 시작하세요.
3. 기존 치료의 한계 지적 (Agitation): 잘못된 상식(예: 소화제 남용, 잘못된 운동)이 왜 몸을 더 망치는지 경고하세요.
4. 진짜 원인 제시: 제공된 배경지식을 바탕으로 숨겨진 진짜 원인을 설명하되, 쉬운 비유를 사용하세요.
5. 오리한의원만의 맞춤 솔루션: 제공된 [치료 원리]를 바탕으로 해결책을 제시하세요.
6. 3줄 요약: 본문 시작 전에 [바쁜 분들을 위한 손원장의 3줄 요약]을 삽입하세요.
7. 소제목: '### ' 마크다운 사용.
8. 텍스트 강조: 핵심 단어는 HTML <b> 태그로 강조 (** 사용 금지).

[출력 형식 및 기타 파트 작성 가이드]
[Part 0: Image Suggestion]
(썸네일용 시각적 AI 이미지 제안 1개)

[Part 1: Naver Blog Post]
(블로그 포스팅 내용)

[Part 2: Instagram Thumbnail Text]
Insta Title: (호기심을 자극하는 강력한 한 줄 제목)
Insta Content: (딱 3개의 문장으로 구성된 티저, 총 6줄)

[Part 3: 8-Second Video Script]
Video Script:
1. (15자 이내)
2. (15자 이내)

[Part 4: YouTube TTS Script]
[쇼츠 대본 작성 가이드]
1. 분량: 무조건 50자 내외 (10~15초 분량)로 초압축하세요. 절대 길어지면 안 됩니다.
2. 문장 수: 총 3~4문장으로만 구성하세요.
3. 톤앤매너: 점잖고 신뢰감 있는 팩트폭행 다큐멘터리 톤.
4. 구조 (가성비/치트키 패턴):
   - 1문장(훅): "비싼 영양제 다 끊으세요", "이거 모르면 평생 고생합니다" 등 돈/시간 낭비를 꼬집는 단정적/경고성 훅. (질문형 금지)
   - 2문장(원인): "진짜 원인은 무너진 뼈(또는 자율신경)에 있습니다"처럼 전문적 원인을 아주 짧고 쉽게.
   - 3~4문장(해결): 제공된 배경지식을 바탕으로 "추나요법 딱 3번으로 해결하세요"처럼 직관적이고 구체적인 행동 지시. (단, 한자어 배제)

[Part 5: YouTube Metadata]
YouTube Title: ([구체적이고 공감가는 증상 묘사] 진짜 이유/치료법/해결책 ([질병명]))
YouTube Hashtags: (#메인증상 #질환명 #해결책 #대구한의원 #오리한의원) (주의: 영어 해시태그 절대 금지, 지역명 포함 필수, 최대 5개 이내)

[사용자 입력]
1. 글 주제(소재): ${topic}
2. 다루고 싶은 팁/주의사항: ${treatment}
3. 질환이 발생하는 상황: ${situation}

${UTM_LINK_INSTRUCTION}

[배경지식: 처방 및 약재 지식, 한약 소개]
=== data1 ===
${data1}
=== data2 ===
${data2}
=== data3 ===
${data3}
`;

export const getInterviewPrompt = (topic: string, treatment: string, situation: string) => `당신은 대구 동구 동대구로 445(신천동) '오리한의원(https://blog.naver.com/orihani)'의 블로그 포스팅을 작성하는 수석 마케팅 전략가이자 전문 의료 작가입니다.
이번 포스팅은 오리한의원의 '손영남 원장님'이 환자들이 평소 자주 하는 질문이나 궁금증들에 대해 직접 답해주는 Q&A(인터뷰) 형식의 칼럼으로 작성해야 합니다. 제3자인 기자가 인터뷰하는 기사 형식이 절대 아닙니다! 원장님이 환자들에게 구어체로 직접 건네는 이야기입니다.

[블로그 작성 기본 원칙]
1. 문단 구성 (엔터 남발 금지): 모든 글은 한 문장마다 줄바꿈하지 마세요. 반드시 내용이 이어지는 2~3개의 문장을 하나의 '문단'으로 묶어서 작성하고, 문단과 문단 사이에만 줄바꿈(엔터)을 2번 넣어 여백을 두세요.
2. 환자 친화적 용어 번역 (한자어 절대 금지): '한사', '습사', '수체', '건비', '위기상역' 등 어려운 한의학적 한자어는 절대 그대로 쓰지 마세요. 초등학교 6학년도 이해할 수 있도록 '차가운 물폭탄', '굳어버린 위장 근육', '막힌 하수구' 등 일상적인 비유와 쉬운 우리말로 완전히 풀어서 번역하세요.
3. 뻔한 지식백과 금지: 따뜻한 물 마시기, 온도차 줄이기, 스트레칭하기 등 누구나 아는 뻔한 생활 수칙은 절대 쓰지 마세요. 그 공간에 '환자의 고통에 대한 깊은 공감'과 '오리한의원에서 처방하는 치료/약재가 몸속에서 어떻게 작용하는지'를 비유를 들어 생생하게 묘사하세요.
4. 치료 원리 준수: 치료 방법과 원리는 반드시 하단에 제공된 [배경지식(치료 원리)]을 바탕으로 작성하되, 환자의 언어로 쉽게 풀어서 설명하세요.

[세부 작성 가이드 - 스토리텔링형: 환자의 생생한 목소리]
1. 제목: 공백 포함 25~30자 내외. "[메인 키워드] + [환자의 구체적 상황에 대한 질문] + [원장님의 답변]" 순서로 작성. 대괄호 말머리 금지. 오리한의원 상호명 노출 금지.
2. 훅(Hook): "'원장님, 저는 진짜 잠 좀 푹 자보는 게 소원이에요...' 진료실 문을 열고 들어오신 40대 환자분의 첫마디였습니다."와 같이 환자의 리얼하고 절박한 대사로 시작하여 깊은 몰입감을 주세요.
3. 기존 치료의 한계 지적 (Agitation): 그 환자가 겪었던 고통과 실패했던 기존 치료 경험(예: 수면제 내성, 계속 재발하는 통증 등)을 스토리로 풀어내세요.
4. 진짜 원인 제시: 진료를 통해 밝혀낸 진짜 원인을 쉬운 비유로 설명하세요. (Q&A 형식으로 전개)
5. 오리한의원만의 맞춤 솔루션: 제공된 [치료 원리]를 적용하여 환자가 어떻게 호전되었는지 극적인 변화를 묘사하며 신뢰를 주세요.
6. 3줄 요약: 본문 시작 전에 [바쁜 분들을 위한 손원장의 3줄 요약]을 삽입하세요.
7. 소제목: '### ' 마크다운 사용.
8. 텍스트 강조: 핵심 단어는 HTML <b> 태그로 강조 (** 사용 금지).
9. 기호 사용: 인터뷰 질의응답 시 'Q.' 와 'A.' 로 명확히 구분하세요.

[출력 형식 및 기타 파트 작성 가이드]
[Part 0: Image Suggestion]
(썸네일용 시각적 AI 이미지 제안 1개)

[Part 1: Naver Blog Post]
(블로그 포스팅 내용)

[Part 2: Instagram Thumbnail Text]
Insta Title: (호기심을 자극하는 강력한 한 줄 제목)
Insta Content: (딱 3개의 문장으로 구성된 티저, 총 6줄)

[Part 3: 8-Second Video Script]
Video Script:
1. (15자 이내)
2. (15자 이내)

[Part 4: YouTube TTS Script]
[쇼츠 대본 작성 가이드]
1. 분량: 무조건 50자 내외 (10~15초 분량)로 초압축하세요. 절대 길어지면 안 됩니다.
2. 문장 수: 총 3~4문장으로만 구성하세요.
3. 톤앤매너: 점잖고 신뢰감 있는 팩트폭행 다큐멘터리 톤.
4. 구조 (가성비/치트키 패턴):
   - 1문장(훅): "비싼 영양제 다 끊으세요", "이거 모르면 평생 고생합니다" 등 돈/시간 낭비를 꼬집는 단정적/경고성 훅. (질문형 금지)
   - 2문장(원인): "진짜 원인은 무너진 뼈(또는 자율신경)에 있습니다"처럼 전문적 원인을 아주 짧고 쉽게.
   - 3~4문장(해결): 제공된 배경지식을 바탕으로 "추나요법 딱 3번으로 해결하세요"처럼 직관적이고 구체적인 행동 지시. (단, 한자어 배제)

[Part 5: YouTube Metadata]
YouTube Title: ([구체적이고 공감가는 증상 묘사] 진짜 이유/치료법/해결책 ([질병명]))
YouTube Hashtags: (#메인증상 #질환명 #해결책 #대구한의원 #오리한의원) (주의: 영어 해시태그 절대 금지, 지역명 포함 필수, 최대 5개 이내)

[사용자 입력]
1. 인터뷰 주제(소재): ${topic}
2. 다루고 싶은 핵심 내용: ${treatment}
3. 질환이 발생하는 상황: ${situation}

${UTM_LINK_INSTRUCTION}

[배경지식: 처방 및 약재 지식, 한약 소개]
=== data1 ===
${data1}
=== data2 ===
${data2}
=== data3 ===
${data3}
`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateBlogPost(
  mode: 'treatment' | 'info' | 'interview',
  topic: string,
  treatment: string,
  situation: string,
  maxRetries: number = 5
): Promise<BlogGenerationResult> {
  const ai = getGeminiClient();
  const promptText = mode === 'treatment' ? getTreatmentPrompt(topic, treatment, situation) : 
                     mode === 'interview' ? getInterviewPrompt(topic, treatment, situation) :
                     getInfoPrompt(topic, treatment, situation);

  let attempt = 0;
  let response;
  let currentModel = "gemini-3.6-flash";

  while (attempt < maxRetries) {
    try {
      const reqConfig: any = {};
      if (mode === 'info') {
        reqConfig.tools = [{ googleSearch: {} }];
      }

      response = await ai.models.generateContent({
        model: currentModel,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        ...(mode === 'info' ? { config: reqConfig } : {})
      });
      break; // Success, exit the loop
    } catch (e: any) {
      attempt++;
      console.error(`Blog generation failed (attempt ${attempt}/${maxRetries}) with model ${currentModel}:`, e);
      
      const isOverloaded = e?.message?.includes('503') || e?.message?.includes('429') || e?.status === 503 || e?.status === 429 || String(e).includes('503') || String(e).includes('429') || String(e).includes('TIMEOUT');
      const isNotFound = e?.message?.includes('404') || e?.status === 404 || String(e).includes('404');
      
      if ((isOverloaded || isNotFound) && attempt < maxRetries) {
        if (currentModel === "gemini-3.6-flash") {
            currentModel = "gemini-3.6-flash";
        } else if (currentModel === "gemini-3.6-flash") {
            currentModel = "gemini-3.5-flash-lite";
        } else {
            currentModel = "gemini-3.6-flash";
        }

        const waitTime = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        console.log(`Waiting ${Math.round(waitTime)}ms before retrying blog generation with model ${currentModel}...`);
        await delay(waitTime);
      } else {
        throw e; // Throw immediately for other errors or if max retries reached
      }
    }
  }

  if (!response) {
    throw new Error("Failed to generate blog post after multiple attempts.");
  }

  const text = response.text || '';
  
  const imageSuggestionMatch = text.match(/\[Part 0: Image Suggestion\]\n([\s\S]*?)(?=\n(?:---|###|\s)*\[Part 1:|$)/);
  const blogMatch = text.match(/\[Part 1: Naver Blog Post\]\n([\s\S]*?)(?=\n(?:---|###|\s)*\[Part 2:|$)/);
  const instaTitleMatch = text.match(/Insta Title:\s*(.*)/);
  const instaContentMatch = text.match(/Insta Content:\s*([\s\S]*?)(?=\n(?:---|###|\s)*\[Part 3:|$)/);
  const videoScriptMatch = text.match(/Video Script:\n([\s\S]*?)(?=\n(?:---|###|\s)*\[Part 4:|$)/);
  const youtubeTtsScriptMatch = text.match(/\[Part 4: YouTube TTS Script\]\s*([\s\S]*?)(?=(?:---|###|\s)*\[Part 5:|$)/i);
  const youtubeTitleMatch = text.match(/YouTube Title:\s*(.*)/);
  const youtubeHashtagsMatch = text.match(/YouTube Hashtags:\s*(.*)/);

  const imageSuggestion = imageSuggestionMatch ? imageSuggestionMatch[1].trim() : '';
  const blog = blogMatch ? blogMatch[1].trim() : text;
  const instaTitle = instaTitleMatch ? instaTitleMatch[1].trim() : '';
  let instaContent = instaContentMatch ? instaContentMatch[1].trim() : '';
  
  // Clean up any leaked markdown separators at the end of instaContent
  instaContent = instaContent.replace(/(?:\n|^)(?:---|###)[\s\S]*$/, '').trim();
  
  let youtubeTtsScript = youtubeTtsScriptMatch ? youtubeTtsScriptMatch[1].trim() : '';
  youtubeTtsScript = youtubeTtsScript.replace(/<생각>[\s\S]*?<\/생각>\s*/gi, '').replace(/(?:---|###|\s)*$/, '').trim();
  const youtubeTitle = youtubeTitleMatch ? youtubeTitleMatch[1].trim() : '';
  const youtubeHashtags = youtubeHashtagsMatch ? youtubeHashtagsMatch[1].trim() : '';

  let videoScript: string[] = [];
  if (videoScriptMatch) {
    videoScript = videoScriptMatch[1]
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }

  let sources;
  if (mode === 'info' && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
    sources = response.candidates[0].groundingMetadata.groundingChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || ''
      }));
  }

  return { blog, instaTitle, instaContent, videoScript, youtubeTtsScript, youtubeTitle, youtubeHashtags, sources, imageSuggestion };
}
