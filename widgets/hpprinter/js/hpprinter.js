/*
    ioBroker.vis hpprinter Widget-Set

    version: "0.0.1"

    Copyright 2021 Richard r.treichl@gmail.com
*/
"use strict";

// add translations for edit mode
$.extend(
    true,
    systemDictionary,
    {
        // Add your translations here, e.g.:
        // "size": {
        // 	"en": "Size",
        // 	"de": "Größe",
        // 	"ru": "Размер",
        // 	"pt": "Tamanho",
        // 	"nl": "Grootte",
        // 	"fr": "Taille",
        // 	"it": "Dimensione",
        // 	"es": "Talla",
        // 	"pl": "Rozmiar",
        // 	"zh-cn": "尺寸"
        // }
    }
);

// this code can be placed directly in hpprinter.html
vis.binds["hpprinter"] = {
    version: "0.0.1",
    showVersion: function () {
        if (vis.binds["hpprinter"].version) {
            console.log("Version hpprinter: " + vis.binds["hpprinter"].version);
            vis.binds["hpprinter"].version = null;
        }
    },
    createWidget: function (widgetID, view, data, style) {
        var $div = $("#" + widgetID);
        // if nothing found => wait
        if (!$div.length) {
            return setTimeout(function () {
                vis.binds["hpprinter"].createWidget(widgetID, view, data, style);
            }, 100);
        }

        var text = "";
        text += '<div class="hpprinter-cartridge-class" style="position:relative; width:100px; height:100px; width:100px; height:100px;">';
        text += '<img style="position: relative; z-index: 2; width:100px; height:100px;" src="widgets/hpprinter/img/cartridge.png" />';
        text += '<div class="hpprinter-fuel-class" style="position: absolute; z-index: 1; left: 0; top: 0; width: 40px; height: 59px; margin-left: 25px; margin-top: 20px;">';
        text += '</div></div>';

        $("#" + widgetID).html(text);

        var test = $("#" + widgetID).find(".hpprinter-fuel-class");

        var gradient = "linear-gradient(0deg, " + data.myColor + " " + vis.states[data.attr('oid') + '.val'] + "%, dimgray " + vis.states[data.attr('oid') + '.val'] + "%)";

        test.css({"background": gradient});

        // subscribe on updates of value
        function onChange(e, newVal, oldVal) {
            var test = $div.find(".hpprinter-fuel-class").css("background");
            test = test.replace(oldVal + "%,", newVal + "%,");
            test = test.replace(oldVal + "%)", newVal + "%)");
            $div.find(".hpprinter-fuel-class").css({"background": test});
        }
        if (data.oid) {
            vis.states.bind(data.oid + ".val", onChange);
            //remember bound state that vis can release if didnt needed
            $div.data("bound", [data.oid + ".val"]);
            //remember onchange handler to release bound states
            $div.data("bindHandler", onChange);
        }

        vis.states.bind(data.oid + 'val', onChange);
    }
};

vis.binds["hpprinter"].showVersion();
