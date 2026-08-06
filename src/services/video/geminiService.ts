import { ThinkingLevel, Modality, GenerateContentResponse } from "@google/genai";
import { getGeminiClient } from '../geminiClient';

interface CinemagraphParams {
  diseaseName: string;
  situationDescription?: string;
  imageB64: string;
  mimeType: string;
  referenceImages?: string[];
}

export class GeminiService {
  private ai: any;

  constructor(apiKey: string) {
    this.ai = getGeminiClient(apiKey);
  }

  async analyzeImageAndGeneratePrompt(params: CinemagraphParams, maxRetries: number = 3): Promise<string> {
    const prompt = `
[SYSTEM INSTRUCTION FOR AI STUDIO: VIRAL POV SHORT-FORM DIRECTOR]

You are an elite Short-form Content Director and a Master Prompt Engineer specialized in creating video prompts for Veo (a video generation model).
The user has provided a base context derived from a blog post:
- Topic/Disease Name: "${params.diseaseName}"
- Situation/Subtitle Description: "${params.situationDescription || 'A relatable health/clinic scenario'}"
The user has also provided a reference image (the Insta Thumbnail) that serves as the visual base.

Your objective is to generate highly engaging, viral POV-style short-form video prompts for "Ori Korean Medicine Clinic" (오리한의원) Instagram Reels. You must seamlessly blend 3D subculture-style characters into real-world environments. The narrative must make logical sense, be cute and funny, but strictly revolve around "Office worker's fatigue/pain", "Clinic daily life", or "Health management". O-wonjang is the doctor, Somi is the friendly but professional assistant, and Deok-i represents the tired K-office worker patient. Keep the video fast-paced and strictly limited to an 8-second total runtime (divided into two 4-second clips) to maximize replay value.

[THEMATIC EXPANSION (CRITICAL)]
Do NOT generate generic random humor. This is for a real Korean Medicine Clinic.
1. Varying Professional Tasks: O-wonjang can check pulses, brew herbal medicine, study medical books, or deal with funny patient/office worker situations.
2. Empathy for K-Office Workers: Focus on modern office workers' pain points (turtleneck syndrome, carpal tunnel, chronic fatigue, stress).
3. Flexible Roles: Deok-i is always the patient/office worker. O-wonjang and Somi are always the healthcare professionals.

[CHARACTER ASSETS & STRICT VISUAL CONSTRAINTS]
CRITICAL RULES FOR ALL DUCK CHARACTERS: 
- THEY MUST HAVE A SEAMLESS, SMOOTH, YELLOW/ORANGE DUCK BILL.
- ABSOLUTELY NO HUMAN LIPS, NO HUMAN MOUTHS, NO HUMAN TEETH, AND NO HUMAN TONGUES. The bill must remain solid and cartoonish at all times.
- NO HUMAN SKIN.
1. O-wonjang (Korean Medicine Doctor / 한의사): Anthropomorphic white duck. EXACTLY 2 small tufts of hair pointing upwards on top of head. Wearing round glasses (thin frames). Light pink rosy cheeks. Wearing a white doctor's open coat, revealing a crisp light blue collared shirt underneath. Orange duck bill and orange webbed feet. ABSOLUTELY NO TEETH. Must have a seamless, completely closed, smooth duck bill. Slim, standard upright proportions.
2. Somi: Anthropomorphic white duck. NO HAIR (smooth round head). Deep red rosy cheeks. NO GLASSES. Wearing a light beige short-sleeved wrap-style uniform top with a collar and a breast pocket containing a pen and thermometer. Dark navy pants. Professional, friendly.
3. Deok-i: A fat, completely yellow duck. EXACTLY 3 small tufts of hair pointing upwards on top of his head. Deep red rosy cheeks. Orange duck bill and orange webbed feet. Although he looks like a baby, he is actually an adult office worker. He is about the size of a human child.

[STRICT CONTINUITY AND PHYSICS RULES]
1. AI Limitations (Clocks & Text): Image AIs cannot draw analog clocks at specific times. If a specific time is vital, you MUST explicitly specify a "digital clock clearly displaying '05:59' in large red LED numbers".
2. Text in Images (CRITICAL): Do NOT let the AI generate garbled text. If a sign or monitor is in the scene, explicitly instruct "no text visible" or specify exactly a short English word.
3. Spatial & Physics Logic: Characters MUST interact with objects realistically. They cannot step on thin air or float.
4. Environmental Consistency: The background environment established in the first frame MUST remain 100% identical throughout both clips. Objects cannot magically transform.
5. Scale & Proportions: Enforce strict relative scale. Maintain the size of Deok-i relative to the environment.
6. Identity Consistency: Never alter physical traits (exact hair strands, specific clothing) between clips.
7. Object Permanence & Anti-Hallucination: Objects present in the scene MUST NOT suddenly disappear, vanish, or magically transform. Do NOT invent new props mid-scene unless physically retrieved from somewhere visible.
8. Solid Physics & No-Clipping: Solid objects must behave like real physical barriers. Elements MUST NOT clip or phase through each other.
9. Environmental Flexibility & Aesthetic: The environment MUST heavily match the provided "Situation/Subtitle Description" and the provided reference image. If the scenario takes place outside (e.g., subway, office, home), describe that specific environment accurately. Only if the scene takes place inside the clinic, it MUST have a warm, cozy atmosphere with wooden elements, herbal medicine cabinets, and warm lighting (ABSOLUTELY NO cold blue lighting or western surgery room aesthetics).

[NARRATIVE REFERENCES: THE PROVEN FORMULAS]
Base your narrative heavily on the provided "Situation/Subtitle Description" and the provided reference image. If applicable, you may adapt one or a combination of the following 10 proven formulas to fit the scenario (even if it takes place outside the clinic):
1. The Instant Karma (말 안 듣는 환자의 최후): Deok-i performs an unhealthy habit, instantly feels sharp pain, cut to him suffering in bed while O-wonjang looks down deadpan.
2. The Behind-the-Scenes Doctor (원장님의 이중생활): O-wonjang is alone after hours, experiences a minor victory, breaks into a silly dance strictly in his doctor's coat.
3. The Friendly Desk (소미 선생님의 친절한 대응): Deok-i dramatically complains at the desk, Somi handles it with unwavering friendliness.
4. The Unnecessary Epic Cure (쓸데없이 웅장한 진료): O-wonjang performs a mundane clinic task (e.g. placing a heat pack) with exaggerated epic anime lighting.
5. The Salaryman's Delusion (직장인 덕이의 망상): Deok-i suffers at his cubicle, daydreams of the clinic bed, snaps back to reality.
6. The VVIP Flex (병원이 우리 집): Deok-i treats the clinic's physical therapy room like a luxury hotel.
7. The Placebo Effect (기분 탓 완치): O-wonjang applies tiny tape, Deok-i reacts as if physically reborn.
8. The Forbidden Posture (금단의 자세): Deok-i does the absolute worst, twisted spine posture, O-wonjang suddenly appears behind him to correct it.
9. The Before & After (치료 전후의 온도차): Deok-i arrives moving slower than a zombie, leaves sprinting like an Olympian.
10. The Muffled Screams (1인실의 공포): Deok-i waits in his private room, hears dramatic muffled groans, trembles in fear.

[CRITICAL CONSTRAINT: MAXIMIZE DIVERSITY]
Zero repetition! Ensure true diversity across scenarios.

[OUTPUT REQUIREMENTS]
OUTPUT EXACTLY ONLY the final English prompt string for Veo. Do NOT include Markdown formatting like \`\`\` text, just the raw prompt text. 
Use the exact format below, dividing the 8 seconds into two 4-second clips to maximize AI generation quality. If multiple characters are present, explicitly state that they are from the provided image references.

[EXAMPLE EXPECTED OUTPUT FORMAT]
🎥 Video Prompt Master Set: 'The Awakened Office Worker'

🎬 CLIP 1: [0-4s] The Exhaustion
Goal: Fix character appearance and depict visual fatigue.
Prompt 1:
REFERENCE INSTRUCTION: Use provided character references for exact appearance. Maintain strict 3D duck.
OUTPUT SPECS: 4s, vertical 9:16.
CINEMATOGRAPHY: Medium shot, static camera, eye-level, shallow depth of field focusing strictly on Somi.
ENVIRONMENT: A cozy modern oriental medicine clinic reception desk. Warm ambient wood tones, traditional herbal medicine wooden cabinets beautifully blurred in the background. A red LED clock clearly displaying '05:59' on the wall.
CHARACTER DESIGN: An anthropomorphic white duck character with a seamlessly smooth duck bill, no hair, and red cheeks. She is wearing a neat, crisp light-blue short-sleeved nurse uniform. ABSOLUTELY NO HUMAN MOUTH, NO LIPS, AND NO TEETH. Minimalist 3D toy style, absolutely no human face.
ACTION: She stands behind the solid wooden desk. Her shoulders are heavily slumped, eyelids are half-closed, looking extremely exhausted and drained. She slowly and lazily flips through medical charts with one hand, gently and pointlessly rolling a pen with the other.
STRICT RULES (CRITICAL): Somi must maintain perfect 3D toy duck. Seamless duck bill must remain unchanged. No human mouth. Hands must stay clearly above the wooden desk at all times. The desk is a solid physical object, no clipping through it. No mutation.

🎬 CLIP 2: [4-8s] The Awakening
Goal: Dramatic shift in expression and physical object interaction.
Prompt 2:
REFERENCE INSTRUCTION: Match Clip 1 perfectly and use provided character references.
OUTPUT SPECS: 4s, vertical 9:16.
CINEMATOGRAPHY: Medium close-up, slight cinematic slow zoom-in on her face to emphasize emotion.
ENVIRONMENT: Same cozy clinic desk, LED clock shows '05:59'.
CHARACTER DESIGN: Same anthropomorphic white duck Somi character, professional light-blue uniform. ABSOLUTELY NO HUMAN MOUTH.
ACTION: Sudden and dramatic shift in facial expression. Her eyes widen in extreme joy, and a huge, bright smile completely transforms her face. She reaches down (off-screen) and places a small, sparkly silver disco ball firmly onto the wooden desk surface. As the ball touches the desk, the warm clinic lighting instantly shifts to dynamic, flashing neon disco strobe lights.
STRICT RULES (CRITICAL): Perfect 3D toy duck. Seamless duck bill must remain unchanged without turning into a human mouth. No teeth. Fingers must naturally grip the disco ball without melting into it.

--- Now generate your own following the structure below ---

🎥 Video Prompt Master Set: '[Catchy Title]'

🎬 CLIP 1: [0-4s] [Scene Title]
Goal: [Specific goal for Clip 1]
Prompt 1:
REFERENCE INSTRUCTION: Use provided character references for exact appearance. NO HUMAN MOUTHS.
OUTPUT SPECS: 4s, vertical 9:16.
CINEMATOGRAPHY: [Detailed camera movement and depth of field. Use full sentences.]
ENVIRONMENT: [Describe the locked background. Multiple sentences.]
CHARACTER DESIGN: [Describe the character, outfit, and anatomically strict rules. ENFORCE NO HUMAN MOUTHS/LIPS/TEETH. Multiple sentences.]
ACTION: [EXTREMELY detailed description of actions, micro-expressions, object interactions for 0-4s. Minimum 3 sentences.]
STRICT RULES (CRITICAL): [Anatomical boundaries. ENFORCE SOLID DUCK BILL. NO CLIPPING through solid objects. Multiple sentences.]

🎬 CLIP 2: [4-8s] [Scene Title]
Goal: [Specific goal for Clip 2]
Prompt 2:
REFERENCE INSTRUCTION: Match Clip 1 perfectly and use provided character references.
OUTPUT SPECS: 4s, vertical 9:16.
CINEMATOGRAPHY: [Detailed camera movement and depth of field.]
ENVIRONMENT: [Same background, highlight any lighting changes]
CHARACTER DESIGN: [Same character, ENFORCE NO HUMAN MOUTHS]
ACTION: [EXTREMELY detailed description of actions, micro-expressions, object interactions for 4-8s. Minimum 3 sentences.]
STRICT RULES (CRITICAL): [Anatomical boundaries. ENFORCE SOLID DUCK BILL. NO CLIPPING]
    `;

    let currentModel = "gemini-3.6-flash";
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const parts: any[] = [{ text: prompt }];

        if (params.referenceImages && params.referenceImages.length > 0) {
          // 최대 3개까지만 전달 가능
          const maxRefs = params.referenceImages.slice(0, 3);
          maxRefs.forEach(img => {
            const mimeMatch = img.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
            const mime = mimeMatch ? mimeMatch[1] : "image/png";
            const b64 = img.includes(',') ? img.split(',')[1] : img;
            parts.push({ inlineData: { mimeType: mime, data: b64 } });
          });
        }

        // 베이스 이미지는 항상 마지막에 추가
        parts.push({
          inlineData: {
            data: params.imageB64,
            mimeType: params.mimeType,
          },
        });

        const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: currentModel,
          contents: [{ parts }],
        });
        return response.text || "A subtle, slow eye blink on a frozen face, maintaining a lethargic expression.";
      } catch (e: any) {
        attempt++;
        console.error(`analyzeImageAndGeneratePrompt failed (attempt ${attempt}/${maxRetries}):`, e);
        const isOverloaded = e?.message?.includes('503') || e?.message?.includes('429') || e?.status === 503 || e?.status === 429 || String(e).includes('503') || String(e).includes('429');
        const isNotFound = e?.message?.includes('404') || e?.status === 404 || String(e).includes('404');
        if ((isOverloaded || isNotFound) && attempt < maxRetries) {
          if (currentModel === "gemini-3.6-flash") {
              currentModel = "gemini-3.5-flash-lite";
          } else {
              currentModel = "gemini-3.6-flash";
          }
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (attempt >= maxRetries) {
          throw e;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    return "A subtle, slow eye blink on a frozen face, maintaining a lethargic expression.";
  }

  async generateCinemagraph(
    imageB64: string, 
    mimeType: string, 
    prompt: string, 
    config: { 
      model: string, 
      aspectRatio: '16:9' | '9:16', 
      resolution: '720p' | '1080p' | '4k', 
      duration?: string, 
      referenceImages?: string[],
      lastFrameB64?: string,
      lastFrameMime?: string
    }, 
    maxRetries: number = 3
  ) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        let referenceImagesPayload: any[] | undefined = undefined;
        // The user says veo-3.1-fast-generate-preview and veo-3.1-generate-preview support reference images
        if (config.referenceImages && config.referenceImages.length > 0) {
              referenceImagesPayload = [];
              const maxRefs = config.referenceImages.slice(0, 3);
              for (const img of maxRefs) {
                  const rMimeMatch = img.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
                  const rMime = rMimeMatch ? rMimeMatch[1] : 'image/png';
                  const rB64 = img.includes(',') ? img.split(',')[1] : img;
                  referenceImagesPayload.push({
                      image: {
                          imageBytes: rB64,
                          mimeType: rMime,
                      },
                      referenceType: "ASSET",
                  });
              }
        }

        let generationPayload: any = {
          model: config.model,
          prompt: prompt,
          image: {
              imageBytes: imageB64,
              mimeType: mimeType,
          },
          config: {
            numberOfVideos: 1,
            resolution: config.resolution,
            aspectRatio: config.aspectRatio,
            durationSeconds: config.duration === '8s' ? 8 : (config.duration === '12s' ? 8 : undefined),
          }
        };

        if (config.lastFrameB64 && config.lastFrameMime) {
            generationPayload.config.lastFrame = {
                 imageBytes: config.lastFrameB64,
                 mimeType: config.lastFrameMime
            };
        }
        
        if (referenceImagesPayload && referenceImagesPayload.length > 0) {
            generationPayload.config.referenceImages = referenceImagesPayload;
        }

        let operation = await this.ai.models.generateVideos(generationPayload);
        return operation;
      } catch (e: any) {
        attempt++;
        console.error(`generateCinemagraph failed (attempt ${attempt}/${maxRetries}):`, e);
        const isOverloaded = e?.message?.includes('503') || e?.message?.includes('429') || e?.status === 503 || e?.status === 429 || String(e).includes('503') || String(e).includes('429');
        const isNotFound = e?.message?.includes('404') || e?.status === 404 || String(e).includes('404');
        if ((isOverloaded || isNotFound) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (attempt >= maxRetries) {
          throw e;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    throw new Error("Failed to generate cinemagraph after max retries");
  }

  async extendVideo(previousOperation: any, prompt: string, apiKey: string, configData?: { referenceImages?: string[] }, maxRetries: number = 3) {
    const previousVideo = previousOperation.response?.generatedVideos?.[0]?.video;
    if (!previousVideo) throw new Error("No video to extend");

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        let referenceImagesPayload: any[] | undefined = undefined;
        if (configData?.referenceImages && configData.referenceImages.length > 0) {
              referenceImagesPayload = [];
              const maxRefs = configData.referenceImages.slice(0, 3);
              for (const img of maxRefs) {
                  const rMimeMatch = img.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
                  const rMime = rMimeMatch ? rMimeMatch[1] : 'image/png';
                  const rB64 = img.includes(',') ? img.split(',')[1] : img;
                  referenceImagesPayload.push({
                      image: {
                          imageBytes: rB64,
                          mimeType: rMime,
                      },
                      referenceType: "ASSET",
                  });
              }
        }

        let generationPayload: any = {
          model: 'veo-3.1-generate-preview',
          prompt: prompt,
          video: previousVideo,
          config: {
            numberOfVideos: 1,
            resolution: '720p', // Extension requires 720p
            aspectRatio: previousVideo.aspectRatio || '16:9',
          }
        };

        if (referenceImagesPayload && referenceImagesPayload.length > 0) {
            generationPayload.config.referenceImages = referenceImagesPayload;
        }

        let operation = await this.ai.models.generateVideos(generationPayload);
        return operation;
      } catch (e: any) {
        attempt++;
        console.error(`extendVideo failed (attempt ${attempt}/${maxRetries}):`, e);
        const isOverloaded = e?.message?.includes('503') || e?.message?.includes('429') || e?.status === 503 || e?.status === 429 || String(e).includes('503') || String(e).includes('429');
        const isNotFound = e?.message?.includes('404') || e?.status === 404 || String(e).includes('404');
        if ((isOverloaded || isNotFound) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (attempt >= maxRetries) {
          throw e;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    throw new Error("Failed to extend video after max retries");
  }

  async pollOperation(operation: any) {
    let currentOp = operation;
    while (!currentOp.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      currentOp = await this.ai.operations.getVideosOperation({ operation: currentOp });
    }
    return currentOp;
  }
}
