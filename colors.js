import chalk from "chalk";

export function success(message) {
    return chalk.greenBright(message);
}

export function warning(message) {
    return chalk.yellowBright(message);
}

export function danger(message) {
    return chalk.redBright(message);
}

export function error(message) {
    return chalk.red(message);
}

export function info(message) {
    return chalk.cyanBright(message);
}

export function muted(message) {
    return chalk.gray(message);
}

export function counter(message) {
    return chalk.black(chalk.bgYellow(message));
}

export function request(method, path, session) {
    return `${chalk.bgGreen(" " + method + " ")} ${chalk.cyanBright(session)} - ${chalk.gray(path)}`;
}