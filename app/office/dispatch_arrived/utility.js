const q = require("q");

const { APPROVE_LEVEL_1_RULE, CONFIRM_RULE, MANAGE_DISPATCHARRIVED_RULE, DISPATCH_ARRIVED_STATUS, LEAD_RULE } = require('./const');
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
    const conditions = [];
    //PLACE OF DISPATCH ARRIVED
    if (Array.isArray(queryCriteria.place) && queryCriteria.place.length > 0) {

        conditions.push({
            agency_promulgate: { $in: queryCriteria.place }
        });
    }
    if (conditions.length > 0) {
        aggregationSteps.push({ $match: { $and: conditions } });
    }
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


class BuildFilterAggregate {
    constructor() { }

    generateUIFilterAggregate_load(aggregationSteps = [], queryCriteria) {
        doFilter(aggregationSteps, queryCriteria);
        doSort(aggregationSteps, queryCriteria);
        doPagination(aggregationSteps, queryCriteria);
        return aggregationSteps;
    }

    generatePermissionAggregate_QuickHandle(department, rule, aggregationSteps = []) {

        const conditions = [];
        
        if (rule.filter(e => e.rule === MANAGE_DISPATCHARRIVED_RULE)[0]) {
            conditions.push({
                status: { $eq: DISPATCH_ARRIVED_STATUS.CREATED }
            });
        }

        if (rule.filter(e => e.rule === LEAD_RULE)[0]) {
            conditions.push({
                status: { $eq: DISPATCH_ARRIVED_STATUS.WAITING_FOR_APPROVAL }
            });
        }

        const ruleConfirm = rule.filter(e => e.rule === CONFIRM_RULE)[0];
        if (ruleConfirm && ruleConfirm.details) {
            switch (ruleConfirm.details.type) {
                case "All":
                    conditions.push({
                        status: { $eq: DISPATCH_ARRIVED_STATUS.WAITING_FOR_ACCEPT }
                    });
                    break;
                case "Specific":
                    conditions.push({
                        $and: [
                            {
                                status: { $eq: DISPATCH_ARRIVED_STATUS.WAITING_FOR_ACCEPT }
                            },
                            {
                                "tasks.department.id": { $in: ruleConfirm.details.department }
                            }
                        ]

                    });
                    break;
                case "Working":
                    conditions.push({
                        $and: [
                            {
                                status: { $eq: DISPATCH_ARRIVED_STATUS.WAITING_FOR_ACCEPT }
                            },
                            {
                                "tasks.department.id": { $eq: department }
                            }
                        ]

                    });
                    break;
            }
        }

        if (rule.filter(e => e.rule === APPROVE_LEVEL_1_RULE)[0]) {
            conditions.push({
                status: { $eq: DISPATCH_ARRIVED_STATUS.WAITING_FOR_REVIEW }
            });
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
}

exports.BuildFilterAggregate = new BuildFilterAggregate();