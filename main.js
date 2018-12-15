/*
 * This is a quick script to capture a JSON file of all search results for a given search term.
 * The resulting JSON file could be used for scraping the photos directly. This functionality is not contained in this script.
 * 
 * The script is used by typing `npm run start "search_term" "api_key"`
 * 
 * An API key can be obtained without logging in by opening the Network tab in Chrome dev tools, running a search on Flickr, then finding the request to api.flickr.com/rest and the parameter in that request called api_key
 * 
 * The resulting JSON file needs to have a [ added at the start and ] at the end manually.
 * 
 * NOTE: This is largely untested, and I can't guarantee Flickr won't rate limit/ban you. It also probably violates their terms of service.
 */

const axios = require('axios'),
    fs = require('fs');

const sort = 'date-posted-asc',
      perPage = 50,
      searchTerm = process.argv[2],
      apiKey = process.argv[3];

let errorCount = 0;

// Requests a page from the server
const requestPage = async (number) => {
    try {
        const rawResult = await axios.get(`https://api.flickr.com/services/rest?sort=${sort}&parse_tags=1&content_type=7&extras=date_taken%2Cowner_datecreate%2Cispro%2Cdate_upload%2Ccan_comment%2Ccount_comments%2Ccount_faves%2Cdescription%2Cisfavorite%2Clicense%2Cmedia%2Cneeds_interstitial%2Cowner_name%2Cpath_alias%2Crealname%2Crotation%2Curl_o%2Curl_k%2Curl_h%2Curl_l%2Curl_c%2Curl_z%2Curl_m&per_page=${perPage}&page=${number}&lang=en-US&safe_search=1&view_all=1&min_upload_date=0&max_upload_date=${Date.now()/1000}&media=photos&text=${searchTerm}&viewerNSID=&method=flickr.photos.search&csrf=&api_key=${apiKey}&format=json&hermes=1&hermesClient=1&reqId=b1cade4b&nojsoncallback=1`),
              result = rawResult.data;
        
        return [
            result.photos.photo,
            result.photos.pages
        ];
    } catch (err) { 
        console.log(err);
        return [];
    }
};

// Parses out all the data we want from the current page and saves it to a .json file in the current directory
const parsePage = (photos) => {
    for (let photo of photos) {
        if (photo.ispro === 0) {                // Only save photos that aren't on pro accounts
            let bestURL = '';
            let height = 0,
                width = 0;

            if (photo.url_o_cdn) {              // original
                bestURL = photo.url_o_cdn;
                if (photo.height_o) height = photo.height_o;
                if (photo.width_o) width = photo.width_o;
            } else if (photo.url_k_cdn) {       // large 2048
                bestURL = photo.url_k_cdn;
                if (photo.height_n) height = photo.height_n;
                if (photo.width_n) width = photo.width_n;
            } else if (photo.url_h_cdn) {       // large 1600
                bestURL = photo.url_h_cdn;
                if (photo.height_h) height = photo.height_h;
                if (photo.width_h) width = photo.width_h;
            } else if (photo.url_l_cdn) {       // large 1024
                bestURL = photo.url_l_cdn;
                if (photo.height_l) height = photo.height_l;
                if (photo.width_l) width = photo.width_l;
            } else if (photo.url_c_cdn) {       // medium 800
                bestURL = photo.url_c_cdn;
                if (photo.height_c) height = photo.height_c;
                if (photo.width_c) width = photo.width_c;
            } else if (photo.url_z_cdn) {       // medium 640
                bestURL = photo.url_z_cdn;
                if (photo.height_z) height = photo.height_z;
                if (photo.width_z) width = photo.width_z;
            } else if (photo.url_m_cdn) {       // medium 500
                bestURL = photo.url_m_cdn;
                if (photo.height_m) height = photo.height_m;
                if (photo.width_m) width = photo.width_m;
            }

            const data = {
                url: bestURL,
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
                dateCreate: photo.owner_datecreate
            };

            console.log(data);
            fs.appendFileSync(searchTerm + '.json', JSON.stringify(data) + ',');
        }
    }
};

(async () => {
    let [photos, pages] = await requestPage(1);
    console.log('Pages to fetch: ' + pages)
    console.log('Total results: ' + photos.length);

    parsePage(photos);                              // first page

    if (pages >= 2) {
        for (let n = 2; n < pages; n++) {           // the rest of the pages 
            console.log('Requesting page ' + n);

            const [photos, newPages] = await requestPage(n);

            if (photos && newPages) {
                errorCount = 0;
                pages = newPages;
                parsePage(photos);
                console.log('Parsed page ' + n + ' of ' + newPages);
            } else {
                console.log('An error occurred');
                errorCount++;

                if (errorCount < 5) {
                    console.log('Retrying in ' + errorCount * 3 + 's');
                    n--;
                    await sleep(errorCount * 3000);
                } else {
                    break;
                }
            }
        }
    }

})();