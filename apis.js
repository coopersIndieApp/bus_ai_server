export const ESTOP_API = `https://citybus.taichung.gov.tw/ebus/graphql`;

export const query_static_route_info = (routeId) => ({
  method: "post",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `{
        route(xno: ${routeId}, lang: "zh") {
          id
          name
          departure
          destination
          description
          isCycled
          stations {
            edges {
              sid
              goBack
              orderNo
              node {
                id
                lat
                lon
                name
              }
            }
          }
          providers {
            edges {
              node {
                id
                name
                opType
                telephone
              }
            }
          }
        }
      }`,
  }),
});

export const query_dynamic_route_info = (routeId) => ({
  method: "post",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `{
        route(xno: ${routeId}, lang: "zh") {
          departure
          destination
          stations {
            edges {
              sid
              goBack
              node {
                id
                lat
                lon
                name
              }
            }
          }
          estimateTimes {
            edges {
              node {
                id
                goBack
                orderNo
                xno
                comeTime
                comeBusId
                isSuspended
                isOperationDay
                clogType
                etas {
                  etaTime
                  busId
                  countdownTime
                  isLast
                }
              }
            }
          }
          buses {
            edges {
              goBack
              node {
                id
                lat
                lon
                type
                driverId
                capacity
                dataTime
                status
                dutyStatus
                isCrowded
                provider {
                  id
                  name
                  opType
                  telephone
                }
              }
            }
          }
        }
      }`,
  }),
});

export const query_stationIds_by_name = (stationName) => ({
  method: "post",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `{
    stationsByName(name: "${stationName}", lang:"zh") {
    edges {
      node {
        id
        name
      } 
    }
    }
 }
 `,
  }),
});

export const query_routes_by_stationIds = (stationIds) => ({
  method: "post",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `{
  stations(ids: [${stationIds}], lang: "zh") {
    edges {
      node {
        id
        name
        ... on Station {
          routes {
            edges {
              node {
                id
                name
                description
                departure
                destination
                estimateTimes {
                    edges {
                      node {
                        id
                        goBack
                        orderNo
                        xno
                        comeTime
                        comeBusId
                        isSuspended
                        isOperationDay
                        clogType
                        etas {
                          etaTime
                          busId
                          countdownTime
                          isLast
                        }
                      }
                    }
                  }
              }
            }
          }
        }
      }
    }
  }
}
`,
  }),
});

export const query_mrt_stop_routes = () => ({
  method: "post",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `{
            metros(lang: "zh") {
              edges{
                node{
                  id
                  lat
                  lon
                  seq
                  name
                  routes{
                    edges{
                      orderNo
                      stationId
                      goBack
                      node{
                        id
                        seq
                        name
                        departure
                        destination
                      }
                    }
                  }
                }
              }
            }
          }`,
  }),
});
