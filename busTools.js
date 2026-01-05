export const travelPlanTool = {
  type: "function",
  function: {
    name: "travel_plan",
    description: "規劃兩地之間的公車旅運路線",
    parameters: {
      type: "object",
      properties: {
        from_place: {
          type: "string",
          description: "起點地點名稱（站名或地標）",
        },
        to_place: {
          type: "string",
          description: "終點地點名稱（站名或地標）",
        },
        dateTime: {
          type: "string",
          description: "出發時間（YYYY-MM-DD HH:mm），若未提供代表現在或今天",
        },
      },
      required: ["from_place", "to_place"],
    },
  },
};

export const stationInfoTool = {
  type: "function",
  function: {
    name: "station_info",
    description: "查詢站點相關資訊（模糊站名，可能對應多個實際站）",
    parameters: {
      type: "object",
      properties: {
        station_name: {
          type: "string",
          description: "使用者輸入的站名（可為模糊）",
        },
        fields: {
          type: "array",
          items: {
            enum: ["routes", "eta", "bus_id"],
          },
          description: "想查詢的資訊欄位",
        },
      },
      required: ["station_name", "fields"],
    },
  },
};
