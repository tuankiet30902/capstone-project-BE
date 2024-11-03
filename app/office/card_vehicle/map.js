const { adminDomain } = require("../../../utils/setting");
const maps = [
    {
        key: "CardVehical",
        path: "card-vehicle",
        js: [
            "/modules/office/card_vehicle/card_vehicle.service.js",
            "/modules/office/card_vehicle/card_vehicle.controller.js",
        ],
        html: "/modules/office/card_vehicle/views/card_vehicle.html",
        rule: ["Office.CardVehical.Use"],
        icon: '<i class="fa fa-file-contract"></i>',
        canStick: true,
    },
];

module.exports = (function () {
    var temp = [];
    for (let i in maps) {
        for (let j in maps[i].js) {
            maps[i].js[j] = adminDomain + maps[i].js[j];
        }
        maps[i].html = adminDomain + maps[i].html;
        if (maps[i].toolbar) {
            for (let j in maps[i].toolbar.js) {
                maps[i].toolbar.js[j] = adminDomain + maps[i].toolbar.js[j];
            }
            maps[i].toolbar.html = adminDomain + maps[i].toolbar.html;
        }
        temp.push(maps[i]);
    }
    return temp;
})();