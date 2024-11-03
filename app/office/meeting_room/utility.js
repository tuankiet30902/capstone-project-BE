const q = require("q");

const { ROOM_RULE,
    ROOM_TYPE,
    MEETING_ROOM_SCHEDULE_STATUS,
    SCHEDULE_MEETING_ROOM_FEATURE_NAME,
    MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB,
    MEETING_ROOM_TAB,
    MEETING_ROOM_SCHEDULE_FLOW,
    MEETING_ROOM_FROM_ACTION
} = require('./const');
const { RULE_EVENT_CALENDAR, STATUS_EVENT_CALENDAR, EVENT_FEATURE_NAME, LEVEl_CALENDAR } = require('../event_calendar/const');
const { RULE_CAR, STATUS_CAR, CAR_FEATURE_NAME } = require('../car_management/const');
const { status } = require("@shared/multi_tenant/pnt-tenant");
const { convertToStartOfDay, convertToEndOfDay } = require("@utils/util");
function doSearchFilter(aggregationSteps = [], queryCriteria) {
    if (queryCriteria.search) {
        aggregationSteps.push({
            $match:
            {
                $text: {
                    $search: `"${queryCriteria.search}"`,
                },
            }
            ,
        });
    }
    return aggregationSteps;
}

function doFilter(aggregationSteps = [], queryCriteria) {
    const dateStart = convertToStartOfDay(queryCriteria.date_start);
    const dateEnd = convertToEndOfDay(queryCriteria.date_end);
    const tab = queryCriteria.tab;
    const conditions = [];
    if(dateStart && dateEnd){
        conditions.push({ date_start: { $gte: dateStart } });
        conditions.push({ date_end: { $lte: dateEnd } });
    }

    if(Array.isArray(queryCriteria.room_types) && queryCriteria.room_types.length > 0){
        conditions.push({ type: { $in: queryCriteria.room_types } });
    }

    if(tab === MEETING_ROOM_TAB.CALENDAR){
        conditions.push({ status: MEETING_ROOM_SCHEDULE_STATUS.APPROVED });
        conditions.push({ flow: MEETING_ROOM_SCHEDULE_FLOW.APPROVE });
    }

    if(conditions.length > 0){
        aggregationSteps.push({
            $match:{
                $and:[...conditions]
            }
        })
    }

    return aggregationSteps;
}

function addDepartmentFields(aggregationSteps = []) {
    // Chuyển đổi trường department thành chuỗi để đảm bảo khớp với id trong collection organization
    aggregationSteps.push({
        $addFields: {
            department_id: { $toString: "$department" }
        }
    });

    // Lookup để lấy thông tin từ collection organization
    aggregationSteps.push({
        $lookup: {
            from: "organization",
            localField: "department_id",
            foreignField: "id",
            as: "organization_info"
        }
    });

    // Unwind kết quả lookup
    aggregationSteps.push({
        $unwind: {
            path: "$organization_info",
            preserveNullAndEmptyArrays: true
        }
    });

    // Thêm trường title từ organization vào task
    aggregationSteps.push({
        $addFields: {
            department_title: {
                $ifNull: ["$organization_info.title", false]
            }
        }
    });

    //to_department
    aggregationSteps.push({
        $addFields: {
            to_department_ids: {
                $map: {
                    input: "$to_department",
                    as: "dept",
                    in: { $toString: "$$dept" }
                }
            }
        }
    });

    aggregationSteps.push({
        $lookup: {
            from: "organization",
            localField: "to_department_ids",
            foreignField: "id",
            as: "to_department_info"
        }
    });

    aggregationSteps.push({
        $addFields: {
            to_department_titles: {
                $map: {
                    input: "$to_department_ids",
                    as: "dept_id",
                    in: {
                        $let: {
                            vars: {
                                matched_dept: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$to_department_info",
                                                cond: { $eq: ["$$this.id", "$$dept_id"] }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: { $ifNull: ["$$matched_dept.title", false] }
                        }
                    }
                }
            }
        }
    });

    // Loại bỏ trường organization_info tạm thời
    aggregationSteps.push({
        $project: {
            organization_info: 0,
            to_department_info: 0,
            to_department_ids: 0
        }
    });

}

function addDriveFields(aggregationSteps = []) {
    
    aggregationSteps.push({
        $lookup: {
            from: "employee",
            localField: "driver",
            foreignField: "username",
            as: "driver_info"
        }
    });
    
    // Bước $addFields để lấy phần tử đầu tiên của mảng driver_info
    aggregationSteps.push({
        $addFields: {
            driver_detail: {
                $cond: {
                    if: { $and: [
                        { $ne: ["$driver", null] },
                        { $ne: ["$driver", ""] },
                        { $ne: [{ $type: "$driver" }, "missing"] }
                    ]},
                    then: { $ifNull: [{ $arrayElemAt: ["$driver_info", 0] }, {}] },
                    else: null
                }
            }
        }
    });
    
    // Loại bỏ trường driver_info tạm thời
    aggregationSteps.push({
        $project: {
            driver_info: 0
        }
    });
}

function doSort(aggregationSteps = [], queryCriteria) {
    if (queryCriteria.sort) {
        aggregationSteps.push({ $sort: queryCriteria.sort });
    }
}

function doPagination(aggregationSteps = [], queryCriteria) {
    if (parseInt(queryCriteria.offset)) {
        aggregationSteps.push({
            $skip: parseInt(queryCriteria.offset)
        });
    }
    if (parseInt(queryCriteria.top)) {
        aggregationSteps.push({
            $limit: parseInt(queryCriteria.top)
        });
    }

}

function doCount(aggregationSteps = []) {
    aggregationSteps.push({
        $count: "count",
    });
}

function generateAggerationCondition_room(department, rule) {
    const conditions = [];
    const ruleApproveDepartmentLevel = rule.filter(e => e.rule === ROOM_RULE.APPROVE_LEVEL_DEPARTMENT)[0];
    const ruleCancel = rule.filter(e => e.rule ===ROOM_RULE.REQUEST_CANCEL);
    
    if (ruleApproveDepartmentLevel && ruleApproveDepartmentLevel.details) {
        switch (ruleApproveDepartmentLevel.details.type) {
            case "All":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.REGISTERED } }
                    ]

                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        {
                            status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.REGISTERED }
                        },
                        {
                            department: { $in: ruleApproveDepartmentLevel.details.department }
                        }
                    ]

                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        {
                            status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.REGISTERED }
                        },
                        {
                            department: { $eq: department }
                        }
                    ]

                });
                break;
        }

    }

    if (ruleCancel && ruleCancel.details) {
        switch (ruleCancel.details.type) {
            case "All":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                    ]

                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        {
                            department: { $in: ruleApproveDepartmentLevel.details.department }
                        }
                    ]

                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        {
                            department: { $eq: department }
                        }
                    ]

                });
                break;
        }
    }

    if (rule.filter(e => e.rule === ROOM_RULE.CLASS_ROOM_CONFIRM)[0]) {
        conditions.push({
            $and: [
                { status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED } },
                { type: { $eq: ROOM_TYPE.CLASS } },
                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } }
            ]
        });
    }

    if (rule.filter(e => e.rule === ROOM_RULE.CLASS_ROOM_APPROVE_LEAD)[0]) {
        conditions.push({
            $and: [
                { status: { $in: [MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED] } },
                // { status: { $in: [MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED, MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED] } },
                { type: { $eq: ROOM_TYPE.CLASS } },
                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } }
            ]
        });
    }

    if (rule.filter(e => e.rule === ROOM_RULE.MEETING_ROOM_CONFIRM)[0]) {
        conditions.push({
            $and: [
                { status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.DEPARTMENT_APPROVED } },
                { type: { $eq: ROOM_TYPE.MEETING } },
                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } }
            ]
        });
    }

    if (rule.filter(e => e.rule === ROOM_RULE.MEETING_ROOM_APPROVE_LEAD)[0]) {
        conditions.push({
            $and: [
                { status: { $in: [ MEETING_ROOM_SCHEDULE_STATUS.CONFIRMED] } },
                { type: { $eq: ROOM_TYPE.MEETING } },
                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } }
            ]
        });
    }
    return conditions
}

function generateAggerationCondition_car(username, department, rule) {
    const conditions = [];
    conditions.push({
        $and: [
            { username: { $eq: username } },
            { assign_card: true },
            { status: { $in: [STATUS_CAR.LEAD_EXTERNAL_APPROVED, STATUS_CAR.CREATOR_RECEIVED_CARD] } },
            { feature: { $eq: CAR_FEATURE_NAME } }
        ]
    });

    const ruleApproveDepartmentLevel = rule.filter(e => e.rule === RULE_CAR.APPROVE_DEPARTMENT)[0];
    if (ruleApproveDepartmentLevel && ruleApproveDepartmentLevel.details) {
        switch (ruleApproveDepartmentLevel.details.type) {
            case "All":
                conditions.push({
                    $and: [
                        { feature: { $eq: CAR_FEATURE_NAME } },
                        { status: { $eq: STATUS_CAR.CREATED } }
                    ]

                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        { feature: { $eq: CAR_FEATURE_NAME } },
                        {
                            status: { $eq: STATUS_CAR.CREATED }
                        },
                        {
                            department: { $in: ruleApproveDepartmentLevel.details.department }
                        }
                    ]

                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        { feature: { $eq: CAR_FEATURE_NAME } },
                        {
                            status: { $eq: STATUS_CAR.CREATED }
                        },
                        {
                            department: { $eq: department }
                        }
                    ]

                });
                break;
        }

    }
    if (rule.filter(e => e.rule === RULE_CAR.CONFIRM)[0]) {
        conditions.push({
            $and: [
                { feature: { $eq: CAR_FEATURE_NAME } },
                { status: { $in: [STATUS_CAR.LEADER_DEPARTMENT_APPROVED, STATUS_CAR.CREATOR_RETURNED_CARD] } }
            ]

        });
    }

    if (rule.filter(e => e.rule === RULE_CAR.APPROVE_LEAD)[0]) {
        conditions.push({
            $and: [
                { feature: { $eq: CAR_FEATURE_NAME } },
                { status: { $eq: STATUS_CAR.CONFIRMER_APPROVED } }
            ]

        });
    }

    if (rule.filter(e => e.rule === RULE_CAR.APPROVE_LEAD_EXTERNAL)[0]){
        conditions.push({
            $and: [
                { feature: { $eq: CAR_FEATURE_NAME } },
                { status: { $eq: STATUS_CAR.LEAD_APPROVED_CAR } }
            ]
        });
    }

    return conditions
}

function generateAggerationCondition_event(department, rule, username) {
    const conditions = [];
    const ruleApproveDepartmentLevel = rule.filter(e => 
        e.rule === RULE_EVENT_CALENDAR.APPROVE_DEPARTMENT
    )[0];
    
    if (ruleApproveDepartmentLevel && ruleApproveDepartmentLevel.details) {
        switch (ruleApproveDepartmentLevel.details.type) {
            case "All":
                conditions.push({
                   $and: [
                    { feature: { $eq: EVENT_FEATURE_NAME }},
                    { status:  { $eq: STATUS_EVENT_CALENDAR.CREATED }}
                   ]
                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        { feature:  { $eq: EVENT_FEATURE_NAME }},
                        { status:  { $eq:  STATUS_EVENT_CALENDAR.CREATED}},
                        { department: { $in: ruleApproveDepartmentLevel.details.department }, }
                    ]
                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        { feature: { $eq: EVENT_FEATURE_NAME}},
                        { status: { $eq: STATUS_EVENT_CALENDAR.CREATED}},
                        { department: { $eq: department } }
                    ]
                });
                break;
        }
    }

    // Người chủ trì
    conditions.push({
        $and:[
            { feature: { $eq: EVENT_FEATURE_NAME} },
            { status: { $eq: STATUS_EVENT_CALENDAR.LEADER_DEPARTMENT_APPROVED}},
            { main_person: { $eq: username } },
            { level: { $eq: LEVEl_CALENDAR.LEVEL_1 } }
        ]
    });
    if (conditions.length > 0) {
        return {
            $and:[
                { end_date: { $gte: new Date().getTime() } },
                { $or: [
                    ...conditions,
                ] 
                }
            ]
        };
    } else {
        return [{ _id: { $eq: false } }];
    }
}

function generateAggerationCondition_DepartmentReponsibility(department, rule) {
    const conditions = [];
    const conditionsDepartmentLead = [];
    const conditionsManage = [];
    const ruleManageInformation = rule.filter(e => e.rule === ROOM_RULE.MANAGE_INFORMATION)[0];
    if (ruleManageInformation && ruleManageInformation.details) {
        switch (ruleManageInformation.details.type) {
            case "All":
                conditionsManage.push({ feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } });
                break;
            case "Specific":
                conditionsManage.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { 
                            $or: [
                                { department: { $in: ruleManageInformation.details.department } },
                                { to_department: { $in: ruleManageInformation.details.department } }
                            ] 
                        }
                    ]

                });
                break;
            case "Working":
                conditionsManage.push({
                    $and: [
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { 
                            $or: [
                                { department: { $eq: department } },
                                { to_department: { $eq: department } },
                            ] 
                        }
                    ]

                });
                break;
        }
    }

    //Kiểm tra có phải là trưởng phòng không
    const ruleDepartmentLead = rule.filter(e => e.rule === ROOM_RULE.APPROVE_LEVEL_DEPARTMENT)[0];
    if (ruleDepartmentLead && ruleDepartmentLead.details) {
        switch (ruleDepartmentLead.details.type) {
            case "All":
                conditionsDepartmentLead.push({ feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } });
                break;
            case "Specific":
                conditionsDepartmentLead.push({
                    $and:[
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        {
                            $or: [
                                { department: { $in: ruleDepartmentLead.details.department } },
                                { to_department: { $in: ruleDepartmentLead.details.department } },
                            ]
                        }
                    ]
                });
                break;
            case "Working":
                conditionsDepartmentLead.push({
                    $and:[
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { 
                            $or: [
                                { department: { $eq: department } },
                                { to_department: { $eq: department } },
                            ]
                        }
                    ]
                });
                break;
        }
    }

    if(conditionsManage.length > 0 || conditionsDepartmentLead.length > 0){
        conditions.push({
            $or:[
                ...conditionsManage,
                ...conditionsDepartmentLead,
            ]
        });
    }
    return conditions;
}

function generateAggerationCondition_Created(username) {
    const conditions = [];
    conditions.push({
        $and: [
            { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
            { username: { $eq: username } },
            {
                $or: [
                    {
                        $and: [
                            {
                                status: {
                                    $in: [MEETING_ROOM_SCHEDULE_STATUS.APPROVED,
                                    MEETING_ROOM_SCHEDULE_STATUS.REJECTED,
                                    MEETING_ROOM_SCHEDULE_STATUS.REQUEST_CANCEL]
                                }
                            },
                            // { date_end: { $gte: new Date().getTime() } }
                        ]
                    }, {
                        status: {
                            $nin: [MEETING_ROOM_SCHEDULE_STATUS.APPROVED,
                            MEETING_ROOM_SCHEDULE_STATUS.REJECTED,
                            MEETING_ROOM_SCHEDULE_STATUS.REQUEST_CANCEL]
                        }
                    }
                ]
            }
        ]
    });
    return conditions;
}

function generateAggerationCondition_Handle(department, rule) {
    return generateAggerationCondition_room(department, rule)
}

function generateAggerationCondition_Handled(username){
    const listActionHandled = [
        MEETING_ROOM_FROM_ACTION.APPROVE_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_DEPARTMENT_AND_CHANGE,
        MEETING_ROOM_FROM_ACTION.REJECT_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_LEAD,
        MEETING_ROOM_FROM_ACTION.REJECT_LEAD,
        MEETING_ROOM_FROM_ACTION.REQUEST_CANCEL,

        MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_DEPARTMENT_AND_CHANGE,
        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.APPROVE_RECALL_LEAD,
        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_LEAD,
    ];
    const NUM_YEAR = 1;
    const maxTimeShow = new Date();
    maxTimeShow.setFullYear(maxTimeShow.getFullYear() - NUM_YEAR);
    const conditions = [];
    conditions.push({
        $and: [
            { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
            {
                event: {
                    $elemMatch: {
                        username: username,
                        action: { $in: listActionHandled },
                        time: { $gte: maxTimeShow.getTime() },
                    },
                },
            },
        ],
    });

    return conditions;
}

function generateAggerationCondition_Rejected(username){
    const listActionHandled = [
        MEETING_ROOM_FROM_ACTION.REJECT_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_LEAD,

        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_DEPARTMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_MANAGEMENT,
        MEETING_ROOM_FROM_ACTION.REJECT_RECALL_LEAD,
    ];
    const NUM_YEAR = 1;
    const maxTimeShow = new Date();
    maxTimeShow.setFullYear(maxTimeShow.getFullYear() - NUM_YEAR);
    const conditions = [];
    conditions.push({
        $and: [
            { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
            {
                event: {
                    $elemMatch: {
                        username: username,
                        action: { $in: listActionHandled },
                        time: { $gte: maxTimeShow.getTime() },
                    },
                },
            },
        ],
    });

    return conditions;
}

function generateAggerationCondition_Approved(username){
    const conditions = []
    conditions.push({
        $and: [
            { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
            {
                status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.APPROVED }
            },
        ],
    });

    return conditions;
}

class BuildFilterAggregate {
    constructor() { }

    generateUIFilterAggregate_load(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        addDepartmentFields(aggregationSteps);
        addDriveFields(aggregationSteps);
        doSort(aggregationSteps, queryCriteria);
        doPagination(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }

    generateUIFilterAggregate_export_excel(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        addDepartmentFields(aggregationSteps);
        doSort(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }


    generatePermissionAggregate_QuickHandle(username, department, rule,aggregationSteps = [], features = []) {
        let conditions = [];
        if (features.includes(SCHEDULE_MEETING_ROOM_FEATURE_NAME) || features.length === 0) {
            const conditions_room = generateAggerationCondition_room(department, rule);
            conditions = conditions.concat(conditions_room);
        }

        if (features.includes(CAR_FEATURE_NAME) || features.length === 0) {
            const conditions_car = generateAggerationCondition_car(username, department, rule);
            conditions = conditions.concat(conditions_car);
        }

        if (features.includes(EVENT_FEATURE_NAME) || features.length === 0) {
            const conditions_event = generateAggerationCondition_event(department, rule, username);
            conditions = conditions.concat(conditions_event);
        }

        if (conditions.length > 0) {
            aggregationSteps.push({ $match: { $or: conditions } });
        } else {
            aggregationSteps.push({ $match: { _id: { $eq: false } } });
        }

        return aggregationSteps
    }

    generateUIFilterAggregate_count(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        doCount(aggregationSteps);
        return aggregationSteps;
    }

    generateUIFilterAggregate_search(aggregationSteps = [], queryCriteria) {
        doSearchFilter(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }

    generatePermissionAggregate_ManageUI(username, department, rule, tab, checks, aggregationSteps = []) {
        let conditions = [];
        switch (tab) {
            case MEETING_ROOM_TAB.MANAGEMENT:
                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.CREATED) !== -1) {
                    const createdConditions = generateAggerationCondition_Created(username);
                    conditions = conditions.concat(createdConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.NEED_HANDLE) !== -1) {
                    const needHandleConditions = generateAggerationCondition_Handle(department, rule);
                    conditions = conditions.concat(needHandleConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.RESPOSIBILITY_DEPARTMENT) !== -1) {
                    const responsibilityConditions = generateAggerationCondition_DepartmentReponsibility(department, rule);
                    conditions = conditions.concat(responsibilityConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.HANDLED) !== -1) {
                    const responsibilityConditions = generateAggerationCondition_Handled(username);
                    conditions = conditions.concat(responsibilityConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.REJECTED) !== -1) {
                    const responsibilityConditions = generateAggerationCondition_Rejected(username);
                    conditions = conditions.concat(responsibilityConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.APPROVED) !== -1) {
                    const responsibilityConditions = generateAggerationCondition_Approved(username);
                    conditions = conditions.concat(responsibilityConditions);
                }

                break;
            case MEETING_ROOM_TAB.CALENDAR:
                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.CREATED) !== -1) {
                    const createdConditions = generateAggerationCondition_Created(username);
                    conditions = conditions.concat(createdConditions);
                }

                if (checks.indexOf(MEETING_ROOM_CHECKLIST_ON_MANAGE_TAB.RESPOSIBILITY_DEPARTMENT) !== -1) {
                    const responsibilityConditions = generateAggerationCondition_DepartmentReponsibility(department, rule);
                    conditions = conditions.concat(responsibilityConditions);
                }

                if(rule.find(rule => rule.rule === ROOM_RULE.MEETING_ROOM_APPROVE_LEAD)){
                    conditions = conditions.concat([
                        {
                            $and:[
                                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                                {
                                    status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.APPROVED } 
                                },
                                {
                                    flow: { $eq: MEETING_ROOM_SCHEDULE_FLOW.APPROVE }
                                },
                                {
                                    type: { $eq: ROOM_TYPE.MEETING } 
                                }
                            ]
                        }
                    ])
                }

                if(rule.find(rule => rule.rule === ROOM_RULE.CLASS_ROOM_APPROVE_LEAD)){
                    conditions = conditions.concat([
                        {
                            $and:[
                                { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                                {
                                    status: { $eq: MEETING_ROOM_SCHEDULE_STATUS.APPROVED }
                                },
                                {
                                    type: { $eq: ROOM_TYPE.CLASS }
                                }
                            ]
                        }
                    ])
                }
                
                //Kiểm tra có phải người tham dự không
                conditions.push({
                    $and:[
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { participants: { $eq: username } }
                    ]
                });

                //Kiểm tra có phải host không
                conditions.push({
                    $and:[
                        { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                        { host:  { $eq: username } }
                    ]
                });

                //Kiểm tra có phải là người tiếp nhận thông tin cấp đơn vị hay không
                const ruleReceiveInformation = rule.find(e => e.rule === ROOM_RULE.RECEIVE_INFORMATION);
                if (ruleReceiveInformation && ruleReceiveInformation.details) {
                    switch (ruleReceiveInformation.details.type) {
                        case "All":
                            conditions.push({ feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } });
                            break;
                        case "Specific":
                            conditions.push({
                                $and: [
                                    { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                                    {
                                        to_department: { $in: ruleReceiveInformation.details.department } 
                                    }
                                ]
                            });
                            break;
                        case "Working":
                            conditions.push({
                                $and: [
                                    { feature: { $eq: SCHEDULE_MEETING_ROOM_FEATURE_NAME } },
                                    {
                                        to_department: { $eq: department } 
                                    }
                                ]
                            });
                            break;
                    }
                }
                break;
        }
        
        if (conditions.length > 0) {
            aggregationSteps.push({ $match: { $or: conditions } });
        } else {
            aggregationSteps.push({ $match: { _id: { $eq: false } } });
        }
        return aggregationSteps
    }
}

exports.BuildFilterAggregate = new BuildFilterAggregate();