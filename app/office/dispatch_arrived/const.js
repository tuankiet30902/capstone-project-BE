exports.NAME_LIB = "dispatch_arrived";
exports.PARENT_FOLDER = "/office";
exports.FOLDER_ARRAY = ["office"];
exports.OFFICE_DEPARTMENT_SETTING_KEY = "schoolOfficeDepartment";
exports.BOARD_OF_DIRECTORS_SETTING_KEY = "boardOfDirectorsDepartment";

exports.LEAD_RULE = "Office.DispatchArrived.Lead";
exports.APPROVE_LEVEL_1_RULE = "Office.DispatchArrived.ApproveLevel1";
exports.CONFIRM_RULE = "Office.DispatchArrived.Confirm";
exports.MANAGE_DISPATCHARRIVED_RULE = "Office.DispatchArrived.Manager";
exports.DISPATCH_ARRIVED_STATUS = {
    CREATED: "Created",
    WAITING_FOR_APPROVAL: "WaitingForApproval",
    WAITING_FOR_REVIEW: "WaitingForReview",
    WAITING_FOR_ACCEPT: "WaitingForAccept",
    TRANSFERRED: "Transferred",
    REJECTED: "Rejected",
};
exports.DISPATCH_FORWARD_TO = {
    HEAD_OF_DEPARTMENT: "HeadOfDepartment",
    BOARD_OF_DIRECTORS: "BoardOfDirectors",
    DEPARTMENTS: "Departments",
};