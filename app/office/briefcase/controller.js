const q = require("q");

const { BriefCaseService } = require("./service");

const { TENANT_IDENTIFIER } = process.env;
const { generateParent } = require('../../../utils/util');

class BriefCaseController {
    searchReferences(dbNamePrefix, currentUser, body) {
        return BriefCaseService.searchReferences(dbNamePrefix, currentUser.username, body.search);
    }

    loadAll(dbname_prefix, currentUser, body) {
        return BriefCaseService.loadAll(dbname_prefix, currentUser.username, body);
    }

    loadDetail(dbname_prefix, currentUser, body) {
        return BriefCaseService.loadDetail(dbname_prefix, currentUser.username, body);
    }

    insert(dbname_prefix, currentUser, body ) {
        let dfd = q.defer();
        BriefCaseService.insert(dbname_prefix, currentUser.username, body,
            generateParent(body.parents|| [], body.parent||{}),body.parent||{}).then(
            function (data) {
                dfd.resolve(data);
            },
            function (err) {
                dfd.reject(err);
            },
        );
        return dfd.promise;
    }

    prepareData(dbname_prefix, currentUser, body) {
        let dfd = q.defer();
        BriefCaseService.generatePreviewCode(dbname_prefix)
            .then((code) => {
                dfd.resolve({
                    code,
                    organ_id: TENANT_IDENTIFIER,
                });
            })
            .catch(() => {
                dfd.resolve({});
            });
        return dfd.promise;
    }

    update(dbname_prefix, currentUser, body) {
        let dfd = q.defer();
        BriefCaseService.update(dbname_prefix, currentUser.username, body).then(
            function (data) {
                dfd.resolve(data);
            },
            function (err) {
                dfd.reject(err);
            },
        );
        return dfd.promise;
    }

    updateReferences(dbname_prefix, currentUser, body) {
        let dfd = q.defer();
        BriefCaseService.updateReferences(dbname_prefix, currentUser.username, body).then(
            function (data) {
                dfd.resolve(data);
            },
            function (err) {
                dfd.reject(err);
            },
        );
        return dfd.promise;
    }

    cancel(dbname_prefix, currentUser, body) {
        return BriefCaseService.cancel(dbname_prefix, currentUser.username, body);
    }
}

exports.BriefCaseController = new BriefCaseController();
