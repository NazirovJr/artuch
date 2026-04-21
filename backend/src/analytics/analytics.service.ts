import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../pos/entities/transaction.entity';
import { Order } from '../restaurant/entities/order.entity';
import { Room } from '../hotel/entities/room.entity';
import { Reservation } from '../hotel/entities/reservation.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
  ) {}

  async getRevenueStats(period: 'day' | 'week' | 'month' = 'day') {
    let dateTrunc: string;
    switch (period) {
      case 'week':
        dateTrunc = 'week';
        break;
      case 'month':
        dateTrunc = 'month';
        break;
      default:
        dateTrunc = 'day';
    }

    const results = await this.transactionRepo
      .createQueryBuilder('t')
      .select(`date_trunc('${dateTrunc}', t."createdAt")`, 'period')
      .addSelect('SUM(t.total)', 'revenue')
      .addSelect('COUNT(t.id)', 'count')
      .where("t.status != 'refunded'")
      .groupBy(`date_trunc('${dateTrunc}', t."createdAt")`)
      .orderBy('period', 'DESC')
      .limit(30)
      .getRawMany();

    return results.map((r) => ({
      period: r.period,
      revenue: parseFloat(r.revenue) || 0,
      count: parseInt(r.count, 10) || 0,
    }));
  }

  async getTopItems(limit = 10) {
    const results = await this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin('t.items', 'ti')
      .select('ti.name', 'name')
      .addSelect('SUM(ti.quantity)', 'totalQuantity')
      .addSelect('SUM(ti.price * ti.quantity)', 'totalRevenue')
      .where("t.status != 'refunded'")
      .groupBy('ti.name')
      .orderBy('"totalQuantity"', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      name: r.name,
      totalQuantity: parseInt(r.totalQuantity, 10) || 0,
      totalRevenue: parseFloat(r.totalRevenue) || 0,
    }));
  }

  async getEmployeeStats() {
    const results = await this.transactionRepo
      .createQueryBuilder('t')
      .select('t.employeeId', 'employeeId')
      .addSelect('t.employee', 'employeeName')
      .addSelect('COUNT(t.id)', 'transactionCount')
      .addSelect('SUM(t.total)', 'totalRevenue')
      .where("t.status != 'refunded'")
      .groupBy('t.employeeId')
      .addGroupBy('t.employee')
      .orderBy('"totalRevenue"', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      transactionCount: parseInt(r.transactionCount, 10) || 0,
      totalRevenue: parseFloat(r.totalRevenue) || 0,
    }));
  }

  async getRoomOccupancy() {
    const totalRooms = await this.roomRepo.count();
    const occupiedRooms = await this.roomRepo.count({
      where: { status: 'occupied' },
    });

    return {
      total: totalRooms,
      occupied: occupiedRooms,
      available: totalRooms - occupiedRooms,
      occupancyRate:
        totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 100)
          : 0,
    };
  }

  async getKpiDashboard() {
    // Today's revenue
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRevenue = await this.transactionRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.total), 0)', 'revenue')
      .where('t."createdAt" >= :todayStart', { todayStart })
      .andWhere("t.status != 'refunded'")
      .getRawOne();

    // Active orders count
    const activeOrders = await this.orderRepo.count({
      where: [{ status: 'pending' }, { status: 'preparing' }],
    });

    // Room occupancy
    const occupancy = await this.getRoomOccupancy();

    // Pending reservations
    const pendingReservations = await this.reservationRepo.count({
      where: { status: 'pending' },
    });

    return {
      todayRevenue: parseFloat(todayRevenue?.revenue) || 0,
      activeOrders,
      occupiedRooms: occupancy.occupied,
      totalRooms: occupancy.total,
      pendingReservations,
    };
  }
}
