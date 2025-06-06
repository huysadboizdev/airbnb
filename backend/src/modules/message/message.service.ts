import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createMessageDto: CreateMessageDto) {
    const { senderId, receiverId, content } = createMessageDto;

    return await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
    });
  }

  async findAll() {
    return await this.prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return await this.prisma.message.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateMessageDto: Partial<CreateMessageDto>) {
    return await this.prisma.message.update({
      where: { id },
      data: updateMessageDto,
    });
  }

  async remove(id: number) {
    return await this.prisma.message.delete({
      where: { id },
    });
  }

  //  Tìm tất cả tin nhắn giữa hai user
  async findMessagesBetweenUsers(user1: number, user2: number) {
    return await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: user1, receiverId: user2 },
          { senderId: user2, receiverId: user1 },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, role: true, avatar: true } },
        receiver: { select: { id: true, name: true, role: true, avatar: true } },
      },
    });
  }

  async findContacts(userId: number) {
    const sent = await this.prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const received = await this.prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    // Trích ID từ kết quả
    const sentIds = sent.map(m => m.receiverId);
    const receivedIds = received.map(m => m.senderId);

    // Gộp và loại bỏ trùng lặp
    const contactIds = Array.from(new Set([...sentIds, ...receivedIds]));

    // Nếu bạn muốn trả về thông tin người dùng
    return this.prisma.user.findMany({
      where: {
        id: { in: contactIds },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
      },
    });
  }
}
