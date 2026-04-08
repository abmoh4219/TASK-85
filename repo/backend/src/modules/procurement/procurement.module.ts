import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { PurchaseRequest } from './purchase-request.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { RFQ } from './rfq.entity';
import { RFQLine } from './rfq-line.entity';
import { VendorQuote } from './vendor-quote.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { POLine } from './po-line.entity';
import { POReceipt } from './po-receipt.entity';
import { POReceiptLine } from './po-receipt-line.entity';
import { PutAway } from './put-away.entity';
import { Reconciliation } from './reconciliation.entity';
import { InventoryLevel } from '../inventory/inventory-level.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { Vendor } from './vendor.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    AdminModule,
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseRequestItem,
      RFQ,
      RFQLine,
      Vendor,
      VendorQuote,
      PurchaseOrder,
      POLine,
      POReceipt,
      POReceiptLine,
      PutAway,
      Reconciliation,
      InventoryLevel,
      StockMovement,
      AuditLog,
    ]),
  ],
  providers: [ProcurementService, AuditLogService],
  controllers: [ProcurementController],
  exports: [ProcurementService],
})
export class ProcurementModule {}
