import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const setting = {
            key: "asaasWebhookToken",
            value: "",
            companyId: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const existing = await queryInterface.sequelize.query(
            `SELECT id FROM "Settings" WHERE key = '${setting.key}' AND "companyId" = ${setting.companyId}`,
            { type: (queryInterface.sequelize as any).QueryTypes.SELECT }
        );

        if ((existing as any[]).length === 0) {
            await queryInterface.bulkInsert("Settings", [setting]);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Settings", {
            key: ["asaasWebhookToken"],
            companyId: 1
        } as any);
    }
};
