"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: async (queryInterface) => {
        return queryInterface.addColumn("Queues", "useGroqCorrection", {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    },
    down: async (queryInterface) => {
        return queryInterface.removeColumn("Queues", "useGroqCorrection");
    }
};
