"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return queryInterface.addColumn("QueueOptions", "mediaName", {
            type: sequelize_1.DataTypes.TEXT,
            defaultValue: "",
            allowNull: true
        }),
            queryInterface.addColumn("QueueOptions", "mediaPath", {
                type: sequelize_1.DataTypes.TEXT,
                defaultValue: "",
                allowNull: true
            });
    },
    down: (queryInterface) => {
        return queryInterface.removeColumn("QueueOptions", "mediaName"),
            queryInterface.removeColumn("QueueOptions", "mediaPath");
    }
};
