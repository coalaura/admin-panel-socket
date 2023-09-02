import {requestOpFwApi} from "./http.js";

export async function updateModelsJSON(pServer) {
    const models = await requestOpFwApi(`${pServer.url}/op-framework/models.json`, pServer.token);

    pServer.models = models.models;

    for (const weaponHash in models.weapons) {
        const weaponName = models.weapons[weaponHash];

        pServer.models[weaponHash] = weaponName;
    }
}