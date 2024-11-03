const q = require("q");
const { cloneDeep } = require("lodash");

const BaseError = require("@shared/error/BaseError");

const { FileProvider } = require("../../../shared/file/file.provider");
const { LogProvider } = require("../../../shared/log_nohierarchy/log.provider.js");

const ReferencesUtil = require("@utils/referencesUtil");

const { ODBService, DepartmentService, EmployeeService, BriefcaseService, TaskService } = require("./service");
const { RingBellItemService } = require("../../management/ringbell_item/service");
const { EmployeeService: EmpService } = require("@app/office/human/employee/service");
const { UserService } = require("@app/management/user/user.service");
const validation = require("./validation");

const WORKFLOW_PLAY_CONF = require("@app/office/workflow_play/const");
const { OBD_STATUS } = require("@utils/constant.js");
const { WorkflowPlayService, TaskWorkFlowPlayService: TaskServiceWFP } = require("@app/office/workflow_play/service");

const { TASK_STATUS } = require("@utils/constant");
const { resolveParents } = require("@utils/referenceUtil");
const { NAME_LIB } = require("@app/office/outgoing_dispatch/const");
const { getValidValue } = require("../../../utils/util");
const fileUtil = require("../../../utils/fileUtil");

const fieldSearchAr = ["search", "odb_book", "priority", "send_method", "type", "tab"];

const countFilter = function (body) {
    let count = 0;
    for (var i in fieldSearchAr) {
        if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
            count++;
        }
    }
    return count;
}

const genFilter = function (body, count) {
    let filter = { $and: [] };
    if (count === 1) {
        switch (body.tab) {
            case "created":
                filter.$and.push({ username: { $eq: body.username } });
                break;
            case "all":
                break;
            case "need_to_handle":
                filter.$and.push({ handler: { $eq: body.username } });
                break;
            case "waiting_storage":
                filter.$and.push({ status: { $eq: OBD_STATUS.RELEASED } });
                break;
            case "dispatchAway":
                filter.$and.push({ document_type: { $ne: 'separate_dispatch' } });
                break;
            case "separateDispatch":
                filter.$and.push({ document_type: { $eq: 'separate_dispatch' } });
        }
        filter.$and.push({
            status: { $ne: OBD_STATUS.NOT_PUBLIC_YET },
        });
        return filter;
    }

    for (var i in fieldSearchAr) {
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
                            filter.$and.push({ handler: { $eq: body.username } });
                            break;
                        case "waiting_storage":
                            filter.$and.push({ status: { $eq: OBD_STATUS.RELEASED } });
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

    filter.$and.push({
        status: { $ne: OBD_STATUS.NOT_PUBLIC_YET },
    });

    return filter;
}


const genUpdateData = function (fields) {
    let result = {};
    if(fields.from === 'origin' ) {
        result.odb_book= fields.odb_book;
        result.signed_date = fields.signed_date;
        result.type= fields.type;
        result.excerpt= fields.excerpt;
        result.priority= fields.priority;
        result.expiration_date= fields.expiration_date;
    } else if (fields.from === 'transfer') {
        result.notification_departments = fields.notification_departments;
        result.notification_recipients = fields.notification_recipients;
    }
    return result;
}


function genUpdateReferencesData(dto) {
    return {
        references: groupReferences(dto)
    };
}

function groupReferences(references) {
    const result = {};

    for (const reference of references) {
        if (!result[reference.object]) {
            result[reference.object] = [];
        }
        result[reference.object].push(reference.id);
    }
    return Object.keys(result).map((key) => ({
        type: "array",
        object: key,
        value: result[key],
        isDefault: false
    }));
}

function sendNotificationToRecipients(dbNamePrefix, publisher, obd, recipients) {
    const dfd = q.defer();
    q.fcall(() => {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            dfd.resolve();
            return;
        }
        return RingBellItemService.insert(
            dbNamePrefix,
            publisher.username,
            "obd_released",
            {
                workflowPlayId: obd.workflowPlayId,
                code : obd.code,
                obdId: obd._id.toString(),
                title: obd.title,
                mes: "JustReleasedBy",
                username_release: publisher.username,
            },
            recipients,
            [],
            "releaseOBD",
            new Date().getTime(),
        );
    })
        .then(() => {
            dfd.resolve();
        })
        .catch((error) => {
            dfd.reject(error);
        });
    return dfd.promise;
}

function sendNotificationToDepartments(dbNamePrefix, publisher, obd, departments) {
    const dfd = q.defer();
    q.fcall(() => {
        if (!Array.isArray(departments) || departments.length === 0) {
            dfd.resolve();
            return;
        }
        return EmpService.loadLeadersByDepartmentIds(dbNamePrefix, departments);
    })
        .then((departments) => {
            let employeeIds = [];
            for (const department of departments) {
                if (Array.isArray(department.leader) && department.leader.length > 0) {
                    employeeIds = employeeIds.concat(department.leader.map((leader) => leader._id.toString()));
                }
            }
            if (employeeIds.length === 0) {
                dfd.resolve();
                return;
            }
            return UserService.loadByEmployeeIds(dbNamePrefix, employeeIds);
        })
        .then((users) => {
            if (!Array.isArray(users) || users.length === 0) {
                dfd.resolve();
                return;
            }
            const recipients = users.map((user) => user.username);
            return sendNotificationToRecipients(dbNamePrefix, publisher, obd, recipients);
        })
        .then(() => {
            dfd.resolve();
        })
        .catch((error) => {
            dfd.reject(error);
        });
    return dfd.promise;
}

const handleSendNotificationForRelease = function (
    dbNamePrefix,
    publisher,
    obd
) {
    const dfd = q.defer();

    const notificationDepartments = obd.receiver_notification || [];
    const notificationRecipients = obd.department_notification || [];

    q.all([
        sendNotificationToRecipients(dbNamePrefix, publisher, obd, notificationRecipients),
        sendNotificationToDepartments(dbNamePrefix, publisher, obd, notificationDepartments),
    ])
        .then(() => {
            dfd.resolve();
        })
        .catch((error) => {
            LogProvider.error("Process send notification for release OBD error", error);
            dfd.reject(error);
        });
    return dfd.promise;
};

function loadReference(dbname_prefix, username, odb) {
    const dfd = q.defer();
    q.fcall(() => {
        const referenceGroup = ReferencesUtil.groupReferences(odb["references"]);

        let briefcasePromise = null;
        if (referenceGroup["brief_case"]) {
            briefcasePromise = BriefcaseService.loadDetail(dbname_prefix, username, referenceGroup["brief_case"]);
        }

        let taskRelatedPromise = null;
        if (referenceGroup["workflow_play"]) {
            taskRelatedPromise = TaskService.loadDetailByWorkFlowPlayId(
                dbname_prefix,
                username,
                referenceGroup["workflow_play"],
            );
        }

        let workflowPlayPromise = null;
        if (referenceGroup["workflow_play"]) {
            workflowPlayPromise = WorkflowPlayService.loadDetails(dbname_prefix, username, referenceGroup["workflow_play"]);
        }

        return q.all([briefcasePromise, taskRelatedPromise, workflowPlayPromise]);
    })
        .then(([briefcase, taskRelated, workflowPlay]) => {
            Object.assign(odb, {
                briefcase: briefcase,
                related_task: taskRelated,
                workflow_play: workflowPlay,
            });
            dfd.resolve(odb);
        })
        .catch((error) => {
            dfd.reject(error);
        });
    return dfd.promise;
}

function buildOutgoingDispatchDTOFromRequest(formData) {
    const fields = formData.Fields;
    const dto = {
        outgoing_dispatch_id: getValidValue(fields.outgoing_dispatch_id),
        outgoing_dispatch_book: getValidValue(fields.outgoing_dispatch_book),
        document_date: fields.document_date,
        outgoing_documents: [],
        attach_documents: [],
        excerpt: getValidValue(fields.excerpt),
        signers: fields.signers,
        draft_department: fields.draft_department,
        receiver_notification: fields.receiver_notification,
        department_notification: fields.department_notification,
        document_quantity: fields.document_quantity,
        transfer_date: fields.transfer_date,
        note: getValidValue(fields.note),
        expiration_date: fields.expiration_date,
        priority: fields.priority,
        code: fields.code
    };
    dto.outgoing_documents = fileUtil.getUploadedFilesWithSpecificKey({
        nameLib: NAME_LIB,
        formData,
        fieldKey: "outgoing_documents",
    });
    dto.attach_documents = fileUtil.getUploadedFilesWithSpecificKey({
        nameLib: NAME_LIB,
        formData,
        fieldKey: "attach_documents",
    });
    
    return dto;
}

function filterByUserRule (userData, results) {
    const rules = userData.session.rule;
    const curRule = rules.find(rule => rule.rule === 'Office.DispatchOutgoing.ViewODB');
    const { type, department } = curRule.details;
    let response;
    switch (type) {
        case 'NotAllow':
            response = [];
            break;
    
        case 'All':
            response = results;
            break;
            
        case 'Specific':
            results 
                ? response = results.filter(odb => {
                    const dp_notification = odb.department_notification;
                    return dp_notification.some(dp => department && department.includes(dp));
                })
                : [];
            break;
        
        case 'Working':
            results 
                ? response = results.filter(odb => odb.department_notification.includes(userData.session.department)) 
                : [];
            break;    

        default:
            response = [];
            break;
    }

    return response;
}

class ODBController {
    constructor() {}

    getNumber(body) {
        return ODBService.getNumber(body._service[0].dbname_prefix, body.odb_book);
    }

    insert(body) {
        let dfd = q.defer();
        let d = new Date();
        var event = [{ username: body.username,  action: "Created", time: d.getTime() }]
        ODBService.insert(
            body._service[0].dbname_prefix,
            body.username,
            body.session.employee_details.department,
            body.title,
            body.odb_book,
            body.number,
            body.signed_date,
            body.type,
            body.priority,
            body.signers,
            body.with_task,
            body.is_legal,
            body.is_assign_task,
            body.excerpt,
            body.place_of_da,
            event,
            [],
            body.expiration_date,
            body.id,
            body.is_ODB_WFP,
        ).then(
            function (data) {
                dfd.resolve(data);
            },
            function (err) {
                dfd.reject(err);
            },
        );

        return dfd.promise;
    }

    loadDetail(dbname_prefix, body) {
        let dfd = q.defer();
        let odb = {};
        ODBService.load(dbname_prefix, body.username, body.id, body.code)
            .then(function (data) {
                odb = cloneDeep(data);
                return loadReference(dbname_prefix, body.username, odb);
            })
            .then(() => {
                return resolveParents(dbname_prefix, odb);
            })
            .then(() => {
                dfd.resolve(odb);
            })
            .catch((err) => dfd.reject(err));

        return dfd.promise;
    }

    load(body) {
        let dfd = q.defer();
        let count = countFilter(body);
        let filter = genFilter(body, count);
        ODBService.loadList(body._service[0].dbname_prefix, filter, body.top, body.offset, body.sort)
            .then(function (data) {
                const result = filterByUserRule(body, data);
                dfd.resolve(result);
                dfd = undefined;
                result = undefined;
                data = undefined;
            })
            .catch((err) => {
                dfd.reject(
                    err instanceof BaseError
                        ? err
                        : new BaseError("OutgoingDispatchController.load", "Load"),
                );
            });

        return dfd.promise;
    }

    count(body) {
        let count = countFilter(body);
        let filter = genFilter(body, count);
        return ODBService.countList(body._service[0].dbname_prefix,filter);
    }

    loadFileInfo(dbPrefix, currentUser, odbId, fileName) {
        let dfd = q.defer();

        let targetDocument = null;

        ODBService.load(dbPrefix, currentUser.username, odbId)
            .then(function (data) {
                const allDocuments = data.outgoing_documents.concat(data.attach_documents)
                    .concat(data.archived_documents);
                targetDocument = allDocuments.find((doc) => doc.name === fileName);

                if (!targetDocument) {
                    throw new BaseError("OutgoingDispatchController.loadFileInfo", "FileNotFound", 404);
                }

                return FileProvider.loadFile(
                    dbPrefix,
                    currentUser,
                    targetDocument.nameLib,
                    targetDocument.name,
                    targetDocument.timePath,
                    targetDocument.locate,
                    WORKFLOW_PLAY_CONF.FOLDER_ARRAY,
                    currentUser.username,
                );
            })
            .then((fileDetail) => {
                Object.assign(fileDetail, { display: targetDocument.display });
                dfd.resolve(fileDetail);
            })
            .catch((err) => {
                dfd.reject(
                    err instanceof BaseError
                        ? err
                        : new BaseError("OutgoingDispatchController.loadFileInfo", "LoadFileDetailFailed"),
                );
            });

        return dfd.promise;
    }

    update(dbname_prefix, body) {
        let dfd = q.defer();
        ODBService.load(dbname_prefix, body.username, body.id)
            .then((obd) => {
                if (obd.status !== OBD_STATUS.NOT_PUBLIC_YET) {
                    dfd.reject({ path: 'ODBController.update.InvalidAction', mes: 'InvalidAction' })
                    return;
                }
                const data = genUpdateData(body);
                return ODBService.update(
                    dbname_prefix,
                    body.username,
                    body.id,
                    data.odb_book,
                    data.signed_date,
                    data.type,
                    data.excerpt,
                    data.expiration_date,
                    data.priority,
                    data.notification_departments,
                    data.notification_recipients
                );
            })
            .then(() => {
                dfd.resolve(true);
            }).catch(err => {
                dfd.reject(err);
            });

        return dfd.promise;
    }

    updateReferences(dbname_prefix, body) {
        let dfd = q.defer();
        ODBService.load(dbname_prefix, body.username, body.id)
            .then((obd) => {
                if (obd.status !== OBD_STATUS.RELEASED) {
                    dfd.reject({ path: 'ODBController.update.InvalidAction', mes: 'InvalidAction' })
                    return;
                }
                const notDefaultReferences = body.references.filter(item => item.isDefault === false);
                const defaultReferences = body.references.filter(item => item.isDefault === true);
                let data = genUpdateReferencesData(notDefaultReferences);
                data.references = [...defaultReferences, ...data.references];
                // defaultReferences.forEach(item => {
                //     data.references.unshift(item)
                // })
                // data.references.push(defaultReferences);
                const combinedReferences = [...defaultReferences, ...data.references];
                return ODBService.update(
                    dbname_prefix,
                    body.username,
                    body.id,
                    data
                );
            })
            .then(() => {
                dfd.resolve(true);
            }).catch(err => {
                dfd.reject(err);
            });

        return dfd.promise;
    }

    release(dbname_prefix, body) {
        let dfd = q.defer();
        const d = new Date();
        let obd = {};
        ODBService.load(dbname_prefix, body.username, body.id)
            .then((data) => {
                obd = cloneDeep(data);
                if (obd.status !== OBD_STATUS.NOT_PUBLIC_YET) {
                    throw new BaseError("ODBController.release.InvalidAction", "InvalidAction");
                }

                if (!obd.receiver_notification.length && !obd.department_notification.length) {
                    throw new BaseError("ODBController.release.ReceiverOrDepartmentNotificationIsRequired", "ReceiverOrDepartmentNotificationIsRequired");
                }

                return handleSendNotificationForRelease(dbname_prefix, body.session, obd);
            })
            .then(() => {
                const workflowPlay = obd.references.find((ref) => ref.object === "workflow_play");
                return q.all([
                    ODBService.release(dbname_prefix, body.username, body.id),
                    TaskServiceWFP.updateTaskStatusbyWFP(
                        dbname_prefix,
                        body.username,
                        workflowPlay.value,
                        TASK_STATUS.COMPLETED,
                    ),
                ]);
            })
            .then(() => {
                dfd.resolve(true);
            })
            .catch((err) => {
                dfd.reject(err);
            });
        return dfd.promise;
    }

    loadArchivedDocument(dbname_prefix, body) {
        let dfd = q.defer();
        let odbArr = [];
        ODBService.loadList(dbname_prefix, { code: body.code })
            .then(function (data) {
                odbArr = data;
                let promiseArray = [];
                if (data.length > 0) {
                    promiseArray.push(loadReference(dbname_prefix, body.username, odbArr[0]));
                }
                return q.all(promiseArray);
            })
            .then(() => {
                dfd.resolve(odbArr);
            })
            .catch((err) => dfd.reject(err));

        return dfd.promise;
    }

    insertSeparatelyOutgoingDispatch(dbname_prefix, currentUser, formData) {
        let dfd = q.defer();
        let dto = buildOutgoingDispatchDTOFromRequest(formData);
        dto = validation.validation.processFormData(dto);
        ODBService.insertSeparatelyOutgoingDispatch(dbname_prefix, currentUser.username, dto)
            .then(function (data) {
                dfd.resolve(data);
            })
            .catch(function (err) {
                dfd.reject(err);
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
        return EmployeeService.load(body._service[0].dbname_prefix,body.department);
    }
}

exports.ODBController = new ODBController();
exports.DepartmentController = new DepartmentController();
exports.EmployeeController = new EmployeeController();
