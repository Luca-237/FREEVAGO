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
        
        // Intercept requests
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('api') || url.includes('search') || url.includes('autocomplete') || url.includes('suggest')) {
                if (!url.includes('.js') && !url.includes('.css')) {
                    try {
                        const text = await response.text();
                        console.log('\n>>> URL:', url.substring(0, 200));
                        console.log('>>> BODY:', text.substring(0, 300));
                    } catch(e) {}
                }
            }
        });

        await page.goto('https://www.civitatis.com/ar/', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
        
        // Find search input and type
        const inputs = await page.$$('input[type="text"], input[type="search"]');
        if (inputs.length > 0) {
            console.log('Found input, typing "Cordoba"');
            await inputs[0].click();
            await inputs[0].type('Cordoba', { delay: 100 });
            await new Promise(r => setTimeout(r, 5000));
        } else {
            console.log('No input found');
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
