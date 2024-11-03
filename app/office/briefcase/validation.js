const { ValidationProvider } = require("@shared/validation/validation.provider");
const { list: LANGUAGE_LIST } = require("@shared/localization/language.const");

const { BRIEFCASE_STATE, BRIEFCASE_DURATION_UNIT } = require("@utils/constant");

const Joi = ValidationProvider.initModuleValidation();

function buildReferenceSchema() {
    return Joi.object().keys({
        object: Joi.string().required(),
        id: Joi.string().required(),
    });
}

exports.searchReference = function (request, response, next) {
    const schema_body = {
        search: Joi.string().required(),
    };
    ValidationProvider.createValidator(schema_body, request, response, next);
};

exports.loadAll = function (request, response, next) {
    const schema_body = {
        top: Joi.number().default(0),
        limit: Joi.number(),
        search: Joi.string().allow(null, ""),
        dispatch_arrived_id: Joi.string().allow(null, ""),
        outgoing_dispatch_id: Joi.string().allow(null, ""),
        state: Joi.string().valid(Object.values(BRIEFCASE_STATE)),
    };
    ValidationProvider.createValidator(schema_body, request, response, next);
};

exports.loadDetail = function (request, response, next) {
    const schema_body = {
        id: Joi.string().allow(null, ""),
        code: Joi.string().allow(null, ""),
        skipReferences: Joi.boolean().default(false),
    };
    ValidationProvider.createValidator(schema_body, request, response, next);
};

exports.insert = function (req, res, next) {
    const schema_body = {
        title: Joi.string().required(),
        organ_id: Joi.string().required(),
        outgoing_dispatch_id: Joi.string().required(),
        file_notation: Joi.string().required(),
        maintenance_time: Joi.object()
            .keys({
                amount: Joi.number().min(1).required(),
                unit: Joi.string().valid(Object.values(BRIEFCASE_DURATION_UNIT)).required(),
            })
            .required(),
        usage_mode: Joi.string().required(),
        language: Joi.string()
            .valid(LANGUAGE_LIST.map((lang) => lang.key))
            .required(),
        storage_name: Joi.string().required(),
        storage_position: Joi.string().required(),
        year: Joi.number().integer().positive().required(),
        description: Joi.string().allow(""),
        references: Joi.array().items(buildReferenceSchema()).allow([]),
        parents: Joi.array(),
        parent: Joi.object()
    };
    ValidationProvider.createValidator(schema_body, req, res, next);
};

exports.update = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        title: Joi.string().required(),
        organ_id: Joi.string().required(),
        file_notation: Joi.string().required(),
        maintenance_time: Joi.object()
            .keys({
                amount: Joi.number().min(1).required(),
                unit: Joi.string().valid(Object.values(BRIEFCASE_DURATION_UNIT)).required(),
            })
            .required(),
        usage_mode: Joi.string().required(),
        language: Joi.string()
            .valid(LANGUAGE_LIST.map((lang) => lang.key))
            .required(),
        storage_name: Joi.string().required(),
        storage_position: Joi.string().required(),
        year: Joi.number().integer().positive().required(),
        description: Joi.string().allow(""),
        references: Joi.array().items(buildReferenceSchema()).allow([]),
    };
    ValidationProvider.createValidator(schema_body, req, res, next);
};

exports.updateReferences = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        references: Joi.array().items(buildReferenceSchema()).allow([])
    };
    ValidationProvider.createValidator(schema_body, req, res, next);
};

exports.cancel = function (request, response, next) {
    const schema_body = {
        id: Joi.string().required(),
        reason: Joi.string().required(),
    };
    ValidationProvider.createValidator(schema_body, request, response, next);
};
