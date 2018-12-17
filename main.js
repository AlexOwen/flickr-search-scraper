/*
 * This is a quick script to capture a JSON file of all search results for a given search term and the best version of all non-pro images in the search.
 */
'use strict';

const axios = require('axios'),
    path = require('path'),
    fs = require('fs');

const getAPIKey = require('./apiKey').getAPIKey,
    helpers = require('./helpers'),
    sleep = helpers.sleep,
    formatDate = helpers.formatDate,
    getFilenameFromURL = helpers.getFilenameFromURL,
    handleError = helpers.handleError,
    resetErrorCount = helpers.resetErrorCount;

const sort = 'date-posted-asc',
    perPage = 100,
    searchTerm = process.argv[2],
    options = helpers.processArgs(process.argv),
    sandbox = typeof options.sandbox === 'undefined' ? true : Boolean(options.sandbox),                     // Sandbox unless we're told not to
    startTime = typeof options.start === 'undefined' ? 0 : parseInt(options.start),                         // Start from 0 unless anotehr time is specified (for resuming)
    endTime = typeof options.end === 'undefined' ? (new Date()).getTime() / 1000 : parseInt(options.end);   // End now unless specified

let photosSaved = 0,
    apiKey = '';

(async () => {

    if (startTime < endTime) {
        apiKey = await getAPIKey(sandbox);

        if (!fs.existsSync('./images')) {
            fs.mkdirSync('./images');
        }

        if (!fs.existsSync('./images/' + searchTerm)) {
            fs.mkdirSync('./images/' + searchTerm);
        }
        
        getPhotos(startTime, endTime);
    } else {
        console.log('Failed: Start time is after end time');
    }

})();

// Recursive function to make sure we get all the photos
async function getPhotos(startTime, endTime) {
    console.log(`Starting date range: ${formatDate(startTime)} - ${formatDate(endTime)}`);

    let [photos, pages, total] = await requestPage(1, startTime, endTime);

    if (typeof photos !== 'undefined' || typeof pages !== 'undefined') {
        resetErrorCount();

        // Flickr only returns up to around 4000 unique results per query (the rest are duplicates), so we might have to split by date range
        if (photos.length > 0 && pages > 0) {
            if (total > 3500) {
                console.log(`Too many results (${total}), choosing smaller date range`);
                let rangeMidPoint = (startTime + endTime) / 2;

                await getPhotos(startTime, rangeMidPoint);
                await getPhotos(rangeMidPoint, endTime);
            } else {
                console.log(`Found ${total} photos`);

                let page = 1;

                while (page <= pages) {
                    console.log(`Requesting page ${page} of ${pages}`)
                    let [pagePhotos, newPages, _] = await requestPage(page, startTime, endTime);
                    await parsePage(pagePhotos);
                    console.log(`Completed page ${page} of ${pages}`);

                    pages = newPages; // The count might change
                    page++;
                }
                console.log(`Completed date range: ${formatDate(startTime)} (${startTime}) - ${formatDate(endTime)} (${endTime})`);
            }
        } else {
            console.log(`No results for date range: ${formatDate(startTime)} - ${formatDate(endTime)}`);
        }
    } else {
        console.log('No data');
    }
}

// Download a photo from a URL
async function downloadPhoto(url) {

    const filePath = path.resolve(__dirname, 'images', searchTerm, getFilenameFromURL(url));

    let response;

    try {
        response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });
    } catch (err) {
        console.log('Failed to download ' + getFilenameFromURL(url));
        console.log(err);
    }

    if (response) {
        response.data.pipe(fs.createWriteStream(filePath));

        return new Promise((resolve, reject) => {
            response.data.on('end', () => {
                console.log('Downloaded ' + getFilenameFromURL(url));
                resolve();
            });

            response.data.on('error', () => {
                console.log('Failed to download ' + getFilenameFromURL(url));
                reject();
            });
        });
    }
}

// Parses out all the data we want from the current page and saves it to a .json file in the current directory
async function parsePage(photos) {
    let downloadPromises = [];

    if (photos && photos.length && photos.length > 0) {
        for (let photo of photos) {
            if (photo.ispro === 0) { // Only save photos that aren't on pro accounts
                let bestURL = '';
                let height = 0,
                    width = 0;

                if (photo.url_o_cdn) { // original
                    bestURL = photo.url_o_cdn;
                    if (photo.height_o) height = photo.height_o;
                    if (photo.width_o) width = photo.width_o;
                } else if (photo.url_k_cdn) { // large 2048
                    bestURL = photo.url_k_cdn;
                    if (photo.height_n) height = photo.height_n;
                    if (photo.width_n) width = photo.width_n;
                } else if (photo.url_h_cdn) { // large 1600
                    bestURL = photo.url_h_cdn;
                    if (photo.height_h) height = photo.height_h;
                    if (photo.width_h) width = photo.width_h;
                } else if (photo.url_l_cdn) { // large 1024
                    bestURL = photo.url_l_cdn;
                    if (photo.height_l) height = photo.height_l;
                    if (photo.width_l) width = photo.width_l;
                } else if (photo.url_c_cdn) { // medium 800
                    bestURL = photo.url_c_cdn;
                    if (photo.height_c) height = photo.height_c;
                    if (photo.width_c) width = photo.width_c;
                } else if (photo.url_z_cdn) { // medium 640
                    bestURL = photo.url_z_cdn;
                    if (photo.height_z) height = photo.height_z;
                    if (photo.width_z) width = photo.width_z;
                } else if (photo.url_m_cdn) { // medium 500
                    bestURL = photo.url_m_cdn;
                    if (photo.height_m) height = photo.height_m;
                    if (photo.width_m) width = photo.width_m;
                }

                // No lower res photos as there's little point

                if (bestURL !== '') {
                    let filename = getFilenameFromURL(bestURL);

                    const data = {
                        url: bestURL,
                        filename,
                        title: photo.title,
                        license: photo.license,
                        description: photo.description ? photo.description._content : '',
                        rotation: photo.rotation,
                        owner: photo.owner,
                        ownerName: photo.ownername,
                        height,
                        width,
                        dateTaken: photo.datetaken,
                        dateUpload: photo.dateupload,
                        dateCreate: photo.owner_datecreate,
                        tags: photo.tags,
                        machine_tags: photo.machine_tags,
                        geo: photo.geo
                    };

                    // console.log(data);

                    if (!photoExists(searchTerm, filename)) {
                        downloadPromises.push(downloadPhoto(bestURL));
                        fs.appendFileSync(searchTerm + '.json', JSON.stringify(data) + ',');
                        photosSaved++;
                    } else {
                        console.log(`Skipping file (exists): ${filename}`);
                    }
                }
            }
        }
        console.log('Photos saved to file: ' + photosSaved);
        console.log('Downloading ' + downloadPromises.length + ' photos');

        return await Promise.all(downloadPromises);
    }
}

function photoExists(searchTerm, filename) {
    let flag = true;
    try {
        fs.accessSync(`./images/${searchTerm}/${filename}`, fs.F_OK);
    } catch(e) {
        flag = false;
    }
    return flag;
}

// Requests a page of results from the server
async function requestPage(number, startTime, endTime) {
    try {
        const searchURL = `https://api.flickr.com/services/rest?sort=${sort}&view_all=1&parse_tags=1&content_type=7&extras=geo%2Ctags%2Cmachine_tags%2Cdate_taken%2Cowner_datecreate%2Cispro%2Cdate_upload%2Ccan_comment%2Ccount_comments%2Ccount_faves%2Cdescription%2Cisfavorite%2Clicense%2Cmedia%2Cneeds_interstitial%2Cowner_name%2Cpath_alias%2Crealname%2Crotation%2Curl_o%2Curl_k%2Curl_h%2Curl_l%2Curl_c%2Curl_z%2Curl_m&per_page=${perPage}&page=${number}&lang=en-US&safe_search=3&view_all=1&min_upload_date=${startTime}&max_upload_date=${endTime}&media=photos&text=${searchTerm}&viewerNSID=&method=flickr.photos.search&csrf=&api_key=${apiKey}&format=json&hermes=1&hermesClient=1&reqId=b1cade4b&nojsoncallback=1`;
        // console.log(searchURL);
        const rawResult = await axios.get(searchURL),
            result = rawResult.data;

        if (result && result.photos) {
            resetErrorCount();
            return [
                result.photos.photo,
                result.photos.pages,
                result.photos.total
            ];
        } else {
            if (result) {

                console.log(result);

                // if the API key is invalid, get a new one
                if (result.code === 100) {
                    if (await handleError('The API key is invalid/expired')) {
                        apiKey = await getAPIKey(sandbox);
                        return await requestPage(number, startTime, endTime);
                    } else {
                        return [];
                    }
                }

            } else {
                console.log('No result from server');
            }
            
            resetErrorCount();
            return [[], 0, 0];
        }
    } catch (err) {
        if (await handleError(`Requesting page ${number} of range ${formatDate(startTime)} (${startTime}) - ${formatDate(endTime)} (${endTime})`)) {
            return await requestPage(number, startTime, endTime);
        } else {
            return [];
        }
    }
}