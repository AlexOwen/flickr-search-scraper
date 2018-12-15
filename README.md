This is a quick script to capture a JSON file of all search results for a given search term, along with the best version of each image in the search.

The JSON file contains as much meta data as I can get from the raw API, more can be got by calling the API for each photo (rather than each page of results), but that would put a lot of stress on the server and might get your key/IP banned.

Images are saved to ./images/search_term/

The script is used by typing `npm run start "search_term"`

You can add "no-sandbox" as the final argument if you are running on a headless Linux box and don't want to set up sandboxing as described here: https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md

The script will automatically retrieve an API key, and renew it mid-job if it expires.

The resulting JSON file needs to have a [ added at the start and ] at the end manually.

parents.json is a sample output.

NOTE: This is largely untested, and I can't guarantee Flickr won't rate limit/ban you. It also probably violates their terms of service.

TODO: Re-add resume functionality.