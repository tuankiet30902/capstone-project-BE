module.exports = [
    { path: "/office/organization", router: require('./organization/organization.router') },
    { path: "/office/human/labor_contract", router: require('./human/labor_contract/router') },
    { path: "/office/human/employee", router: require('./human/employee/router') },
    { path: "/office/notify", router: require('./notify/router') },
    { path: "/office/project/project", router: require('./project/project/project.router') },
    { path: "/office/project/wiki", router: require('./project/wiki/wiki.router') },
    { path: "/office/workflow", router: require('./workflow/router') },
    { path: "/office/workflow_play", router: require('./workflow_play/router') },
    { path: "/office/leave_form", router: require('./leave_form/router') },
    { path: "/office/task", router: require('./task/router') },
    { path: "/office/dispatch_arrived", router: require('./dispatch_arrived/router') },
    { path: "/office/journey_time_form", router: require('./journey_time_form/router') },
    { path: "/office/strategic", router: require('./strategic/router') },
    { path: "/office/task_workflow", router: require('./task_workflow/router') },
    { path: "/office/file", router: require('./file/router') },
    { path: "/office/outgoing_dispatch", router: require('./outgoing_dispatch/router') },
    { path: '/office/label', router: require('./label/router') },
    { path: '/office/briefcase', router: require('./briefcase/router') },
    { path: '/office/sending-place', router: require('./sending_place/router') },
    { path: '/office/task_template', router: require('./task_template/router') },
    // { path: "/office/study_plan", router: require('./study_plan/router') },
    { path: '/office/meeting_room', router: require('./meeting_room/router') },
    { path: "/office/car_management", router: require('./car_management/router') },
    { path: '/office/event_calendar', router: require('./event_calendar/router') },
    { path: '/office/card_vehical', router: require('./card_vehicle/router') },
]
