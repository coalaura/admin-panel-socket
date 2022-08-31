import {requestOpFwApi} from "./http.js";

export async function updateStaffJSON(pServer) {
    return await requestOpFwApi(`https://${"url" in pServer ? pServer.url : pServer.server + ".op-framework.com"}/op-framework/staffChat.json`, pServer.token);
}