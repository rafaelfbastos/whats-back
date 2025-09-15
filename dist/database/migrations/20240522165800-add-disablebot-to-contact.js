"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Contacts", "disableBot", {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            }),
        ]);
    },
    down: (queryInterface) => {
        Promise.all([
            queryInterface.removeColumn("Contacts", "disableBot"),
        ]);
    }
};
