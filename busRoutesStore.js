import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve("./busRoutes.json");
const API_URL = "https://citybus.taichung.gov.tw/ebus/graphql";
export const query_bus_routes = () => ({
  method: "post",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    query: `{
      routes(lang:"zh"){
        edges{
          node{
            id
            name
            description
            opType
            inuse
            isCycled
            departure
            destination
          }
        }
      }
    }`,
  }),
});

let busRoutesCache = null;

/**
 * 從 API 抓最新資料，寫入 JSON 並更新記憶體快取
 */
export async function updateBusRoutes() {
  console.log("抓取最新 busRoutes...");
  const res = await fetch(API_URL, query_bus_routes()); // 這個 function 需回傳完整 busRoutes JSON
  if (!res.ok) throw new Error("取得 bus routes 失敗");
  const data = await res.json();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  busRoutesCache = data;
  console.log("busRoutes.json 更新完成 ✅");
  return data;
}

/**
 * 取得記憶體中的資料（給 handler 用）
 * @param {boolean} reload - 是否強制從 JSON 重新讀取（不會自動抓 API）
 */
export async function getBusRoutes({ reload = false } = {}) {
  if (!busRoutesCache || reload) {
    if (!fs.existsSync(FILE_PATH)) {
      // 如果 JSON 不存在 → 直接從 API 抓
      return await updateBusRoutes();
    }
    busRoutesCache = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  }
  return busRoutesCache;
}
