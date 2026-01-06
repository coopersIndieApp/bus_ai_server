import {
  ESTOP_API,
  query_stationIds_by_name,
  query_routes_by_stationIds,
  query_dynamic_route_info,
  query_static_route_info,
  query_mrt_stop_routes,
} from "./apis.js";
import * as fuzz from "fuzzball"; // ✅
import { generateAnswer } from "./index.js";
import { getBusRoutes } from "./busRoutesStore.js";

/**
 * 模糊比對站名
 * @param {string} name - 真實站名
 * @param {string} query - 使用者輸入
 * @param {number} threshold - 相似度門檻
 */
/* ========================
   Fuzzy Helper
======================== */
const normalize = (str) =>
  str
    .replace(/[\/（）()]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const fuzzyMatchScore = (name, query) =>
  fuzz.partial_ratio(normalize(name), normalize(query));

const fuzzyMatch = (name, query, threshold = 70) =>
  fuzzyMatchScore(name, query) >= threshold;

const getFuzzyCandidates = (
  stationName,
  stationNodes,
  threshold = 50,
  topN = 5
) => {
  const scored = stationNodes.map((s) => ({
    name: s.node.name,
    score: fuzzyMatchScore(s.node.name, stationName),
  }));

  const filtered = scored.filter((s) => s.score >= threshold);
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, topN).map((s) => s.name);
};

/* ========================
   Data Extractor
======================== */
// const busRoutes = await loadBusRoutes(); // 會自動快取

// const busRoutes = await getBusRoutes({ reload: true });
// const busRoutes = JSON.parse(
//   fs.readFileSync(path.resolve("./busRoutes.json"), "utf-8")
// );

// const busRoutes = await getBusRoutes({ reload: true });

const getRouteNodeByName = async (route_name) => {
  const busRoutes = await getBusRoutes({ reload: true });
  return busRoutes.data.routes.edges.find((r) => r.node.name === route_name)
    ?.node;
};

const getRouteIdByName = async (route_name) => {
  const node = await getRouteNodeByName(route_name);
  return node?.id;
};
const extractBusRoutesData = async (routeNode, fields) => {
  const result = {};

  if (fields.includes("count_routes")) {
    const busRoutes = await getBusRoutes({ reload: true });
    result.count = busRoutes.data.routes.edges.length;
  }
  if (fields.includes("routes")) {
    const busRoutes = await getBusRoutes({ reload: true });
    result.routes = busRoutes.data.routes.edges.map((e) => ({
      name: e.node.name,
      description: e.node.description,
      departure: e.node.departure,
      destination: e.node.destination,
      isCycled: e.node.isCycled,
    }));
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

  if (fields.includes("ticket_price")) {
    // result.stations = routeNode.stations.edges;
    result.stations = {
      go: routeNode.stations.edges.filter((e) => e.goBack === 1),
      back: routeNode.stations.edges.filter((e) => e.goBack === 2),
    };
  }

  return result;
};

const extractDynamicData = (routeNode, station_name) => {
  let matchedStations = routeNode.stations.edges.filter((s) =>
    fuzzyMatch(s.node.name, station_name)
  );

  if (matchedStations.length === 0) {
    // 如果沒有任何 fuzzy match → 直接找最接近的站點
    const candidates = getFuzzyCandidates(
      station_name,
      routeNode.stations.edges,
      0,
      1
    );
    if (candidates.length === 0) {
      return { content: `抱歉，查無${station_name}。` };
    }
    // 找到最接近的站點
    matchedStations = routeNode.stations.edges.filter(
      (s) => s.node.name === candidates[0]
    );
  }

  const stationIds = matchedStations.map((e) => e.node.id);

  const data = routeNode.estimateTimes.edges
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

  return data;
};

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
   Tool Handler
======================== */

export const handleBusRoutesInfoTool = async (
  { route_name, fields },
  message
) => {
  let routeNode;
  if (route_name) {
    routeNode = await getRouteNodeByName(route_name);
    if (!routeNode) return { content: `抱歉，查無${route_name}。` };
  }

  const data = await extractBusRoutesData(routeNode, fields);

  return generateAnswer({ fields, data }, message);
};

export const handleStaticRouteInfoTool = async (
  { route_name, fields },
  message
) => {
  const route_id = await getRouteIdByName(route_name);
  if (!route_id) return { content: `抱歉，查無${route_name}。` };

  const apiResult = await fetch(
    ESTOP_API,
    query_static_route_info(route_id)
  ).then((r) => r.json());

  const data = extractStaticData(apiResult.data.route, fields);

  return generateAnswer({ fields, data }, message);
};

export const handleDynamicRouteInfoTool = async (
  { route_name, station_name, fields },
  message
) => {
  // ==== 2️⃣ 取得 route_id ====
  const route_id = await getRouteIdByName(route_name);
  if (!route_id) return { content: `抱歉，查無${route_name}。` };

  // ==== 3️⃣ 取得動態路線資訊 ====
  const apiResult = await fetch(
    ESTOP_API,
    query_dynamic_route_info(route_id)
  ).then((r) => r.json());
  const routeData = apiResult.data.route;

  const data = extractDynamicData(routeData, station_name);

  // ==== 5️⃣ 回傳結果 ====
  return generateAnswer({ fields, data }, message);
};

const formatStationInfoAnswer = (fields, stationsData) => {
  return stationsData
    .map((station) => {
      const lines = [];

      // === 站名（一定顯示，不合併） ===
      lines.push(`【${station.name}】`);

      // === 路線排序 ===
      const sortedRoutes = [...station.routes].sort((a, b) => {
        const aNum = parseInt(a.name, 10);
        const bNum = parseInt(b.name, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;
        if (!isNaN(bNum)) return 1;

        return a.name.localeCompare(b.name, "zh-Hant");
      });

      sortedRoutes.forEach((route) => {
        // 路線名稱（單獨一行）
        lines.push(`${route.name}`);

        route.estimateTimes.forEach((et) => {
          let status = "";

          if (!et.isOperationDay) {
            status = "未營運";
          } else if (et.isSuspended) {
            status = "末班駛離";
          } else {
            switch (et.clogType) {
              case -8:
                status = "取消停靠";
                break;
              case -7:
                status = "臨時站位";
                break;
              case -6:
                status = "活動改道";
                break;
              case -5:
                status = "施工改道";
                break;
              default: {
                const etaTime = et?.eta?.[0];

                if (typeof etaTime === "string" && etaTime.includes(":")) {
                  status = etaTime;
                } else if (typeof etaTime === "number") {
                  if (etaTime < 1) status = "進站中";
                  else if (etaTime <= 3) status = "即將到站";
                  else status = `將於 ${etaTime} 分鐘後到站`;
                } else {
                  status = "目前無法提供到站時間";
                }
              }
            }
          }

          // 方向（一定顯示 destination）
          lines.push(
            `  往 ${et.destination}${
              fields.includes("eta") ? `：${status}` : ""
            }`
          );
        });

        // 路線之間空一行
        lines.push("");
      });

      // 移除最後多的空行
      if (lines[lines.length - 1] === "") lines.pop();

      return lines.join("\n");
    })
    .join("\n\n");
};

export const handleStationInfoTool = async (
  { station_name, fields },
  message
) => {
  const stationIdResult = await fetch(
    ESTOP_API,
    query_stationIds_by_name(station_name)
  ).then((r) => r.json());

  const stationIds = stationIdResult.data.stationsByName.edges.map(
    (e) => e.node.id
  );

  if (stationIds.length === 0) {
    return { content: `抱歉，查無${station_name}。` };
  }

  const apiResult = await fetch(
    ESTOP_API,
    query_routes_by_stationIds(stationIds)
  ).then((r) => r.json());

  const data = extractDynamicStationsData(apiResult.data.stations);

  if (!data || data.length === 0) {
    return { content: `目前無法提供${station_name}的資訊。` };
  }

  const content = formatStationInfoAnswer(fields, data);
  //   console.log(content);
  //   return { content: `「${station_name}」站點資訊：\n\n${content}` };
  return generateAnswer(
    {
      fields,
      data: content,
    },
    message
  );
};

export const handleRouteScheduleInfoTool = async ({
  route_name,
  date,
  direction,
}) => {
  const route_id = await getRouteIdByName(route_name);
  if (!route_id) return { content: `抱歉，查無${route_name}。` };

  const activeTabIndex = direction ? direction : 0; // 0: go, 1: back
  const directionText = direction ? (direction === 1 ? "回程" : "去程") : "";
  const scheduleDate = date ? date : "";
  return {
    content: `點擊查看「${route_name}」${directionText}時刻表 ${
      scheduleDate ? `(${scheduleDate})` : ""
    } →`,
    navigate: `/general/busRoute/busTimetableTabs?id=${route_id}&routeName=${route_name}&activeTabIndex=${activeTabIndex}&scheduleDate=${scheduleDate}`,
  };
};

export const handleRouteMapTool = async ({ route_name, direction }) => {
  const route_id = await getRouteIdByName(route_name);
  if (!route_id) return { content: `抱歉，查無${route_name}。` };

  const activeTabIndex = direction ? direction : 0; // 0: go, 1: back
  const directionText = direction ? (direction === 1 ? "回程" : "去程") : ""; // 0: go, 1: back

  return {
    content: `點擊查看「${route_name}」${directionText}路線圖 →`,
    navigate: `/general/busRoute/busPolyline?id=${route_id}&routeName=${route_name}&activeTabIndex=${activeTabIndex}`,
  };
};

export const handleTravelPlanTool = async ({
  from_place,
  to_place,
  dateTime,
}) => {
  let from_place_name;
  let to_place_name;
  if (from_place === "CURRENT_LOCATION") {
    from_place_name = "現在位置";
  } else {
    from_place_name = from_place;
  }
  if (to_place === "CURRENT_LOCATION") {
    to_place_name = "現在位置";
  } else {
    to_place_name = to_place;
  }
  const dateTimeString = dateTime ? dateTime : "";
  return {
    content: `點擊查看 ${
      dateTimeString ? `(${dateTimeString})` : ""
    }「${from_place_name} 到 ${to_place_name}」旅運規劃 →`,
    navigate: `/general/planner?from_place=${from_place}&to_place=${to_place}&dateTime=${dateTimeString}`,
  };
};

export const handleMrTBusTool = async ({ mrt_stop_name }) => {
  const apiResult = await fetch(ESTOP_API, query_mrt_stop_routes()).then((r) =>
    r.json()
  );

  const mrtBusStops = apiResult.data.metros.edges.map((e) => e.node);

  let mrtName;

  const mrtStopFound = mrtBusStops.find((e) => {
    mrtName = e.name;
    return fuzzyMatch(e.name, mrt_stop_name);
  });

  if (!mrtStopFound) return { content: `抱歉，查無${mrt_stop_name}。` };

  const routes = mrtStopFound.routes.edges;

  return {
    content: `點擊查看 捷運「${mrt_stop_name}」的公車路線 →`,
    navigate: {
      pathname: `/general/mrtBus/mrtBusStopRoutes`,
      params: {
        name: mrtName,
        routes: JSON.stringify(routes),
      },
    },
  };
};

export const handleTicketPriceTool = async ({
  route_name,
  from_station_name,
  to_station_name,
  fields,
}) => {
  if (!route_name) {
    return { content: "請問您要查詢哪條路線的票價？" };
  }

  const route_id = await getRouteIdByName(route_name);
  if (!route_id) return { content: `抱歉，查無${route_name}。` };

  const apiResult = await fetch(
    ESTOP_API,
    query_static_route_info(route_id)
  ).then((r) => r.json());

  const routeInfo = apiResult.data.route;
  const data = extractStaticData(apiResult.data.route, fields);

  if (!from_station_name || !to_station_name) {
    return { content: "請提供上車站與下車站。" };
  }
  //   300 東海大學到靜宜大學票價
  const go_from_station = data.stations.go.find((e) =>
    fuzzyMatch(e.node.name, normalize(from_station_name))
  );
  const go_to_station = data.stations.go.find((e) =>
    fuzzyMatch(e.node.name, normalize(to_station_name))
  );
  const back_from_station = data.stations.back.find((e) =>
    fuzzyMatch(e.node.name, normalize(from_station_name))
  );
  const back_to_station = data.stations.back.find((e) =>
    fuzzyMatch(e.node.name, normalize(to_station_name))
  );

  if (!go_from_station || !back_from_station) {
    return {
      content: `抱歉，${route_name}路線查無此上車站。`,
      // ${from_station_name}
    };
  }
  if (!go_to_station || !back_to_station) {
    return {
      content: `抱歉，${route_name}路線查無此下車站。`,
      // ${to_station_name}
    };
  }

  let goBack;
  let departure;
  let destination;
  let possibleResults = [];
  //循環線
  //如果 出發站序號 > 到達站序號，代表返程
  if (go_from_station?.orderNo < go_to_station?.orderNo) {
    goBack = go_from_station.goBack;
    departure = go_from_station;
    destination = go_to_station;
  } else {
    goBack = back_from_station.goBack;
    departure = back_from_station;
    destination = back_to_station;
  }
  //   300 董海大學到靚衣大學票價
  if (departure?.node?.id == destination?.node?.id) {
    if (!routeInfo.isCycled) {
      return { content: "抱歉，出發站與到達站相同，無法查詢票價。" };
    }
  } else {
    possibleResults.push({
      goBack: goBack,
      departure: departure,
      destination: destination,
    });
  }

  if (routeInfo.isCycled && go_to_station?.sid != back_to_station?.sid) {
    goBack = 1;
    departure = go_from_station;
    destination = back_to_station;

    possibleResults.push({
      goBack: goBack,
      departure: departure,
      destination: destination,
      isCycled: routeInfo.isCycled,
    });
  }

  const results = possibleResults.map((e) => {
    const direction =
      e.goBack == 1
        ? ` - 往${routeInfo.destination}`
        : ` - 往${routeInfo.departure}`;
    return {
      content: `點擊查看「${route_name}${direction}」${
        e.departure?.node?.name
      } 到 ${e.isCycled ? "『返程』-" : ""} ${
        e.destination?.node?.name
      } 票價資訊 →`,
      navigate: `/general/fare?id=${route_id}&goBack=${e.goBack}&departureId=${e.departure?.node?.id}&destinationId=${e.destination?.node?.id}`,
    };
  });

  return {
    content: results[0].content,
    navigate: results[0].navigate,
    extraData: results.length > 1 ? results : null,
  };
};

// 300市政府到台中車站票價
