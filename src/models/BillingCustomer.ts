import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "BillingCustomers" })
class BillingCustomer extends Model<BillingCustomer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  email: string;

  @AllowNull(false)
  @Column
  cpfCnpj: string;

  @Column
  phone: string;

  @Column
  address: string;

  @Column
  city: string;

  @Column
  state: string;

  @Column
  zipcode: string;

  @Column
  asaasCustomerId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default BillingCustomer;
