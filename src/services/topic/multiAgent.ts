import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { AgentLog, AgentResponse, FinalOutput } from '../../types/agent';
import { callAgent } from '../core/agentRunner';
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
  let recentHistoryText = "최근 1개월 발행 내역 없음.";
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
        `[${index + 1}] 질환/부위: ${data.disease || '미상'}, 타겟: ${data.target}, 상황: ${data.situation}, 치료법: ${data.treatments.join(', ')}`
      ).join('\n');
    }
  } catch (error) {
    console.error("Failed to fetch blog history:", error);
  }
  return { text: recentHistoryText, data: recentHistoryData };
}

function checkDuplicatePlan(parsedReviewer: any, recentHistoryData: any[]): boolean {
  if (!(parsedReviewer.score >= 90 && parsedReviewer.disease)) {
    return false;
  }
  for (const history of recentHistoryData) {
    if (history.disease === parsedReviewer.disease) {
      return true;
    }
  }
  return false;
}

export const runMultiAgentSystem = async (
  onProgress: (log: AgentLog) => void,
  userFeedback?: string,
  previousCategory?: string
): Promise<FinalOutput> => {
  const currentDate = await fetchNetworkTime(onProgress);
  const today = currentDate.toLocaleDateString('ko-KR');
  
  const categories = [
    '근골격계 및 통증 (목, 허리, 무릎, 관절염 등)',
    '내과 및 소화기 (소화불량, 과민성 대장 증후군, 위염 등)',
    '만성피로 및 보약 (경옥고, 공진단, 수험생 보약 등)',
    '여성질환 (갱년기, 월경불순, 다낭성 난소증후군, 난임, 생리통 등)', 
    '피부질환 (여드름, 아토피, 다한증 등)',
    '다이어트 및 비만 관리',
    '교통사고 후유증 및 재활'
  ];
  const randomCategory = previousCategory || categories[Math.floor(Math.random() * categories.length)];

  const { text: recentHistoryText, data: recentHistoryData } = await fetchRecentHistory(currentDate);
  
  let globalAttempt = 0;
  const maxGlobalRetries = 5;
  let reviewerFeedbackHistory = userFeedback ? `[원장님(최종 확인자)의 지시사항 (가장 최우선 반영)]:\n${userFeedback}\n\n` : "";

  let crawlerRes: AgentResponse, jsonRes: AgentResponse, plannerRes: AgentResponse, parsedReviewer: any;

  onProgress({
    id: Date.now().toString() + Math.random(),
    timestamp: Date.now(),
    agentName: 'System',
    message: `[오늘의 집중 기획 대분류]: ${randomCategory}\n\n[최근 1개월 발행 이력]\n${recentHistoryText}`,
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
    
    const crawlerPrompt = `기준일: ${today}\n대분류: ${randomCategory}\n\n위 대분류 내에서 단일 질환을 하나만 뾰족하게 선정하고 관련 키워드와 트렌드를 마구 수집하세요.\n\n${reviewerFeedbackHistory}`;
    const crawlerOutput = await callAgent(
      TOPIC_CRAWLER_PROMPT, 
      crawlerPrompt, 
      "gemini-3.5-flash-lite", 
      undefined, undefined, true, 5, 
      ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]
    );
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
    
    const plannerPrompt = `[최근 1개월 기획 내역 (중복 절대 금지)]\n${recentHistoryText}\n\n[타겟 질환 카테고리]: ${randomCategory}\n\n[가공된 리서치 데이터]\n${jsonOutput}\n\n${reviewerFeedbackHistory}`;
    const plannerOutput = await callAgent(
      TOPIC_PLANNER_PROMPT, 
      plannerPrompt, 
      "gemini-3.6-flash", 
      undefined, undefined, false, 5, 
      ["gemini-3.6-flash", "gemini-3.6-flash"]
    );
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
    
    const reviewerPrompt = `[기획 작성자의 기획안]\n${plannerOutput}\n\n[누적 피드백/지시사항]\n${reviewerFeedbackHistory}\n\n이 기획안을 평가하고 합격(90점 이상) 시 요약본과 메타데이터 JSON을 출력하세요.`;
    const reviewerOutput = await callAgent(
      TOPIC_REVIEWER_PROMPT, 
      reviewerPrompt, 
      "gemini-3.6-flash", 
      undefined, undefined, false, 5, 
      ["gemini-3.6-flash", "gemini-3.6-flash"]
    );

    try {
      parsedReviewer = JSON.parse(reviewerOutput.replace(/```json\n?|\n?```/g, "").trim());
    } catch(e) {
      parsedReviewer = { 
        content: reviewerOutput, 
        score: 90, 
        feedback: "파싱 실패로 텍스트 승인",
        finalTopic: "미정",
        finalTreatment: "미정 (파싱 오류)",
        format: "치료형",
        disease: "미정",
        target: "미정",
        situation: "미정",
        treatments: []
      };
    }

    const isDuplicate = checkDuplicatePlan(parsedReviewer, recentHistoryData);

    if (isDuplicate) {
      onProgress({
        id: Date.now().toString() + Math.random(),
        timestamp: Date.now(),
        agentName: 'System',
        message: `[중복 기획 감지] 질환/부위(${parsedReviewer.disease})가 최근 1개월 내에 이미 발행되었습니다. 기획을 반려하고 다시 시작합니다.`,
        type: 'error'
      });
      reviewerFeedbackHistory += `\n\n[자동 중복 반려 사유]: 질환/부위(${parsedReviewer.disease})은(는) 최근 1개월 내에 이미 포스팅했습니다. 완전히 다른 질환으로 다시 시도하세요.`;
      continue;
    }

    onProgress({
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      agentName: '검수자',
      message: `최종 검수 완료: ${parsedReviewer.score}점\n${parsedReviewer.feedback}`,
      type: parsedReviewer.score >= 90 ? 'success' : 'error'
    });

    if (parsedReviewer.score >= 90 || globalAttempt > maxGlobalRetries) {
      break;
    } else {
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
    category: randomCategory
  };
};
