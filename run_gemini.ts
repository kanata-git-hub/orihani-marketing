import { generateBlogPost } from "./src/services/blog/geminiService.js";
import { config } from "dotenv";
config();

async function run() {
  try {
    const result = await generateBlogPost(
      "treatment",
      "갱년기 상열감",
      "한약 치료",
      "시도 때도 없이 훅 달아오르고 땀이 나는 상황"
    );
    console.log("=== YouTube TTS Script ===");
    console.log(result.youtubeTtsScript);
  } catch (error) {
    console.error(error);
  }
}
run();
