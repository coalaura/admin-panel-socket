import {requestOpFwApi} from "./http.js";

export async function updateModelsJSON(pServer) {
    pServer.models = await requestOpFwApi(`${pServer.url}/op-framework/models.json`, pServer.token);
}