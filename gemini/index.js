// import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

import { ANSWER_PROMPT, TOOL_CALL_PROMPT } from "./rules.js";
import { geminiTools } from "./tools.js";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let client = null;

export const getGemini = () => {
  if (client) return client;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return client;
};

/* ========================
   Answer Generator（沿用）
======================== */
export const generateAnswer_gemini = async (data, message) => {
  const gemini = getGemini();

  const result = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [`資料：${JSON.stringify(data)}`, `使用者問題：${message}`],
  });

  return {
    content: result.text,
  };
};

/* ========================
   /chat（tool-first）
======================== */
export const handleChat_gemini = async (messages, lastMessage) => {
  const gemini = getGemini();

  // 轉成 Gemini content 格式
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // 東海大學停靠路線
  // const result = await model.generateContent({
  //   contents,
  // });

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
    config: geminiTools,
  });

  // Check for function calls in the response
  if (response.functionCalls && response.functionCalls.length > 0) {
    const functionCall = response.functionCalls[0]; // Assuming one function call
    // In a real app, you would call your actual function here:
    // const result = await scheduleMeeting(functionCall.args);
    const { name, args } = functionCall;
    return { name, args };
  } else {
    return {
      content: response.text,
    };
    // return { content: response.text };
    // return { content: "目前無法處理該查詢。" };
  }
};
