"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return queryInterface.addColumn("Queues", "mediaName", {
            type: sequelize_1.DataTypes.TEXT,
            defaultValue: "",
            allowNull: true
        }),
            queryInterface.addColumn("Queues", "mediaPath", {
                type: sequelize_1.DataTypes.TEXT,
                defaultValue: "",
                allowNull: true
            });
    },
    down: (queryInterface) => {
        return queryInterface.removeColumn("Queues", "mediaName"),
            queryInterface.removeColumn("Queues", "mediaPath");
    }
};
