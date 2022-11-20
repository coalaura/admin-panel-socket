import {requestOpFwApi} from "./http.js";

export async function updateStaffJSON(pServer) {
    return await requestOpFwApi(`${pServer.url}/op-framework/staffChat.json`, pServer.token);
}
