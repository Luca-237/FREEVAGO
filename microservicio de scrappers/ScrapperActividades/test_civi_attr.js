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
        
        await page.goto('https://www.civitatis.com/ar/cordoba-argentina/', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 5000));
        
        const results = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article'));
            return articles.slice(0, 3).map(article => {
                const link = article.querySelector('a[data-gtm-new-model-click]');
                if (!link) return { error: "no link" };
                
                const rawAttr = link.getAttribute('data-gtm-new-model-click');
                let parsed = null;
                let parsedPrice = null;
                try {
                    parsed = JSON.parse(rawAttr);
                    if (parsed && parsed.ecommerce && parsed.ecommerce.click && parsed.ecommerce.click.products) {
                        parsedPrice = parsed.ecommerce.click.products[0].dimension32;
                    }
                } catch(e) {
                    parsed = "JSON.parse ERROR: " + e.message;
                }
                
                let regexPrice1 = null;
                let regexPrice2 = null;
                const match1 = rawAttr.match(/"dimension32":(\d+)/);
                if (match1) regexPrice1 = match1[1];
                
                const match2 = rawAttr.match(/&quot;dimension32&quot;:(\d+)/);
                if (match2) regexPrice2 = match2[1];
                
                return {
                    rawAttr: rawAttr.substring(0, 100) + '...',
                    parsedPrice,
                    regexPrice1,
                    regexPrice2,
                    jsonParseResult: parsed !== null ? (typeof parsed === 'object' ? 'Success' : parsed) : 'Null'
                };
            });
        });
        
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
