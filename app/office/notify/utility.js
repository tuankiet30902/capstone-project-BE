const q = require("q");

const { NOTIFY_RULE, NOTIFY_STATUS, NOTIFY_SCOPE, NOTIFY_TAB } = require('./const');
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
}

function doFilter(aggregationSteps = [], queryCriteria) {

}

function doSoftDeleteFilter(aggregationSteps = []) {
    aggregationSteps.push({
        $match:
        {
            is_delete: { $ne: true }
        }
        ,
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

function generateAggerationCondition_Created(username) {
    const conditions = [];
    conditions.push({
        $or: [
            {
                $and: [
                    { username: { $eq: username } },
                    { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } },
                    { status: { $nin: [NOTIFY_STATUS.REJECTED, NOTIFY_STATUS.APPROVED, NOTIFY_STATUS.RECALLED] } }
                ]
            },
            {
                $and: [
                    { username: { $eq: username } },
                    { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } },
                    { status: { $in: [NOTIFY_STATUS.REJECTED, NOTIFY_STATUS.APPROVED, NOTIFY_STATUS.RECALLED] } },
                    { changeStatusTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() } }
                ]
            },
            {
                $and: [
                    { username: { $eq: username } },
                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } },
                    { status: { $nin: [NOTIFY_STATUS.REJECTED, NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED] } }
                ]
            },
            {
                $and: [
                    { username: { $eq: username } },
                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } },
                    { status: { $in: [NOTIFY_STATUS.REJECTED, NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED] } },
                    { changeStatusTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() } }
                ]
            }
        ]
    });
    return conditions;
}

function generateAggerationCondition_bookmark(username) {
    const conditions = [];
    conditions.push({
        $and: [
            { bookmark: { $eq: username } },
            {
                $or: [
                    { status: { $eq: NOTIFY_STATUS.APPROVED } },
                    {
                        $and: [
                            { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                            { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                        ]
                    }
                ]
            }
        ]
    });
    return conditions;
}

function generateAggerationCondition_notseen(username, department) {
    const conditions = [];
    conditions.push({
        $or: [
            {
                $and: [
                    { type: { $eq: "WholeSchool" } },
                    {
                        $or: [
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED } },
                                    { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } }
                                ]
                            },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            }
                        ]
                    },
                    {
                        $expr: {
                            $not: [
                                {
                                    $anyElementTrue: {
                                        $map: {
                                            input: "$event",
                                            as: "event",
                                            in: {
                                                $and: [
                                                    { $eq: ["$$event.username", username] },
                                                    { $eq: ["$$event.action", "Seen"] }
                                                ]
                                            }
                                        }
                                    }
                                }]
                        }
                    }
                ]
            }, {
                $and: [
                    { type: { $eq: "Employee" } },
                    {
                        $or: [
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED } },
                                    { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } }
                                ]
                            },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            }
                        ]
                    },
                    { to_employee: { $eq: username } },
                    {
                        $expr: {
                            $not: [
                                {
                                    $anyElementTrue: {
                                        $map: {
                                            input: "$event",
                                            as: "event",
                                            in: {
                                                $and: [
                                                    { $eq: ["$$event.username", username] },
                                                    { $eq: ["$$event.action", "Seen"] }
                                                ]
                                            }
                                        }
                                    }
                                }]
                        }
                    }
                ]
            }, {
                $and: [
                    { type: { $eq: "Department" } },
                    {
                        $or: [
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED } },
                                    { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } }
                                ]
                            },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            }
                        ]
                    },
                    { to_department: { $eq: department } },
                    {
                        $expr: {
                            $not: [
                                {
                                    $anyElementTrue: {
                                        $map: {
                                            input: "$event",
                                            as: "event",
                                            in: {
                                                $and: [
                                                    { $eq: ["$$event.username", username] },
                                                    { $eq: ["$$event.action", "Seen"] }
                                                ]
                                            }
                                        }
                                    }
                                }]
                        }
                    }
                ]
            }
        ]

    });
    return conditions;
}

function generateAggerationCondition_home(username, department) {
    const conditions = [];
    conditions.push({
        $or: [
            {
                $and: [
                    { type: { $eq: "WholeSchool" } },
                    {
                        $or: [
                            { status: { $in: [NOTIFY_STATUS.APPROVED, NOTIFY_STATUS.PENDING_RECALLED, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] } },
                            {
                                "event": {
                                  $all: [
                                    { $elemMatch: { action: NOTIFY_STATUS.PENDING_RECALLED } },
                                    { $elemMatch: { action: NOTIFY_STATUS.REJECTED } }
                                  ]
                                }
                            },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            }
                        ]
                    }
                ]
            }, {
                $and: [
                    { type: { $eq: "Employee" } },
                    {
                        $or: [
                            { status: { $in: [NOTIFY_STATUS.APPROVED, NOTIFY_STATUS.PENDING_RECALLED, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] } },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            },
                            {
                                "event": {
                                    $all: [
                                      { $elemMatch: { action: NOTIFY_STATUS.PENDING_RECALLED } },
                                      { $elemMatch: { action: NOTIFY_STATUS.REJECTED } }
                                    ]
                                  }
                            }
                        ]
                    },
                    { to_employee: { $eq: username } }
                ]
            }, {
                $and: [
                    { type: { $eq: "Department" } },
                    {
                        $or: [
                            { 
                                status: { $in: [NOTIFY_STATUS.APPROVED, NOTIFY_STATUS.PENDING_RECALLED, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] }
                            },
                            {
                                $and: [
                                    { status: { $eq: NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER } },
                                    { scope: { $eq: NOTIFY_SCOPE.INTERNAL } }
                                ]
                            },
                            {
                                "event": {
                                    $all: [
                                      { $elemMatch: { action: NOTIFY_STATUS.PENDING_RECALLED } },
                                      { $elemMatch: { action: NOTIFY_STATUS.REJECTED } }
                                    ]
                                  }
                            }
                        ]
                    },
                    { to_department: { $eq: department } }
                ]
            }
        ]

    });
    return conditions;
}

function generateAggerationCondition_needtohandle(rule, department) {
    const conditions = [];

    const ruleApproveDepartment = rule.filter(e => e.rule === NOTIFY_RULE.APPROVE_DEPARTMENT)[0];
    if (ruleApproveDepartment && ruleApproveDepartment.details) {
        switch (ruleApproveDepartment.details.type) {
            case "All":
                conditions.push({
                    status: { $in: [NOTIFY_STATUS.PENDING, NOTIFY_STATUS.PENDING_RECALLED] }
                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        {
                            status: { $in: [NOTIFY_STATUS.PENDING, NOTIFY_STATUS.PENDING_RECALLED] }
                        },
                        {
                            "department": { $in: ruleApproveDepartment.details.department }
                        }
                    ]

                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        {
                            status: { $in: [NOTIFY_STATUS.PENDING, NOTIFY_STATUS.PENDING_RECALLED] }
                        },
                        {
                            "department": { $eq: department }
                        }
                    ]

                });
                break;
        }
    }

    const ruleApproveLead = rule.filter(e => e.rule === NOTIFY_RULE.APPROVE_LEAD)[0];
    if (ruleApproveLead && ruleApproveLead.details) {
        switch (ruleApproveLead.details.type) {
            case "All":
                conditions.push({
                    $and: [
                        { status: { $in: [NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] } },
                        { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } }
                    ]

                });
                break;
            case "Specific":
                conditions.push({
                    $and: [
                        { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } },
                        {
                            status: { $in: [NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] }
                        },
                        {
                            "department": { $in: ruleApproveLead.details.department }
                        }
                    ]

                });
                break;
            case "Working":
                conditions.push({
                    $and: [
                        { scope: { $eq: NOTIFY_SCOPE.EXTERNAL } },
                        {
                            status: { $in: [NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER, NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER] }
                        },
                        {
                            "department": { $eq: department }
                        }
                    ]

                });
                break;
        }
    }
    return conditions;
}

function generateAggerationCondition_Handled(username, department, rule) {
    const listActionHandled = [
        NOTIFY_STATUS.APPROVED_BY_DEPARTMENT_LEADER,
        NOTIFY_STATUS.APPROVED,
        NOTIFY_STATUS.REJECTED,
        NOTIFY_STATUS.PENDING_RECALLED,
        NOTIFY_STATUS.APPROVED_RECALL_BY_DEPARTMENT_LEADER,
        NOTIFY_STATUS.RECALLED,
        
    ];
    const NUM_YEAR = 1;
    const maxTimeShow = new Date();
    maxTimeShow.setFullYear(maxTimeShow.getFullYear() - NUM_YEAR);
    const conditions = [];
    conditions.push({
        $and: [
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

function generateAggerationCondition_responsibile(rule, department) {
    const conditions = [];
    const ruleManageInformation = rule.filter(e => e.rule === NOTIFY_RULE.MANAGER)[0];
    if (ruleManageInformation && ruleManageInformation.details) {
        switch (ruleManageInformation.details.type) {
            case "All":
                break;
            case "Specific":
                conditions.push({
                    department: { $in: ruleManageInformation.details.department }
                });
                break;
            case "Working":
                conditions.push({
                    department: { $eq: department }
                });
                break;
        }
    }
    return conditions;
}


class BuildFilterAggregate {
    constructor() { }

    generateUIFilterAggregate_load(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        doSoftDeleteFilter(aggregationSteps);
        doSort(aggregationSteps, queryCriteria);
        doPagination(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }

    generatePermissionAggregate_QuickHandle(department, rule, aggregationSteps = []) {


        const conditions = generateAggerationCondition_needtohandle(rule, department);

        if (conditions.length > 0) {
            aggregationSteps.push({ $match: { $or: conditions } });
        } else {
            aggregationSteps.push({ $match: { _id: { $eq: false } } });
        }

        return aggregationSteps

    }

    generateUIFilterAggregate_count(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        doSoftDeleteFilter(aggregationSteps);
        doCount(aggregationSteps);
        return aggregationSteps;
    }

    generateUIFilterAggregate_search(aggregationSteps = [], queryCriteria) {
        doSearchFilter(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }

    generatePermissionAggregate_load(username, department, rule, checks, aggregationSteps = []) {
        let conditions = [];

        if (checks.indexOf(NOTIFY_TAB.CREATED) !== -1) {
            const createdConditions = generateAggerationCondition_Created(username);
            conditions = conditions.concat(createdConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.BOOKMARK) !== -1) {
            const bookmarkConditions = generateAggerationCondition_bookmark(username);
            conditions = conditions.concat(bookmarkConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.NEEDTOHANDLE) !== -1) {
            const needtohandleConditions = generateAggerationCondition_needtohandle(rule, department);
            conditions = conditions.concat(needtohandleConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.HANDLED) !== -1) {
            const needHandleConditions = generateAggerationCondition_Handled(username, department, rule);
            conditions = conditions.concat(needHandleConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.NOTSEEN) !== -1) {
            const notseenConditions = generateAggerationCondition_notseen(username, department);
            conditions = conditions.concat(notseenConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.REPONSIBILITY) !== -1) {
            const responsibilityConditions = generateAggerationCondition_responsibile(rule, department);
            conditions = conditions.concat(responsibilityConditions);
        }

        if (checks.indexOf(NOTIFY_TAB.HOME) !== -1) {
            const homeConditions = generateAggerationCondition_home(username, department);
            conditions = conditions.concat(homeConditions);
        }

        if (conditions.length > 0) {
            aggregationSteps.push({ $match: { $or: conditions } });
        } else {
            aggregationSteps.push({ $match: { _id: { $eq: false } } });
        }

        return aggregationSteps;
    }
}

exports.BuildFilterAggregate = new BuildFilterAggregate();
