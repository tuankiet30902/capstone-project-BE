const q = require('q');
const { MeetingRoomService, UserService, DirectoryService } = require('./service');
const { BuildFilterAggregate } = require('./utility');

const { FileProvider } = require('../../../shared/file/file.provider');
const fileUtil = require('../../../utils/fileUtil');
const {validation} = require('./validation');
const nameLib = "meeting_room";
const parentFolder = 'office';
const folderArray = ['office']
const { MEETING_ROOM_SCHEDULE_EVENT, MEETING_ROOM_TYPE } = require('../../../utils/constant');
const { MEETING_ROOM_SCHEDULE_STATUS, ROOM_RULE, ROOM_TYPE, MEETING_ROOM_SCHEDULE_FLOW, MEETING_ROOM_ACTION_NAME, MEETING_ROOM_FROM_ACTION, MEETING_ROOM_TAB } = require('./const');
const { SCHEDULE_MEETING_ROOM_FEATURE_NAME } = require('./const');
const { v4: uuidv4 } = require('uuid');
const { RingBellItemService } = require('@app/management/ringbell_item/service');
const { checkRuleRadioDepartment, getObjectDifferences, deepClone } = require('@utils/ruleUtils');
const { generateCalendar, formatTimestamp } = require('@utils/eventUtil');
const XLSX = require('xlsx-js-style');
const { filterLanguage, genFilterRuleUser, getWeekNumber } = require('@utils/util');

const countFilterCondition = function (body) {
    let count = 0;
    if (body.status !== undefined) {
        count++;
    }
    if (body.type !== undefined) {
        count++;
    }
    return count;
}

const genFilterData = function (body, count) {
    if (count == 0) { return { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } } };
    let filter = { $and: [{ feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } }] };
    if (count > 0) {
        if (body.status !== undefined) {
            filter.$and.push({ status: { $eq: body.status } });
        }
        // if (body.type !== undefined) {
        //     filter.$and.push({ type: { $eq: body.type } });
        // }
    }

    let orConditions = [];
    if (body.session.rule.some(e => e.rule === "Office.MeetingRoomSchedule.Approval")) {
        orConditions.push({ type: { $eq: MEETING_ROOM_TYPE.MEETING_ROOM } });
    }
    if (body.session.rule.some(e => e.rule === "Office.LectureHallClassroom.Approval")) {
        orConditions.push({ type: { $eq: MEETING_ROOM_TYPE.LECTURE_HALL_CLASSROOM } });
    }

    if (orConditions.length > 0) {
        filter.$and.push({ $and: orConditions });
    } else {
        filter.$and.push({ "entity.his.0.createdby": { $eq: body.username } });
    }

    return filter;
}

const getStatusRegiserMeetingRoom = function(userRules){
    if(userRules.find(rule => rule.rule === ROOM_RULE.MEETING_ROOM_APPROVE_LEAD)){
        return MEETING_ROOM_SCHEDULE_STATUS.APPROVED;
    }

    if(userRules.find(rule => rule.rule === ROOM_RULE.MEETING_ROOM_CONFIRM)){
        return MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED;
    }

    if(userRules.find(rule => rule.rule === ROOM_RULE.APPROVE_LEVEL_DEPARTMENT)){
        return MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED;
    }

    return MEETING_ROOM_SCHEDULE_STATUS.REGISTERED;
}

const getStatusRegiserClassRoom = function(userRules){
    if(userRules.find(rule => rule.rule === ROOM_RULE.CLASS_ROOM_APPROVE_LEAD)){
        return MEETING_ROOM_SCHEDULE_STATUS.APPROVED;
    }

    if(userRules.find(rule => rule.rule === ROOM_RULE.CLASS_ROOM_CONFIRM)){
        return MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED;
    }

    if(userRules.find(rule => rule.rule === ROOM_RULE.APPROVE_LEVEL_DEPARTMENT)){
        return MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED;
    }

    return MEETING_ROOM_SCHEDULE_STATUS.REGISTERED;
}

class MeetingRoomController {
    constructor() { }

    load_quick_handle(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_QuickHandle(body.username, body.session.employee_details.department, body.session.rule, aggerationSearch, body.feature);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_load(aggerationSteps, queryCriteria);
        return MeetingRoomService.executeAggregate(body._service[0].dbname_prefix, filter);
    }

    count_quick_handle(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_QuickHandle(body.username, body.session.employee_details.department, body.session.rule, aggerationSearch, body.feature);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_count(aggerationSteps, queryCriteria);
        return MeetingRoomService.executeAggregate(body._service[0].dbname_prefix, filter);
    }

    register(req) {     
        let dfd = q.defer();
        let data;
        let attachments;
        FileProvider.upload(req, nameLib, validation.register, undefined, parentFolder, req.body.username).then(function (res) {
            data = genData(res.Fields);
            attachments = fileUtil.getUploadedFilesWithSpecificKey({
                nameLib,
                formData: res,
                fieldKey: "file",
            });

            data.attachments = attachments.map(attachment =>({
                ...attachment,
                id:uuidv4(),
            }))
            data.department = req.body.session.employee_details.department;
            const event = {
                username: req.body.username,
                time: new Date().getTime(),
                action: MEETING_ROOM_ACTION_NAME.CREATE,
                id: uuidv4(),
            }

            MeetingRoomService.getCode(req.body._service[0].dbname_prefix, req.body.session.department_details.ordernumber).then(function (code) {
                MeetingRoomService.register(
                    req.body._service[0].dbname_prefix,
                    req.body.username,
                    data,
                    event,
                    code
                ).then(function(data){
                    dfd.resolve(data);
                    const action = MEETING_ROOM_ACTION_NAME.APPROVE;
                    const rule = ROOM_RULE.APPROVE_LEVEL_DEPARTMENT;
                    const filter = genFilterRuleUser(rule, data.department);
                    const d = new Date().getTime();
                    const fromAction= MEETING_ROOM_FROM_ACTION.CREATE;
                    UserService.getNotifyUsers(req.body._service[0].dbname_prefix,filter).then(function(users){
                        users = users.map(item => item.username).filter(item => item !== req.body.username);
                        RingBellItemService.insert(
                            req.body._service[0].dbname_prefix,
                            req.body.username,
                            action,
                            {
                                code: code,
                                title: data.title,
                                username_create_ticket: data.username,       
                                status: data.status,
                                roomType: data.type
                            },
                            users,
                            [],
                            fromAction,
                            d,
                            []
                        )
                    }, function(err) { console.error(err); })
                }, function(err){
                    dfd.reject(err);
                })
            }, function (err) { dfd.reject(err) })

        }, function (err) {
            dfd.reject(err);
        })

        return dfd.promise;
    }

    load(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_ManageUI(body.username, body.session.employee_details.department, body.session.rule,body.tab,body.checks, aggerationSearch);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_load(aggerationSteps, queryCriteria);
        return MeetingRoomService.executeAggregate(body._service[0].dbname_prefix, filter);
    }

    count(body) {
        const aggerationSearch = BuildFilterAggregate.generateUIFilterAggregate_search([], body);
        const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_ManageUI(body.username, body.session.employee_details.department, body.session.rule,body.tab,body.checks, aggerationSearch);
        const queryCriteria = { ...body };
        const filter = BuildFilterAggregate.generateUIFilterAggregate_count(aggerationSteps, queryCriteria);
        return MeetingRoomService.executeAggregate(body._service[0].dbname_prefix, filter);
    }

    deleteRegistered(body) {
        return MeetingRoomService.deleteRegistered(body._service[0].dbname_prefix, body.id, body.username);
    }

    loadDetailForUpdate(body) {
        let dfd = q.defer();
        MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id, body.code).then(function (item) {
            dfd.resolve(item);
            item = undefined;
            body = undefined;
        }, function (err) {
            dfd.reject(err);
            body = undefined;
            err = undefined;
        });

        return dfd.promise;
    }

    loadDetailRegistered(body) {
        let dfd = q.defer();
        MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id).then(function (item) {
            if ((item.type == MEETING_ROOM_TYPE.MEETING_ROOM &&
                !body.session.rule.some(e => e.rule === "Office.MeetingRoomSchedule.Approval")) ||
                (meetingRoomSchedule.type == MEETING_ROOM_TYPE.LECTURE_HALL_CLASSROOM &&
                    !body.session.rule.some(e => e.rule === "Office.LectureHallClassRoom.Approval")
                )
            ) {
                throw new BaseError(
                    "MeetingRoomController.changeStatus.YouHaveNotPermissionToPerformThisOperationOrDataIsNotExists",
                    "YouHaveNotPermissionToPerformThisOperationOrDataIsNotExists"
                );
            }
            dfd.resolve(item);
            item = undefined;
            body = undefined;
        }, function (err) {
            dfd.reject(err);
            body = undefined;
            err = undefined;
        });

        return dfd.promise;
    }

    updateRegistered(req) {
        let dfd = q.defer();
        let data;
        let attachments;
        let newAttachments = [];
        let action = MEETING_ROOM_ACTION_NAME.UPDATE;

        FileProvider.upload(req, nameLib, validation.update, undefined, parentFolder, req.body.username).then(function (res) {
            data = genDataUpdate(res.Fields);

            attachments = fileUtil.getUploadedFilesWithSpecificKey({
                nameLib,
                formData: res,
                fieldKey: "file",
            });
            attachments = attachments.map(item=>({
                ...item,
                id: uuidv4()
            }));            
            MeetingRoomService.loadDetail(req.body._service[0].dbname_prefix, data.id).then(function (meetingRoomSchedule) {
                if(meetingRoomSchedule.status !== MEETING_ROOM_SCHEDULE_STATUS.REGISTERED && meetingRoomSchedule.status !== MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED ){
                    dfd.reject('Do not has permission');
                }else{
                    newAttachments = meetingRoomSchedule.attachments.filter(file=> !data.removeAtachments.includes(file.id));
                    data.newAttachments = newAttachments.concat(attachments);
                    const event = {
                        username: req.body.username,
                        time: new Date().getTime(),
                        action: action,
                        id: uuidv4(),
                        note: req.body.note
                    }
                    MeetingRoomService.updateRegistered(req.body._service[0].dbname_prefix, req.body.username, meetingRoomSchedule._id, data, event).then(function(documentUpdate){
                        dfd.resolve(documentUpdate);
                        const attachmentsDelete = meetingRoomSchedule.attachments.filter(item=> data.removeAtachments.includes(item.id));
                        FileProvider.delete(body._service[0].dbname_prefix, req.body.session, nameLib, attachmentsDelete, meetingRoomSchedule.username, folderArray);
                    },function(err){
                        dfd.reject(err);
                    })
                }
            }, function (err) {
                dfd.reject(err);
            });

        }, function (err) {
            dfd.reject(err);
        })
        
        return dfd.promise;
    }

    approve_department(req) {
        let dfd = q.defer();
        let data;
        let attachments;
        let newAttachments = [];
        const body = req.body;
        FileProvider.upload(req, nameLib, validation.approve_department, undefined, parentFolder, req.body.username).then(function (res) {
            verify_ApproveDepartment(body, res.Fields.id).then(function(ticketDetail){
                data = genDataApproveDepartment(res.Fields, ticketDetail, req.body.username);
                attachments = fileUtil.getUploadedFilesWithSpecificKey({
                    nameLib,
                    formData: res,
                    fieldKey: "file",
                });
                attachments = attachments.map(item=>({
                    ...item,
                    id: uuidv4()
                }));    
                newAttachments = ticketDetail.attachments.filter(file=> !data.removeAtachments.includes(file.id));
                data.newAttachments = newAttachments.concat(attachments);
                MeetingRoomService.approveDepartment(req.body._service[0].dbname_prefix, req.body.username, ticketDetail._id, data, data.event, MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED).then(function(documentUpdate){
                    dfd.resolve(true);
                    ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED;
                    ticketDetail.type = data.type;
                    findAndNotifyManagement(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE, data.event.action);
                    const attachmentsDelete = ticketDetail.attachments.filter(item=> data.removeAtachments.includes(item.id));
                    FileProvider.delete(body._service[0].dbname_prefix, req.body.session, nameLib, attachmentsDelete, ticketDetail.username, folderArray);
                },function(err){
                    dfd.reject(err);
                })

            },function(err) { dfd.reject(err);})
            
        }, function (err) {
            dfd.reject(err);
        })
        
        return dfd.promise;
    }

    reject_department(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveDepartment(body, body.id).then(function(ticketDetail){
            MeetingRoomService.assess_department_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.REJECTED,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.REJECT_DEPARTMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT, MEETING_ROOM_FROM_ACTION.REJECT_DEPARTMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    approve_management(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveManagement(body).then(function(ticketDetail){
            MeetingRoomService.assess_management_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED, body.room,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.APPROVE_MANAGEMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED;
                findAndNotifyLead(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE, MEETING_ROOM_FROM_ACTION.APPROVE_MANAGEMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    reject_management(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveManagement(body).then(function(ticketDetail){
            MeetingRoomService.assess_management_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.REJECTED, '',{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.REJECT_MANAGEMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT, MEETING_ROOM_FROM_ACTION.REJECT_MANAGEMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    approve_lead(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveLead(body).then(function(ticketDetail){
            const event = {
                username: body.username,
                time: new Date().getTime(),
                action: MEETING_ROOM_FROM_ACTION.APPROVE_LEAD,
                id: uuidv4(),
                note: body.note
            }
            if(body.room && body.room !== ticketDetail.room){
                event.data_change = {
                    room:{
                        old: ticketDetail.room,
                        new: body.room
                    }
                }
            }
            MeetingRoomService.assess_lead_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.APPROVED, body.room, event
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.APPROVED;
                findAndNotifyApprove(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE, MEETING_ROOM_FROM_ACTION.APPROVE_LEAD);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    reject_lead(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveLead(body).then(function(ticketDetail){
            const event = {
                username: body.username,
                time: new Date().getTime(),
                action: MEETING_ROOM_FROM_ACTION.REJECT_LEAD,
                id: uuidv4(),
                note: body.note
            }
            MeetingRoomService.assess_lead_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.REJECTED, '', event
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT, MEETING_ROOM_FROM_ACTION.REJECT_LEAD);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    request_cancel(req) {
        let dfd = q.defer();
        const body = req.body;
        const flow = MEETING_ROOM_SCHEDULE_FLOW.CANCEL;
        verify_RequestCancel(body).then(function(ticketDetail){
            const event = {
                username: body.username,
                time: new Date().getTime(),
                action: MEETING_ROOM_FROM_ACTION.REQUEST_CANCEL,
                id: uuidv4(),
                note: body.note
            }
            MeetingRoomService.request_cancel(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.REGISTERED, flow, event
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REGISTERED;
                findAndNotifyDepartment(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REQUEST_CANCEL, MEETING_ROOM_FROM_ACTION.REQUEST_CANCEL);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    approve_recall_department(req){
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveDepartment(body, body.id).then(function(ticketDetail){
            MeetingRoomService.assess_department_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_DEPARTMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED;
                findAndNotifyManagement(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE_RECALL, MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_DEPARTMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    reject_recall_department(req){
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveDepartment(body, body.id).then(function(ticketDetail){
            MeetingRoomService.reject_recall(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.APPROVED, MEETING_ROOM_SCHEDULE_FLOW.APPROVE,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.REJECT_RECALL_DEPARTMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT_RECALL, MEETING_ROOM_FROM_ACTION.REJECT_RECALL_DEPARTMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    approve_recall_management(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveManagement(body).then(function(ticketDetail){
            MeetingRoomService.assess_recall_management_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_MANAGEMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED;
                findAndNotifyLead(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE_RECALL, MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_MANAGEMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    reject_recall_management(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveManagement(body).then(function(ticketDetail){
            MeetingRoomService.reject_recall(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.APPROVED, MEETING_ROOM_SCHEDULE_FLOW.APPROVE,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.REJECT_RECALL_MANAGEMENT,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT_RECALL, MEETING_ROOM_FROM_ACTION.REJECT_RECALL_MANAGEMENT);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    approve_recall_lead(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveLead(body).then(function(ticketDetail){
            MeetingRoomService.assess_recall_lead_level(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.CANCELLED,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_LEAD,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.CANCELLED;
                findAndNotifyApprove(req, ticketDetail, MEETING_ROOM_ACTION_NAME.APPROVE_RECALL, MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_LEAD);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    reject_recall_lead(req) {
        let dfd = q.defer();
        const body = req.body;
        verify_ApproveLead(body).then(function(ticketDetail){
            MeetingRoomService.reject_recall(
                req.body._service[0].dbname_prefix,
                req.body.username, ticketDetail._id,
                MEETING_ROOM_SCHEDULE_STATUS.APPROVED, MEETING_ROOM_SCHEDULE_FLOW.APPROVE,{
                    username: body.username,
                    time: new Date().getTime(),
                    action: MEETING_ROOM_FROM_ACTION.REJECT_RECALL_LEAD,
                    id: uuidv4(),
                    note: body.note
                }
            ).then(function(){
                dfd.resolve(true);
                ticketDetail.status = MEETING_ROOM_SCHEDULE_STATUS.REJECTED;
                findAndNotifyReject(req, ticketDetail, MEETING_ROOM_ACTION_NAME.REJECT_RECALL, MEETING_ROOM_FROM_ACTION.REJECT_RECALL_LEAD);
            },function(err){
                dfd.reject(err);
            })

        },function(err) { dfd.reject(err);})
        return dfd.promise;
    }

    loadSchedule(body) {
        let filter;
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const startOfMonth = body.month ? new Date(body.year, body.month - 1, 1) : new Date(currentYear, currentMonth - 1, 1);
        const endOfMonth = body.year ? new Date(body.year, body.month, 0) : new Date(currentYear, currentMonth, 0);

        filter = { $and: [] };
        filter.$and.push({ status: { $eq: MEETING_ROOM_SCHEDULE_EVENT.APPROVED } });
        filter.$and.push({
            $and: [
                { date_start: { $gte: startOfMonth, $lte: endOfMonth } },
                { date_to: { $gte: startOfMonth, $lte: endOfMonth } }
            ]
        });


        return MeetingRoomService.loadSchedule(body._service[0].dbname_prefix, filter);
    }

    load_file_info(body) {
        let dfd = q.defer();
        MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id).then(
            function (data) {
                const fileInfo = data.attachments.find((item) => item.name === body.filename);
                if (fileInfo) {
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
                        },
                        function (err) {
                            dfd.reject(err);
                        },
                    );
                } else {
                    dfd.reject({ path: "MeetingRoomController.load_file_info.FileIsNotExists", mes: "FileIsNotExists" });
                }
            },
            function (err) {
                dfd.reject(err);
            },
        );

        return dfd.promise;
    }

export_excel(body) {
    let dfd = q.defer();
    const aggerationSearch = [];
    const aggerationSteps = BuildFilterAggregate.generatePermissionAggregate_ManageUI(body.username, body.session.employee_details.department, body.session.rule, MEETING_ROOM_TAB.CALENDAR, body.checks, aggerationSearch);
    const queryCriteria = { ...body, tab: MEETING_ROOM_TAB.CALENDAR };
    const filter = BuildFilterAggregate.generateUIFilterAggregate_export_excel(aggerationSteps, queryCriteria);
    const languageCurrent = body.session.language.current;

    var now = new Date();
    var todayDay = now.getDate().toString().padStart(2, '0');
    var todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    var todayYear = now.getFullYear().toString();

    function getDayMonthFullTextDate(value) {
        var date = new Date(value);
        var day = date.getDate().toString().padStart(2, '0');
        var month = (date.getMonth() + 1).toString().padStart(2, '0');
        var year = (date.getFullYear()).toString();
        return [day, month, year].join('/');
    }

    MeetingRoomService.executeAggregate(body._service[0].dbname_prefix, filter).then(function(events) {
        let dfdAr = [];
        dfdAr.push(loadRoomExportExcel(body, events));
        dfdAr.push(loadUserExportExcel(events, body));
        q.all(dfdAr).then(([rooms, users]) => {
            let rows = [];
            const calendarDates = genDataCalendar(events, body);

            var firstDayMonth = getDayMonthFullTextDate(body.date_start);
            var lastDayMonth = getDayMonthFullTextDate(body.date_end);

            for (let i = 0; i < 10; i++) {
                rows.push(new Array(12).fill(''));
            }

            rows[0][0] = 'TRƯỜNG ĐẠI HỌC Y KHOA';
            rows[1][0] = 'PHẠM NGỌC THẠCH';
            rows[2][0] = 'VĂN PHÒNG TRƯỜNG';
            rows[4][0] = 'Số: .../TB-VPT';
            rows[6][4] = 'THÔNG BÁO';
            rows[7][4] = 'Bảng tổng hợp lịch sử dụng phòng họp định kỳ *';
            rows[8][4] = `(Tuần ${getWeekNumber(body.date_start)} từ ngày ${firstDayMonth} đến ngày ${lastDayMonth})`;
            rows[0][rooms.length + 7 -3] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
            rows[1][rooms.length + 7 -3] = 'Độc lập - Tự do - Hạnh phúc';
            rows[4][rooms.length + 7 -3] = `Thành phố Hồ Chí Minh, ngày ${todayDay} tháng ${todayMonth} năm ${todayYear}`;

            let headerRow1 = [
                'STT',
                filterLanguage('DayEvent', languageCurrent).toUpperCase(),
                filterLanguage('Department proposed', languageCurrent).toUpperCase(),
                filterLanguage('Proposed', languageCurrent).toUpperCase(),
                filterLanguage('Content', languageCurrent).toUpperCase(),
                filterLanguage('HostPerson', languageCurrent).toUpperCase(),
                filterLanguage('Number of people', languageCurrent).toUpperCase(),
                // filterLanguage('Participant', languageCurrent),
                // filterLanguage('ParticipateDepartments', languageCurrent),
                // filterLanguage('AddressEvent', languageCurrent),
            ];
            headerRow1 = headerRow1.concat(rooms.map(room => room.title[languageCurrent]))

            let headerRow2 = [
                '',
                filterLanguage('DayEvent', languageCurrent),
                // filterLanguage('Start', languageCurrent),
                // filterLanguage('End', languageCurrent),
            ];

            rows.push(headerRow1);

            let stt = 1;
            let mergedCells = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
                { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
                { s: { r: 6, c: 4 }, e: { r: 6, c: 7 } },
                { s: { r: 7, c: 4 }, e: { r: 7, c: 7 } },
                { s: { r: 8, c: 4 }, e: { r: 8, c: 7 } },
                { s: { r: 0, c: rooms.length + 7 -3 }, e: { r: 0, c: rooms.length + 7 } },
                { s: { r: 1, c: rooms.length + 7 -3 }, e: { r: 1, c: rooms.length + 7 } },
                { s: { r: 4, c: rooms.length + 7 -3 }, e: { r: 4, c: rooms.length + 7 } },
                // { s: { r: 10, c: 1 }, e: { r: 10, c: 3 } }
            ];

            // for (let i = 0; i < headerRow1.length; i++) {
            //     if (i !== 1 && i !== 2 && i !== 3) {
            //         mergedCells.push({ s: { r: 10, c: i }, e: { r: 11, c: i } });
            //     }
            // }

            calendarDates.forEach((day, dayIndex) => {
                let dayEvents = day.events.length > 0 ? day.events : [null];
                let startRow = rows.length;

                dayEvents.forEach((d, eventIndex) => {
                    
                    const listRoom = deepClone(rooms);
                    const roomEvents = [];
                    listRoom.forEach(room=>{
                        if(d && room.value === d.room){
                            roomEvents.push(`${d.start_time_event} - ${d.end_time_event}`);
                        }else{
                            roomEvents.push('');
                        }
                    })
                    let row = [
                        stt++,
                        eventIndex === 0 ? `${filterLanguage(day.weekDay, languageCurrent)} \n ${formatTimestamp(day.value)}` : '',
                        d ? d.department_title[languageCurrent] : '',
                        d ? d.username : '',
                        d ? d.content : '',
                        d ? d.host : '',
                        d ? `${d.person} người` : '',
                        // d ? d.participants.join('\n') : '',
                        // d ? d.to_department_titles.map(department => department[languageCurrent]).join('\n') : '',
                    ];
                    row = row.concat(roomEvents);
                    rows.push(row);
                });

                if (dayEvents.length > 1) {
                    mergedCells.push({ s: { r: startRow, c: 1 }, e: { r: rows.length - 1, c: 1 } });
                }
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const borderStyle = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            ws['!cols'] = [
                {wch: 10},  // Cột A độ rộng 10 ký tự
                {wch: 20},  // Cột B độ rộng 20 ký tự
                {wch: 20},  // Cột B độ rộng 20 ký tự
                {wch: 20},  // Cột B độ rộng 20 ký tự
                {wch: 20},  // Cột B độ rộng 20 ký tự
                {wch: 20},  // Cột B độ rộng 20 ký tự
                {wch: 10},  // Cột B độ rộng 20 ký tự
            ];
           
            ws['!cols'] = ws['!cols'].concat(new Array(rooms.length).fill({wch: 20}))

            const headerStyle = {
                font: {
                    bold: true,
                    sz: 14 
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'center',
                    wrapText: true
                },
                border: borderStyle
            };
            const noBorderStyle = {
                top: null,
                bottom: null,
                left: null,
                right: null
            };

            const range = XLSX.utils.decode_range(ws['!ref']);
            if (!ws['!rows']) ws['!rows'] = [];
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellAddress]) ws[cellAddress] = {};
                    ws[cellAddress].s = ws[cellAddress].s || {};
                    if (R < 10 || R > 10 + stt) {
                        ws[cellAddress].s.border = noBorderStyle;
                        ws[cellAddress].s.fill = { fgColor: { rgb: "FFFFFF" } };
                        ws[cellAddress].s.alignment = {
                            horizontal: 'center',
                            vertical: 'center',
                            wrapText: true
                        };
                        if (ws[cellAddress].v) {
                            ws[cellAddress].s.font = { bold: true, sz: 14  };
                        }
                    } else {
                        if (R === 10) {
                            ws[cellAddress].s = { ...ws[cellAddress].s, ...headerStyle };
                        } else {
                            ws['!rows'][R] = { hpx: 35 };

                            ws[cellAddress].s.border = borderStyle;

                            ws[cellAddress].s.alignment = {
                                horizontal: 'center',
                                vertical: 'center',
                                wrapText: true
                            };
                            ws[cellAddress].s.font = { sz: 11 };
                        }
                    }
                }
            }
            
            ws['!merges'] = mergedCells;
            XLSX.utils.book_append_sheet(wb, ws, "Lịch làm việc");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            dfd.resolve(excelBuffer);
        }, function(err) { dfd.reject(err); });
    }, function(error) {
        dfd.reject(error);
    });

    return dfd.promise;
}
}

function loadRoomExportExcel(body, events){
    let dfd = q.defer();
    let conditions = [];
    if(Array.isArray(body.room_types) && body.room_types.length > 0){
        conditions.push({room_type: { $in: body.room_types }})
    }
    const languageCurrent = body.session.language.current;
    DirectoryService.loadRoom(body._service[0].dbname_prefix, conditions).then(rooms =>{
        events = events.map(event =>{
            const room = rooms.find(r => r.value === event.room);
            if(room){
                event.room_title = room.title[languageCurrent];
            }
            return {
                ...event
            }
        })
        dfd.resolve(rooms);
    }, function(err){
        console.error(err);
    });
    return dfd.promise;
}

function loadUserExportExcel(events,body){
    let dfd = q.defer();
    const participants = events.reduce((acc, current) => {
        return acc.concat(current.participants);
    }, []);
    const users = events.reduce((acc, current) => {
        return acc.concat([current.username]);
    }, []);
    const hosts = events.reduce((acc, current) => {
        return acc.concat([current.host]);
    }, []);
    const list_users = [
        ...participants,
        ...users,
        ...hosts
    ]
    const filterUsers = {
        username: {$in: list_users }
    }
    UserService.loadUser(body._service[0].dbname_prefix, filterUsers).then(users =>{ 
        const userTitles = {};
        users.forEach(user =>{
            userTitles[user.username] = user.title;
        })
        events = events.forEach(event => {
            event.host = userTitles[event.host];
            event.username = userTitles[event.username];
            event.participants = event.participants.map(item => userTitles[item]);
        });
        dfd.resolve(userTitles);
    });
    return dfd.promise;
}

function genDataCalendar(events, body){
    events = events.map(event =>{
        return {
            ...event,
            start_date: event.date_start*1,
            end_date: event.date_end*1,
            start_date_text: new Date(event.date_start*1),
            end_date_text: new Date (event.date_end*1),
        }
    });
    const from_date = new Date(body.date_start);
    const to_date = new Date(body.date_end);
    return generateCalendar(from_date, to_date, events);
}

const genData = function (fields) {
    let result = {};
    result.title = fields.title;
    result.date_start = parseInt(fields.date_start);
    result.date_end = parseInt(fields.date_end);
    result.type = fields.type;
    result.host = fields.host;
    result.participants = JSON.parse(fields.participants);
    result.other_participants = JSON.parse(fields.other_participants);
    result.to_department = JSON.parse(fields.to_department);
    result.content = fields.content;
    result.person = fields.person * 1;
    result.teabreak = JSON.parse(fields.teabreak);
    if(result.teabreak){
        result.teabreak_text = fields.teabreak_text;
    }
    result.helpdesk = JSON.parse(fields.helpdesk);
    result.helpdesk_text = fields.helpdesk_text;
    if(result.helpdesk){
        result.helpdesk_text = fields.helpdesk_text;
    }
    result.service_proposal = JSON.parse(fields.service_proposal);
    result.service_proposal_text = fields.service_proposal_text;
    if(result.service_proposal){
        result.service_proposal_text = fields.service_proposal_text;
    }
    return result;
};

const genDataApproveDepartment = function (fields, item, username) {
    try{

        let result = {};
        let action = MEETING_ROOM_FROM_ACTION.APPROVE_DEPARTMENT;
        result.title = fields.title;
        result.date_start = parseInt(fields.date_start);
        result.date_end = parseInt(fields.date_end);
        result.type = fields.type;
        result.host = fields.host;
        result.participants = JSON.parse(fields.participants);
        result.other_participants = JSON.parse(fields.other_participants);
        result.to_department = JSON.parse(fields.to_department);
        result.content = fields.content;
        result.person = fields.person * 1;
        result.teabreak = JSON.parse(fields.teabreak);
        result.teabreak_text = fields.teabreak_text;
        result.helpdesk = JSON.parse(fields.helpdesk);
        result.helpdesk_text = fields.helpdesk_text;
        result.service_proposal = JSON.parse(fields.service_proposal);
        result.service_proposal_text = fields.service_proposal_text;
    
        const dataUpdate = getObjectDifferences(result, item);
    
        result.event = { 
            id: uuidv4(),
            username,
            time: new Date().getTime(),
            note: fields.note
        };
        if(Object.keys(dataUpdate).length > 0){
            action = MEETING_ROOM_FROM_ACTION.APPROVE_DEPARTMENT_AND_CHANGE;
            result.event.data_change = dataUpdate;
        }
        result.event.action = action;
        result.id = fields.id;
        result.removeAtachments = JSON.parse(fields.removeAtachments);
        return result;
    }catch(e){
        console.log(e);
    }
};

const genDataUpdate = function (fields) {
    let result = {};
    result.id = fields.id;
    result.title = fields.title;
    result.date_start = parseInt(fields.date_start);
    result.date_end = parseInt(fields.date_end);
    result.type = fields.type;
    result.host = fields.host;
    result.participants = JSON.parse(fields.participants);
    result.other_participants = JSON.parse(fields.other_participants);
    result.to_department = JSON.parse(fields.to_department);
    result.content = fields.content;
    result.person = fields.person * 1;
    result.teabreak = JSON.parse(fields.teabreak);
    result.teabreak_text = fields.teabreak_text;
    result.helpdesk = JSON.parse(fields.helpdesk);
    result.helpdesk_text = fields.helpdesk_text;
    result.service_proposal = JSON.parse(fields.service_proposal);
    result.service_proposal_text = fields.service_proposal_text;
    result.removeAtachments = JSON.parse(fields.removeAtachments);
    return result;
};

const genFilter_findUsersNotify = function(registration) {
    let filters = [];
    switch(registration.status){
        case MEETING_ROOM_SCHEDULE_STATUS.REGISTERED:
            filters = [
                {
                    $match:{
                    $or:[
                        {
                            rule:{
                                $elemMatch:{
                                    rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                    'details.type':'All',
                                },
                            },
                        },
                        {
                            rule: {
                                $elemMatch:{
                                    rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                    'details.type': 'Specific',
                                    'details.department': {$eq: registration.department}
                                },
                            },
                        },
                        {
                            $and:[
                                {
                                    rule: {
                                        $elemMatch: {
                                            rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                            'details.type': 'Working',
                                        },
                                    },
                                },
                                {
                                    department: {$eq: registration.department}
                                }
                            ]
                        },
                    ],
                    },
                },
            ];
            break;
        case MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED:
            filters = [
                {
                    $match:{
                        $or:[
                            {
                                rule: {
                                    $elemMatch :{
                                        rule: registration.type === ROOM_TYPE.CLASS ? 
                                                ROOM_RULE.CLASS_ROOM_CONFIRM: 
                                                ROOM_RULE.MEETING_ROOM_CONFIRM
                                    }
                                }
                            },
                            {
                                rule: {
                                    $elemMatch :{
                                        rule: registration.type === ROOM_TYPE.CLASS ? 
                                                ROOM_RULE.CLASS_ROOM_APPROVE_LEAD: 
                                                ROOM_RULE.MEETING_ROOM_APPROVE_LEAD
                                    }
                                }
                            },
                        ]
                    }
                }
            ];
            break;
        case MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED:
            filters = [
                {
                    $match: {
                        rule: {
                            $elemMatch :{
                                rule: registration.type === ROOM_TYPE.CLASS ? 
                                        ROOM_RULE.CLASS_ROOM_APPROVE_LEAD: 
                                        ROOM_RULE.MEETING_ROOM_APPROVE_LEAD
                            }
                        }
                    }
                }
            ];
        
        case MEETING_ROOM_SCHEDULE_STATUS.APPROVED:
        case MEETING_ROOM_SCHEDULE_STATUS.REJECTED:
        case MEETING_ROOM_SCHEDULE_STATUS.CANCELLED:
            filters = [
                {
                    $match:{
                    $or:[
                        {
                            rule:{
                                $elemMatch:{
                                    rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                    'details.type':'All',
                                },
                            },
                        },
                        {
                            rule: {
                                $elemMatch:{
                                    rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                    'details.type': 'Specific',
                                    'details.department': {$eq: registration.department}
                                },
                            },
                        },
                        {
                            $and:[
                                {
                                    rule: {
                                        $elemMatch: {
                                            rule: ROOM_RULE.APPROVE_LEVEL_DEPARTMENT,
                                            'details.type': 'Working',
                                        },
                                    },
                                },
                                {
                                    department: registration.department
                                }
                            ]
                        },

                        {
                            username: registration.username,
                        }
                    ],
                    },
                },
            ];
            break;
    }
    return filters;
}

function verify_ApproveDepartment(body, id){
    let dfd = q.defer();
    MeetingRoomService.loadDetail(body._service[0].dbname_prefix,id).then(function(ticketDetails){
        
        if(ticketDetails.status === MEETING_ROOM_SCHEDULE_STATUS.REGISTERED){
            if(checkRuleRadioDepartment(body.session.rule,ticketDetails.department,
                body.session.employee_details.department,
                ROOM_RULE.APPROVE_LEVEL_DEPARTMENT
            )){
                dfd.resolve(ticketDetails);
            }else{
                dfd.reject({path:"MeetingRoomController.verify_ApproveDepartment.NotPermission", mes:"NotPermission"});
            }
        }else{
            dfd.reject({path:"MeetingRoomController.verify_ApproveDepartment.StatusInvalid", mes:"StatusInvalid"});
        }
    },function(err){
        dfd.reject(err);
    })
    return dfd.promise;
}

function verify_ApproveManagement(body){
    let dfd = q.defer();
    MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id).then(function(ticketDetails){
        if(ticketDetails.status === MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED){
            const rule = ticketDetails.type === ROOM_TYPE.MEETING ? ROOM_RULE.MEETING_ROOM_CONFIRM : ROOM_RULE.CLASS_ROOM_CONFIRM;
            if(body.session.rule.some(e => e.rule === rule)){
                dfd.resolve(ticketDetails);
            }else{
                dfd.reject({path:"MeetingRoomController.verify_ApproveManagement.NotPermission", mes:"NotPermission"});
            }
        }else{
            dfd.reject({path:"MeetingRoomController.verify_ApproveManagement.StatusInvalid", mes:"StatusInvalid"});
        }
    },function(err){
        dfd.reject(err);
    })
    return dfd.promise;
}

function verify_ApproveLead(body){
    let dfd = q.defer();
    MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id).then(function(ticketDetails){
        if(ticketDetails.status === MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED || ticketDetails.status === MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED ){
            const rule = ticketDetails.type === ROOM_TYPE.MEETING ? ROOM_RULE.MEETING_ROOM_APPROVE_LEAD : ROOM_RULE.CLASS_ROOM_APPROVE_LEAD;
            if(body.session.rule.some(e => e.rule === rule)){
                dfd.resolve(ticketDetails);
            }else{
                dfd.reject({path:"MeetingRoomController.verify_ApproveLead.NotPermission", mes:"NotPermission"});
            }
        }else{
            dfd.reject({path:"MeetingRoomController.verify_ApproveLead.StatusInvalid", mes:"StatusInvalid"});
        }
    },function(err){
        dfd.reject(err);
    })
    return dfd.promise;
}

function verify_RequestCancel(body){
    let dfd = q.defer();
    MeetingRoomService.loadDetail(body._service[0].dbname_prefix, body.id).then(function(ticketDetails){
        if(ticketDetails.status === MEETING_ROOM_SCHEDULE_STATUS.APPROVED){
            if(checkRuleRadioDepartment(body.session.rule,ticketDetails.department,
                body.session.employee_details.department,
                ROOM_RULE.APPROVE_LEVEL_DEPARTMENT
            ) || ticketDetails.username === body.username){

                dfd.resolve(ticketDetails);
            }else{
                dfd.reject({path:"MeetingRoomController.verify_RequestCancel.NotPermission", mes:"NotPermission"});
            }
        }else{
            dfd.reject({path:"MeetingRoomController.verify_RequestCancel.StatusInvalid", mes:"StatusInvalid"});
        }
    },function(err){
        dfd.reject(err);
    })
    return dfd.promise;
}

function findAndNotifyManagement(req, item, action, from_action) {
    const rule = item.type === ROOM_TYPE.CLASS ? ROOM_RULE.CLASS_ROOM_CONFIRM : ROOM_RULE.MEETING_ROOM_CONFIRM;
    const filter = genFilterRuleUser(rule, item.department);
    
    notify(req, filter, action,{
        code: item.code,
        title: item.title,
        username_create_ticket: item.username,
        status: item.status,
        roomType: item.type
    }, from_action);
    
}

function findAndNotifyLead(req, item, action, from_action) {
    const rule = item.type === ROOM_TYPE.CLASS ? ROOM_RULE.CLASS_ROOM_APPROVE_LEAD : ROOM_RULE.MEETING_ROOM_APPROVE_LEAD;  
    const filter = genFilterRuleUser(rule, item.department);
    
    notify(req, filter, action,{
        code: item.code,
        title: item.title,
        username_create_ticket: item.username,
        status: item.status,
        roomType: item.type
    }, from_action);
    
}

function findAndNotifyReject(req, item, action, from_action){
    const users = [...new Set(item.event.map(item => item.username).filter(user => user !== req.body.username))];

    const params = {
        code: item.code,
        title: item.title,
        username_create_ticket: item.username,
        status: item.status,
        roomType: item.type,
        action_by: req.body.username
    }

    RingBellItemService.insert(
        req.body._service[0].dbname_prefix,
        req.body.username,
        action,
        params,
        users,
        [],
        from_action,
        new Date().getTime()
    )
}

function findAndNotifyApprove(req, item, action, from_action){
    const rule = ROOM_RULE.APPROVE_LEVEL_DEPARTMENT;
    const filter = genFilterRuleUser(rule, item.department, [
        {
            username: { $eq: item.username },
        },
        {
            username: { $in: item.participants },
        },
        {
            username: { $eq: item.host },
        }
    ]);

    notify(req, filter, action,{
        code: item.code,
        title: item.title,
        username_create_ticket: item.username,
        status: item.status,
        roomType: item.type
    }, from_action);
}

function findAndNotifyDepartment(req, item, action, from_action) {
    const rule = [ROOM_RULE.APPROVE_LEVEL_DEPARTMENT, ROOM_RULE.NOTIFY_DEPARTMENT];
    const filter = genFilterRuleUser(rule, item.department, [
        {
            username: { $eq: item.username },
        }
    ])
    notify(req, filter, action,{
        code: item.code,
        title: item.title,
        username_create_ticket: item.username,
        status: item.status,
        roomType: item.type
    }, from_action);
}

function notify(req, filter, action, params, from_action){
    UserService.getNotifyUsers(req.body._service[0].dbname_prefix, filter).then(function (users) {   
        users = users.map(e => e.username).filter(e => e !== req.body.username);
        RingBellItemService.insert(
            req.body._service[0].dbname_prefix,
            req.body.username,
            action,
            params,
            users,
            [],
            from_action,
            new Date().getTime()
        )
        
    }, function (err) {
        console.log(action, JOSN.stringify(err));
    })
}

exports.MeetingRoomController = new MeetingRoomController();
