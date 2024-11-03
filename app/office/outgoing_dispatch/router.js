const express = require('express');
const router = express.Router();
const { ODBController } = require('./controller');
const { validation } = require('./validation');
const { PermissionProvider } = require('../../../shared/permission/permission.provider');
const { statusHTTP } = require('../../../utils/setting');
const { Router } = require('../../../shared/router/router.provider');
const {MultiTenant} = require('../../../shared/multi_tenant/provider');
const CommonUtils = require("../../../utils/util");
const FromDataMiddleware = require("@shared/middleware/form-data");

const OUTGOING_DISPATCH = require('./const');


router.post('/get_number',MultiTenant.match({module_key:["office"]}), PermissionProvider.check(["Office.DispatchArrived.Use"]) ,validation.get_number,Router.trycatchFunction("post/outgoing_dispatch/get_number", function (req, res) {
    return function () {
        ODBController.getNumber(req.body).then(function (data) {
            res.send({ number: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/outgoing_dispatch/get_number", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post(
    "/loadDetail",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Office.DispatchArrived.Use"]),
    validation.load_detail,
    Router.trycatchFunction("post/outgoing_dispatch/loadDetail", function (req, res) {
        return function () {
            ODBController.loadDetail(CommonUtils.getDbNamePrefix(req), req.body).then(
                function (data) {
                    res.send(data);
                    res.end();
                    data = undefined;
                    res = undefined;
                    req = undefined;
                    return;
                },
                function (err) {
                    res.status(statusHTTP.internalServer);
                    Router.LogAndMessage(res, "post/outgoing_dispatch/loadDetail", err);
                    res.end();
                    err = undefined;
                    res = undefined;
                    req = undefined;
                    return;
                },
            );
        };
    }),
);

router.post('/load',MultiTenant.match({module_key:["office"]}), PermissionProvider.check(["Authorized"]) ,validation.load,Router.trycatchFunction("post/outgoing_dispatch/load", function (req, res) {
    return function () {
        ODBController.load(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/outgoing_dispatch/load", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/count',MultiTenant.match({module_key:["office"]}), PermissionProvider.check(["Authorized"]) ,validation.count,Router.trycatchFunction("post/outgoing_dispatch/count", function (req, res) {
    return function () {
        ODBController.count(req.body).then(function (data) {
            res.send({ count: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/outgoing_dispatch/count", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post(
    "/loadfileinfo",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.loadFileInfo,
    Router.trycatchFunction("post/outgoing_dispatch/loadfileinfo", function (req, res) {
        return function () {
            const dbPrefix = CommonUtils.getDbNamePrefix(req);

            ODBController.loadFileInfo(dbPrefix, req.body.session, req.body.id, req.body.filename).then(
                function (data) {
                    res.send(data);
                    res.end();
                },
                function (err) {
                    res.status(statusHTTP.internalServer);
                    Router.LogAndMessage(res, "post/outgoing_dispatch/loadfileinfo", err);
                    res.end();
                },
            );
        };
    }),
);

router.post('/update',
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.update,
    Router.trycatchFunction("post/outgoing_dispatch/update", function (req, res) {
        return function () {
            ODBController.update(CommonUtils.getDbNamePrefix(req), req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }).catch(err => {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/outgoing_dispatch/update", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    })
);

router.post('/update-references',
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.updateReferences,
    Router.trycatchFunction("post/outgoing_dispatch/update-references", function (req, res) {
        return function () {
            ODBController.updateReferences(CommonUtils.getDbNamePrefix(req), req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }).catch(err => {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/outgoing_dispatch/update-references", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    })
);


router.post('/release',
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.release,
    Router.trycatchFunction("post/outgoing_dispatch/release", function (req, res) {
        return function () {
            ODBController.release(CommonUtils.getDbNamePrefix(req), req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }).catch(err => {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/outgoing_dispatch/release", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    })
);

router.post('/loadArchivedDocument',
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.load_by_code,
    Router.trycatchFunction("post/outgoing_dispatch/loadArchivedDocument", function (req, res) {
        return function () {
            ODBController.loadArchivedDocument(CommonUtils.getDbNamePrefix(req), req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }).catch(err => {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/outgoing_dispatch/loadArchivedDocument", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    })
);

router.post('/insertSepatate',
    MultiTenant.match({ module_key: ['office'] }),
    PermissionProvider.check(['Authorized']),
    FromDataMiddleware(OUTGOING_DISPATCH.NAME_LIB, undefined, undefined, OUTGOING_DISPATCH.PARENT_FOLDER),
    Router.trycatchFunction("post/outgoing_dispatch/insertSepatate", function (req, res) {
        return function () {
            ODBController.insertSeparatelyOutgoingDispatch(CommonUtils.getDbNamePrefix(req), req.body.session, req.formData).then(
                function (data) {
                    res.send(data);
                    res.end();
                    data = undefined;
                    res = undefined;
                    req = undefined;
                    return;
                },
                function (err) {
                    res.status(statusHTTP.internalServer);
                    Router.LogAndMessage(res, "post/outgoing_dispatch/insertSepatate", err);
                    res.end();
                    err = undefined;
                    res = undefined;
                    req = undefined;
                    return;
                }
            );
        }
    })
);


module.exports = router;
