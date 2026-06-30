import dotenv from "dotenv";
import express from "express";
import { getBusRoutes, updateBusRoutes } from "./busRoutesStore.js";
import { handleToolCall } from "./handler.js";
import cron from "node-cron";
import { aiRouter } from "./aiRouter.js";

// 捷運松竹站公車路線
dotenv.config();
const app = express();
app.use(express.json());

// 先啟動時更新一次
(async () => {
  console.log("初始化更新 busRoutes.json...");
  await updateBusRoutes({ reload: true });
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

app.post("/chat", async (req, res) => {
  const { messages, provider = "openai" } = req.body;
  const lastMessage = messages[messages.length - 1].content;

  try {
    const ai = aiRouter[provider];
    if (!ai) {
      return res.status(400).json({ error: "Unsupported AI provider" });
    }
    // ① AI 判斷是否要叫 tool
    const result = await ai.handleChat(messages, lastMessage);
    console.log("result", result);
    // ② 沒 tool，直接回
    if (result.content) {
      return res.json({ reply: result });
    }
    // ③ 有 tool
    const { name, args } = result;
    const toolResult = await handleToolCall(name, args, lastMessage);
    console.log("toolResult", toolResult);
    if (toolResult?.content) {
      res.json({ reply: toolResult });
    } else {
      // ④ 丟資料回 AI 生成自然語言
      const finalAnswer = await ai.generateAnswer(toolResult, lastMessage);
      res.json({ reply: finalAnswer });
    }
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

app.get("/health", async (_, res) => {
  try {
    const routes = await getBusRoutes();

    res.status(200).json({
      status: "ok",
      busRoutesCount: routes?.data?.routes?.edges?.length ?? 0,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "busRoutes unavailable",
    });
  }
});

/* ========================
   Server
======================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
