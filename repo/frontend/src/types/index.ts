// ── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta?: { total: number; page: number; limit: number };
}

// ── Procurement ───────────────────────────────────────────────────────────────

export interface Item {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unitOfMeasure: string;
  categoryId: string | null;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  isActive: boolean;
}

export interface PurchaseRequestItem {
  id: string;
  itemId: string;
  item?: Item;
  quantity: number;
  unitOfMeasure: string;
  notes: string | null;
}

export interface PurchaseRequest {
  id: string;
  status: string;
  justification: string | null;
  createdById: string;
  items: PurchaseRequestItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RFQLine {
  id: string;
  itemId: string;
  item?: Item;
  quantity: number;
  unitOfMeasure: string;
}

export interface VendorQuote {
  id: string;
  rfqLineId: string;
  vendorId: string;
  vendor?: Vendor;
  unitPrice: number;
  leadTimeDays: number | null;
  validUntil: string | null;
  notes: string | null;
  isSelected: boolean;
}

export interface RFQ {
  id: string;
  purchaseRequestId: string;
  status: string;
  dueDate: string | null;
  lines: RFQLine[];
  quotes: VendorQuote[];
  createdAt: string;
}

export interface POLine {
  id: string;
  itemId: string;
  item?: Item;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
}

export interface POReceiptLine {
  id: string;
  poLineId: string;
  receivedQuantity: number;
  inspectionResult: string;
  lotNumber: string | null;
  expiryDate: string | null;
}

export interface POReceipt {
  id: string;
  receivedById: string;
  status: string;
  notes: string | null;
  lines: POReceiptLine[];
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  rfqId: string | null;
  status: string;
  priceLockedUntil: string | null;
  notes: string | null;
  lines: POLine[];
  receipts?: POReceipt[];
  createdAt: string;
  updatedAt: string;
}

export interface RFQComparison {
  rfqId: string;
  lines: Array<{
    lineId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    quotes: Array<{
      vendorId: string;
      vendorName: string;
      unitPrice: number;
      leadTimeDays: number | null;
      isLowest: boolean;
    }>;
  }>;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface InventoryLevel {
  id: string;
  itemId: string;
  item?: Item;
  currentStock: number;
  safetyStockLevel: number;
  minLevel: number;
  maxLevel: number;
  reorderPoint: number;
  avgDailyUsage: number;
  leadTimeDays: number;
  bufferDays: number;
}

export interface InventoryAlert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  itemId: string | null;
  item?: Item;
  acknowledgedAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReplenishmentRecommendation {
  id: string;
  itemId: string;
  item?: Item;
  recommendedQuantity: number;
  reasoning: string;
  status: string;
  createdAt: string;
}

// ── Lab ───────────────────────────────────────────────────────────────────────

export interface ReferenceRange {
  id: string;
  minValue: number | null;
  maxValue: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  unit: string;
  populationGroup: string | null;
}

export interface LabTestDictionary {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  sampleType: string;
  turnaroundHours: number;
  referenceRanges: ReferenceRange[];
  isActive: boolean;
}

export interface LabResult {
  id: string;
  testId: string;
  test?: LabTestDictionary;
  numericValue: number | null;
  textValue: string | null;
  isAbnormal: boolean;
  isCritical: boolean;
  notes: string | null;
}

export interface LabReport {
  id: string;
  sampleId: string;
  summary: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabReportVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  summary: string | null;
  editedById: string;
  editedAt: string;
}

export interface LabSample {
  id: string;
  sampleType: string;
  collectionDate: string;
  patientIdentifier: string | null;
  status: string;
  submittedById: string;
  notes: string | null;
  results?: LabResult[];
  report?: LabReport | null;
  createdAt: string;
}
