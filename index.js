import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import OpenAI from "openai";
import path from "path";
import {
  ESTOP_API,
  query_dynamic_route_info,
  query_mrt_stop_routes,
  query_routes_by_stationIds,
  query_static_route_info,
  query_stationIds_by_name,
} from "./apis.js";
import { ANSWER_PROMPT, INTENT_PROMPT } from "./rules.js";

dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========================
   基礎資料
======================== */

const busRoutes = JSON.parse(
  fs.readFileSync(path.resolve("./busRoutes.json"), "utf-8")
);

function normalize(text) {
  return text.replace(/臺/g, "台").toLowerCase();
}

function tokenize(text) {
  const t = normalize(text);

  // 常見關鍵詞優先
  const keywords = ["高鐵", "捷運", "火車"];

  const tokens = keywords.filter((k) => t.includes(k));

  // fallback：每 2 字一組
  if (tokens.length === 0) {
    for (let i = 0; i < t.length - 1; i++) {
      tokens.push(t.slice(i, i + 2));
    }
  }

  return [...new Set(tokens)];
}

function fuzzyMatch(name, query) {
  const n = normalize(name);
  const tokens = tokenize(query);

  return tokens.every((token) => n.includes(token));
}

const getRouteNodeByName = (route_name) =>
  busRoutes.data.routes.edges.find((r) => r.node.name === route_name)?.node;

const getRouteIdByName = (route_name) => getRouteNodeByName(route_name)?.id;

/* ========================
   Data Extractors
======================== */

// busRoutes.json（總路線 / 起訖 / 是否循環）
const extractBusRoutesData = (routeNode, fields) => {
  const result = {};

  if (fields.includes("count_routes")) {
    result.count = busRoutes.data.routes.edges.length;
  }
  if (fields.includes("departure_destination")) {
    result.departure = routeNode.departure;
    result.destination = routeNode.destination;
  }
  if (fields.includes("isCycled")) {
    result.isCycled = routeNode.isCycled;
  }

  return result;
};

// 靜態 API
const extractStaticData = (routeNode, fields) => {
  const result = {};

  if (fields.includes("stations")) {
    result.stations = {
      go: routeNode.stations.edges
        .filter((e) => e.goBack === 1)
        .map((e) => e.node.name),
      back: routeNode.stations.edges
        .filter((e) => e.goBack === 2)
        .map((e) => e.node.name),
    };
  }

  if (fields.includes("providers")) {
    result.providers = routeNode.providers.edges.map((e) => e.node.name);
  }

  return result;
};

// 5 台中公園 到站時間

// 動態 API（ETA / 車號）
const extractDynamicData = (routeNode, station_name) => {
  // const stationIds = routeNode.stations.edges
  //   .filter((e) => e.node.name.includes(station_name))
  //   .map((e) => e.node.id);

  const stationIds = routeNode.stations.edges
    .filter((e) => fuzzyMatch(e.node.name, station_name))
    .map((e) => e.node.id);

  // console.log("stationIds", stationIds);

  if (stationIds.length === 0) return;

  return routeNode.estimateTimes.edges
    .filter((e) => stationIds.includes(e.node.id))
    .map((e) => ({
      station_name: routeNode.stations.edges.find(
        (s) => s.node.id === e.node.id
      ).node.name,
      direction: e.node.goBack === 1 ? "去程" : "回程",
      destination:
        e.node.goBack === 1 ? routeNode.destination : routeNode.departure,
      eta:
        e.node.etas.length > 0
          ? e.node.etas.map((x) => x.etaTime)
          : [e.node.comeTime],
      bus_id:
        e.node.etas.length > 0
          ? e.node.etas.map((x) => x.busId)
          : e.node.comeBusId
          ? [e.node.comeBusId]
          : [],
      isSuspended: e.node.isSuspended,
      isOperationDay: e.node.isOperationDay,
      clogType: e.node.clogType,
    }));
};

const extractDynamicStationsData = (stationNode) => {
  const result = stationNode.edges
    .map((e) => ({
      name: e.node.name,
      routes: e.node.routes.edges.map((r) => {
        return {
          name: r.node.name,
          description: r.node.description,
          departure: r.node.departure,
          destination: r.node.destination,
          estimateTimes: r.node.estimateTimes.edges.map((e) => ({
            direction: e.node.goBack === 1 ? "去程" : "回程",
            destination:
              e.node.goBack === 1 ? r.node.destination : r.node.departure,
            eta:
              e.node.etas.length > 0
                ? e.node.etas.map((x) => x.etaTime)
                : [e.node.comeTime],
            bus_id:
              e.node.etas.length > 0
                ? e.node.etas.map((x) => x.busId)
                : e.node.comeBusId
                ? [e.node.comeBusId]
                : [],
            isSuspended: e.node.isSuspended,
            isOperationDay: e.node.isOperationDay,
            clogType: e.node.clogType,
          })),
        };
      }),
    }))
    .filter((e) => e.routes.length > 0);

  return result;
};

/* ========================
   AI Answer
======================== */

// 舊社站路線

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
   Action Handlers
======================== */

const actionHandlers = {
  busRoutes_info: async (intentJSON, message) => {
    const routeNode = getRouteNodeByName(intentJSON.route_name);
    if (!routeNode) return { content: "抱歉，查無此路線。" };

    const data = extractBusRoutesData(routeNode, intentJSON.fields);
    return generateAnswer(data, message);
  },

  static_route_info: async (intentJSON, message) => {
    const route_id = getRouteIdByName(intentJSON.route_name);
    if (!route_id) return { content: "抱歉，查無此路線。" };

    const apiResult = await fetch(
      ESTOP_API,
      query_static_route_info(route_id)
    ).then((r) => r.json());

    const data = extractStaticData(apiResult.data.route, intentJSON.fields);

    return generateAnswer(data, message);
  },
  //   300 東海大學 去程 何時到站
  dynamic_route_info: async (intentJSON, message) => {
    const route_id = getRouteIdByName(intentJSON.route_name);
    if (!route_id) return { content: "抱歉，查無此路線。" };

    const apiResult = await fetch(
      ESTOP_API,
      query_dynamic_route_info(route_id)
    ).then((r) => r.json());
    // 300 正英路 往靜宜大學 何時來
    const data = extractDynamicData(
      apiResult.data.route,
      intentJSON.station_name
    );

    console.log("data", data);
    if (!data) return { content: "抱歉，查無相關資料，請確認輸入是否正確。" };

    return generateAnswer(
      {
        fields: intentJSON.fields,
        data,
      },
      message
    );
  },

  station_info: async (intentJSON, message) => {
    const station_id_result = await fetch(
      ESTOP_API,
      query_stationIds_by_name(intentJSON.station_name)
    ).then((r) => r.json());

    const station_ids = station_id_result.data.stationsByName.edges.map(
      (e) => e.node.id
    );

    const apiResult = await fetch(
      ESTOP_API,
      query_routes_by_stationIds(station_ids)
    ).then((r) => r.json());

    const data = extractDynamicStationsData(
      apiResult.data.stations,
      intentJSON.station_name
    );

    if (!data) return { content: "抱歉，查無相關資料，請確認輸入是否正確" };

    return generateAnswer(
      {
        fields: intentJSON.fields,
        data,
      },
      message
    );
  },

  route_schedule_info: async (intentJSON, message) => {
    const route_id = getRouteIdByName(intentJSON.route_name);
    if (!route_id) return { content: "抱歉，查無此路線。" };

    const activeTabIndex = intentJSON.direction ? intentJSON.direction : 0; // 0: go, 1: back
    const direction = intentJSON.direction
      ? intentJSON.direction === 1
        ? "回程"
        : "去程"
      : ""; // 0: go, 1: back
    const date = intentJSON.date ? intentJSON.date : "";
    return {
      content: `點擊查看「${intentJSON.route_name}」${
        direction ? direction : ""
      }時刻表 ${date ? `(${date})` : ""} →`,
      navigate: `/general/busRoute/busTimetableTabs?id=${route_id}&routeName=${intentJSON.route_name}&activeTabIndex=${activeTabIndex}&scheduleDate=${intentJSON.date}`,
    };
  },

  route_map: async (intentJSON, message) => {
    const route_id = getRouteIdByName(intentJSON.route_name);
    if (!route_id) return { content: "抱歉，查無此路線。" };

    const activeTabIndex = intentJSON.direction ? intentJSON.direction : 0; // 0: go, 1: back
    const direction = intentJSON.direction
      ? intentJSON.direction === 1
        ? "回程"
        : "去程"
      : ""; // 0: go, 1: back

    return {
      content: `點擊查看「${intentJSON.route_name}」${
        direction ? direction : ""
      }路線圖 →`,
      navigate: `/general/busRoute/busPolyline?id=${route_id}&routeName=${intentJSON.route_name}&activeTabIndex=${activeTabIndex}`,
    };
  },

  // 捷運松竹站公車路線

  mrt_bus: async (intentJSON, message) => {
    const apiResult = await fetch(ESTOP_API, query_mrt_stop_routes()).then(
      (r) => r.json()
    );

    const mrtBusStops = apiResult.data.metros.edges.map((e) => e.node);
    // console.log("mrtBusStops", mrtBusStops);

    const mrtStopFound = mrtBusStops.find((e) =>
      e.name.includes(intentJSON.mrt_stop_name)
    );

    if (!mrtStopFound) return { content: "抱歉，查無此捷遵運站。" };

    const routes = mrtStopFound.routes.edges;

    return {
      content: `點擊查看 捷運「${intentJSON.mrt_stop_name}」的公車路線 →`,
      navigate: {
        pathname: `/general/mrtBus/mrtBusStopRoutes`,
        params: {
          name: intentJSON.mrt_stop_name,
          routes: JSON.stringify(routes),
        },
      },
    };
  },

  none: async () => {
    return { content: "抱歉，我無法解析您的問題" };
  },
};
// 靜宜大學有哪些路線
/* ========================
   Utils
======================== */

const safeJSONParse = (text) => {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
};

/* ========================
   API
======================== */

app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1].content;

  try {
    const intentCompletion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: INTENT_PROMPT },
        ...messages,
        // { role: "user", content: lastMessage },
      ],
    });

    const intentJSON = safeJSONParse(
      intentCompletion.choices[0].message.content
    );

    console.log("intentJSON", intentJSON);

    if (!intentJSON) {
      return res.json({ reply: "抱歉，我無法理解您的問題" });
    }

    const handler = actionHandlers[intentJSON.action] || actionHandlers.none;
    const reply = await handler(intentJSON, lastMessage);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI 回應失敗" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
