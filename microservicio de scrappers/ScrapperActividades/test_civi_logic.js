import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

async function getCivitatisUrl(page, cityName, countryName) {
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '-');
    
    const citySlug = normalize(cityName);
    const countrySlug = normalize(countryName);
    
    // Attempt 1: city-country
    let url = `https://www.civitatis.com/ar/${citySlug}-${countrySlug}/`;
    console.log('Trying:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    let currentUrl = page.url();
    
    if (currentUrl === 'https://www.civitatis.com/ar/' || currentUrl === 'https://www.civitatis.com/ar') {
        // Attempt 2: city only
        url = `https://www.civitatis.com/ar/${citySlug}/`;
        console.log('Redirected to home. Trying:', url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        currentUrl = page.url();
    }
    
    if (currentUrl === 'https://www.civitatis.com/ar/' || currentUrl === 'https://www.civitatis.com/ar') {
        return null;
    }
    
    return currentUrl;
}

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        console.log('Mendoza:', await getCivitatisUrl(page, 'Mendoza', 'Argentina'));
        console.log('Roma:', await getCivitatisUrl(page, 'Roma', 'Italia'));
        console.log('Cordoba:', await getCivitatisUrl(page, 'Cordoba', 'Argentina'));
        console.log('San Carlos de Bariloche:', await getCivitatisUrl(page, 'San Carlos de Bariloche', 'Argentina'));
        console.log('Viena:', await getCivitatisUrl(page, 'Viena', 'Austria'));

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
