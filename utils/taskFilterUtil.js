const { TASK_GROUP_FILTER, TAB_FILTER, TASK_LEVEL, TASK_STATUS, TASK_EVENT, TASK_PRIORITY, TASK_STATE, ROLE_FILTER } = require("./constant");

const INVALID_DATA = [undefined, null, "", "null", "undefined"];
const TASK_STATE_MILE_STONE = 75;

function prepareTaskState(aggregationSteps = []) {
    aggregationSteps.push({
        $addFields: {
            all_username: {
                $concatArrays: ["$main_person", "$participant", "$observer", ["$username"]],
            },
            total_duration: {
                $subtract: ["$to_date", "$from_date"],
            },
            last_updated_time: {
                $switch: {
                    branches: [
                        {
                            case: { $and: [{ $eq: ["$status", TASK_STATUS.COMPLETED] }] },
                            then: {
                                $toLong: {
                                    $ifNull: [
                                        {
                                            $arrayElemAt: [
                                                "$event.time",
                                                {
                                                    $indexOfArray: [
                                                        "$event.action",
                                                        TASK_EVENT.COMPLETED
                                                    ]
                                                }
                                            ]
                                        },
                                        {
                                            $toLong: "$$NOW",
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                    default: {
                        $toLong: "$$NOW",
                    },
                },
            },
        },
    });
    aggregationSteps.push({
        $addFields: {
            elapsed_percent: {
                $cond: [
                    { $eq: ["$total_duration", 0] },
                    100,
                    {
                        $round: [
                            {
                                $divide: [
                                    {
                                        $multiply: [
                                            {
                                                $subtract: ["$last_updated_time", "$from_date"],
                                            },
                                            100,
                                        ],
                                    },
                                    "$total_duration",
                                ],
                            },
                            0,
                        ],
                    },
                ],
            },
        },
    });
    aggregationSteps.push({
        $addFields: {
            state: {
                $switch: {
                    branches: [
                        {
                            case: { $eq: ["$status", TASK_STATUS.CANCELLED] },
                            then: TASK_STATUS.CANCELLED,
                        },
                        {
                            case: { $eq: ["$status", TASK_STATUS.COMPLETED] },
                            then: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $gt: ["$last_updated_time", "$to_date"] },
                                            then: TASK_STATE.LATE,
                                        },
                                        {
                                            case: { $gte: ["$elapsed_percent", TASK_STATE_MILE_STONE] },
                                            then: TASK_STATE.ON_SCHEDULE,
                                        },
                                    ],
                                    default: TASK_STATE.EARLY,
                                },
                            },
                        },
                        {
                            case: { $ne: ["$status", TASK_STATUS.COMPLETED] },
                            then: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $gt: ["$last_updated_time", "$to_date"] },
                                            then: TASK_STATE.OVERDUE,
                                        },
                                        {
                                            case: { $gte: ["$elapsed_percent", TASK_STATE_MILE_STONE] },
                                            then: TASK_STATE.GONNA_LATE,
                                        },
                                    ],
                                    default: TASK_STATE.OPEN,
                                },
                            },
                        },
                    ],
                    default: null,
                },
            },
        },
    });
}

function prepareTaskProgress(aggregationSteps = []) {
    aggregationSteps.push({
        $addFields: { task_id: { $toString: "$_id" } }
    });

    aggregationSteps.push({
        $lookup: {
            from: "task",
            localField: "task_id",
            foreignField: "head_task_id",
            as: "workItems",
        }
    });

    aggregationSteps.push({
        $addFields: {
            workItemsLength: {
                $size: "$workItems",
            },
            completedWorkItemsCount: {
                $size: {
                    $filter: {
                        input: "$workItems",
                        cond: {
                            $eq: ["$$this.status", TASK_STATUS.COMPLETED],
                        }
                    }
                }
            }
        }
    });

    aggregationSteps.push({
        $addFields: {
            progress: {
                $switch: {
                    branches: [
                        {
                            case: {
                                $gt: ["$workItemsLength", 0]
                            },
                            then: {
                                $floor: {
                                    $multiply: [
                                        {
                                            $divide: [
                                                "$completedWorkItemsCount",
                                                "$workItemsLength"
                                            ]
                                        },
                                        100
                                    ]
                                }
                            }
                        }
                    ],
                    default: "$progress"
                }
            }
        }
    })
}

function prepareTaskDefaultFields(aggregationSteps = []) {
    aggregationSteps.push({
        $addFields: {
            attachment: {
                $ifNull: ["$attachment", []],
            },
        },
    });
}

function prepareTaskDepartmentFilter(aggregationSteps = [], { body, check }) {
    const conditions = [];
    exports.generateTabFilterForDepartment(conditions, body.tab, {
        isGeneralInChief: check.isManager,
        department: body.department,
        employees: body.employee,
    });
    if (Array.isArray(body.employee) && body.employee.length > 0) {
        exports.generateEmployeeFilter(conditions, body.employee);
    } else {
        exports.generateDepartmentEmployeesFilter(conditions, body.department, body.departmentEmployees);
    }
    exports.generateStatusFilter(conditions, body.status);
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    exports.generateTaskGroupFilter(conditions, body.task_group);
    exports.generateProjectsFilter(conditions, body.projects);

    aggregationSteps.push({ $match: { $and: conditions } });
}

function prepareParentTaskFilterForDepartment(aggregationSteps = [], { body, check }) {
    const conditions = [];
    conditions.push({
        $and: [
            {
                $or: [
                    { department: { $eq: body.department } },
                    {
                        department: { $in: INVALID_DATA },
                        $or: [
                            { main_person: { $in: body.employee } },
                            { participant: { $in: body.employee } },
                            { observer: { $in: body.employee } },
                            { username: { $in: body.employee } },
                        ],
                    },
                ],
            },
            {
                $or: [
                    {
                        head_task_id: { $in: INVALID_DATA },
                        level: { $in: [TASK_LEVEL.TASK, TASK_LEVEL.HEAD_TASK] },
                    },
                    {
                        level: { $eq: TASK_LEVEL.TRANSFER_TICKET },
                        status: { $nin: [TASK_STATUS.PENDING_APPROVAL] },
                    },
                ],
            },
        ],
    });
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    exports.generateTaskGroupFilter(conditions, body.task_group);
    exports.generateProjectsFilter(conditions, body.projects);
    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareChildTaskFilterForDepartment(aggregationSteps = [], { body, check }) {
    const conditions = [];
    const childTaskConditions = {
        $and: [
            {
                $or: [
                    { department: { $eq: body.department } },
                    {
                        department: { $in: INVALID_DATA },
                        $or: [
                            { main_person: { $in: body.employee } },
                            { participant: { $in: body.employee } },
                            { observer: { $in: body.employee } },
                            { username: { $in: body.employee } },
                        ],
                    },
                ],
            },
            {
                $or: [{ level: { $eq: TASK_LEVEL.TASK } }, { level: { $exists: false } }],
            },
        ],
    }
    if (check.isManager) {
        conditions.push({
            $and: [
                { head_task_id: { $nin: INVALID_DATA } },
                {
                    $or: [
                        childTaskConditions,
                        {
                            department_assign_id: { $eq: body.department },
                            level: { $eq: TASK_LEVEL.TRANSFER_TICKET },
                        }
                    ]
                }
            ]
        });
    } else {
        conditions.push({
            $and: [
                { head_task_id: { $nin: INVALID_DATA } },
                childTaskConditions
            ]
        });
    }

    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    exports.generateTaskGroupFilter(conditions, body.task_group);
    exports.generateProjectsFilter(conditions, body.projects);

    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareStatisticCountDepartmentFilter(aggregationSteps = [], { body }) {
    const conditions = [];
    const departmentOrEmployeeFilter = {
        $or: [
            { department: body.department },
            { all_username: { $in: body.employee } },
        ],
    };
    conditions.push(departmentOrEmployeeFilter);
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    exports.generateTaskGroupFilter(conditions, body.task_group);
    exports.generateProjectsFilter(conditions, body.projects);
    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareTaskProjectFilter(aggregationSteps = [], { body, check }) {
    const conditions = [];
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateTabFilterForProject(conditions, body.tab, { project: body.project });
    exports.generateEmployeeFilter(conditions, body.participant);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    aggregationSteps.push({ $match: { $and: conditions } });
}

function prepareParentTaskFilterForProject(aggregationSteps = [], { body, check }) {
    const conditions = [
        { project: { $eq: body.project } },
        { head_task_id: { $in: INVALID_DATA } },
    ];
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateTaskEmployeeFilter(conditions, body.participant);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareChildTaskFilterForProject(aggregationSteps = [], { body, check }) {
    const conditions = [
        { project: { $eq: body.project } },
        { head_task_id: { $nin: INVALID_DATA } },
    ];
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateTaskEmployeeFilter(conditions, body.participant);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareStatisticCountProjectFilter(aggregationSteps = [], { body }) {
    const conditions = [];
    conditions.push({ project: { $eq: body.project } });
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generateTaskEmployeeFilter(conditions, body.participant);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    aggregationSteps.push({
        $match: {
            $and: conditions,
        },
    });
}

function prepareTaskPersonalFilter(aggregationSteps = [], { body }) {
    const conditions = [];
    exports.generateTabFilterForPersonal(conditions, body.tab, { username: body.username });
    exports.generateDateRangeFilter(conditions, body.from_date, body.to_date);
    exports.generatePriorityFilter(conditions, body.priority);
    exports.generateStatusFilter(conditions, body.status);
    exports.generateStateFilter(conditions, body.state);
    exports.generateTaskTypeFilter(conditions, body.task_type);
    exports.generateLabelFilter(conditions, body.label);
    exports.generateTaskGroupFilter(conditions, body.task_group);
    exports.generateProjectsFilter(conditions, body.projects);
    aggregationSteps.push({ $match: { $and: conditions } });
}

function prepareStatisticPersonalTabFilter(aggregationSteps = [], { body }) {
    switch (body.tab) {
        case TAB_FILTER.CREATED:
            aggregationSteps.push({
                $match: { username: { $eq: body.username } },
            });
            break;

        case TAB_FILTER.ASSIGNED:
            aggregationSteps.push({
                $or: [
                    { main_person: { $eq: body.username } },
                    { participant: { $eq: body.username } },
                    { observer: { $eq: body.username } },
                ],
            });
            break;
    }
}

function prepareSearch(aggregationSteps = [], { body }) {
    if (body.search) {
        aggregationSteps.push({
            $match:
            {
                $text: {
                    $search: `"${body.search}"`
                }
            }
        });
    }
}

function prepareStateSort(aggregationSteps = []) {
    aggregationSteps.push({
        $addFields: {
            stateOrder: {
                $switch: {
                    branches: [
                        {
                            case: { $eq: ["$state", TASK_STATE.OVERDUE] },
                            then: 1
                        },
                        {
                            case: { $eq: ["$state", TASK_STATE.GONNA_LATE] },
                            then: 2
                        },
                        {
                            case: { $eq: ["$state", TASK_STATE.OPEN] },
                            then: 3
                        },
                        {
                            case: { $eq: ["$state", TASK_STATE.LATE] },
                            then: 4
                        },
                        {
                            case: { $eq: ["$state", TASK_STATE.ON_SCHEDULE] },
                            then: 5
                        },
                        {
                            case: { $eq: ["$state", TASK_STATE.EARLY] },
                            then: 6
                        }
                    ],
                    default: 7,
                },
            },
        },
    })
    aggregationSteps.push({
        $sort: {
            "stateOrder": 1,
        },
    });

}

function prepareStatisticCount(aggregationSteps = []) {
    aggregationSteps.push({
        $group: {
            _id: "statistic",
            completed: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.COMPLETED] }, 1, 0],
                },
            },
            done: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.DONE] }, 1, 0],
                },
            },
            process: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.PROCESSING] }, 1, 0],
                },
            },
            not_start: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.NOT_STARTED_YET] }, 1, 0],
                },
            },
            cancelled: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.CANCELLED] }, 1, 0],
                },
            },
            pending_approval: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.PENDING_APPROVAL] }, 1, 0],
                },
            },
            waitting: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.WAITING_FOR_APPROVAL] }, 1, 0],
                },
            },
            
            not_seen: {
                $sum: {
                    $cond: [{ $eq: ["$status", TASK_STATUS.NOT_SEEN] }, 1, 0],
                },
            },
            all: {
                $sum: 1,
            },
        },
    });
    aggregationSteps.push({
        $unset: ["_id"]
    });
}

function prepareStatisticGrowth(aggregationSteps = []) {
    aggregationSteps.push({
        $facet: {
            created: [
                { $match: { date_created: { $exists: true, $type: "string" } } },
                { $group: { _id: "$date_created", count: { $sum: 1 } } },
            ],
            completed: [
                { $match: { date_completed: { $exists: true, $type: "string" } } },
                { $group: { _id: "$date_completed", count: { $sum: 1 } } },
            ],
            cancelled: [
                { $match: { date_cancelled: { $exists: true, $type: "string" } } },
                { $group: { _id: "$date_cancelled", count: { $sum: 1 } } },
            ]
        },
    });
}

function preparePagination(aggregationSteps = [], { body }) {
    if (parseInt(body.offset)) {
        aggregationSteps.push({
            $skip: parseInt(body.offset),
        });
    }
    if (parseInt(body.top)) {
        aggregationSteps.push({
            $limit: parseInt(body.top),
        });
    }

}

function prepareCount(aggregationSteps = []) {
    aggregationSteps.push({
        $count: "count",
    });
}

exports.generateTabFilterForDepartment = function (
    conditions = [],
    tab,
    { department, isGeneralInChief, employees = [] },
) {
    let filter;
    const filterTaskLevels = [TASK_LEVEL.HEAD_TASK];
    if (isGeneralInChief) {
        filterTaskLevels.push(TASK_LEVEL.TRANSFER_TICKET);
    }

    switch (tab) {
        case TAB_FILTER.HEAD_TASK:
            filter = {
                $and: [
                    { level: { $in: filterTaskLevels } },
                    { status: { $nin: [TASK_STATUS.PENDING_APPROVAL] } },
                ],
            };
            conditions.push(filter);
            break;

        case TAB_FILTER.TASK:
            filter = {
                $or: [
                    {
                        $and: [
                            { $or: [{ level: { $eq: "Task" } }, { level: { $exists: false } }] },
                        ],
                    },
                ],
            };
            if (isGeneralInChief) {
                filter.$or.push({
                    department_assign_id: { $eq: department },
                    level: { $eq: TASK_LEVEL.TRANSFER_TICKET },
                });
            }
            conditions.push(filter);
            break;
    }
};

exports.generateTabFilterForProject = function (conditions = [], tab, { project }) {
    switch (tab) {
        case TAB_FILTER.HEAD_TASK:
            conditions.push({
                $and: [
                    { project: { $eq: project } },
                    { level: { $in: [TASK_LEVEL.HEAD_TASK, TASK_LEVEL.TRANSFER_TICKET] } },
                    { status: { $nin: [TASK_STATUS.PENDING_APPROVAL] } },
                ],
            });
            break;
        case TAB_FILTER.TASK:
            conditions.push({
                $and: [
                    { project: { $eq: project } },
                    { $or: [{ level: { $eq: TASK_LEVEL.TASK } }, { level: { $exists: false } }] },
                ],
            });
            break;
    }
};


exports.generateTabFilterForPersonal = function (conditions = [], tab, { username }) {
    switch (tab) {
        case TAB_FILTER.CREATED:
            conditions.push({ username: { $eq: username } });
            break;
        case TAB_FILTER.ASSIGNED:
            conditions.push({
                $or: [
                    { main_person: { $eq: username } },
                    { participant: { $eq: username } },
                    { observer: { $eq: username } }
                ]
            });
            break;
        case TAB_FILTER.RESPONSIBLE:
            conditions.push({ main_person: { $eq: username } });
            break;
        case TAB_FILTER.SUPPORT:
            conditions.push({ participant: { $eq: username } });
            break;
        case TAB_FILTER.SUPERVISION:
            conditions.push({ observer: { $eq: username } });
            break;
    }
};

exports.generateSearchFilter = function (condition = [], val) {
    if (!val) {
        return;
    }
    condition.push({ $text: { $search: `"${val}"` } });
};

exports.generateStatusFilter = function (condition = [], val) {
    condition.push({
        status: {
            $nin: [TASK_STATUS.WAITING_FOR_ACCEPT, TASK_STATUS.REJECTED],
        },
    });
    if (Array.isArray(val) && val.length > 0) {
        condition.push({
            status: {
                $in: val,
            },
        });
    }
    if (!Array.isArray(val) && typeof val === "string") {
        condition.push({
            status: {
                $eq: val,
            },
        });
    }
};

exports.generateDateRangeFilter = function (condition = [], fromDate, toDate) {
    if (fromDate && toDate) {
        condition.push({
            $or: [
                {
                    $and: [{ from_date: { $lte: fromDate } }, { to_date: { $gte: fromDate } }],
                },
                {
                    $and: [{ from_date: { $lte: toDate } }, { to_date: { $gte: toDate } }],
                },
                {
                    $and: [{ from_date: { $gte: fromDate } }, { to_date: { $lte: toDate } }],
                },
                {
                    $and: [{ from_date: { $lte: fromDate } }, { to_date: { $gte: toDate } }],
                },
            ],
        });
    }
};

exports.generateEmployeeFilter = function (condition = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    condition.push({
        all_username: {
            $in: val,
        },
    });
};



exports.generateDepartmentEmployeesFilter = function (condition = [], department, employees = []) {
    condition.push({
        $or: [
            { department: { $eq: department } },
            {
                $or: [
                    { main_person: { $in: employees } },
                    { participant: { $in: employees } },
                    { observer: { $in: employees } },
                ],
            },
        ],
    });
};

exports.generatePriorityFilter = function (condition = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    condition.push({
        priority: { $in: val },
    });
};

exports.generateStateFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    conditions.push({
        state: {
            $in: val,
        },
    });
};

exports.generateTaskTypeFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    conditions.push({
        task_type: { $in: val },
    });
};

exports.generateLabelFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return null;
    }
    conditions.push({
        label: {
            $in: val,
        },
    });
};

exports.generateTaskGroupFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }

    const filter = {
        $or: [],
    };

    for (const valElement of val) {
        switch (valElement) {
            case TASK_GROUP_FILTER.DEPARTMENT:
                filter.$or.push({
                    department: {
                        $exists: true,
                        $ne: null,
                    },
                });
                break;

            case TASK_GROUP_FILTER.PROJECT:
                filter.$or.push({
                    project: {
                        $exists: true,
                        $ne: null,
                    },
                });
                break;
        }
    }
    if (filter.$or.length > 0) {
        conditions.push(filter);
    }
};

exports.generateTaskEmployeeFilter = function (conditions = [], val) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    conditions.push({
        $or: [
            { username: { $in: val } },
            { main_person: { $in: val } },
            { participant: { $in: val } },
            { observer: { $in: val } },
        ],
    });
};

exports.generateProjectsFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    conditions.push({
        project: {
            $in: val,
        },
    });
};

exports.generateRoleFilter = function (conditions = [], val = []) {
    if (!Array.isArray(val) || val.length === 0) {
        return;
    }
    conditions.push({
        project: {
            $in: val,
        },
    });
};

function prepareCombinedSort(aggregationSteps = []) {
    aggregationSteps.push({
        $addFields: {
            stateOrder: {
                $switch: {
                    branches: [
                        { case: { $eq: ["$state", TASK_STATE.OVERDUE] }, then: 1 },
                        { case: { $eq: ["$state", TASK_STATE.GONNA_LATE] }, then: 2 },
                        { case: { $eq: ["$state", TASK_STATE.OPEN] }, then: 3 },
                        { case: { $eq: ["$state", TASK_STATE.LATE] }, then: 4 },
                        { case: { $eq: ["$state", TASK_STATE.ON_SCHEDULE] }, then: 5 },
                        { case: { $eq: ["$state", TASK_STATE.EARLY] }, then: 6 }
                    ],
                    default: 7,
                },
            },
            statusOrder: {
                $switch: {
                    branches: [
                        { case: { $eq: ["$status", TASK_STATUS.NOT_SEEN] }, then: 1 },
                        { case: { $eq: ["$status", TASK_STATUS.PENDING_APPROVAL] }, then: 2 },
                        { case: { $eq: ["$status", TASK_STATUS.PROCESSING] }, then: 3 },
                        { case: { $eq: ["$status", TASK_STATUS.WAITING_FOR_APPROVAL] }, then: 4 },
                        { case: { $eq: ["$status", TASK_STATUS.COMPLETED] }, then: 5 },
                        { case: { $eq: ["$status", TASK_STATUS.CANCELLED] }, then: 6 }
                    ],
                    default: 7,
                },
            },
        },
    });
    aggregationSteps.push({
        $sort: { "stateOrder": 1, "statusOrder": 1 },
    });
}

exports.buildLoadBaseDepartmentAggregation = function (body, check) {
    const aggregationSteps = [];
    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskDefaultFields(aggregationSteps);
    prepareTaskDepartmentFilter(aggregationSteps, { body, check });
    prepareCombinedSort(aggregationSteps);
    preparePagination(aggregationSteps, { body });

    return aggregationSteps;
};

exports.buildCountBaseDepartmentAggregation = function (body, check) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskDepartmentFilter(aggregationSteps, { body, check });
    prepareCount(aggregationSteps);

    return aggregationSteps;
};

exports.buildGanttChartForDepartmentAggregation = function (body, check) {
    const parentTaskAggregation = [];
    const childTaskAggregation = [];

    prepareSearch(parentTaskAggregation, { body });
    prepareSearch(childTaskAggregation, { body });

    prepareTaskState(parentTaskAggregation);
    prepareTaskState(childTaskAggregation);

    prepareParentTaskFilterForDepartment(parentTaskAggregation, { body, check });
    prepareChildTaskFilterForDepartment(childTaskAggregation, { body, check });

    prepareStateSort(parentTaskAggregation);
    prepareStateSort(childTaskAggregation)

    return {
        parentTaskAggregation,
        childTaskAggregation,
    };
};

exports.buildStatisticDepartmentCountAggregation = function (body) {
    const aggregationSteps = [];
    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareStatisticCountDepartmentFilter(aggregationSteps, { body });
    prepareStatisticCount(aggregationSteps);
    return aggregationSteps;
};

exports.buildStatisticDepartmentGrowthAggregation = function (body) {
    const aggregationSteps = [];
    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareStatisticCountDepartmentFilter(aggregationSteps, { body });
    prepareStatisticGrowth(aggregationSteps);
    return aggregationSteps;
};

exports.buildLoadBaseProjectAggregation = function (body, check) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskDefaultFields(aggregationSteps);
    prepareTaskProjectFilter(aggregationSteps, { body, check });
    preparePagination(aggregationSteps, { body });

    return aggregationSteps;
}

exports.buildCountBaseProjectAggregation = function (body, check) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskProjectFilter(aggregationSteps, { body, check });
    prepareCount(aggregationSteps);

    return aggregationSteps;
}

exports.buildGanttChartForProjectAggregation = function (body, check) {
    const parentTaskAggregation = [];
    const childTaskAggregation = [];

    prepareSearch(parentTaskAggregation, { body });
    prepareSearch(childTaskAggregation, { body });

    prepareTaskState(parentTaskAggregation);
    prepareTaskState(childTaskAggregation);

    prepareParentTaskFilterForProject(parentTaskAggregation, { body, check });
    prepareChildTaskFilterForProject(childTaskAggregation, { body, check });

    prepareStateSort(parentTaskAggregation);
    prepareStateSort(childTaskAggregation);

    return {
        parentTaskAggregation,
        childTaskAggregation,
    };
};

exports.buildStatisticProjectCountAggregation = function (body) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body })
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareStatisticCountProjectFilter(aggregationSteps, { body });
    prepareStatisticCount(aggregationSteps);
    return aggregationSteps;
};

exports.buildStatisticProjectGrowthAggregation = function (body) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareStatisticCountProjectFilter(aggregationSteps, { body });
    prepareStatisticGrowth(aggregationSteps);
    return aggregationSteps;
};

exports.buildLoadBasePersonalAggregation = function (body) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body })

    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskDefaultFields(aggregationSteps);
    prepareTaskPersonalFilter(aggregationSteps, { body });
    preparePagination(aggregationSteps, { body });

    return aggregationSteps;
};

exports.buildCountBasePersonalAggregation = function (body) {
    const aggregationSteps = [];

    prepareSearch(aggregationSteps, { body })
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskPersonalFilter(aggregationSteps, { body });
    prepareCount(aggregationSteps);

    return aggregationSteps;
};

exports.buildStatisticPersonalCountAggregation = function (body) {
    const aggregationSteps = [];
    prepareSearch(aggregationSteps, { body })
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskPersonalFilter(aggregationSteps, { body });
    prepareStatisticPersonalTabFilter(aggregationSteps, { body });
    prepareStatisticCount(aggregationSteps);
    return aggregationSteps;
};

exports.buildStatisticPersonalGrowthAggregation = function (body) {
    const aggregationSteps = [];
    prepareSearch(aggregationSteps, { body });
    prepareTaskState(aggregationSteps);
    prepareTaskProgress(aggregationSteps);
    prepareTaskPersonalFilter(aggregationSteps, { body });
    prepareStatisticPersonalTabFilter(aggregationSteps, { body });
    prepareStatisticGrowth(aggregationSteps);
    return aggregationSteps;
};
