import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryService } from './inventory.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAlertChecks() {
    this.logger.log('Running scheduled inventory alert checks...');
    try {
      await this.inventoryService.runAllAlertChecks();
      this.logger.log('Alert checks complete.');
    } catch (err) {
      this.logger.error('Alert check failed', err);
    }
  }
}
