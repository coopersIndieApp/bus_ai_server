const busRoutesInfoTool = {
  type: "function",
  function: {
    name: "busRoutes_info",
    description:
      "查詢公車路線總覽，如路線數量、起訖站、是否循環。範例：目前台中有幾條公車路線？3開頭的路線有哪些？300 路線起訖站？300 是不是循環線？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱" },
        fields: {
          type: "array",
          items: {
            enum: [
              "count_routes",
              "departure_destination",
              "isCycled",
              "routes",
            ],
          },
        },
      },
      required: ["fields"],
    },
  },
};

const staticRouteInfoTool = {
  type: "function",
  function: {
    name: "static_route_info",
    description:
      "查詢特定路線的靜態資訊，如站點、營運商。範例：300 路線有哪些站？300 路線的營運商是哪幾家？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱, 通常是數字" },
        fields: {
          type: "array",
          items: {
            enum: ["stations", "providers"],
          },
        },
      },
      required: ["route_name", "fields"],
    },
  },
};

const dynamicRouteInfoTool = {
  type: "function",
  function: {
    name: "dynamic_route_info",
    description:
      "查詢特定路線 + 特定站點的動態資料。範例：300 路線 靜宜大學 的到站時間？300 路線 靜宜大學 有哪幾台車？300 路線 靜宜大學 到站時間跟車號？300 正英路 往靜宜大學 何時來？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱" },
        station_name: { type: "string", description: "站點名稱" },
        fields: {
          type: "array",
          items: {
            enum: ["routes", "eta", "bus_id"],
          },
        },
      },
      required: ["route_name"],
    },
  },
};

const stationInfoTool = {
  type: "function",
  function: {
    name: "station_info",
    description:
      "用站名查詢站點相關資訊，如路線、到站時間等，可能對應多個實際站點（同名不同站位）。範例：靜宜大學 有哪些路線？靜宜大學 的到站時間？靜宜大學 有哪幾台車？靜宜大學 到站時間跟車號？",
    parameters: {
      type: "object",
      properties: {
        station_name: { type: "string", description: "站點名稱" },
        fields: {
          type: "array",
          items: {
            enum: ["routes", "eta", "bus_id"],
          },
        },
      },
      required: ["station_name", "fields"],
    },
  },
};

const routeScheduleInfoTool = {
  type: "function",
  function: {
    name: "route_schedule_info",
    description:
      "查詢特定路線的時刻表。範例：300 路線的時刻表？300 路線昨天的時刻表？300 路線回程的時刻表？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱" },
        date: {
          type: "string",
          description: "日期（YYYY-MM-DD） 若未提供，則使用當天",
        },
        direction: { type: "number", description: "方向（0: 去程, 1: 回程" },
      },
      required: ["route_name"],
    },
  },
};

const routeMapTool = {
  type: "function",
  function: {
    name: "route_map",
    description:
      "查詢特定路線的地圖。範例：300 路線的地圖？300 路線回程的地圖？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱" },
        direction: { type: "number", description: "方向（0: 去程, 1: 回程" },
      },
      required: ["route_name"],
    },
  },
};

const mrtBusTool = {
  type: "function",
  function: {
    name: "mrt_bus",
    description:
      "查詢捷運站公車路線。範例：捷運高鐵臺中站 公車路線？捷運松竹站 公車路線？",
    parameters: {
      type: "object",
      properties: {
        mrt_stop_name: { type: "string", description: "捷運站名稱" },
      },
      required: ["mrt_stop_name"],
    },
  },
};

const ticketPriceTool = {
  type: "function",
  function: {
    name: "ticket_price",
    description:
      "查詢票價。範例：300 路線 靜宜大學 到 秋紅谷 票價？300 路線 秋紅谷 到 靜宜大學 票價？",
    parameters: {
      type: "object",
      properties: {
        route_name: { type: "string", description: "路線名稱" },
        from_station_name: { type: "string", description: "出發站名稱" },
        to_station_name: { type: "string", description: "到達站名稱" },
        fields: {
          type: "array",
          items: {
            enum: ["ticket_price"],
          },
        },
      },
      required: [
        "route_name",
        "from_station_name",
        "to_station_name",
        "fields",
      ],
    },
  },
};

const travelPlanTool = {
  type: "function",
  function: {
    name: "travel_plan",
    description:
      "規劃如何搭乘大眾運輸從出發地到目的地。範例：怎麼搭到高鐵臺中站？怎麼從靜宜大學 搭到 高鐵臺中站？明天下午 2 點 靜宜大學 到 高鐵臺中站 旅運規劃？",
    parameters: {
      type: "object",
      properties: {
        from_place: {
          type: "string",
          description: "出發地名稱，或使用 CURRENT_LOCATION 代表現在位置",
          enum: ["CURRENT_LOCATION"],
        },
        to_place: {
          type: "string",
          description: "目的地名稱，或使用 CURRENT_LOCATION 代表現在位置",
          enum: ["CURRENT_LOCATION"],
        },
        dateTime: {
          type: "string",
          description: "日期時間（YYYY-MM-DD HH:mm）, 若未提供，則使用當天",
        },
      },
      required: ["from_place", "to_place"],
    },
  },
};

export const tools = [
  busRoutesInfoTool,
  staticRouteInfoTool,
  dynamicRouteInfoTool,
  stationInfoTool,
  routeScheduleInfoTool,
  routeMapTool,
  travelPlanTool,
  mrtBusTool,
  ticketPriceTool,
];
