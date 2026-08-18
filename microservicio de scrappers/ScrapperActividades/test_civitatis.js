import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto('https://www.civitatis.com/ar/cordoba-argentina/', { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        
        // Extraer tarjetas de actividades
        const cards = await page.evaluate(() => {
            // Buscar las tarjetas de actividades
            const selectors = [
                'article', '.activity-card', '[class*="activity"]', '[class*="card"]',
                'a[href*="/ar/cordoba-argentina/"]'
            ];
            
            for (const sel of selectors) {
                const found = Array.from(document.querySelectorAll(sel));
                const valid = found.filter(el => {
                    const text = el.innerText || '';
                    return text.length > 30 && text.length < 1000;
                });
                if (valid.length > 2) {
                    return valid.slice(0, 5).map(el => ({
                        tag: el.tagName,
                        class: el.className.substring(0, 100),
                        text: el.innerText.substring(0, 300),
                        html: el.innerHTML.substring(0, 200)
                    }));
                }
            }
            
            // Fallback: buscar divs con precio
            const divs = Array.from(document.querySelectorAll('div'));
            const withPrice = divs.filter(d => {
                const t = d.innerText || '';
                return t.length > 50 && t.length < 500 && (t.includes('$') || t.includes('ARS') || t.includes('Gratis') || t.includes('Desde'));
            });
            return withPrice.slice(0, 5).map(el => ({
                tag: el.tagName,
                class: el.className.substring(0, 100),
                text: el.innerText.substring(0, 300)
            }));
        });
        
        console.log('=== Cards encontradas ===');
        console.log(JSON.stringify(cards, null, 2));
        
        // También probar con Roma
        await page.goto('https://www.civitatis.com/ar/roma/', { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        
        const romaCards = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article'));
            if (articles.length > 0) {
                return articles.slice(0, 3).map(el => ({
                    tag: el.tagName,
                    class: el.className.substring(0, 100),
                    text: el.innerText.substring(0, 300)
                }));
            }
            // Try links
            const links = Array.from(document.querySelectorAll('a'));
            const activityLinks = links.filter(a => {
                const text = a.innerText || '';
                return text.length > 30 && text.length < 500 && (text.includes('Desde') || text.includes('Gratis') || text.includes('$'));
            });
            return activityLinks.slice(0, 3).map(el => ({
                tag: el.tagName,
                class: el.className.substring(0, 100),
                text: el.innerText.substring(0, 300),
                href: el.href
            }));
        });
        
        console.log('\n=== Roma Cards ===');
        console.log(JSON.stringify(romaCards, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
