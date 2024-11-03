const fs = require('fs');
const PNT_TENANT = require('../multi_tenant/pnt-tenant');
const settings = require('../mongodb/mongodb.const');
const { MongoDBInterface } = require('../mongodb/db.interface');

class Migrate{
    constructor(path){
        this.path = path;
        this.data = this.readFile(path);
        this.dbname_prefix = PNT_TENANT['dbname_prefix'];
        this.username = 'migrate';
        this.dbname = settings.connectName.management;
    }

    readFile(path) {
        try {
            return fs.readFileSync(path, 'utf8');
        } catch (err) {
            console.error('Error reading file:', err);
        }
    }

    async migrate() {
        if (!this.data) {
            console.error('No data to insert.');
            return;
        }

        try {
            const result = await MongoDBInterface.insertMany(
                this.dbname_prefix,
                this.dbname,
                { collection: this.collection, username: this.username },
                this.data
                // options
            );

            console.log(`Insert ${this.path} done.`);
        } catch (e) {
            console.error(`Error inserting: ${e}`);
        }
    }
}

class MigrateCar extends Migrate{
    constructor(path){
        super(path);
        this.collection = 'directory';
        this.master_key = 'vehicle_list';
        this.tranformData();
    }

    tranformData() {
        //tranformData
        return this.data;
    }
}

class MigrateCardCar extends Migrate{
    constructor(path){
        super(path);
        this.collection = 'directory';
        this.master_key = 'card_list';
        this.tranformData();
    }

    tranformData() {
        //tranformData
        return this.data;
    }
}

class MigrateOrganization extends Migrate{
    constructor(path){
        super(path);
        this.collection = 'organization';
        this.tranformData();
        this.dbname = settings.connectName.office;
    }

    tranformData() {
        //tranformData
        return this.data;
    }
}

class MigrateRoom extends Migrate{
    constructor(path){
        super(path);
        this.collection = 'directory';
        this.master_key = 'meeting_room';
        this.tranformData();
    }

    tranformData() {
        //tranformData
        return this.data;
    }
}

exports.MigrateCar = MigrateCar;
exports.MigrateCardCar = MigrateCardCar;
exports.MigrateRoom = MigrateRoom;
exports.MigrateOrganization = MigrateOrganization;
