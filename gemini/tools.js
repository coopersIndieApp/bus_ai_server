// tools.js (Gemini version)

export const geminiTools = {
  tools: [
    {
      functionDeclarations: [
        {
          name: "busRoutes_info",
          description:
            "查詢公車路線總覽。根據使用者問題自動判斷返回內容：問「有多少路線」、「幾條路線」、「路線總數」時返回路線數量；問「有哪些路線」、「路線列表」時返回路線列表。",
          parameters: {
            type: "object",
            properties: {
              fields: {
                type: "array",
                description: "可選參數。不指定時系統會依問題自動判斷。",
                items: {
                  type: "string",
                  enum: ["count_routes", "routes"],
                },
              },
            },
          },
        },

        {
          name: "static_route_info",
          description:
            "查詢特定路線的靜態資訊，如站點、營運商、起訖站、是否循環。",
          parameters: {
            type: "object",
            properties: {
              route_name: {
                type: "string",
                description: "路線名稱（通常是數字）",
              },
              fields: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["stations", "providers", "route_info"],
                },
              },
            },
            required: ["route_name", "fields"],
          },
        },

        {
          name: "dynamic_route_info",
          description:
            "查詢特定路線在特定站點的即時動態資料，如到站時間或車號。",
          parameters: {
            type: "object",
            properties: {
              route_name: { type: "string", description: "路線名稱" },
              station_name: { type: "string", description: "站點名稱" },
              fields: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["routes", "eta", "bus_id"],
                },
              },
            },
            required: ["route_name"],
          },
        },

        {
          name: "station_info",
          description: "以站名查詢站點資訊，可能包含多個同名站位。",
          parameters: {
            type: "object",
            properties: {
              station_name: {
                type: "string",
                description: "站點名稱",
              },
              fields: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["routes", "eta", "bus_id"],
                },
              },
            },
            required: ["station_name", "fields"],
          },
        },

        {
          name: "route_schedule_info",
          description: "查詢特定路線的時刻表。",
          parameters: {
            type: "object",
            properties: {
              route_name: { type: "string", description: "路線名稱" },
              date: {
                type: "string",
                description: "日期 YYYY-MM-DD（未提供則為今天）",
              },
              direction: {
                type: "number",
                description: "方向（0: 去程, 1: 回程）",
              },
            },
            required: ["route_name"],
          },
        },

        {
          name: "route_map",
          description: "查詢特定路線的路線地圖。",
          parameters: {
            type: "object",
            properties: {
              route_name: { type: "string", description: "路線名稱" },
              direction: {
                type: "number",
                description: "方向（0: 去程, 1: 回程）",
              },
            },
            required: ["route_name"],
          },
        },

        {
          name: "mrt_bus",
          description: "查詢捷運站或捷運站對應的公車路線。",
          parameters: {
            type: "object",
            properties: {
              mrt_stop_name: {
                type: "string",
                description: "捷運站名稱",
              },
              fields: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["mrt_names", "mrt_bus_routes"],
                },
              },
            },
          },
        },

        {
          name: "ticket_price",
          description: "查詢兩站間的公車票價。",
          parameters: {
            type: "object",
            properties: {
              route_name: { type: "string" },
              from_station_name: { type: "string" },
              to_station_name: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "string",
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

        {
          name: "travel_plan",
          description: "規劃如何搭乘大眾運輸從出發地到目的地。",
          parameters: {
            type: "object",
            properties: {
              from_place: {
                type: "string",
                description: "出發地名稱，或 CURRENT_LOCATION",
              },
              to_place: {
                type: "string",
                description: "目的地名稱，或 CURRENT_LOCATION",
              },
              dateTime: {
                type: "string",
                description: "YYYY-MM-DD HH:mm（未提供則使用現在）",
              },
            },
            required: ["from_place", "to_place"],
          },
        },

        {
          name: "nearby_station",
          description: "查詢使用者附近的公車站點。",
          parameters: {
            type: "object",
            properties: {},
          },
        },

        {
          name: "reserve_stop",
          description: "預約指定路線與站牌。",
          parameters: {
            type: "object",
            properties: {
              route_name: { type: "string" },
              direction: {
                type: "number",
                description: "1: 去程, 2: 回程",
              },
              destination: {
                type: "string",
                description: "往 XXX",
              },
              station_name: {
                type: "string",
                description: "站點名稱",
              },
            },
            required: ["route_name", "station_name"],
          },
        },
      ],
    },
  ],
};
