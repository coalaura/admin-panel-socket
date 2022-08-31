export function formatNumber(pNumber, pDecimals) {
    const str = pNumber.toFixed(pDecimals);

    return str.replace(/\.?0+$/gm, "");
}