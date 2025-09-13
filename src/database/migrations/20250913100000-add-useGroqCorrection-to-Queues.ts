import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Queues", "useGroqCorrection", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Queues", "useGroqCorrection");
  }
};

