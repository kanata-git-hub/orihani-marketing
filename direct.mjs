import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { config } from "dotenv";
config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const data1 = fs.readFileSync("src/data/data1.md", "utf8");
const data2 = fs.readFileSync("src/data/data2.md", "utf8");
const data3 = fs.readFileSync("src/data/data3.md", "utf8");

const promptText = `
당신은 대구 동구 동대구로 445(신천동) '오리한의원(https://blog.naver.com/orihani)'의 블로그 포스팅을 작성하는 수석 마케팅 전략가이자 전문 의료 작가입니다. 

[사용자 입력]
1. 인터뷰 주제(소재): 기능성 소화불량
2. 다루고 싶은 핵심 내용: 한약 치료
3. 질환이 발생하는 상황: 내시경은 깨끗한데 명치가 꽉 막힌 느낌

[출력 형식]
[Part 4: YouTube TTS Script]
(제공된 배경지식을 바탕으로 질환의 치료, 처방, 약재 등에 관한 전문적인 내용을 포함하여 유튜브 숏폼 대본을 작성하세요.
- 분량: 공백 포함 600자 이내
- 톤앤매너: 환자가 상처받지 않도록 따뜻하고 공감가는 어조.
- 필수 구조 및 내용 (매우 중요):
  1. 비유적 설명: 인체를 "보일러", "밸브" 등 이해하기 쉬운 비유를 사용하여 질환의 원인(예: 자율신경계 과부하, 피부 방어막 붕괴, 속열 등)을 설명하세요.
  2. 기전과 한의학적 연결: 스트레스, 교감신경 항진, 위기(衛氣) 약화 등 생리 병리 기전을 설명하세요.
  3. 약재의 타겟 작용 명시 (핵심): 첨부된 배경지식(data1, data2, data3)을 깊이 있게 분석 및 추론하여, 질환에 맞는 처방과 그 안에 포함된 개별 약재(예: 보중익기탕의 황기, 백출, 시호 등)가 각각 어떤 기전으로 작용하는지 명확하게 매칭해서 설명하세요. (예: "시호는 열을 내리고 교감신경 흥분을 완화하며, 황기는 약해진 피부 방어막을 튼튼하게 코팅합니다" 등). 지식베이스의 내용을 수동적으로 쓰지 말고, 원장님의 예시처럼 적극적으로 약재의 역할과 효능을 연결하여 스토리텔링하세요.)

[배경지식: 처방 및 약재 지식, 한약 소개]
(참고: data1, data2는 처방의 구성과 약재와 처방의 지식, data3는 전반적 지식과 특정 병에 사용하는 한약에 대한 소개입니다.)
=== data1 ===
${data1.slice(0, 5000)}... (truncated for this script)
=== data2 ===
${data2.slice(0, 5000)}... (truncated)
=== data3 ===
${data3}
`;

async function run() {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: promptText
  });
  console.log(response.text);
}
run();
