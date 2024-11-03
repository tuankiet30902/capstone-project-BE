exports.NOTIFY_STATUS = {
    PENDING: "Pending",

    APPROVED_BY_DEPARTMENT_LEADER: "ApprovedByDepartmentLeader",
    APPROVED: "Approved",
    REJECTED: "Rejected",

    PENDING_RECALLED: "PendingRecalled",
    APPROVED_RECALL_BY_DEPARTMENT_LEADER: "ApprovedRecallByDepartmentLeader",
    RECALLED: "Recalled"
};

exports.NOTIFY_RULE = {
    NOTIFY_DEPARTMENT:"Office.Notify.NotifyDepartment",
    APPROVE_DEPARTMENT: "Office.Notify.ApprovalLevel_2",
    APPROVE_LEAD: "Office.Notify.ApprovalLevel_1",
    AUTHORIZED: "Authorized",
    MANAGER: "Office.Notify.Manager"
};

exports.NOTIFY_SCOPE = {
    INTERNAL: "Internal",
    EXTERNAL: "External",
};

exports.NOTIFY_EVENT = {
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

// exports.NOTIFY_TAB = [
//     "bookmark",
//     "home",
//     "created",
//     "notseen",
//     "seen",
//     "need_to_handle_level_2",
//     "need_to_handle_level_1",
//     "all",
//     "recyclebin",
// ];

exports.NOTIFY_TAB = {
    CREATED: "Created",
    BOOKMARK: "Bookmark",
    NOTSEEN: "NotSeen",
    NEEDTOHANDLE: "NeedToHandle",
    HANDLED: "Handled",
    REPONSIBILITY: "Responsibility",
    HOME: "Home",
};

exports.NOTIFY_BELL_MODAL = {
    PENDING: "notify_need_approve",

    APPROVED_BY_DEPARTMENT_LEADER: "notify_need_approve",
    APPROVED: `notify_approved`,
    APPROVED_TO_USER: `notify_approved_to_user`,
    REJECTED: "notify_rejected",

    PENDING_RECALLED: "notify_need_approve_recall",
    APPROVED_RECALL_BY_DEPARTMENT_LEADER: "notify_need_approve_recall",
    RECALLED: "notify_approved_recall",
};

exports.NOTIFY_TYPE = {
    WHOLESCHOOL: "WholeSchool",
    EMPLOYEE: "Employee",
    DEPARTMENT: "Department"
};
