import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.addColumn("Invoices", "paymentMethod", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Invoices", "asaasPaymentId", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Invoices", "boletoUrl", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Invoices", "boletoBarcode", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Invoices", "pixQrCode", {
            type: DataTypes.TEXT,
            allowNull: true
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeColumn("Invoices", "paymentMethod");
        await queryInterface.removeColumn("Invoices", "asaasPaymentId");
        await queryInterface.removeColumn("Invoices", "boletoUrl");
        await queryInterface.removeColumn("Invoices", "boletoBarcode");
        await queryInterface.removeColumn("Invoices", "pixQrCode");
    }
};
