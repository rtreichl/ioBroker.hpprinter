// bringt den <span class="posthilit">Druckertintenstand</span> von WEB enabled HP Tintenstrahler in ioBroker
// Basierend auf CCU2 Script fuer HP Drucker http://homematic-forum.de/forum/viewtop ... 31&amp;t=25140
// und dem angepassten Script von PiX aus iobroker http://forum.iobroker.de/viewtopic.php? ... c289#p6931
// Author : looxer01 - 22.12.2015
const parseString = require('xml2js').parseString;;
const request = require('request');

function getURL(url) {
    return new Promise((resolve, reject) => {
        request(url, (error, response, body) => {
            if (error)
                reject(error);
            if (response.statusCode != 200) {
                reject('Invalaid status code <' + response.statusCode + '>');
            }
            resolve(body);
        });
    });
}

function parseXml(xml) {
    return new Promise((resolve, reject) => {
        parseString(xml, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function getPrinterModel(ipaddr) {
    var url = "http://" + ipaddr + "/DevMgmt/ProductConfigDyn.xml";
    var body = await getURL(url);
    body = body.replace(/prdcfgdyn2:/g, '');
    body = body.replace(/prdcfgdyn:/g, '');
    body = body.replace(/dd:/g, '');
    try {
        let result = await parseXml(body);
        let model = result.ProductConfigDyn.ProductInformation[0].MakeAndModel[0].split(/[ ,]+/).pop();
        log(model, "info");
        return model;
    }
    catch (e) {
        log(`Unexpected or malformed discovery response: ${result}.`, "error");
        return null;
    }
}

function getCardridgeStates(colorCode) {
    var url = "http://" + ipaddr + "/DevMgmt/ConsumableConfigDyn.xml";;
    request(druckerConsumableURL, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = body.replace(/ccdyn:/g, '');
            body = body.replace(/dd:/g, '');
            parseString(body, (err, result) => {
                if (!err) {
                    try {
                        for (key in result.ConsumableConfigDyn.ConsumableInfo) {
                            let cardRidge = result.ConsumableConfigDyn.ConsumableInfo[key];
                            let colorCode = cardRidge.ConsumableLabelCode[0];
                            let remainingLevel = cardRidge.ConsumablePercentageLevelRemaining[0];
                            let partNumber = cardRidge.ProductNumber[0];

                            log('Printer Level ' + colorCodeTable[colorCode] + ' ' + remainingLevel + ' Partnumber: ' + partNumber, "info");

                            setState('javascript.0.Printer.HP.' + druckermod + '.' + colorCodeTable[colorCode] + '.Level', remainingLevel);
                            setState('javascript.0.Printer.HP.' + druckermod + '.' + colorCodeTable[colorCode] + '.Ink', partNumber);

                        }
                        let cardRidgeType = result.ConsumableConfigDyn.ConsumableInfo[0].ConsumableSelectibilityNumber[0];
                        setState('javascript.0.Printer.HP.' + druckermod + '.InkType', cardRidgeType);
                    }
                    catch (e) {
                        log(`Unexpected or malformed discovery response: ${result}.`, "error");
                    }
                }
                else {
                    log("Error parsing!", "error");
                }
            });
        }

    }); // end of request
}