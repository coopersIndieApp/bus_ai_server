import OpenAI from "openai";
import { ANSWER_PROMPT, TOOL_CALL_PROMPT } from "./rules.js";
import { tools } from "./tools.js";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

let client = null;

export const getOpenAI = () => {
  if (client) return client;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
};

/* ========================
   Answer Generator（沿用）
======================== */
export const generateAnswer_gpt = async (data, message) => {
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: "資料：" + JSON.stringify(data) },
      { role: "user", content: `使用者問題：${message} ` },
    ],
  });

  return { content: completion.choices[0].message.content };
};

/* ========================
   /chat（tool-first）
======================== */
export const handleChat_gpt = async (messages, lastMessage) => {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "system", content: TOOL_CALL_PROMPT }, ...messages],
    tools,
    tool_choice: "auto",
  });
  // 東海大學到靜宜大學 怎麼搭
  const toolCall = completion.choices[0].message.tool_calls?.[0];

  if (!toolCall) {
    return { content: completion.choices[0].message.content };
  }
  const { type, function: func } = toolCall;

  if (type === "function") {
    const { name, arguments: argString } = func;
    const args = JSON.parse(argString);
    // const reply = await handleToolCall_gpt(name, args, lastMessage);
    // return reply;
    return { name, args };
  }

  return { content: "目前無法處理該查詢。" };
};
