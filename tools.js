export const tools = [
  {
    type: "function",
    function: {
      name: "station_info",
      description: "查詢站點相關資訊，可能對應多個實際站點（同名不同站位）",
      parameters: {
        type: "object",
        properties: {
          station_name: { type: "string" },
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
  },
];
