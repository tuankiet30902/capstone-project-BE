exports.NAME_LIB = "car_management";
exports.PARENT_FOLDER = "/office";
exports.FOLDER_ARRAY = ["office"];
exports.RULE_CAR = {
    USE:"Office.CarManagement.Use",
    CREATE:"Office.CarManagement.Create",
    APPROVE_DEPARTMENT:"Office.CarManagement.Review",
    NOTIFY_DEPARTMENT:"Office.CarManagement.NotifyDepartment",
    CONFIRM:"Office.CarManagement.Confirm",
    APPROVE_LEAD:"Office.CarManagement.Approve",
    APPROVE_LEAD_EXTERNAL:"Office.CarManagement.ApproveExternal",
};

exports.STATUS_CAR = {
    CREATED:"Created",
    LEADER_DEPARTMENT_APPROVED:"reviewer_approved",
    CONFIRMER_APPROVED:"manager_approved",
    LEAD_APPROVED_CAR: "head_approved_car",
    LEAD_EXTERNAL_APPROVED: "head_external_approved",
    CREATOR_RECEIVED_CARD: 'creator_received_card',
    CREATOR_RETURNED_CARD: 'creator_returned_card',
    MANAGER_RECEIVED_CARD: 'manager_received_card',
    REJECTED:"rejected",
    CANCELLED:"cancelled",
};

exports.STATUS_FLOW = {
    REGISTER: "register",
    RECALL:"recall"
}


exports.CHECKS_ON_UI = {
    CREATED : "created",
    NEED_HANDLE: "need_handle",
    HANDLED: "handled",
    REJECTED: "rejected",
    RESPOSIBILITY_DEPARTMENT : "responsibility",
    CARD_NOT_RETURNED: "card_not_returned",
    ALL_DEPARTMENT: "all_department",
    MY_CALENDER: "my_calendar"
}

exports.MASTER_KEY_CARD = "card_list";

exports.CARD_CREDIT_STATUS = {
    ACTIVE: true,
    BUSY: false
}

exports.CAR_ACTION_NAME = {
    NEED_TO_APPROVE: 'car_need_to_approve',
    APPROVE: 'car_approve',
    REJECTED: 'car_registration_reject',
    CREATOR_CANCEL: 'car_registration_creator_cancel',
}

exports.CAR_FROM_ACTION = {
    CREATED : "Created",
    UPDATED : "Updated",
    DEPARTMENT_APPROVED: "DepartmentApproved",
    DEPARTMENT_APPROVED_AND_CHANGE: "DepartmentApprovedAndChange",
    DEPARTMENT_REJECTED: "RejectedLeaderDepartment",
    MANAGEMENT_CAR_APPROVED: "ManagementCarApproved",
    MANAGEMENT_CAR_REJECTED: "ManagementCarRejected",
    LEAD_APPROVED:"LeadApproved",
    LEAD_APPROVED_AND_CHANGE:"LeadApprovedAndChange",
    LEAD_REJECTED:"LeadRejected",
    LEAD_EXTERNAL_APPROVED:"LeadExternalApproved",
    LEAD_EXTERNAL_REJECTED:"LeadExternalRejected",

    APPROVED:"Approved",

    MANAGEMENT_CARD_CHANGE_CARD: "ManagementCardChangeCard",
    CREATOR_RECEIVED_CARD: "CreatorReceivedCard",
    CREATOR_RETURNED_CARD: "CreatorReturnedCard",
    MANAGEMENT_RECEIVED_CARD: "ManagingReceivedCard",
    CREATOR_CANCEL:"CreatorCancel",
}
exports.CAR_TAB = {
    MANAGEMENT: "Management",
    CALENDAR: "Calendar"
} 

exports.CAR_FEATURE_NAME = "car";
