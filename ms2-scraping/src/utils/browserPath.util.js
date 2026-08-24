import fs from 'fs';
import path from 'path';

// Rutas conocidas de instalación de Brave/Chrome/Chromium por SO. Se prueban
// en orden y se usa la primera que exista en el disco.
const CANDIDATES = {
    darwin: [
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
        '/usr/bin/brave-browser',
        '/usr/bin/brave',
        '/snap/bin/brave',
        '/opt/brave.com/brave-origin/brave',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ],
    win32: [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ]
};

let cachedPath;

// Resuelve el ejecutable de browser que va a usar Puppeteer, sin depender de
// una ruta fija por SO. Prioridad:
//   1. BRAVE_PATH en el .env, si está seteado (override manual).
//   2. Autodetección de Brave/Chrome/Chromium instalado, según process.platform.
// Tira un error descriptivo si no encuentra nada, así el scraper que llama
// esto lo captura en su try/catch y lo devuelve como { error } normal, sin
// tumbar el servidor.
export function resolveBrowserPath() {
    if (cachedPath) return cachedPath;

    if (process.env.BRAVE_PATH) {
        if (!fs.existsSync(process.env.BRAVE_PATH)) {
            throw new Error(`BRAVE_PATH apunta a una ruta que no existe: "${process.env.BRAVE_PATH}"`);
        }
        cachedPath = process.env.BRAVE_PATH;
        return cachedPath;
    }

    const candidates = CANDIDATES[process.platform] || [];
    const found = candidates.find(p => p && fs.existsSync(p));

    if (!found) {
        throw new Error(
            `No se encontró Brave ni Chrome instalado en las rutas conocidas para "${process.platform}". ` +
            `Instalá alguno de los dos, o seteá BRAVE_PATH en tu .env con la ruta al ejecutable.`
        );
    }

    cachedPath = found;
    return cachedPath;
}
