"use strict";

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
const parseString = require('xml2js').parseString;;
const request = require('request');
const ping = require('ping');

const colorCodeTable = {
    "K": "black",
    "C": "cyan",
    "M": "magenta",
    "Y": "yellow",
}

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1)
}

function ValidateIPaddress(ipaddress) {
    if (/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(ipaddress)) {
        return (true)
    }
    return (false)
}

class Hpprinter extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "hpprinter",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.isConnected = null;
        this.intervalHandle = null;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        if (ValidateIPaddress(this.config.ipaddr)) {
            this.log.info("Printer ip adress: " + this.config.ipaddr);
            if(!(await this.checkConnection(this.config.ipaddr)))
            {
                this.log.error("Printer is not online or reachable");
            }
        }
        else {
            this.log.error("Please configure the hp printer adapter");
            return;
        }

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */

        for (var key in colorCodeTable) {
            await this.setObjectNotExistsAsync(colorCodeTable[key], {
                type: "channel",
                common: {
                    name: colorCodeTable[key].capitalize() + " color information",
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(colorCodeTable[key] + ".cartridgetype", {
                type: "state",
                common: {
                    name: colorCodeTable[key].capitalize() + " cartridge type",
                    role: "info.name",
                    type: "string",
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(colorCodeTable[key] + ".cartridgelevel", {
                type: "state",
                common: {
                    name: colorCodeTable[key].capitalize() + " cartridge ink level",
                    role: "value.fill",
                    type: "number",
                    min: 0,
                    max: 100,
                    def: 0,
                    unit: "%",
                    read: true,
                    write: false,
                },
                native: {},
            });
        }

        var model = await this.getPrinterModel(this.config.ipaddr);

        await this.setState("info.model", { val: model, ack: true });

        await this.setState("info.ip", { val: this.config.ipaddr, ack: true });

        await this.updateCartRidgeStates(this.config.ipaddr);

        this.intervalHandle = setInterval(this.updateCartRidgeStates.bind(this), 60000 * 10, this.config.ipaddr);


    }

    async updateCartRidgeStates(_ipaddr)
    {
        var cartridge = await this.getcartridgeStates(_ipaddr);

        if (cartridge != null) {

            for (const [key, value] of Object.entries(cartridge)) {
                await this.setState(colorCodeTable[key] + ".cartridgelevel", { val: value.level, ack: true });
                await this.setState(colorCodeTable[key] + ".cartridgetype", { val: value.type, ack: true });
            }

            let cartRidgeSeries = cartridge[Object.keys(cartridge)[0]].series;

            await this.setState("info.cartridgeseries", { val: cartRidgeSeries, ack: true });
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearInterval(this.intervalHandle);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    setConnected(_isConnected) {
        if (this.isConnected !== _isConnected) {
            this.isConnected = _isConnected;
            this.setState('info.connection', {val: this.isConnected, ack: true});
        }
    }

    async checkConnection(_ipaddr) {
        let res = await ping.promise.probe(_ipaddr);
        if (!res) {
            this.log.error("Something went wrong druing printer ping!");
            return false;
        }
        else {
            this.setConnected(res.alive);
            return true;
        }
    }

    //fetch URL with request
    getURL(_url) {
        return new Promise((resolve, reject) => {
            request(_url, (error, response, body) => {
                if (error)
                    reject(error);
                if (response.statusCode != 200) {
                    reject('Invalaid status code <' + response.statusCode + '>');
                }
                resolve(body);
            });
        });
    }

    //pares XML to JS
    parseXml(_xml) {
        return new Promise((resolve, reject) => {
            parseString(_xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async getPrinterModel(_ipaddr) {
        var url = "http://" + _ipaddr + "/DevMgmt/ProductConfigDyn.xml";
        var body = await this.getURL(url);
        body = body.replace(/prdcfgdyn2:/g, '');
        body = body.replace(/prdcfgdyn:/g, '');
        body = body.replace(/dd:/g, '');
        try {
            let result = await this.parseXml(body);
            let model = result.ProductConfigDyn.ProductInformation[0].MakeAndModel[0].split(/[ ,]+/).pop();
            this.log.info(model);
            return model;
        }
        catch (e) {
            this.log.error(`Unexpected or malformed discovery response: ${result}.`);
            return null;
        }
    }

    async getcartridgeStates(_ipaddr) {
        var url = "http://" + _ipaddr + "/DevMgmt/ConsumableConfigDyn.xml";
        var body = await this.getURL(url);
        body = body.replace(/ccdyn:/g, '');
        body = body.replace(/dd:/g, '');

        var ret = {};

        try {
            var result = await this.parseXml(body);
            for (const [key, value] of Object.entries(result.ConsumableConfigDyn.ConsumableInfo)) {
                let colorCode = value.ConsumableLabelCode[0];
                let remainingLevel = value.ConsumablePercentageLevelRemaining[0];
                let partNumber = value.ProductNumber[0];
                let cartRidgeSeries = value.ConsumableSelectibilityNumber[0];

                this.log.info("Printer Level " + colorCodeTable[colorCode] + " " + remainingLevel + " Partnumber: " + partNumber);

                ret[colorCode] = {
                    "type": partNumber,
                    "level": remainingLevel,
                    "series": cartRidgeSeries
                };
            }
            this.log.info("Printer cartridge series: " + ret[Object.keys(ret)[0]].series);
            return ret;
        }
        catch (e) {
            this.log.error(`Unexpected or malformed discovery response: ${result}.`);
            return null;
        }


    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Hpprinter(options);
} else {
    // otherwise start the instance directly
    new Hpprinter();
}