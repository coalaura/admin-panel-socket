import {requestOpFwApi} from "./http.js";

export async function updateStaffJSON(pServer) {
    return await requestOpFwApi(`${"url" in pServer ? pServer.url : "https://" + pServer.server + ".op-framework.com"}/op-framework/staffChat.json`, pServer.token);
}
