import { requestOpFwApi } from "./http.js";

export async function updateStaffJSON(server) {
    return await requestOpFwApi(`${server.url}/op-framework/staffChat.json`, server.token);
}
