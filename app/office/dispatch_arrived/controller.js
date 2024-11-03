const q = require("q");
const { BuildFilterAggregate } = require('./utility');

const BaseError = require("@shared/error/BaseError");
const { removeUnicode } = require('../../../utils/util');
const { FileProvider } = require("../../../shared/file/file.provider");
const { LogProvider } = require("@shared/log_nohierarchy/log.provider");

const { TaskController } = require("@office/task/controller");

const { TaskService } = require("@office/task/service");
const { OrganizationService } = require("@office/organization/organization.service");
const { SettingService } = require("@management/setting/service");

const { DirectoryService } = require("../../management/directory/service");
const { RingBellItemService } = require("../../management/ringbell_item/service");

const { DAService, DepartmentService, EmployeeService, UserService, TaskService: TaskDAService } = require("./service");
const CommonUtil = require("@utils/util");

const FileUtil = require("@utils/fileUtil");
const { ItemSetup } = require("../../../shared/setup/items.const");
const { NAME_LIB, OFFICE_DEPARTMENT_SETTING_KEY, BOARD_OF_DIRECTORS_SETTING_KEY, DISPATCH_FORWARD_TO, LEAD_RULE, CONFIRM_RULE, APPROVE_LEVEL_1_RULE, MANAGE_DISPATCHARRIVED_RULE } = require("./const");

const { DISPATCH_ARRIVED_VIEW_STATUS, DISPATCH_ARRIVED_STATUS, TASK_STATUS } = require("@utils/constant");
const { dbname_prefix } = require("@shared/multi_tenant/pnt-tenant");

const { validation } = require("./validation");
const nameLib = "dispatch_arrived";
const fieldSearchAr = ["search", "da_book", "priority", "receive_method", "type", "tab"];
const parentFolder = "/office";
const folderArray = ["office"];
const countFilter = function (body) {
    let count = 0;
    for (var i in fieldSearchAr) {
        if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
            count++;
        }
    }
    return count;
};

const genFilter_new = function (body, count, dbPrefix) {
    let dfd = q.defer();
    let result = {};
    let casePermission = "";
    const rules = body.session.rule.filter(e => e.rule === "Office.DispatchArrived.FollowDA");
    if (rules[0]) {
        casePermission = rules[0].details.type;
    } else {
        casePermission = "None";
    }
    switch (casePermission) {
        case "All":
            result = genFilter_All(body, count);
            break;
        case "None":
            result = genFilter_None(body, count, dbPrefix);
            break;
        case "Working":
            result = genFilter_BaseDepartment(body, count, [body.session.employee_details.department], dbPrefix);
            break;
        case "Specific":
            result = genFilter_BaseDepartment(body, count, rules[0].details.department, dbPrefix);
            break;
    }
    result.then(function (filter) {
        dfd.resolve(filter);
    }, function (err) {
        dfd.reject(err);
    });
    return dfd.promise;
}

const genFilter_All = function (body, count) {
    let dfd = q.defer();
    if (count === 1) {
        let filter = {};
        switch (body.tab) {
            case "created":
                filter = { username: { $eq: body.username } };
                break;
            case "all":
                filter = {};
                break;
            case "need_to_handle":
                filter = {};
                break;
            case "forwarded":
                filter = {
                    event: {
                        $elemMatch: {
                            username: body.username,
                            action: "HandlingAndForward",
                        },
                    },
                };
                break;
        }
        dfd.resolve(filter);
        return dfd.promise;
    }

    let filter = { $and: [] };
    for (const i in fieldSearchAr) {
        if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
            switch (fieldSearchAr[i]) {
                case "tab":
                    switch (body.tab) {
                        case "created":
                            filter.$and.push({ username: { $eq: body.username } });
                            break;
                        case "all":
                            filter.$and.push({ _id: { $ne: false } });
                            break;
                        case "need_to_handle":
                            break;
                        case "forwarded":
                            filter.$and.push({
                                event: {
                                    $elemMatch: {
                                        username: body.username,
                                        action: "HandlingAndForward",
                                    },
                                },
                            });
                            break;
                    }
                    break;
                case "search":
                    filter.$and.push({
                        $text: { $search: body[fieldSearchAr[i]] },
                    });
                    break;
                default:
                    let item = {};
                    item[fieldSearchAr[i]] = { $eq: body[fieldSearchAr[i]] };
                    filter.$and.push(item);
            }
        }
    }
    dfd.resolve(filter);
    return dfd.promise;
};

const genFilter_BaseDepartment = function (body, count, departments, dbPrefix) {
    let dfd = q.defer();
    const filterRelatedTask = {
        $or: [
            {
                $and: [
                    {
                        $or: [
                            { main_person: { $eq: body.username } },
                            { participant: { $eq: body.username } },
                            { observer: { $eq: body.username } }
                        ]
                    },
                    {
                        "parents.object": { $eq: "dispatch_arrived" }
                    },
                    {
                        "status": { $in: ["Done", "NotStartedYet", "Processing"] }
                    },
                ]
            },
            {
                $and: [
                    {
                        department: { $eq: departments }

                    },
                    {
                        "parents.object": { $eq: "dispatch_arrived" }
                    },
                    {
                        "status": { $in: ["Done", "NotStartedYet", "Processing", "Completed", "WaitingForAccept"] }
                    },
                ]
            }

        ],

    };


    OrganizationService.justLoadNotHandleAnythingElse(dbPrefix, { departmentLeader: { $eq: body.username } }).then(function (departmentList) {
        let departmentIdList = [];
        if (departmentList && departmentList[0]) {
            for (let i in departmentList) {
                departmentIdList.push(departmentList[i].id);
            }
            filterTask = {
                $or: [
                    filterRelatedTask,
                    {
                        $and: [
                            { status: { $eq: "WaitingForAccept" } },
                            { department: { $in: departmentList } }
                        ]
                    }
                ]
            }
        } else {
            filterTask = filterRelatedTask;
        }

        TaskService.loadList(dbPrefix, filterTask, undefined, undefined, { parents: true }).then(function (taskList) {
            let DAIDList = [];
            for (let i in taskList) {
                for (let j in taskList[i].parents) {
                    if (taskList[i].parents[j].object === "dispatch_arrived") {
                        DAIDList.push(taskList[i].parents[j].id);
                    }
                }
            }
            if (DAIDList[0]) {
                if (departmentIdList[0]) {
                    dfd.resolve(
                        {
                            $or: [
                                { id: { $in: DAIDList } },
                                {
                                    $and: [
                                        { status: { $eq: "Transferred" } },
                                        {
                                            view_only_departments: {
                                                $elemMatch: {
                                                    department: { $in: departmentIdList },
                                                    status: { $eq: "Unread" }
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }

                    );
                } else {
                    dfd.resolve({
                        id: { $in: DAIDList }
                    });
                }
            } else {
                if (departmentIdList[0]) {
                    dfd.resolve(
                        {
                            $and: [
                                { status: { $eq: "Transferred" } },
                                {
                                    view_only_departments: {
                                        $elemMatch: {
                                            department: { $in: departmentIdList },
                                            status: { $eq: "Unread" }
                                        }
                                    }
                                }
                            ]
                        }
                    );
                } else {
                    dfd.resolve({ _id: false });
                }

            }
        }, function (err) {
            dfd.reject(err instanceof BaseError
                ? err
                : new BaseError("DAController.genFilter_None.loadTaskListFailed", "loadTaskListFailed"));
        });
    }, function (err) {
        dfd.reject(err);
    })
    return dfd.promise;
}

const genFilter_None = function (body, count, dbPrefix) {
    let dfd = q.defer();

    const filterRelatedTask = {
        $and: [
            {
                $or: [
                    { main_person: { $eq: body.username } },
                    { participant: { $eq: body.username } },
                    { observer: { $eq: body.username } }
                ]
            },
            {
                "parents.object": { $eq: "dispatch_arrived" }
            },
            {
                "status": { $ne: "Completed" }
            }
        ],

    };

    OrganizationService.justLoadNotHandleAnythingElse(dbPrefix, { departmentLeader: { $eq: body.username } }).then(function (departmentList) {
        let departmentIdList = [];
        if (departmentList && departmentList[0]) {
            for (let i in departmentList) {
                departmentIdList.push(departmentList[i].id);
            }
            filterTask = {
                $or: [
                    filterRelatedTask,
                    {
                        $and: [
                            { status: { $eq: "WaitingForAccept" } },
                            { department: { $in: departmentList } }
                        ]
                    }
                ]
            }
        } else {
            filterTask = filterRelatedTask;
        }

        TaskService.loadList(dbPrefix, filterTask, undefined, undefined, { parents: true }).then(function (taskList) {
            let DAIDList = [];
            for (let i in taskList) {
                for (let j in taskList[i].parents) {
                    if (taskList[i].parents[j].object === "dispatch_arrived") {
                        DAIDList.push(taskList[i].parents[j].id);
                    }
                }
            }
            if (DAIDList[0]) {
                if (departmentIdList[0]) {
                    dfd.resolve(
                        {
                            $or: [
                                { id: { $in: DAIDList } },
                                {
                                    $and: [
                                        { status: { $eq: "Transferred" } },
                                        {
                                            view_only_departments: {
                                                $elemMatch: {
                                                    department: { $in: departmentIdList },
                                                    status: { $eq: "Unread" }
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }

                    );
                } else {
                    dfd.resolve({
                        id: { $in: DAIDList }
                    });
                }
            } else {
                if (departmentIdList[0]) {
                    dfd.resolve(
                        {
                            $and: [
                                { status: { $eq: "Transferred" } },
                                {
                                    view_only_departments: {
                                        $elemMatch: {
                                            department: { $in: departmentIdList },
                                            status: { $eq: "Unread" }
                                        }
                                    }
                                }
                            ]
                        }
                    );
                } else {
                    dfd.resolve({ _id: false });
                }

            }
        }, function (err) {
            dfd.reject(err instanceof BaseError
                ? err
                : new BaseError("DAController.genFilter_None.loadTaskListFailed", "loadTaskListFailed"));
        });
    }, function (err) {
        dfd.reject(err);
    })
    return dfd.promise;
}

const genDTOFromFormData = function (formData) {
    const fields = formData.Fields;
    let result = {};
    result.code = CommonUtil.getValidValue(fields.code);
    result.da_book = CommonUtil.getValidValue(fields.da_book);
    result.number = CommonUtil.getValidValue(fields.number);
    result.release_date = CommonUtil.getValidValue(fields.release_date);
    result.author = CommonUtil.getValidValue(fields.author);
    result.agency_promulgate = CommonUtil.getValidValue(fields.agency_promulgate);
    result.transfer_date = CommonUtil.getValidValue(fields.transfer_date);
    result.note = CommonUtil.getValidValue(fields.note);
    result.type = CommonUtil.getValidValue(fields.type);
    result.priority = CommonUtil.getValidValue(fields.priority);
    result.excerpt = CommonUtil.getValidValue(fields.excerpt);
    result.excerpt_search = removeUnicode(fields.excerpt);
    result.is_legal = CommonUtil.getValidValue(fields.is_legal);
    result.view_only_departments = CommonUtil.getValidValue(fields.view_only_departments, []);
    result.is_assign_task = CommonUtil.getValidValue(fields.is_assign_task);
    result.attachments = [];

    result.attachments = FileUtil.getUploadedFilesWithSpecificKey({
        nameLib: NAME_LIB,
        formData,
        fieldKey: "attachments",
    });
    return result;
};

const genUpdateDTOFromFormData = function (formData) {
    let result = genDTOFromFormData(formData);
    const fields = formData.Fields;
    result.id = CommonUtil.getValidValue(fields.id);
    result.keep_attachments = CommonUtil.getValidValue(fields.keep_attachments, []);
    return result;
}

const genInsertEntityFromDTO = function (dto) {
    let result = {};
    result.code = dto.code;
    result.da_book = dto.da_book;
    result.number = dto.number;
    result.release_date = dto.release_date.getTime();
    result.author = dto.author;
    result.agency_promulgate = dto.agency_promulgate;
    result.transfer_date = dto.transfer_date.getTime();
    result.note = dto.note;
    result.type = dto.type;
    result.priority = dto.priority;
    result.excerpt = dto.excerpt;
    result.excerpt_search = removeUnicode(dto.excerpt);
    result.is_legal = dto.is_legal;
    result.view_only_departments = dto.view_only_departments.map((item) => ({
        department: item,
        status: DISPATCH_ARRIVED_VIEW_STATUS.WAITING_FOR_APPROVAL,
    }));
    result.is_assign_task = dto.is_assign_task;
    result.attachments = dto.attachments;
    return result;
};

const genUpdateEntityFromDTO = function (dto, dispatch) {
    let result = {};
    result.code = dto.code;
    result.da_book = dto.da_book;
    result.number = dto.number;
    result.release_date = dto.release_date.getTime();
    result.author = dto.author;
    result.agency_promulgate = dto.agency_promulgate;
    result.transfer_date = dto.transfer_date.getTime();
    result.note = dto.note;
    result.type = dto.type;
    result.priority = dto.priority;
    result.excerpt = dto.excerpt;
    result.excerpt_search = removeUnicode(dto.excerpt);
    result.is_legal = dto.is_legal;
    result.is_assign_task = dto.is_assign_task;
    result.view_only_departments = dto.view_only_departments.map((item) => ({
        department: item,
        status: DISPATCH_ARRIVED_VIEW_STATUS.WAITING_FOR_APPROVAL,
    }));
    result.attachments = dto.attachments;
    result.attachments = result.attachments.concat(
        dispatch.attachments.filter((attach) => dto.keep_attachments.some((item) => item.name === attach.name)),
    );
    return result;
};

const resolveHandlerForOfficeLeader = function (dbPrefix, currentUser) {
    let isHandler = false;
    const dfd = q.defer();
    UserService.loadLeadOfOffice(dbPrefix).then(function (departmentLeaders) {
        isHandler = departmentLeaders.some(leader => leader.username === currentUser.username);
        dfd.resolve(isHandler);
    }, function (err) {
        dfd.reject(err);
    });
    return dfd.promise;
};

const resolveHandlerForOBD = function (dbPrefix, currentUser) {
    let isHandler = false;
    const dfd = q.defer();
    UserService.loadLeadLevel1(dbPrefix).then(function (departmentLeaders) {
        isHandler = departmentLeaders.some(leader => leader.username === currentUser.username);
        dfd.resolve(isHandler);
    }, function (err) {
        dfd.reject(err);
    });
    return dfd.promise;
};

const resolveHandlerForCreator = function (dbPrefix, currentUser, dispatch) {
    if (dispatch.username === currentUser.username) {
        return q.resolve(true);
    } else {
        return q.resolve(false);
    }
};

const resolveHandlerForDepartmentLeaders = function (dbPrefix, currentUser, dispatch) {
    const dfd = q.defer();
    let listDepartment = [];
    q.fcall(() => {
        let promises = [dispatch.view_only_departments, []];
        if (!dispatch.tasks) {
            promises[1] = TaskService.loadByDispatchArrivedId(dbPrefix, dispatch._id.toString());
        } else {
            promises[1] = q.resolve(dispatch.tasks);
        }
        return q.all(promises);
    })
        .then(([viewOnlyDepartments, tasks]) => {
            viewOnlyDepartments.forEach((item) => {
                if (DISPATCH_ARRIVED_VIEW_STATUS.UNREAD === item.status) {
                    listDepartment.push(typeof item.department === "string" ? item.department : item.department.id);
                }
            });
            tasks.forEach((task) => {
                if (TASK_STATUS.WAITING_FOR_ACCEPT === task.status) {
                    listDepartment.push(typeof task.department === "string" ? task.department : task.department.id);
                }
            });
            return q.all(
                listDepartment.map((departmentId) =>
                    OrganizationService.loadLeaderInDepartment(dbPrefix, departmentId),
                ),
            );
        })
        .then((listLeaderInDepartments) => {
            let isHandler = listLeaderInDepartments.some((leaders) => {
                return leaders.some((leader) => leader.username === currentUser.username);
            });
            dfd.resolve(isHandler);
        })
        .catch((error) => {
            LogProvider.error("Load handler failed with error: " + JSON.stringify(error));
            dfd.resolve(false);
        });
    return dfd.promise;
};

const resolveHandler = function (dbPrefix, dispatch, currentUser) {
    const dfd = q.defer();
    const HANDLER_STRATEGY = {
        [DISPATCH_ARRIVED_STATUS.CREATED]: resolveHandlerForCreator,
        [DISPATCH_ARRIVED_STATUS.WAITING_FOR_REVIEW]: resolveHandlerForOBD,
        [DISPATCH_ARRIVED_STATUS.WAITING_FOR_APPROVAL]: resolveHandlerForOfficeLeader,
        [DISPATCH_ARRIVED_STATUS.TRANSFERRED]: resolveHandlerForDepartmentLeaders,
        [DISPATCH_ARRIVED_STATUS.REJECTED]: resolveHandlerForCreator,
    };
    q.fcall(() => {
        return HANDLER_STRATEGY[dispatch.status](dbPrefix, currentUser, dispatch);
    })
        .then((result) => {
            Object.assign(dispatch, { is_handler: result });
            dfd.resolve(dispatch);
        })
        .catch((error) => {
            LogProvider.error("Resolve handler failed with error: " + JSON.stringify(error));
            dfd.resolve(dispatch);
        });
    return dfd.promise;
};

function processForwardToHeadOfOffice(dbname_prefix, username, dispatch, note) {
    let dfd = q.defer();
    let dfdAr = [];
    dfdAr.push(UserService.loadLeadOfDepartment(dbname_prefix));
    dfdAr.push(DAService.dynamic_update(dbname_prefix, username, dispatch._id, {
        $set: {
            status: DISPATCH_ARRIVED_STATUS.WAITING_FOR_APPROVAL,
        },
        $push: {
            event: {
                username,
                time: new Date().getTime(),
                action: "ForwardToHeadOfOffice",
                note
            },
        }
    }));
    q.all(dfdAr).then(function ([leaders, res]) {
        dfd.resolve(true);
        TaskDAService.updateRejectedTaskToWaitingForApproval(dbPrefix, username, dispatch._id.toString());
        const usernames = leaders.map((leader) => leader.username);
        RingBellItemService.insert(
            dbPrefix,
            username,
            "da_forward_to_head_of_office",
            {
                code: dispatch.code,
                dispatch_id: dispatch._id.toString(),
                action_by: username,
                mes: "ForwardToHeadOfOffice",
            },
            usernames,
            [],
            "ForwardToHeadOfOffice",
            new Date().getTime(),
        );
    }, function (err) { dfd.reject(err); });
    return dfd.promise;
}

function processForwardBOD(dbname_prefix, username, dispatch, note) {
    let dfd = q.defer();
    let dfdAr = [];
    dfdAr.push(UserService.loadLeadLevel1(dbname_prefix));
    dfdAr.push(DAService.dynamic_update(dbname_prefix, username, dispatch._id, {
        $set: {
            status: DISPATCH_ARRIVED_STATUS.WAITING_FOR_REVIEW,
        },
        $push: {
            event: {
                username,
                time: new Date().getTime(),
                action: "ForwardToBOD",
                note
            },
        }
    }));
    q.all(dfdAr).then(function ([leaders, res]) {
        dfd.resolve(true);
        const usernames = leaders.map((leader) => leader.username);
        RingBellItemService.insert(
            dbPrefix,
            username,
            "da_forward_to_board_of_directors",
            {
                code: dispatch.code,
                dispatch_id: dispatch._id.toString(),
                action_by: username,
                mes: "ForwardToBoardOfDirectors",
            },
            usernames,
            [],
            "ForwardToToBoardOfDirectors",
            new Date().getTime(),
        );
    }, function (err) { dfd.reject(err); });
    return dfd.promise;

}

function processToDepartment(dbPrefix, username, dispatch, note) {
    let dfd = q.defer();
    let dfdAr = [];
    dfdAr.push(TaskDAService.updateRejectedTaskToWaitingForApproval(dbPrefix, username, dispatch._id.toString()));
    dfdAr.push(DAService.dynamic_update(dbname_prefix, username, dispatch._id, {
        $set: {
            status: DISPATCH_ARRIVED_STATUS.TRANSFERRED,
            "view_only_departments.$[ele].status": DISPATCH_ARRIVED_VIEW_STATUS.UNREAD,
        },
        $push: {
            event: {
                action: "ForwardToDepartments",
                username,
                time: new Date().getTime(),
                note,
            },
        }
    }));
    q.all(dfdAr).then(function ([leaders, res]) {
        dfd.resolve(true);
        DAService.sendNotificationForLeaderOfDepartments(dbPrefix, dispatch, username);
        DAService.sendNotificationForViewOnlyDepartments(dbPrefix, dispatch, username);
    }, function (err) { dfd.reject(err); });
    return dfd.promise;
}
class DAController {
    constructor() { }

    load_quick_handle(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_QuickHandle(body.session.employee_details.department, body.session.rule, aggerationSearch);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_load(aggerationSteps, queryCriteria);
        return DAService.load_quick_handle(body._service[0].dbname_prefix, filter);
    }

    count_quick_handle(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_QuickHandle(body.session.employee_details.department, body.session.rule, aggerationSearch);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_count(aggerationSteps, queryCriteria);
        return DAService.count_quick_handle(body._service[0].dbname_prefix, filter);
    }

    loadDetails(body) {
        const listUnCheckedRule = [
            "Office.DispatchArrived.Use",
            "Office.Archives.Manager",
            "Tenant.DA.Manager",
            "SystemManagement",
            LEAD_RULE,
            CONFIRM_RULE, APPROVE_LEVEL_1_RULE, MANAGE_DISPATCHARRIVED_RULE
        ];
        const check = body.session.rule.some((ele) => listUnCheckedRule.indexOf(ele.rule) !== -1);

        if (!body.id && !body.code) {
            return q.reject({
                path: "DAController.loadDetails.IdIsNotExists",
                mes: "IdOrCodeIsNotExists",
            });
        }

        const dfd = q.defer();
        let count = countFilter(body);
        let dbPrefix = body._service[0].dbname_prefix;

        genFilter_new(body, count, dbPrefix)
            .then((filter) => {
                return q.fcall(() => DAService.loadDetails(dbPrefix, body.username, body.id, check, body.code));
            })
            .then((dispatch) => {
                dispatch.tasks = dispatch.tasks.slice(0, 1);
                if (Array.isArray(dispatch.tasks)) {
                    return q.all([
                        dispatch,
                        q.all(
                            dispatch.tasks.map((task) =>
                                TaskController.expandTaskReferences(body._service[0].dbname_prefix, dispatch.tasks[0], null, ["department"]),
                            ),
                        ),
                        q.all(
                            dispatch.view_only_departments.map((item) => {
                                const dfd = q.defer();
                                DepartmentService.getDepartmentById(
                                    body._service[0].dbname_prefix,
                                    item.department,
                                ).then(
                                    (department) => {
                                        item.department = department;
                                        dfd.resolve(item);
                                    },
                                    (error) => {
                                        dfd.reject(error);
                                    },
                                );
                                return dfd.promise;
                            }),
                        ),
                    ]);
                }
                return [dispatch, [], []];
            })
            .then(([dispatch]) => {
                return resolveHandler(body._service[0].dbname_prefix, dispatch, body.session);
            })
            .then((dispatch) => {
                dfd.resolve(dispatch);
            })
            .catch((error) => {
                dfd.reject(error);
            });

        return dfd.promise;
    }

    load(body) {
        let dfd = q.defer();
        let dfdArr = [];
        let count = countFilter(body);
        let dbPrefix = body._service[0].dbname_prefix;

        let filterPromise = genFilter_new(body, count, dbPrefix);

        filterPromise.then(function (filter) {
            DAService.loadList(dbPrefix, filter, body.top, body.offset, body.sort).then(
                function (data) {
                    for (let i in data) {
                        dfdArr.push(
                            DirectoryService.loadDetails(
                                dbPrefix,
                                "value",
                                data[i].type,
                                "kind_of_dispatch_to",
                            ).then(function (res) {
                                data[i].typeDirectory = res.title;
                            }),
                        );
                    }

                    q.all(dfdArr)
                        .then(() => {
                            if (body.tab === "need_to_handle") {
                                return q.fcall(() => {
                                    let promises = data.map((item) => {
                                        return resolveHandler(dbPrefix, item, body.session);
                                    });
                                    return q.all(promises);
                                });
                            }
                            return q.resolve(data);
                        })
                        .then((result) => {
                            dfd.resolve(result.filter((item) => item.is_handler === true));
                        })
                        .catch((error) => {
                            dfd.reject(error);
                        });
                },
                function (err) {
                    dfd.reject(err);
                },
            );
        }).catch(function (err) {
            dfd.reject(err);
        });

        return dfd.promise;
    }

    countPending(body) {
        return DAService.countPending(body._service[0].dbname_prefix, body.username);
    }

    count(body) {
        let count = countFilter(body);
        let filter = genFilter_new(body, count);
        return DAService.countList(body._service[0].dbname_prefix, filter);
    }

    getNumber(body) {
        return DAService.getNumber(body._service[0].dbname_prefix, body.da_book);
    }

    insert(dbPrefix, currentUser, formData) {
        const dfd = q.defer();

        q.fcall(() => {
            let dto = genDTOFromFormData(formData);
            dto = validation.insertFormData(dto);
            return genInsertEntityFromDTO(dto);
        })
            .then((entity) => {
                return DAService.insert(
                    dbPrefix,
                    currentUser.username,
                    currentUser.employee_details.department,
                    entity,
                );
            })
            .then((result) => {
                dfd.resolve(result);
            })
            .catch((error) => {
                dfd.reject(error);
            });

        return dfd.promise;
    }

    loadFileInfo(body) {
        let dfd = q.defer();
        let check = false;
        if (
            body.session.role.indexOf("Tenant.DA.Manager") != -1 ||
            body.session.role.indexOf("Office.DA.Use") != -1 ||
            body.session.role.indexOf("SystemManagement") != -1 ||
            body.session.role.indexOf("Office.Archives.Manager") != -1
        ) {
            check = true;
        }
        DAService.loadDetails(body._service[0].dbname_prefix, body.username, body.id, check).then(
            function (data) {
                let checkPermission = true;
                let checkFile = false;
                let fileInfo = {};

                for (let i in data.attachments) {
                    if (data.attachments[i].name === body.filename) {
                        fileInfo = data.attachments[i];
                        checkFile = true;
                        break;
                    }
                }

                if (checkPermission) {
                    if (checkFile) {
                        FileProvider.loadFile(
                            body._service[0].dbname_prefix,
                            body.session,
                            fileInfo.nameLib,
                            fileInfo.name,
                            fileInfo.timePath,
                            fileInfo.locate,
                            folderArray,
                            data.username,
                        ).then(
                            function (fileinfo) {
                                fileinfo.display = fileInfo.display;
                                dfd.resolve(fileinfo);
                                fileinfo = undefined;
                            },
                            function (err) {
                                dfd.reject(err);
                                fileInfo = undefined;
                                err = undefined;
                            },
                        );
                    } else {
                        dfd.reject({
                            path: "DAController.loadFileInfo.FileIsNotExists",
                            mes: "FileIsNotExists",
                        });
                    }
                    body = undefined;
                    checkPermission = undefined;
                    checkFile = undefined;
                } else {
                    dfd.reject({
                        path: "DAController.loadFileInfo.NotPermission",
                        mes: "NotPermission",
                    });
                    body = undefined;
                    checkPermission = undefined;
                    checkFile = undefined;
                    fileInfo = undefined;
                }
            },
            function (err) {
                dfd.reject(err);
                body = undefined;
            },
        );

        return dfd.promise;
    }

    downloadfile(body) {
        let dfd = q.defer();
        let check = false;
        if (
            body.session.role.indexOf("Tenant.DA.Manager") != -1 ||
            body.session.role.indexOf("Office.DA.Use") != -1 ||
            body.session.role.indexOf("SystemManagement") != -1 ||
            body.session.role.indexOf("Office.Archives.Manager") != -1
        ) {
            check = true;
        }
        DAService.loadDetails(body._service[0].dbname_prefix, body.username, body.id, check).then(
            function (data) {
                let checkPermission = true;
                let checkFile = false;

                for (let i in data.attachment) {
                    if (data.attachment[i].name === body.filename) {
                        checkFile = true;
                        break;
                    }
                }

                if (checkPermission) {
                    if (checkFile) {
                        FileProvider.download(
                            body._service[0].dbname_prefix +
                            parentFolder +
                            "/" +
                            nameLib +
                            "/" +
                            data.username +
                            "/" +
                            body.filename,
                        ).then(
                            (url) => {
                                dfd.resolve(url);
                                url = undefined;
                            },
                            (error) => {
                                dfd.reject(error);
                                error = undefined;
                            },
                        );
                    } else {
                        dfd.reject({
                            path: "DAController.downloadfile.FileIsNotExists",
                            mes: "FileIsNotExists",
                        });
                    }
                    body = undefined;
                    checkPermission = undefined;
                    checkFile = undefined;
                } else {
                    dfd.reject({
                        path: "DAController.downloadfile.NotPermission",
                        mes: "NotPermission",
                    });
                    body = undefined;
                    checkPermission = undefined;
                    checkFile = undefined;
                }
            },
            function (err) {
                dfd.reject(err);
                body = undefined;
            },
        );

        return dfd.promise;
    }

    handling(body) {
        return DAService.handling(body._service[0].dbname_prefix, body.username, body.id, body.forward, body.comment);
    }

    delete(body) {
        return DAService.delete(body._service[0].dbname_prefix, body.username, body.id);
    }

    insertTask(body) {
        let dfd = q.defer();
        let date = new Date();
        DAService.loadDetails(body._service[0].dbname_prefix, body.username, body.id).then(
            function (details) {
                DAService.insertTask(
                    body._service[0].dbname_prefix,
                    body.username,
                    body.session.employee_details.department,
                    body.id,
                    body.title,
                    body.content,
                    [],
                    body.main_person,
                    body.participant,
                    body.observer,
                    details.attachment,
                    body.from_date,
                    body.to_date,
                    [],
                    body.priority,
                ).then(
                    function (taskDetail) {
                        dfd.resolve(true);
                        let usernameToNotify = [];
                        usernameToNotify = usernameToNotify.concat(body.main_person);
                        usernameToNotify = usernameToNotify.concat(body.participant);
                        usernameToNotify = usernameToNotify.concat(body.observer);
                        RingBellItemService.insert(
                            body._service[0].dbname_prefix,
                            body.username,
                            "task_assigned",
                            {
                                taskid: taskDetail.insertedId,
                                title: body.title,
                                username_create_task: body.username,
                            },
                            usernameToNotify,
                            [],
                            "createTask",
                            date.getTime(),
                        );
                        date = undefined;
                    },
                    function (err) {
                        dfd.reject(err);
                        err = undefined;
                    },
                );
            },
            function (err) {
                dfd.reject(err);
                err = undefined;
            },
        );
        return dfd.promise;
    }

    update(dbPrefix, currentUser, formData) {
        const dfd = q.defer();
        q.fcall(() => {
            let dto = genUpdateDTOFromFormData(formData);
            if (!dto.attachments && !dto.keep_attachments) {
                throw new BaseError("DAController.update", "AttachmentIsRequired");
            }
            dto = validation.updateFormData(dto);
            return q.all([dto, DAService.loadById(dbPrefix, dto.id)]);
        })
            .then(([dto, dispatch]) => {
                if (!dispatch) {
                    throw new BaseError("DAController.update", "DispatchNotFound");
                }

                const entity = genUpdateEntityFromDTO(dto, dispatch);
                return DAService.update(dbPrefix, currentUser.username, dto.id, entity);
            })
            .then(() => {
                dfd.resolve(true);
            })
            .catch((error) => {
                LogProvider.error("Update dispatch arrived failed with error: " + JSON.stringify(error));
                dfd.reject(error instanceof BaseError ? error : new BaseError("DAController.update", "UpdateError"));
            });

        return dfd.promise;
    }

    signAcknowledge(body) {
        let dfd = q.defer();
        DAService.signAcknowledge(
            body._service[0].dbname_prefix,
            body.username,
            body.id,
            body.note,
            body.with_task,
        ).then(
            function (data) {
                dfd.resolve(true);

                RingBellItemService.insert(
                    body._service[0].dbname_prefix,
                    body.username,
                    "acknowledge",
                    {
                        da_id: body.id,
                        username_create_da: data.username,
                    },
                    data.handler,
                    [],
                    "acknowledge",
                    date.getTime(),
                );
            },
            function (err) {
                dfd.reject(err);
                err = undefined;
            },
        );
        return dfd.promise;
    }

    forward(dbPrefix, body) {
        const dfd = q.defer();

        DAService.loadDispatchArrivedInfo(dbPrefix, body.id).then(function (result) {

            const dispatchArrived = result[0];
            let promise = null;
            switch (body.to) {
                case DISPATCH_FORWARD_TO.HEAD_OF_DEPARTMENT:
                    promise = processForwardToHeadOfOffice(dbPrefix, body.username, dispatchArrived, body.note);
                    break;

                case DISPATCH_FORWARD_TO.BOARD_OF_DIRECTORS:
                    promise = processForwardBOD(dbPrefix, body.username, dispatchArrived, body.note);
                    break;

                case DISPATCH_FORWARD_TO.DEPARTMENTS:
                    promise = processToDepartment(dbPrefix, body.username, dispatchArrived, body.note);
                    break;

                default:
                    dfd.reject({ path: "DAService.forward.InvalidForwardTo", mes: "InvalidForwardTo" });
            }

            promise.then(function () { dfd.resolve(true); }, function (err) { dfd.reject(err); })
        }, function (err) {
            dfd.reject({ path: "DAController.forward.getDAInfoFailed", err });
        });
        return dfd.promise;
    }

    response(dbPrefix, currentUser, body) {
        const dfd = q.defer();
        DAService.loadDetails(dbPrefix, currentUser.username, body.id, true).then(function (dispatch) {
            if (DISPATCH_ARRIVED_STATUS.TRANSFERRED !== dispatch.status) {
                dfd.reject(new BaseError("DAController.response", "InvalidStatus"));
            } else {
                resolveHandler(dbPrefix, dispatch, currentUser).then(function (dispatch2) {
                    if (!dispatch2.is_handler) {
                        dfd.reject(new BaseError("DAController.response", "NotHandler"));
                    } else {
                        DAService.response(dbPrefix, currentUser.username, currentUser.department, body).then(function () {
                            dfd.resolve(true);
                        }, function (err) {
                            dfd.reject(err instanceof BaseError ? err : new BaseError("DAController.response", "resolveFailed"));
                        });
                    }
                }, function (err) {
                    dfd.reject(err instanceof BaseError ? err : new BaseError("DAController.response", "resolveHandlerFailed"));
                })
            }
        }, function (err) {
            LogProvider.error("Process response error: " + JSON.stringify(err));
            dfd.reject(err instanceof BaseError ? err : new BaseError("DAController.response", "LoadDetailsFailed"));
        });
        return dfd.promise;
    }
}

class DepartmentController {
    constructor() { }

    load(body) {
        return DepartmentService.load(body._service[0].dbname_prefix);
    }
}

class EmployeeController {
    constructor() { }

    load(body) {
        return EmployeeService.load(body._service[0].dbname_prefix, body.department);
    }
}

exports.DAController = new DAController();
exports.DepartmentController = new DepartmentController();
exports.EmployeeController = new EmployeeController();
