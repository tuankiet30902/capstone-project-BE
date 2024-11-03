const express = require('express');
const router = express.Router();
const { MeetingRoomController } = require('./controller');
const { validation } = require('./validation');
const { PermissionProvider } = require('../../../shared/permission/permission.provider');
const { statusHTTP } = require('../../../utils/setting');
const { Router } = require('../../../shared/router/router.provider');
const { MultiTenant } = require('../../../shared/multi_tenant/provider');
const { ROOM_RULE } = require('./const');

router.post(
    "/register",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Office.MeetingRoomSchedule.register"]),
    Router.trycatchFunction("post/office/meeting_room_schedule/register", function (req, res) {
        return function () {
            MeetingRoomController.register(req).then(
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
                    Router.LogAndMessage(res, "post/office/meeting_room_schedule/register", err);
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

router.post('/load',
    MultiTenant.match(),
    PermissionProvider.check(["Office.MeetingRoomSchedule.Use"]),
    validation.load,
    Router.trycatchFunction("post/office/meeting_room/load", function (req, res) {
        return function () {
            MeetingRoomController.load(req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }, function (err) {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/office/meeting_room/load", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
}));

router.post('/export-excel',
    MultiTenant.match(),
    PermissionProvider.check(["Office.MeetingRoomSchedule.Use"]),
    validation.export_excel,
    Router.trycatchFunction("post/office/meeting_room/export-excel", function (req, res) {
        return function () {
            MeetingRoomController.export_excel(req.body).then(function (data) {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="CarManagement.xlsx"');
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }, function (err) {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/office/meeting_room/export-excel", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
}));

router.post('/count',
    MultiTenant.match(),
    PermissionProvider.check(["Office.MeetingRoomSchedule.Use"]),
    validation.count,
    Router.trycatchFunction("post/office/meeting_room/count", function (req, res) {
        return function () {
            MeetingRoomController.count(req.body).then(function (data) {
                res.send({ count: data });
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }, function (err) {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/office/meeting_room/count", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    }));

router.post('/delete_registered',
    MultiTenant.match(),
    PermissionProvider.check(["Office.MeetingRoomSchedule.register", "Office.RoomSchedule.ApprovalDepartment"]),
    validation.deleteRegistered,
    Router.trycatchFunction("post/office/meeting_room/delete_registered", function (req, res) {
        return function () {
            MeetingRoomController.deleteRegistered(req.body).then(function (data) {
                res.send(data);
                res.end();
                data = undefined;
                res = undefined;
                req = undefined;
                return;
            }, function (err) {
                res.status(statusHTTP.internalServer);
                Router.LogAndMessage(res, "post/office/meeting_room/delete_registered", err);
                res.end();
                err = undefined;
                res = undefined;
                req = undefined;
                return;
            });
        }
    }));

router.post(
    "/load_detail_for_update",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([
        "Office.MeetingRoomSchedule.register",
        "Office.MeetingRoomSchedule.Use",
        "Office.RoomSchedule.ApprovalDepartment",
        "Office.LectureHallClassroom.Approval",
        "Office.LectureHallClassroom.Confirm",
        "Office.MeetingRoomSchedule.Approval",
        "Office.MeetingRoomSchedule.Confirm",
        "Office.RoomSchedule.Manange"
    ]),
    validation.loadDetailForUpdate,
    Router.trycatchFunction("post/office/meeting_room/load_detail_for_update", function (req, res) {
        return function () {
            MeetingRoomController.loadDetailForUpdate(req.body).then(
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
                    Router.LogAndMessage(res, "post/office/meeting_room/load_detail_for_update", err);
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

router.post(
    "/load_detail_registered",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Office.MeetingRoomSchedule.register","Office.MeetingRoomSchedule.Approval", "Office.LectureHallClassroom.Approval"]),
    validation.loadDetailForUpdate,
    Router.trycatchFunction("post/office/meeting_room/load_detail_registered", function (req, res) {
        return function () {
            MeetingRoomController.loadDetailRegistered(req.body).then(
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
                    Router.LogAndMessage(res, "post/office/meeting_room/load_detail_registered", err);
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

router.post(
    "/update_registered",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Office.MeetingRoomSchedule.register", "Office.RoomSchedule.ApprovalDepartment"]),
    Router.trycatchFunction("post/office/meeting_room/update_registered", function (req, res) {
        return function () {
            MeetingRoomController.updateRegistered(req).then(
                function (data) {
                    res.send(data);
                    res.end();
                    data = undefined;
                    res = undefined;
                    req = undefined;
                    return;
                },
                function (err) {
                    console.log(err.message);
                    res.status(statusHTTP.internalServer);
                    Router.LogAndMessage(res, "post/office/meeting_room/update_registered", err);
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

router.post(
    "/change_status",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([
        "Office.MeetingRoomSchedule.Approval",
        "Office.LectureHallClassroom.Approval",
        "Office.MeetingRoomSchedule.Confirm",
        "Office.LectureHallClassroom.Confirm",
        "Office.MeetingRoomSchedule.Cancel",
        "Office.LectureHallClassroom.Cancel",
        "Office.MeetingRoomSchedule.Reject",
        "Office.LectureHallClassroom.Reject",
    ]),
    validation.changeStatus,
    Router.trycatchFunction("post/office/meeting_room/change_status", function (req, res) {
        return function () {
            MeetingRoomController.changeStatus(req.body).then(
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
                    Router.LogAndMessage(res, "post/office/meeting_room/change_status", err);
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

router.post(
    "/approve_department",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([ROOM_RULE.APPROVE_LEVEL_DEPARTMENT]),
    Router.trycatchFunction("post/office/meeting_room/approve_department", function (req, res) {
        return function () {
            MeetingRoomController.approve_department(req).then(
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
                    Router.LogAndMessage(res, "post/office/meeting_room/accept_schedule_room", err);
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

router.post( "/reject_department",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([ROOM_RULE.APPROVE_LEVEL_DEPARTMENT]),
    validation.reject_department, 
    Router.trycatchFunction("office/meeting_room/reject_department", function  (req, res) {
        return function () {
            MeetingRoomController.reject_department(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_department", err);
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

router.post( "/approve_management",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.approve_management, 
    Router.trycatchFunction("office/meeting_room/approve_management", function  (req, res) {
        return function () {
            MeetingRoomController.approve_management(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/approve_management", err);
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

router.post( "/reject_management",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.reject_management, 
    Router.trycatchFunction("office/meeting_room/reject_management", function  (req, res) {
        return function () {
            MeetingRoomController.reject_management(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_management", err);
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

router.post( "/approve_lead",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.approve_lead, 
    Router.trycatchFunction("office/meeting_room/approve_lead", function  (req, res) {
        return function () {
            MeetingRoomController.approve_lead(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/approve_lead", err);
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

router.post( "/reject_lead",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.reject_lead, 
    Router.trycatchFunction("office/meeting_room/reject_lead", function  (req, res) {
        return function () {
            MeetingRoomController.reject_lead(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_lead", err);
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

router.post( "/request_cancel",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.request_cancel, 
    Router.trycatchFunction("office/meeting_room/request_cancel", function  (req, res) {
        return function () {
            MeetingRoomController.request_cancel(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/request_cancel", err);
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

//recall
router.post( "/approve_recall_department",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([ROOM_RULE.APPROVE_LEVEL_DEPARTMENT]),
    validation.approve_recall_department, 
    Router.trycatchFunction("office/meeting_room/approve_recall_department", function  (req, res) {
        return function () {
            MeetingRoomController.approve_recall_department(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/approve_recall_department", err);
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

router.post( "/reject_recall_department",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check([ROOM_RULE.APPROVE_LEVEL_DEPARTMENT]),
    validation.reject_recall_department, 
    Router.trycatchFunction("office/meeting_room/reject_recall_department", function  (req, res) {
        return function () {
            MeetingRoomController.reject_recall_department(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_recall_department", err);
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

router.post( "/approve_recall_management",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.approve_recall_management, 
    Router.trycatchFunction("office/meeting_room/approve_recall_management", function  (req, res) {
        return function () {
            MeetingRoomController.approve_recall_management(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/approve_recall_management", err);
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

router.post( "/reject_recall_management",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.reject_recall_management, 
    Router.trycatchFunction("office/meeting_room/reject_recall_management", function  (req, res) {
        return function () {
            MeetingRoomController.reject_recall_management(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_recall_management", err);
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

router.post( "/approve_recall_lead",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.approve_recall_lead, 
    Router.trycatchFunction("office/meeting_room/approve_recall_lead", function  (req, res) {
        return function () {
            MeetingRoomController.approve_recall_lead(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/approve_recall_lead", err);
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

router.post( "/reject_recall_lead",
    MultiTenant.match({ module_key: ["office"] }),
    PermissionProvider.check(["Authorized"]),
    validation.reject_recall_lead, 
    Router.trycatchFunction("office/meeting_room/reject_recall_lead", function  (req, res) {
        return function () {
            MeetingRoomController.reject_recall_lead(req).then(
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
                    Router.LogAndMessage(res, "post/meeting_room/reject_recall_lead", err);
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

router.post('/load_schedule',
    MultiTenant.match(),
    PermissionProvider.check([
        "Office.MeetingRoom.Use",
        "Office.MeetingRoomSchedule.Use",
        "Office.MeetingRoomSchedule.Approval",
        "Office.LectureHallClassroom.Approval"
    ]),
    Router.trycatchFunction("post/office/meeting_room/load_schedule", function (req, res) {
    return function () {
        MeetingRoomController.loadSchedule(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/office/meeting_room/load_schedule", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post(
    '/load_quick_handle',
    MultiTenant.match({ module_key: ['office'] }),
    PermissionProvider.check(['Authorized']),
    validation.load_quick_handle,
    Router.trycatchFunction('post/meeting_room/load_quick_handle', function (req, res) {
        return function () {
            MeetingRoomController.load_quick_handle(req.body).then(
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
                    Router.LogAndMessage(res, 'post/meeting_room/load_quick_handle', err);
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

router.post('/count_quick_handle',MultiTenant.match({module_key:["office"]}), PermissionProvider.check(["Authorized"]) ,validation.count_quick_handle,Router.trycatchFunction("post/meeting_room/count_quick_handle", function (req, res) {
    return function () {
        MeetingRoomController.count_quick_handle(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/meeting_room/count_quick_handle", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load_file_info',MultiTenant.match({module_key:["office"]}), PermissionProvider.check(["Authorized"]), validation.load_file_info, Router.trycatchFunction("post/meeting_room/load_file_info", function(req, res) {
    return function() {
        MeetingRoomController.load_file_info(req.body).then(function(data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function(err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/meeting_room/load_file_info", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

module.exports = router;
