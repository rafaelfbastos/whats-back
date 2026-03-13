import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Adiciona configurações de sandbox apenas para empresa 1 (gestora)
        const settings = [
            {
                key: "asaasSandbox",
                value: "disabled",
                companyId: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                key: "asaasTokenSandbox",
                value: "",
                companyId: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        for (const setting of settings) {
            // Verifica se já existe antes de inserir
            const existing = await queryInterface.sequelize.query(
                `SELECT id FROM "Settings" WHERE key = '${setting.key}' AND "companyId" = ${setting.companyId}`,
                { type: (queryInterface.sequelize as any).QueryTypes.SELECT }
            );

            if ((existing as any[]).length === 0) {
                await queryInterface.bulkInsert("Settings", [setting]);
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Settings", {
            key: ["asaasSandbox", "asaasTokenSandbox"],
            companyId: 1
        } as any);
    }
};
