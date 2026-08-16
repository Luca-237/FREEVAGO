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
        
        await page.goto('https://www.civitatis.com/ar/', { waitUntil: 'networkidle2' });
        
        // Find search API via evaluate fetch
        const results = await page.evaluate(async () => {
            try {
                // Try guessing autocomplete endpoints
                // 1. /api/autocomplete
                // 2. /api/search
                // 3. /search/autocomplete
                
                // Let's just try to trigger the autocomplete programmatically 
                // by finding the vue instance or just the input event
                const input = document.querySelector('input[type="text"], input[type="search"]');
                if (input) {
                    input.value = 'Cordoba';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            const suggestions = Array.from(document.querySelectorAll('.autocomplete-result, .m-search-result, .search-result, a[href*="/ar/"]'));
                            resolve(suggestions.map(s => ({
                                text: s.innerText,
                                href: s.href || s.getAttribute('href')
                            })));
                        }, 3000);
                    });
                }
                return { error: 'No input found' };
            } catch(e) {
                return { error: e.message };
            }
        });
        
        console.log('Results:', JSON.stringify(results, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
