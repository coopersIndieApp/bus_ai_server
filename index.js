import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { getBusRoutes, updateBusRoutes } from "./busRoutesStore.js";
import { ANSWER_PROMPT, TOOL_CALL_PROMPT } from "./rules.js";
import { tools } from "./tools.js";
import {
  handleBusRoutesInfoTool,
  handleStaticRouteInfoTool,
  handleDynamicRouteInfoTool,
  handleStationInfoTool,
  handleTravelPlanTool,
  handleRouteMapTool,
  handleRouteScheduleInfoTool,
  handleMrTBusTool,
  handleTicketPriceTool,
} from "./handler.js";
import cron from "node-cron";
// 捷運松竹站公車路線
dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const handleToolCall = async (name, args, lastMessage) => {
  switch (name) {
    case "busRoutes_info":
      return await handleBusRoutesInfoTool(args, lastMessage);
    case "static_route_info":
      return await handleStaticRouteInfoTool(args, lastMessage);
    case "dynamic_route_info":
      return await handleDynamicRouteInfoTool(args, lastMessage);
    case "station_info":
      return await handleStationInfoTool(args, lastMessage);
    case "route_schedule_info":
      return await handleRouteScheduleInfoTool(args, lastMessage);
    case "route_map":
      return await handleRouteMapTool(args, lastMessage);
    case "travel_plan":
      return await handleTravelPlanTool(args, lastMessage);
    case "mrt_bus":
      return await handleMrTBusTool(args, lastMessage);
    case "ticket_price":
      return await handleTicketPriceTool(args, lastMessage);
  }
};

/* ========================
   Answer Generator（沿用）
======================== */

export const generateAnswer = async (data, message) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: JSON.stringify(data) },
      { role: "user", content: `使用者問題：${message} ` },
    ],
  });

  return { content: completion.choices[0].message.content };
};

// 先啟動時更新一次
(async () => {
  console.log("初始化更新 busRoutes.json...");
  await getBusRoutes({ reload: true });
})();

// 每天凌晨 3 點自動更新
cron.schedule("0 3 * * *", async () => {
  console.log("每天凌晨 3 點更新 busRoutes.json...");
  try {
    await updateBusRoutes();
    console.log("更新完成 ✅");
  } catch (err) {
    console.error("更新 busRoutes.json 失敗 ❌", err);
  }
});

/* ========================
   /chat（tool-first）
======================== */

app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1].content;
  // const dateTime = new Date().toISOString().split("T")[0];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: TOOL_CALL_PROMPT }, ...messages],
      tools,
      tool_choice: "auto",
    });
    // 東海大學到靜宜大學 怎麼搭
    const toolCall = completion.choices[0].message.tool_calls?.[0];

    if (!toolCall) {
      return res.json({
        reply: completion.choices[0].message,
      });
    }
    const { type, function: func } = toolCall;

    if (type === "function") {
      const { name, arguments: argString } = func;
      const args = JSON.parse(argString);
      const reply = await handleToolCall(name, args, lastMessage);
      return res.json({ reply });
    }

    res.json({ reply: { content: "目前無法處理該查詢。" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI 回應失敗" });
  }
});

/* ========================
   Admin Routes
======================== */
/*
  更新公車路線資料
  使用方式：
  curl -X POST http://localhost:3000/admin/update-bus-routes
  -H "Content-Type: application/json"
  -d '{"forceUpdate": true}'
  // 台中公車有幾條路線
*/
app.post("/admin/update-bus-routes", async (_, res) => {
  try {
    // 抓最新 API 並刷新快取
    await updateBusRoutes();

    res.json({ success: true, message: "busRoutes 已更新並刷新快取" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "更新失敗" });
  }
});

/* ========================
   Server
======================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
