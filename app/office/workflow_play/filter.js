const CommonFilter = require("../../../utils/commonFilter");
const { WORKFLOW_PLAY_STATUS, WORKFLOW_PLAY_NODE_STATE } = require("../../../utils/constant");
const DURATION_DAY_IN_UNIX = 24 * 60 * 60 * 1000;

function generateLoadFilter(aggregateSteps = [], filter = {}, { currentUser }) {
    let condition = [];
    // condition = buildTabFilter(condition, filter, { username: currentUser.username });

    if (filter.is_personal) {
        condition.push({ is_personal: true });
    }

    if (filter.is_department) {
        condition.push({ is_department: true });
    }

    condition = buildCheckboxFilter(condition, filter, { username: currentUser.username })
    condition = buildSearchFilter(condition, filter);
    condition = buildStatusFilter(condition, filter);
    condition = buildDocumentTypeFilter(condition, filter);
    if (condition.length > 0) {
        aggregateSteps.push({
            $match: { $and: condition },
        });
    }
    return aggregateSteps;
}

function generateStateField(aggregateSteps = []) {
    prepareCommonData(aggregateSteps);
    prepareStateField(aggregateSteps);
}

function buildCheckboxFilter(condition = [], { checks = [] }, { username }) {
    const checkboxConditions = [];

    const conditionsMap = {
        Created: {
            username: { $eq: username },
        },
        Approved: {
            $or: [
                {
                    username: { $eq: username },
                    status: {
                        $in: ["Approved", "SaveODB"],
                    },
                },
                {
                    event: {
                        $elemMatch: {
                            username: username,
                            action: { $in: ["Approved", "SaveODB"] },
                        },
                    },
                },
            ],
        },
        Rejected: {
            event: {
                $elemMatch: {
                    username: username,
                    action: "Rejected",
                },
            },
        },
        NeedToHandle: {
            play_now: {
                $elemMatch: { username },
            },
        },
        Returned: {
            event: {
                $elemMatch: {
                    username: username,
                    action: "Returned",
                },
            },
        },
        ForPersonal: { is_personal: "true" },
        ForDepartment: { is_department: "true" }
    };

    checks.forEach(checkbox => {
        if (conditionsMap[checkbox]) {
            checkboxConditions.push(conditionsMap[checkbox]);
        }
    });

    if (checkboxConditions.length > 0) {
        condition.push({ $and: checkboxConditions });
    }

    return condition;
}

// function buildTabFilter(condition = [], { tab }, { username }) {
//     let tabConditions = [];
//     switch (tab) {
//         case "created":
//             tabConditions.push({
//                 username: { $eq: username },
//             });
//             break;
//         case "approved":
//             tabConditions.push({
//                 $or: [
//                     {
//                         username: { $eq: username },
//                         status: {
//                             $in: ["Approved", "SaveODB"],
//                         },
//                     },
//                     {
//                         $or: [
//                             {
//                                 event: {
//                                     $elemMatch: {
//                                         username: username,
//                                         action: "Approved",
//                                     },
//                                 },
//                             },
//                             {
//                                 event: {
//                                     $elemMatch: {
//                                         username: username,
//                                         action: "SaveODB",
//                                     },
//                                 },
//                             },
//                         ],
//                     },
//                 ],
//             });
//             break;
//         case "rejected":
//             tabConditions.push({
//                 event: {
//                     $elemMatch: {
//                         username: username,
//                         action: "Rejected",
//                     },
//                 },
//             });
//             break;
//         case "need_to_handle":
//             tabConditions.push({
//                 play_now: {
//                     $elemMatch: { username },
//                 },
//             });
//             break;
//         case "returned":
//             tabConditions.push({
//                 event: {
//                     $elemMatch: {
//                         username: username,
//                         action: "Returned",
//                     },
//                 },
//             });
//             break;
//         case "all":
//             tabConditions = [];
//             break;
//     }
//     if (tabConditions.length > 0) {
//         condition.push({ $and: tabConditions });
//     }
//     return condition;
// }

function buildSearchFilter(condition = [], { search }) {
    if (typeof search === "string" && search !== "") {
        condition.push({
            $text: {
                $search: `"${search}"`,
            },
        });
    }
    return condition;
}

function buildStatusFilter(condition = [], { status, statuses }) {
    if (status) {
        condition.push({
            status: { $eq: status },
        });
    } else if (Array.isArray(statuses) && statuses.length > 0) {
        condition.push({
            status: { $in: statuses },
        });
    }
    return condition;
}

function buildDocumentTypeFilter(condition = [], { document_type }) {
    if (document_type) {
        condition.push({
            document_type: { $eq: document_type },
        });
    }
    return condition;
}

function prepareCommonData(aggregateSteps = []) {
    aggregateSteps.push({
        $addFields: {
            current_date: { $toLong: "$$NOW" },
            is_processing_flow: { $eq: ["$status", WORKFLOW_PLAY_STATUS.PENDING] },
        },
    });
    aggregateSteps.push({
        $addFields: {
            current_node: {
                $cond: [
                    "$is_processing_flow",
                    {
                        $arrayElemAt: ["$flow", { $subtract: ["$node", 1] }],
                    },
                    false,
                ],
            },
        },
    });
}

function prepareStateField(aggregateSteps = []) {
    aggregateSteps.push({
        $addFields: {
            percent_used: {
                $cond: [
                    { $not: "$is_processing_flow" },
                    null,
                    {
                        $floor: {
                            $multiply: [
                                100,
                                {
                                    $divide: [
                                        { $subtract: ["$current_date", "$current_node.start_at"] },
                                        { $subtract: ["$current_node.expected_complete_at", "$current_node.start_at"] },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            },
        },
    });
    aggregateSteps.push({
        $addFields: {
            current_node_state: {
                $switch: {
                    branches: [
                        {
                            case: { $gte: ["$percent_used", 80] },
                            then: WORKFLOW_PLAY_NODE_STATE.LATE,
                        },
                        {
                            case: { $gte: ["$percent_used", 60] },
                            then: WORKFLOW_PLAY_NODE_STATE.GONNA_LATE,
                        },
                        {
                            case: { $gte: ["$percent_used", 0] },
                            then: WORKFLOW_PLAY_NODE_STATE.ON_SCHEDULE,
                        },
                    ],
                    default: null,
                },
            },
        },
    });
}

function prepareRemainingDayFiled(aggregateSteps = []) {
    aggregateSteps.push({
        $addFields: {
            remaining_day: {
                $cond: [
                    { $not: "$is_processing_flow" },
                    null,
                    {
                        $floor: {
                            $divide: [
                                { $subtract: ["$current_node.expected_complete_at", "$current_date"] },
                                DURATION_DAY_IN_UNIX,
                            ],
                        },
                    },
                ],
            },
        },
    });
}

function unsetUnnecessaryFields(aggregateSteps) {
    aggregateSteps.push({
        $unset: ["current_date", "is_processing_flow", "current_node", "percent_used"],
    });
}

function addSortStage(aggregateSteps, sort) {
    aggregateSteps.push({
        $sort: sort,
    });
}

exports.buildLoadAggregate = function (body, { currentUser }, sort) {
    const aggregateSteps = [];
    generateLoadFilter(aggregateSteps, body, { currentUser });
    generateStateField(aggregateSteps);
    CommonFilter.preparePagination(aggregateSteps, { body });
    unsetUnnecessaryFields(aggregateSteps);
    addSortStage(aggregateSteps, sort);
    return aggregateSteps;
};

exports.buildJobLoadAggregate = function (remainingDay) {
    const aggregateSteps = [];
    prepareCommonData(aggregateSteps);
    prepareStateField(aggregateSteps);
    prepareRemainingDayFiled(aggregateSteps);
    aggregateSteps.push({
        $match: {
            remaining_day: {
                $eq: remainingDay,
            },
        },
    });
    return aggregateSteps;
};
