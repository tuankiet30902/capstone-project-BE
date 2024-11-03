const { ValidationProvider } = require('../../../shared/validation/validation.provider');
const Joi = ValidationProvider.initModuleValidation();
var validation = {};


validation.get_number = function (req, res, next) {
    const schema_body = {
        odb_book: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load_detail = function (req, res, next) {
    const schema_body = {
        id: Joi.string().allow("", null),
        code: Joi.string().allow("", null),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        od_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string(),
        tab: Joi.string().allow(["created","need_to_handle","all","waiting_storage","dispatchAway","separateDispatch"]).required(),
        top:Joi.number().required(),
        offset:Joi.number().required(),
        sort:Joi.any().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.count = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        od_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string(),
        tab: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loadFileInfo = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        filename: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.update = function (req, res, next) {
    const schema = {
        id: Joi.string().required(),
        from: Joi.string().valid('origin', 'transfer').required(),
        odb_book: Joi.when('from', { is: 'origin', then: Joi.string().required() }),
        signed_date: Joi.when('from', { is: 'origin', then: Joi.date().timestamp("javascript").required() }),
        type: Joi.when('from', { is: 'origin', then: Joi.string().required() }),
        excerpt: Joi.any(),
        expiration_date: Joi.when('from', { is: 'origin', then: Joi.date().timestamp("javascript").required() }),
        priority: Joi.any(),
        notification_departments: Joi.array().items(Joi.string()),
        notification_recipients: Joi.array().items(Joi.string()),
    };

    ValidationProvider.createMiddleware(schema, req, res, next);
}

validation.updateReferences = function (req, res, next) {
    const schema = {
        id: Joi.string().required(),
        from: Joi.string().valid('origin', 'transfer').required(),
        references: Joi.array()
    };

    ValidationProvider.createMiddleware(schema, req, res, next);
}

validation.release = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load_by_code = function (req, res, next) {
    const schema_body = {
        code: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.processFormData = function (data) {
    const schema_body = {
        outgoing_dispatch_id: Joi.string().allow(null, "").default(null),
        outgoing_dispatch_book: Joi.string().required(),
        document_date: Joi.date().timestamp("javascript").required().raw(),
        outgoing_documents: Joi.array().items(Joi.object().required()).required(),
        attach_documents: Joi.array().items(Joi.object()).default([]),
        excerpt: Joi.string().required(),
        signers: Joi.array().items(Joi.string()).required(),
        draft_department: Joi.string(),
        receiver_notification: Joi.array().items(Joi.string()).default([]),
        department_notification: Joi.array().items(Joi.string()).default([]),
        document_quantity: Joi.number().positive().integer().required(),
        transfer_date: Joi.date().timestamp("javascript").required().raw(),
        note: Joi.string().allow(null, "").default(null),
        expiration_date: Joi.date().timestamp("javascript").required().raw(),
        priority: Joi.string().required(),
        parents: Joi.array(),
        parent: Joi.object(),
        code: Joi.string()
    };
    return ValidationProvider.validateData(schema_body, data);
};

exports.validation = validation;
