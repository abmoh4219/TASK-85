import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { AlertsService } from './alerts.service';
import { InventoryController } from './inventory.controller';
import { Item } from './item.entity';
import { ItemCategory } from './item-category.entity';
import { InventoryLevel } from './inventory-level.entity';
import { StockMovement } from './stock-movement.entity';
import { Alert } from './alert.entity';
import { ReplenishmentRecommendation } from './replenishment-recommendation.entity';
import { RecommendationFeedback } from './recommendation-feedback.entity';
import { PurchaseRequest } from '../procurement/purchase-request.entity';
import { PurchaseRequestItem } from '../procurement/purchase-request-item.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      ItemCategory,
      InventoryLevel,
      StockMovement,
      Alert,
      ReplenishmentRecommendation,
      RecommendationFeedback,
      PurchaseRequest,
      PurchaseRequestItem,
      AuditLog,
    ]),
  ],
  providers: [InventoryService, AlertsService, AuditLogService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
