const { ValidationProvider } = require('../../../shared/validation/validation.provider');
const { DISPATCH_FORWARD_TO, DISPATCH_RESPONSE_TYPE } = require("@utils/constant");
const Joi = ValidationProvider.initModuleValidation();
var validation = {};
"da_book", "priority", "receive_method","type", "tab"

validation.load = function (req, res, next) {
    const schema_body = {
        search: Joi.string().allow(''),
        da_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string(),
        tab: Joi.string().allow(['created', 'need_to_handle', 'all', 'forwarded']).required(),
        top: Joi.number().required(),
        offset: Joi.number().required(),
        sort: Joi.any().required(),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
};


validation.load_quick_handle = function (req, res, next) {
    const schema_body = {
        search: Joi.string().allow(''),
        da_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string(),
        top: Joi.number().required(),
        offset: Joi.number().required(),
        sort: Joi.any().required(),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
};

validation.count_quick_handle = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        da_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loadDetails = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.get_number = function (req, res, next) {
    const schema_body = {
        da_book: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.count = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        da_book: Joi.string(),
        priority: Joi.string(),
        receive_method: Joi.string(),
        type: Joi.string(),
        tab: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load_employee = function (req, res, next) {
    const schema_body = {
        department: Joi.string().required()
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

validation.downloadfile = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        filename: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.insertFormData = function (data) {
    const schema_body = {
        code: Joi.string().required(),
        da_book: Joi.string().required(),
        number: Joi.number().positive().integer().required(),
        release_date: Joi.date().timestamp("javascript").required(),
        author: Joi.string().required(),
        agency_promulgate: Joi.string().required(),
        transfer_date: Joi.date().timestamp("javascript").required(),
        note: Joi.string().allow(null),
        type: Joi.string().required(),
        priority: Joi.string().required(),
        excerpt: Joi.string().required(),
        is_legal: Joi.boolean().default(false).required(),
        view_only_departments: Joi.array().items(Joi.string()).default([]),
        is_assign_task: Joi.boolean().default(false),
        attachments: Joi.array().items(Joi.object().required()).required(),
    };
    return ValidationProvider.validateData(schema_body, data);
}

validation.updateFormData = function (data) {
    const schema_body = {
        id: Joi.string().required(),
        code: Joi.string().required(),
        da_book: Joi.string().required(),
        number: Joi.number().positive().integer().required(),
        release_date: Joi.date().timestamp("javascript").required(),
        author: Joi.string().required(),
        agency_promulgate: Joi.string().required(),
        transfer_date: Joi.date().timestamp("javascript").required(),
        note: Joi.string().allow(null),
        type: Joi.string().required(),
        priority: Joi.string().required(),
        excerpt: Joi.string().required(),
        is_legal: Joi.boolean().default(false).required(),
        is_assign_task: Joi.boolean().default(false).required(),
        view_only_departments: Joi.array().items(Joi.string()).default([]),
        attachments: Joi.array().items(Joi.object()).default([]),
        keep_attachments: Joi.array()
            .items(Joi.object().keys({ name: Joi.string().required() }))
            .default([]),
    };
    return ValidationProvider.validateData(schema_body, data);
}

validation.delete = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.handling = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        comment : Joi.string().allow(""),
        forward : Joi.array().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.insert_task = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        title : Joi.string().required(),
        content : Joi.string().required(),
        main_person: Joi.array().required(),
        participant: Joi.array().required(),
        observer: Joi.array().required(),
        from_date: Joi.number().required(),
        to_date: Joi.number().required(),
        priority: Joi.number().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.update = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        number : Joi.number().required(),
        title: Joi.string().required(),
        da_book: Joi.string().required(),
        expiration_date:Joi.number()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.signAcknowledge = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        note: Joi.any(),
        with_task: Joi.any().required(),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.forward = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        to: Joi.string().valid(Object.values(DISPATCH_FORWARD_TO)).required(),
        note: Joi.string().required(),
    };
    ValidationProvider.createValidator(schema_body, req, res, next);
};

validation.response = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        type: Joi.string().valid(Object.values(DISPATCH_RESPONSE_TYPE)).required(),
        note: Joi.string().required(),
    };
    ValidationProvider.createValidator(schema_body, req, res, next);
};

exports.validation = validation;
