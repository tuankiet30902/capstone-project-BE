const q = require("q");
const mongodb = require("mongodb");
const { pickBy, cloneDeep } = require("lodash");

const BaseError = require("@shared/error/BaseError");

const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');

const CodeUtil = require('../../../utils/codeUtil');

const ReferenceUtil = require("@utils/referenceUtil");

const ODB_CODE_PATTERN = 'CVDI-{department}-{directory}-{year}-{sequenceNumber}';
const ODB_SEQUENCE_NUMBER_KEY = () => `outgoing_dispatch_${new Date().getFullYear()}`;
const ODB_DIRECTORY_MASTER_KEY = 'document_type';
const ODB_BOOK_DIRECTORY_MASTER_KEY = 'outgoing_dispatch_book';

const { OBD_STATUS } = require('../../../utils/constant.js');
const { LogProvider } = require("@shared/log_nohierarchy/log.provider");

function loadDirectoriesDetail(dbname_prefix, odb) {
    const odbBookPromise = q.fcall(() => {
        return exports.DirectoryService.loadDetail(
            dbname_prefix,
            ODB_BOOK_DIRECTORY_MASTER_KEY,
            odb.outgoing_dispatch_book,
        );
    });

    const documentTypePromise = q.fcall(() => {
        return exports.DirectoryService.loadDetail(dbname_prefix, ODB_DIRECTORY_MASTER_KEY, odb.document_type);
    });

    const dfd = q.defer();
    q.all([odbBookPromise, documentTypePromise])
        .then(([odbBook, documentType]) => {
            Object.assign(odb, {
                odb_book_title: odbBook.title,
                document_type_title: documentType.title,
            });
            dfd.resolve(odb);
        })
        .catch((err) => dfd.reject(err));
    return dfd.promise;
}

class ODBService {
    constructor() {}

    getNumber(dbname_prefix, odb_book) {
        let dfd = q.defer();
        MongoDBProvider.load_onOffice(
            dbname_prefix,
            'outgoing_dispatch',
            { odb_book: { $eq: odb_book } },
            1,
            0,
            { number: -1 },
            { number: true }
        ).then(
            function (data) {
                if (data[0]) {
                    dfd.resolve(data[0].number + 1);
                } else {
                    dfd.resolve(1);
                }
                data = undefined;
            },
            function (err) {
                dfd.reject(err);
            }
        );
        return dfd.promise;
    }

    load(dbname_prefix, username, id, code) {
        const dfd = q.defer();
        q.fcall(() => {
            let filter = {};
            if (id) {
                filter = { _id: { $eq: new mongodb.ObjectId(id) } };
            } else if (code) {
                code = decodeURIComponent(code);
                filter = {
                    code: {
                        $regex: code,
                        $options: "i",
                    },
                };
            } else {
                throw new BaseError("ODBService.load.err", "IdOrCodeIsRequired");
            }
            return MongoDBProvider.getOne_onOffice(dbname_prefix, "outgoing_dispatch", filter);
        })
            .then((data) => {
                if (!data) {
                    throw BaseError.notFound("ODBService.load.err");
                }
                return loadDirectoriesDetail(dbname_prefix, data);
            })
            .then((data) => {
                dfd.resolve(data);
            })
            .catch((err) => {
                LogProvider.error("Load ODB failed with reason: " + err.mes || err.message);
                dfd.reject(err instanceof BaseError ? err : new BaseError("ODBService.load.err", "LoadODBFailed"));
            });
        return dfd.promise;
    }

    insert(dbname_prefix, username, department, entity) {
        const dfd = q.defer();

        q.all([
            new DepartmentService().getDepartmentById(dbname_prefix, department),
            new DirectoryService().loadDetail(dbname_prefix, ODB_DIRECTORY_MASTER_KEY, entity.document_type),
        ])
            .then(([department, directory]) => {
                if (!department) {
                    return dfd.reject({
                        path: "ODBService.insert",
                        mes: "DepartmentNotFound",
                    });
                }
                if (!department.abbreviation) {
                    return dfd.reject({
                        path: "ODBService.insert",
                        mes: "DepartmentAbbreviationNotFound",
                    });
                }
                if (!directory.abbreviation) {
                    return dfd.reject({
                        path: "ODBService.insert",
                        mes: "DirectoryAbbreviationNotFound",
                    });
                }


                const event = [
                    {
                        username: username,
                        action: "Created",
                        time: new Date().getTime(),
                    },
                ];

                Object.assign(entity, {
                    event,
                    username,
                    status: OBD_STATUS.NOT_PUBLIC_YET,
                    created_date: new Date().getTime(),
                    last_modified_date: null,
                });

                return MongoDBProvider.insert_onOffice(dbname_prefix, "outgoing_dispatch", username, entity);
            })
            .then((result) => {
                dfd.resolve(result.ops[0]);
            })
            .catch((err) => {
                console.log(err);
                dfd.reject(err);
            });
        return dfd.promise;
    }

    insertSeparatelyOutgoingDispatch(dbname_prefix, username, entity) {
        const event = [
            {
                username: username,
                action: "Created",
                time: new Date().getTime(),
            },
        ];

        Object.assign(entity, {
            event,
            username,
            status: OBD_STATUS.SEPARATE_DISPATCH,
            created_date: new Date().getTime(),
            last_modified_date: null,
            document_type: "separate_dispatch"
        });

        return MongoDBProvider.insert_onOffice(dbname_prefix, "outgoing_dispatch", username, entity);
    }

    loadList(dbname_prefix, filter, top, offset, sort) {
        const dfd = q.defer();
        MongoDBProvider.load_onOffice(dbname_prefix, "outgoing_dispatch", filter, top, offset, sort)
            .then((data) => {
                if (data && data.length > 0) {
                    const promises = data.map((odb) => loadDirectoriesDetail(dbname_prefix, odb));
                    const retrieveFields = ["code"];
                    const transformFields = [{ from: "value", to: "id" }];
                    return q.all(promises)
                    .then(() => {
                        const flattenPromises = data.map((item) =>
                            ReferenceUtil.flattenReferencesAndRetrieveAdditionalFieldsOfOGD(
                                dbname_prefix, item, "references", retrieveFields, transformFields
                            )
                        );
                        return q.all(flattenPromises);
                    })
                    .then(() => dfd.resolve(data))
                    .catch(dfd.reject);
                } else {
                    return dfd.resolve(data);
                }
            })
            .catch((err) => dfd.reject(err));

        return dfd.promise;
    }

    countList(dbname_prefix, filter) {
        return MongoDBProvider.count_onOffice(dbname_prefix, "outgoing_dispatch", filter);
    }

    update(dbname_prefix, username, id, entity) {
        const dfd = q.defer();
        q.fcall(() => {
            Object.assign(entity, { last_modified_date: new Date().getTime() });
            return MongoDBProvider.update_onOffice(
                dbname_prefix,
                "outgoing_dispatch",
                username,
                { _id: new mongodb.ObjectId(id) },
                {
                    $set: entity,
                    $push: {
                        event: {
                            username,
                            time: new Date().getTime(),
                            action: "Updated",
                        },
                    },
                },
            );
        })
            .then(() => {
                return MongoDBProvider.getOne_onOffice(dbname_prefix, "outgoing_dispatch", {
                    _id: new mongodb.ObjectId(id),
                });
            })
            .then(dfd.resolve)
            .catch((err) => dfd.reject(err));
        return dfd.promise;
    }

    release(dbname_prefix, username, id) {
        const d = new Date();
        return MongoDBProvider.update_onOffice(
            dbname_prefix,
            "outgoing_dispatch",
            username,
            {
                $and: [{ _id: { $eq: new require("mongodb").ObjectID(id) } }],
            },
            {
                $set: {
                    status: OBD_STATUS.RELEASED,
                    release_date: d.getTime(),
                },
                $push: {
                    event: {
                        username,
                        time: d.getTime(),
                        action: "ReleasedOutgoingDispatch",
                    },
                },
            },
        );
    }

}

class TaskService {
    constructor() { }

    loadDetailByWorkFlowPlayId(dbname_prefix, username, workflowPlayId) {
        let dfd = q.defer();
        MongoDBProvider.getOne_onOffice(dbname_prefix, "task", { workflowPlay_id: { $eq: workflowPlayId } })
            .then(task => dfd.resolve(task))
            .catch(() => dfd.resolve(null));
        return dfd.promise;
    }
}

class DepartmentService {
    constructor() { }

    load(dbname_prefix) {
        return MongoDBProvider.load_onOffice(dbname_prefix, "organization", {
            type: { $eq: "department" },
        });
    }

    getDepartmentById(dbname_prefix, departmentId) {
        const dfd = q.defer();
        MongoDBProvider.load_onOffice(dbname_prefix, "organization", {
            id: departmentId,
        })
            .then(function (departments) {
                if (departments.length > 0) {
                    dfd.resolve(departments[0]);
                } else {
                    dfd.resolve(null);
                }
            })
            .catch(function (err) {
                dfd.reject(err);
            });
        return dfd.promise;
    }
}

class EmployeeService {
    constructor() {}
    load(dbname_prefix, department) {
        return MongoDBProvider.load_onOffice(dbname_prefix, 'employee', {
            department: { $eq: department },
        });
    }
}

class DirectoryService {
    constructor() {}

    loadDetail(dbname_prefix, masterKey, value) {
        return MongoDBProvider.getOne_onManagement(dbname_prefix, 'directory', {
            master_key: masterKey,
            value: value,
        });
    }

    load(dbname_prefix, masterKey) {
        return MongoDBProvider.load_onManagement(dbname_prefix, 'directory', {
            master_key: masterKey,
        });
    }
}

class BriefcaseService {
    constructor() {}

    loadDetail(dbname_prefix, username, briefcaseId) {
        return MongoDBProvider.getOne_onOffice(dbname_prefix, "briefcase", {
            _id: { $eq: new require("mongodb").ObjectID(briefcaseId) },
        })
    }
}

exports.ODBService = new ODBService();
exports.DepartmentService = new DepartmentService();
exports.EmployeeService = new EmployeeService();
exports.DirectoryService = new DirectoryService();
exports.BriefcaseService = new BriefcaseService();
exports.TaskService = new TaskService();
