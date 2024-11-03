const { ConfigSetup } = require('../../../../shared/setup/config.const');

module.exports = {
    name: "user",
    items: [
        {
            "title": "System Management",
            "username": "admin",
            "password": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
            "rule": [
                {
                    rule: "*"
                }
            ],
            "role":["*"],
            "root": true,
            "admin": true,
            "isactive": true,
            "language": {
                "current": "vi-VN"
            }
        },
        {
            "title": "Job",
            "username": "jobDelete",
            "password": "83dbef1f87bac650d5cd57ee6fbc384d6fe9b15860ed374ab9b1be65850c51fd",
            "rule": [
                {
                    rule: "Job.Delete.Run"
                }
            ],
            "role":[],
            "root": true,
            "admin": true,
            "isactive": true,
            "language": {
                "current": "vi-VN"
            },
            "limit_time": ConfigSetup.delete_job.before_month_delete,
            "limit_item": ConfigSetup.delete_job.limit_item
        }
    ]
}