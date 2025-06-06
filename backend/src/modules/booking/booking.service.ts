import { Injectable, Logger, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto, guestId: number) {
    return this.prisma.booking.create({
      data: {
        ...createBookingDto,
        guestId: guestId,
        checkInDate: new Date(createBookingDto.checkInDate),
        checkOutDate: new Date(createBookingDto.checkOutDate),
      },
    });
  }

  // CRON: tự động huỷ các booking "pending" sau 24h
  @Cron(CronExpression.EVERY_HOUR) // chạy mỗi giờ
  async cancelExpiredBookings() {
    const now = new Date();
    const expiredTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 giờ trước

    const result = await this.prisma.booking.updateMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: expiredTime,
        },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Đã huỷ ${result.count} đơn đặt phòng quá hạn.`);
    }
  }

  async updateStatus(update, hostId) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: update.bookingId },
      include: {
        listing: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }

    if (booking.listing.hostId !== hostId) {
      throw new ForbiddenException('Bạn không phải là chủ nhà của đơn đặt phòng này');
    }

    await this.prisma.booking.update({
      where: { id: update.bookingId },
      data: { status: update.status },
    });

    return 'Cập nhật trạng thái thành công';
  }

  async hostBooking(hostId: number) {
    return this.prisma.booking.findMany({
      where: {
        listing: {
          hostId: hostId,
        },
      },
      include: {
        listing: {
          include: {
            images: true,
          },
        },
        guest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async allBooking(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Bạn không có quyền truy cập danh sách đặt phòng.');
    }

    return await this.prisma.booking.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
          },
        },
      },
    });
  }
}
