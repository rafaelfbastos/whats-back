"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = {
    up: async (queryInterface) => {
        await queryInterface.removeConstraint("QueueIntegrations", "QueueIntegrations_name_key");
        await queryInterface.removeConstraint("QueueIntegrations", "QueueIntegrations_projectName_key");
        await queryInterface.removeIndex("QueueIntegrations", "QueueIntegrations_name_key");
        await queryInterface.removeIndex("QueueIntegrations", "QueueIntegrations_projectName_key");
    },
    down: async (queryInterface) => {
        return Promise.all([
            queryInterface.addConstraint("QueueIntegrations", ["name"], {
                name: "QueueIntegrations_name_key",
                type: 'unique'
            }),
            queryInterface.addConstraint("QueueIntegrations", ["projectName"], {
                name: "QueueIntegrations_projectName_key",
                type: 'unique'
            }),
        ]);
    }
};
