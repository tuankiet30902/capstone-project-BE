const {adminDomain} = require('../../../utils/setting');
const maps = [
    {
        key: "DispatchOutgoing",
        path: "odb",
        js: [
            "/modules/office/outgoing_dispatch/filter.js",
            "/modules/office/outgoing_dispatch/service.js",
            "/modules/office/outgoing_dispatch/controller.js",
        ],
        html: "/modules/office/outgoing_dispatch/views/outgoing_dispatch.html",
        rule: ["Office.DispatchOutgoing.Use"],
        icon: '<i class="fas fa-signature"></i>',
        canStick: true,
    },
    {
        key: "ODBDetails",
        path: "odb-details",
        js: [
            "/modules/office/outgoing_dispatch/directive.js",
            "/modules/office/outgoing_dispatch/details/service.js",
            "/modules/office/outgoing_dispatch/details/controller.js",
        ],
        html: "/modules/office/outgoing_dispatch/details/views/details.html",
        rule: ["Authorized"],
        icon: '<i class="cui-graph"></i>',
    },
    {
        key: "ODBDetailsByCode",
        path: "odb/:code",
        js: [
            "/modules/office/outgoing_dispatch/directive.js",
            "/modules/office/outgoing_dispatch/details/service.js",
            "/modules/office/outgoing_dispatch/details/controller.js",
        ],
        html: "/modules/office/outgoing_dispatch/details/views/details.html",
        rule: ["Authorized"],
        icon: '<i class="cui-graph"></i>',
    },
];

module.exports = (function() {
    var temp = [];
    for (let i in maps) {
        for (let j in maps[i].js) {
            maps[i].js[j] = adminDomain + maps[i].js[j];
        }
        maps[i].html = adminDomain + maps[i].html;
        if(maps[i].toolbar){
            for(let j in maps[i].toolbar.js){
                maps[i].toolbar.js[j] = adminDomain + maps[i].toolbar.js[j];
            }
            maps[i].toolbar.html = adminDomain + maps[i].toolbar.html;
        }
        temp.push(maps[i]);
    }
    return temp;
})()
