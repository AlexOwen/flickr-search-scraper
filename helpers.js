let errorCount = 0,
    maxErrors = 10;

module.exports = {
    sleep,
    formatDate,
    getFilenameFromURL,
    handleError,
    resetErrorCount
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function formatDate(unixTime) {
    return new Date(unixTime * 1000).toUTCString();
}

function getFilenameFromURL(url) {
    return url.split('/')[url.split('/').length - 1].split('?')[0];
}

async function handleError(text) {
    console.log('An error occurred: ' + text);
    errorCount++;

    if (errorCount < maxErrors) {
        console.log('Retrying in ' + errorCount * 3 + 's');
        await sleep(errorCount * 30);
        return true;
    } else {
        console.log(`Too many consecutive errors (${errorCount}). Retry later.`);
        return false;
    }
}

function resetErrorCount() {
    errorCount = 0;
}