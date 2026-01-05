import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import OpenAI from "openai";
import path from "path";

import {
  ESTOP_API,
  query_stationIds_by_name,
  query_routes_by_stationIds,
} from "./apis.js";

import { ANSWER_PROMPT } from "./rules.js";
import { tools } from "./tools.js";

dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const busRoutes = JSON.parse(
  fs.readFileSync(path.resolve("./busRoutes.json"), "utf-8")
);

/* ========================
   Tool Definition
======================== */

/* ========================
   Data Extractor（沿用）
======================== */

const extractDynamicStationsData = (stationNode) => {
  return stationNode.edges
    .map((e) => ({
      name: e.node.name,
      routes: e.node.routes.edges.map((r) => ({
        name: r.node.name,
        description: r.node.description,
        departure: r.node.departure,
        destination: r.node.destination,
        estimateTimes: r.node.estimateTimes.edges.map((et) => ({
          direction: et.node.goBack === 1 ? "去程" : "回程",
          destination:
            et.node.goBack === 1 ? r.node.destination : r.node.departure,
          eta:
            et.node.etas.length > 0
              ? et.node.etas.map((x) => x.etaTime)
              : [et.node.comeTime],
          bus_id:
            et.node.etas.length > 0
              ? et.node.etas.map((x) => x.busId)
              : et.node.comeBusId
              ? [et.node.comeBusId]
              : [],
          isSuspended: et.node.isSuspended,
          isOperationDay: et.node.isOperationDay,
          clogType: et.node.clogType,
        })),
      })),
    }))
    .filter((e) => e.routes.length > 0);
};

/* ========================
   Answer Generator（沿用）
======================== */

const generateAnswer = async (data, message) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: JSON.stringify(data) },
      { role: "user", content: `使用者問題：${message}` },
    ],
  });

  return { content: completion.choices[0].message.content };
};

/* ========================
   Tool Handler
======================== */

const handleStationInfoTool = async ({ station_name, fields }, message) => {
  const stationIdResult = await fetch(
    ESTOP_API,
    query_stationIds_by_name(station_name)
  ).then((r) => r.json());

  const stationIds = stationIdResult.data.stationsByName.edges.map(
    (e) => e.node.id
  );

  if (stationIds.length === 0) {
    return { content: "抱歉，查無相關站點。" };
  }

  const apiResult = await fetch(
    ESTOP_API,
    query_routes_by_stationIds(stationIds)
  ).then((r) => r.json());

  const data = extractDynamicStationsData(apiResult.data.stations);

  if (!data || data.length === 0) {
    return { content: "目前無法提供該站點資訊。" };
  }

  return generateAnswer(
    {
      fields,
      data,
    },
    message
  );
};

/* ========================
   /chat（tool-first）
======================== */

app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1].content;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "你是台中公車通 AI，只能透過工具查詢資料，不可自行回答。",
        },
        ...messages,
      ],
      tools,
      tool_choice: "auto",
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];

    console.log(toolCall);

    if (!toolCall) {
      return res.json({
        reply: { content: "請提供要查詢的公車站點。" },
      });
    }

    if (toolCall.function.name === "station_info") {
      const args = JSON.parse(toolCall.function.arguments);
      const reply = await handleStationInfoTool(args, lastMessage);
      return res.json({ reply });
    }

    res.json({ reply: { content: "目前無法處理該查詢。" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI 回應失敗" });
  }
});

/* ========================
   Server
======================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
