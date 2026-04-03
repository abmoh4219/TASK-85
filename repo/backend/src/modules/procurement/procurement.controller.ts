import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Req, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ProcurementService } from './procurement.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { CreateRFQDto } from './dto/create-rfq.dto';
import { AddVendorQuoteDto } from './dto/add-vendor-quote.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveOrderDto } from './dto/receive-order.dto';
import { InspectReceiptDto } from './dto/inspect-receipt.dto';
import { PutAwayDto } from './dto/put-away.dto';
import { ApproveSubstituteDto } from './dto/substitute.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('procurement')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}

  // ── Purchase Requests ────────────────────────────────────────────────

  @Post('requests')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createRequest(
    @Body() dto: CreatePurchaseRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createRequest(dto, user.id, req.ip);
    return { data };
  }

  @Get('requests')
  async getRequests(@CurrentUser() user: AuthUser) {
    const data = await this.service.getRequests(user);
    return { data };
  }

  @Patch('requests/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.submitRequest(id, user.id, req.ip);
    return { data };
  }

  @Patch('requests/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async approveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.approveRequest(id, user.id, req.ip);
    return { data };
  }

  @Patch('requests/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.rejectRequest(id, user.id, req.ip);
    return { data };
  }

  @Post('requests/:id/substitute')
  @Roles(UserRole.ADMIN)
  async approveSubstitute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveSubstituteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.approveSubstitute(id, dto, user.id, req.ip);
    return { data };
  }

  // ── RFQ ──────────────────────────────────────────────────────────────

  @Post('rfq')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createRFQ(
    @Body() dto: CreateRFQDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createRFQ(dto, user.id, req.ip);
    return { data };
  }

  @Post('rfq/:id/quotes')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async addQuote(
    @Param('id', ParseUUIDPipe) rfqId: string,
    @Body() dto: AddVendorQuoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addVendorQuote(rfqId, dto, user.id, req.ip);
    return { data };
  }

  @Get('rfq/:id/comparison')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getComparison(@Param('id', ParseUUIDPipe) rfqId: string) {
    const data = await this.service.getRFQComparison(rfqId);
    return { data };
  }

  // ── Purchase Orders ──────────────────────────────────────────────────

  @Post('orders')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createPO(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createPO(dto, user.id, req.ip);
    return { data };
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getPOs() {
    const data = await this.service.getPOs();
    return { data };
  }

  @Get('orders/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getPO(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getPO(id);
    return { data };
  }

  @Patch('orders/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async approvePO(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.approvePO(id, user.id, req.ip);
    return { data };
  }

  @Patch('orders/:poId/lines/:lineId/price')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateLinePrice(
    @Param('poId', ParseUUIDPipe) poId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body('unitPrice') unitPrice: number,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updatePOLinePrice(poId, lineId, unitPrice, user.id, req.ip);
    return { data };
  }

  // ── Receiving & Inspection ───────────────────────────────────────────

  @Post('orders/:id/receipts')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async receiveOrder(
    @Param('id', ParseUUIDPipe) poId: string,
    @Body() dto: ReceiveOrderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.receiveOrder(poId, dto, user.id, req.ip);
    return { data };
  }

  @Patch('receipts/:id/inspect')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async inspectReceipt(
    @Param('id', ParseUUIDPipe) receiptId: string,
    @Body() dto: InspectReceiptDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.inspectReceipt(receiptId, dto, user.id, req.ip);
    return { data };
  }

  @Post('receipts/:id/putaway')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async putAway(
    @Param('id', ParseUUIDPipe) receiptId: string,
    @Body() dto: PutAwayDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.putAway(receiptId, dto, user.id, req.ip);
    return { data };
  }

  // ── Reconciliation ─��─────────────────────────────────────────────────

  @Post('orders/:id/reconcile')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async reconcile(
    @Param('id', ParseUUIDPipe) poId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.reconcileOrder(poId, user.id, req.ip);
    return { data };
  }
}
