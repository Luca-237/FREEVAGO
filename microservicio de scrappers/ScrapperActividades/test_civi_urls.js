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
        
        const urls = [
            'https://www.civitatis.com/ar/mendoza-argentina/',
            'https://www.civitatis.com/ar/mendoza/',
            'https://www.civitatis.com/ar/roma-italia/',
            'https://www.civitatis.com/ar/roma/',
            'https://www.civitatis.com/ar/san-carlos-de-bariloche-argentina/',
            'https://www.civitatis.com/ar/bariloche/'
        ];

        for (const url of urls) {
            console.log(`\nTesting ${url}`);
            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                const finalUrl = page.url();
                const status = response.status();
                console.log(`Status: ${status}`);
                console.log(`Final URL: ${finalUrl}`);
                if (status === 200) {
                    const title = await page.title();
                    console.log(`Title: ${title}`);
                }
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
