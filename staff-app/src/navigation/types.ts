/**
 * Navigation param-list types for every stack in the app.
 * Screens import these instead of the old monolithic RootStackParamList.
 */

// ── POS ─────────────────────────────────────────────────────────
export type POSStackParamList = {
  POS: undefined;
  Cart: undefined;
  /** Picker for "Bill to room" — loads open folios, sets store.selectedFolioId */
  FolioPicker: undefined;
  Receipt: { transaction: any };
  TransactionHistory: undefined;
  Refund: undefined;
  ShiftOpen: undefined;
  ShiftClose: { shiftId: string };
};

// ── Orders / table checks ───────────────────────────────────────
export type OrdersStackParamList = {
  CheckList: undefined;
  CheckDetail: { checkId: string };
  AddRound: { checkId: string; tableNumber: string };
  Settlement: { checkId: string };
};

// ── Rooms (reception + reservations + folios + guests) ──────────
export type RoomsStackParamList = {
  RoomGrid: undefined;
  RoomDetail: { roomId: string };
  CheckIn: { roomId?: string };
  GuestList: undefined;
  GuestForm: undefined;
  ReservationList: undefined;
  ReservationCalendar: undefined;
  NewReservation: undefined;
  ReservationDetail: { reservationId: string };
  FolioList: undefined;
  FolioDetail: { folioId: string };
  FolioCreate: undefined;
  AddCharge: {
    folioId: string;
    mode: 'charge' | 'payment' | 'discount' | 'deposit';
  };
  FolioClose: { folioId: string };
  FolioReceipt: { folioId: string };
  BookingGroupList: undefined;
  BookingGroupForm: { groupId?: string };
  BookingGroupDetail: { groupId: string };
  BookingGroupStatement: { groupId: string };
};

// ── Bar ─────────────────────────────────────────────────────────
export type BarStackParamList = {
  Bar: undefined;           // existing KDS screen
  BarHome: undefined;       // new hub
  BarSale: undefined;       // direct sale (own POS, no redirect)
  BarReceive: undefined;    // warehouse → bar transfer
  BarChecks: undefined;     // bar checks list
  BarCheckDetail: { checkId: string };
  BarAddRound: { checkId: string; tableNumber: string };
  BarQuickAdd: { checkId: string };
  BarSettlement: { checkId: string };
};

// ── Cleaning ────────────────────────────────────────────────────
export type CleaningStackParamList = {
  CleaningList: undefined;
  CleaningDetail: { roomNumber: number };
  CleaningTaskDetail: { taskId: string };
  CleaningInspection: { taskId: string };
  CleaningRequest: undefined;
};

// ── Warehouse + Rentals ─────────────────────────────────────────
export type WarehouseStackParamList = {
  WarehouseList: undefined;
  WarehouseDetail: { warehouseId: string };
  NewWarehouseItem: { warehouseId: string };
  ReceiveStock: {
    warehouseId: string;
    itemId?: string;
    mode?: 'income' | 'expense';
  };
  BarcodeLookup: {
    warehouseId: string;
    mode?: 'income' | 'expense';
  };
  StockMovements: undefined;
  LowStockAlerts: undefined;
  ExpiringLots: undefined;
  StockReports: undefined;
  Suppliers: undefined;
  UnitConversions: { source: 'warehouse' | 'inventory'; itemId: string; itemName: string };
  TransferList: undefined;
  NewTransfer: { sourceWarehouseId?: string };
  ReceiveTransfer: { transferId: string };
  StocktakeList: { warehouseId?: string };
  StocktakeDetail: { stocktakeId: string };
  RentalList: undefined;
  NewRental: undefined;
  RentalDetail: { rentalId: string };
  ReturnRental: { rentalId: string };
};

// ── Admin / Management ──────────────────────────────────────────
export type AdminStackParamList = {
  Dashboard: undefined;
  StaffList: undefined;
  StaffForm: { userId?: string };
  RoleList: undefined;
  OutletManagement: undefined;
  AuditLog: undefined;
  Finance: undefined;
  Revenue: undefined;
  TopItems: undefined;
  EmployeeStats: undefined;
  OwnerFeed: undefined;
  Exceptions: undefined;
  RoomTypeList: undefined;
  RoomTypeForm: { roomTypeId?: string };
  RoomForm: { roomTypeId?: string };
  RoomManagement: undefined;
  MenuManagement: undefined;
  MenuItemForm: { itemId?: string };
  ExpenseList: undefined;
  ExpenseForm: undefined;
  ExpenseCategories: undefined;
  ExpenseCategoryForm: { categoryId?: string };
  IncomeList: undefined;
  IncomeForm: undefined;
  IncomeCategories: undefined;
  IncomeCategoryForm: { categoryId?: string };
  InventoryItems: undefined;
  AdminSettings: undefined;
};

// ── Root (auth gate) ────────────────────────────────────────────
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

// ── Drawer ──────────────────────────────────────────────────────
export type DrawerParamList = {
  HomeDrawer: undefined;
  POSDrawer: undefined;
  OrdersDrawer: undefined;
  KitchenDrawer: undefined;
  BarDrawer: undefined;
  RoomsDrawer: undefined;
  CleaningDrawer: undefined;
  WarehouseDrawer: undefined;
  AdminDrawer: undefined;
};
