const puppeteer = require('puppeteer');

module.exports = {
    getAPIKey
};

async function getAPIKey(sandbox) {

    console.log('Fetching new API Key');

    let browser;
    if (sandbox) {
        browser = await puppeteer.launch();
    } else {
        browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    }
    
    const page = await browser.newPage();
    await page.goto('https://www.flickr.com/');

    const apiKey = await page.evaluate(() => {
        return this.YUI_config.flickr.api.site_key;
    });

    console.log('New API Key: ' + apiKey);

    await browser.close();

    return apiKey;
}