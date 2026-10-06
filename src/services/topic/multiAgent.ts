import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { AgentLog, AgentResponse, FinalOutput } from '../../types/agent';
import { callAgent } from '../core/agentRunner';
import { DUPLICATE_POLICY, DYSPEPSIA_FOCUS, isDuplicatePlan, isWithinTopicFocus, selectTopicCategory, type TopicMode } from './topicPolicy';
import { 
  TOPIC_CRAWLER_PROMPT, 
  TOPIC_JSON_PROCESSOR_PROMPT, 
  TOPIC_PLANNER_PROMPT, 
  TOPIC_REVIEWER_PROMPT 
} from '../../config/pipelinePrompts';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchNetworkTime(onProgress?: (log: AgentLog) => void): Promise<Date> {
  const maxRetries = 3;
  let currentDate = new Date();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://worldtimeapi.org/api/timezone/Asia/Seoul', { timeout: 3000 } as RequestInit);
      if (response.ok) {
        const data = await response.json();
        currentDate = new Date(data.datetime);
        break;
      }
    } catch (e) {
      if (attempt === maxRetries) {
        if (onProgress) {
           onProgress({
            id: Date.now().toString(),
            timestamp: Date.now(),
            agentName: 'System',
            message: "한국 시간 동기화 실패. 만료 방지를 위해 로컬 시간을 사용합니다.",
            type: 'warning'
          });
        }
      } else {
        await delay(1000 * attempt);
      }
    }
  }
  return currentDate;
}

async function fetchRecentHistory(currentDate: Date): Promise<{ text: string, data: any[] }> {
  let recentHistoryText = "최근 1개월 기획·초안 내역 없음.";
  let recentHistoryData: any[] = [];
  try {
    const oneMonthAgo = new Date(currentDate);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoIso = oneMonthAgo.toISOString();

    const historyRef = collection(db, 'blog_history');
    const q = query(historyRef, where('publishDate', '>=', oneMonthAgoIso));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      recentHistoryData = querySnapshot.docs.map(doc => doc.data());
      recentHistoryText = recentHistoryData.map((data, index) => 
        `[${index + 1}] 질환/부위: ${data.disease || '미상'}, 타겟: ${data.target}, 상황: ${data.situation}, 치료법: ${Array.isArray(data.treatments) ? data.treatments.join(', ') : '미상'}`
      ).join('\n');
    }
  } catch (error) {
    console.error("Failed to fetch blog history:", error);
  }
  return { text: recentHistoryText, data: recentHistoryData };
}

export const runMultiAgentSystem = async (
  onProgress: (log: AgentLog) => void,
  userFeedback?: string,
  previousCategory?: string,
  topicMode: TopicMode = 'dyspepsia'
): Promise<FinalOutput> => {
  const currentDate = await fetchNetworkTime(onProgress);
  const today = currentDate.toLocaleDateString('ko-KR');
  
  const randomCategory = selectTopicCategory(topicMode, previousCategory);
  const topicInstructions = topicMode === 'dyspepsia' ? DYSPEPSIA_FOCUS : DUPLICATE_POLICY;

  const { text: recentHistoryText, data: recentHistoryData } = await fetchRecentHistory(currentDate);
  
  let globalAttempt = 0;
  const maxGlobalRetries = 5;
  let reviewerFeedbackHistory = userFeedback ? `[원장님(최종 확인자)의 지시사항 (가장 최우선 반영)]:\n${userFeedback}\n\n` : "";

  let crawlerRes: AgentResponse, jsonRes: AgentResponse, plannerRes: AgentResponse, parsedReviewer: any;

  onProgress({
    id: Date.now().toString() + Math.random(),
    timestamp: Date.now(),
    agentName: 'System',
    message: `[오늘의 집중 기획 대분류]: ${randomCategory}\n\n[최근 1개월 기획·초안 이력]\n${recentHistoryText}`,
    type: 'success'
  });

  while (globalAttempt <= maxGlobalRetries) {
    globalAttempt++;

    if (globalAttempt > 1) {
      onProgress({
        id: Date.now().toString() + Math.random(),
        timestamp: Date.now(),
        agentName: 'System',
        message: `[재작업 시작] 검수자 반려 또는 중복 기획 감지로 인한 재시작 (시도 ${globalAttempt}/${maxGlobalRetries + 1})`,
        type: 'warning'
      });
    }

    // 1. Crawler
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: 'Crawler',
      message: "데이터 크롤링 중...",
      type: 'working'
    });
    
    const crawlerPrompt = `기준일: ${today}\n대분류: ${randomCategory}\n\n${topicInstructions}\n\n[최근 1개월 기획 내역]\n${recentHistoryText}\n\n위 범위 내에서 핵심 질문 하나를 선정하고 관련 키워드와 자료를 수집하세요.\n\n${reviewerFeedbackHistory}`;
    const crawlerOutput = await callAgent(
      TOPIC_CRAWLER_PROMPT, 
      crawlerPrompt, 
      "gemini-3.5-flash-lite", 
      undefined, undefined, true, 5, 
      ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]
    );
    if (crawlerOutput.startsWith("오류 발생:")) throw new Error(crawlerOutput);
    crawlerRes = { role: "크롤러", content: crawlerOutput };
    
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: 'Crawler',
      message: "날것의 정보 수집 완료",
      type: 'success'
    });
    await delay(300);

    // 2. JSON Processor
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: 'JSON 가공자',
      message: "수집된 데이터 마크다운 JSON 구조화 중...",
      type: 'working'
    });
    
    const jsonOutput = await callAgent(
      TOPIC_JSON_PROCESSOR_PROMPT, 
      `수집된 원본 데이터:\n${crawlerOutput}`, 
      "gemini-3.5-flash-lite", 
      undefined, undefined, false, 5, 
      ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]
    );
    if (jsonOutput.startsWith("오류 발생:")) throw new Error(jsonOutput);
    jsonRes = { role: "가공자", content: jsonOutput };
    
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: 'JSON 가공자',
      message: "데이터 가공 완료",
      type: 'success'
    });
    await delay(300);

    // 3. Planner
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: '기획 작성자',
      message: "마케팅 기획/재무/법률 모두 반영한 심층 기획안 작성 중...",
      type: 'working'
    });
    
    const plannerPrompt = `${topicInstructions}\n\n[최근 1개월 기획 내역 (질환 반복 허용, 같은 질문·설명 재사용 금지)]\n${recentHistoryText}\n\n[타겟 질환 카테고리]: ${randomCategory}\n\n[가공된 리서치 데이터]\n${jsonOutput}\n\n${reviewerFeedbackHistory}`;
    const plannerOutput = await callAgent(
      TOPIC_PLANNER_PROMPT, 
      plannerPrompt, 
      "gemini-3.6-flash", 
      undefined, undefined, false, 5, 
      ["gemini-3.6-flash", "gemini-3.6-flash"]
    );
    if (plannerOutput.startsWith("오류 발생:")) throw new Error(plannerOutput);
    plannerRes = { role: "기획 작성자", content: plannerOutput };
    
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: '기획 작성자',
      message: "심층 기획안 작성 완료",
      type: 'success'
    });
    await delay(500);

    // 4. Reviewer
    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: '검수자',
      message: "최종 검수 및 평가 진행 중...",
      type: 'working'
    });
    
    const reviewerPrompt = `${topicInstructions}\n\n[최근 1개월 기획 내역]\n${recentHistoryText}\n\n[기획 작성자의 기획안]\n${plannerOutput}\n\n[누적 피드백/지시사항]\n${reviewerFeedbackHistory}\n\n같은 질환이라는 이유로 감점하지 마세요. 기존 글과 핵심 질문·답변이 같으면 표현이 달라도 90점 미만으로 반려하세요. finalTreatment에는 치료 이름뿐 아니라 권장 치료를 고려할 조건과 확인할 생활 변화, 선택 근거를 포함하세요. 이 기획안을 평가하고 합격(90점 이상) 시 요약본과 메타데이터 JSON을 출력하세요.`;
    const reviewerOutput = await callAgent(
      TOPIC_REVIEWER_PROMPT, 
      reviewerPrompt, 
      "gemini-3.6-flash", 
      undefined, undefined, false, 5, 
      ["gemini-3.6-flash", "gemini-3.6-flash"]
    );

    if (reviewerOutput.startsWith("오류 발생:")) {
      throw new Error(reviewerOutput);
    }

    try {
      let jsonString = reviewerOutput;
      const jsonMatch = reviewerOutput.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      } else {
        const bracketMatch = reviewerOutput.match(/\{[\s\S]*\}/);
        if (bracketMatch) {
          jsonString = bracketMatch[0];
        }
      }
      parsedReviewer = JSON.parse(jsonString.trim());
      if (!parsedReviewer || typeof parsedReviewer.score !== 'number' || !Number.isFinite(parsedReviewer.score) ||
          !['content', 'finalTopic', 'finalTreatment', 'disease', 'situation'].every(key =>
            typeof parsedReviewer[key] === 'string' && parsedReviewer[key].trim())) {
        throw new Error('기획 메타데이터 누락');
      }
    } catch(e) {
      reviewerFeedbackHistory += '\n\n[형식 반려]: score와 content, finalTopic, finalTreatment, disease, situation을 빠짐없이 유효한 JSON으로 작성하세요.';
      if (globalAttempt > maxGlobalRetries) throw new Error('기획 결과를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      continue;
    }

    if (!isWithinTopicFocus(parsedReviewer, topicMode)) {
      reviewerFeedbackHistory += '\n\n[주제 반려]: 만성 소화불량 집중 모드입니다. 다른 질환으로 바꾸지 말고 이 질환 안에서 새로운 질문을 선정하세요.';
      if (globalAttempt > maxGlobalRetries) throw new Error('만성 소화불량 기획을 얻지 못했습니다. 질문을 바꾸어 다시 시도해 주세요.');
      continue;
    }
    if (topicMode === 'dyspepsia') parsedReviewer.disease = '만성 소화불량';

    const isDuplicate = isDuplicatePlan(parsedReviewer, recentHistoryData);

    if (isDuplicate) {
      onProgress({
        id: Date.now().toString() + Math.random(),
        timestamp: Date.now(),
        agentName: 'System',
        message: `[중복 기획 감지] 질환/부위/소재(${parsedReviewer.disease})와 상황(${parsedReviewer.situation})이 최근 1개월 내에 이미 기획·초안으로 저장되었습니다. 기획을 반려하고 다시 시작합니다.`,
        type: 'error'
      });
      reviewerFeedbackHistory += `\n\n[자동 중복 반려 사유]: 질환/부위/소재(${parsedReviewer.disease}) 및 상황(${parsedReviewer.situation}) 조합은 최근 1개월 내에 이미 기획·초안으로 저장했습니다. 현재 질환을 유지하고 다른 생활 제약이나 핵심 질문을 다루세요. 표현만 바꾸는 것은 금지합니다.`;
      if (globalAttempt > maxGlobalRetries) throw new Error('기존 글과 다른 기획을 찾지 못했습니다. 다른 질문으로 다시 시도해 주세요.');
      continue;
    }

    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: '검수자',
      message: `최종 검수 완료: ${parsedReviewer.score}점\n${parsedReviewer.feedback}`,
      type: parsedReviewer.score >= 90 ? 'success' : 'error'
    });

    if (parsedReviewer.score >= 90) {
      break;
    } else {
      if (globalAttempt > maxGlobalRetries) throw new Error('검수를 통과하지 못했습니다. 피드백을 보완해 다시 시도해 주세요.');
      reviewerFeedbackHistory += `\n\n[${globalAttempt}차 검수자 반려 사유]:\n${parsedReviewer.feedback}`;
    }
  }

  const reviewerRes: AgentResponse = {
    role: "검수자",
    content: parsedReviewer.content,
    score: parsedReviewer.score,
    feedback: parsedReviewer.feedback
  };

  onProgress({
    id: Date.now().toString() + Math.random(),
    timestamp: Date.now(),
    agentName: 'System',
    message: "모든 파이프라인 프로세스 완료!",
    type: 'success'
  });

  return {
    crawler: crawlerRes!,
    jsonProcessor: jsonRes!,
    planner: plannerRes!,
    reviewer: reviewerRes!,
    ceo: reviewerRes, // Fallback for old UI temporarily
    finalTopic: parsedReviewer.finalTopic || "주제 미정",
    finalTreatment: parsedReviewer.finalTreatment || "내용 없음",
    format: parsedReviewer.format || "",
    disease: parsedReviewer.disease || "질환 미정",
    target: parsedReviewer.target || "타겟 미정",
    situation: parsedReviewer.situation || "상황 미정",
    treatments: parsedReviewer.treatments || [],
    category: randomCategory,
    topicMode
  };
};
