import { handleChat_gemini, generateAnswer_gemini } from "./gemini/index.js";
import { handleChat_gpt, generateAnswer_gpt } from "./gpt/index.js";

export const aiRouter = {
  openai: {
    handleChat: handleChat_gpt,
    generateAnswer: generateAnswer_gpt,
  },
  gemini: {
    handleChat: handleChat_gemini,
    generateAnswer: generateAnswer_gemini,
  },
};
