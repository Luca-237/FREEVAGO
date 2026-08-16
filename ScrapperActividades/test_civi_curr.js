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
        
        // Set cookie for ARS
        await page.setCookie({
            name: 'civitatis_currency',
            value: 'ARS',
            domain: '.civitatis.com'
        });
        
        await page.goto('https://www.civitatis.com/ar/cordoba-argentina/', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 5000));
        
        const results = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article'));
            return articles.slice(0, 3).map(article => {
                const link = article.querySelector('a[data-gtm-new-model-click]');
                let parsedPrice = null;
                let currency = null;
                if (link) {
                    try {
                        const parsed = JSON.parse(link.getAttribute('data-gtm-new-model-click'));
                        if (parsed && parsed.ecommerce) {
                            currency = parsed.ecommerce.navigationCurrency;
                            parsedPrice = parsed.ecommerce.click.products[0].dimension32;
                        }
                    } catch(e) {}
                }
                
                return {
                    currency,
                    parsedPrice
                };
            });
        });
        
        console.log("With civitatis_currency=ARS:");
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
