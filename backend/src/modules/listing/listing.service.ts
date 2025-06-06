import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) { }

  async create(createListingDto: CreateListingDto, images: Express.Multer.File[], hostId: number) {
    if (!images || images.length === 0) {
      throw new BadRequestException('Vui lòng tải lên ít nhất một ảnh');
    }

    const listing = await this.prisma.listing.create({
      data: {
        title: createListingDto.title,
        description: createListingDto.description,
        pricePerNight: createListingDto.pricePerNight,
        address: createListingDto.address,
        city: createListingDto.city,
        maxGuests: Number(createListingDto.maxGuests),
        country: createListingDto.country,
        hostId: hostId,
      }
    });

    const newImageRecords = [];

    for (const file of images) {
      try {
        const uploadResult = await this.cloudinary.uploadFile(file);
        newImageRecords.push({
          listingId: listing.id,
          url: uploadResult.secure_url,
          name: uploadResult.original_filename,
        });
      } catch (err) {
        console.error("Tải ảnh thất bại:", file.originalname, err);
      }
    }

    if (newImageRecords.length > 0) {
      await this.prisma.listingImage.createMany({
        data: newImageRecords,
      });
    }

    return { message: "Tạo bài đăng thành công" };
  }

  findAll() {
    return this.prisma.listing.findMany({
      include: {
        host: true,
        images: true,
      }
    });
  }

  async update(updateListingDto: UpdateListingDto, images: Express.Multer.File[]) {
    const { id, removedImageIds, ...updateData } = updateListingDto;

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing) throw new NotFoundException("Không tìm thấy bài đăng");

    if (removedImageIds) {
      const ids = Array.isArray(removedImageIds)
        ? removedImageIds
        : [removedImageIds];

      const imagesToRemove = listing.images.filter((img) =>
        ids.includes(img.id),
      );

      for (const img of imagesToRemove) {
        const publicId = this.cloudinary.extractPublicId(img.url);
        if (publicId) {
          await this.cloudinary.deleteFile(publicId);
        }
      }

      await this.prisma.listingImage.deleteMany({
        where: {
          id: { in: ids },
          listingId: id,
        },
      });
    }

    const newImageRecords = [];

    for (const file of images) {
      const uploadResult = await this.cloudinary.uploadFile(file);
      newImageRecords.push({
        listingId: id,
        url: uploadResult.secure_url,
        name: uploadResult.original_filename,
      });
    }

    if (newImageRecords.length > 0) {
      await this.prisma.listingImage.createMany({
        data: newImageRecords,
      });
    }

    await this.prisma.listing.update({
      where: { id },
      data: updateData,
    });

    return { message: "Cập nhật bài đăng thành công" };
  }

  async remove(id: number) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing) {
      throw new BadRequestException('Không tìm thấy bài đăng');
    }

    for (const image of listing.images) {
      const publicId = this.cloudinary.extractPublicId(image.url);
      await this.cloudinary.deleteFile(publicId);
    }

    await this.prisma.listingImage.deleteMany({
      where: { listingId: id },
    });

    await this.prisma.listing.delete({
      where: { id },
    });

    return 'Xoá bài đăng thành công';
  }

  async findMyListing(hostId: number) {
    const listings = await this.prisma.listing.findMany({
      where: { hostId },
      include: {
        images: true,
      },
    });

    if (!listings || listings.length === 0) {
      throw new NotFoundException("Không tìm thấy bài đăng nào của chủ nhà này");
    }

    return listings;
  }

  async hostUpdate(updateListingDto: UpdateListingDto, images: Express.Multer.File[], hostId: number) {
    const { id, removedImageIds, ...updateData } = updateListingDto;

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing) {
      throw new NotFoundException("Không tìm thấy bài đăng");
    }

    if (listing.hostId !== hostId) {
      throw new BadRequestException("Bạn không có quyền chỉnh sửa bài đăng này");
    }

    if (removedImageIds) {
      const ids = Array.isArray(removedImageIds)
        ? removedImageIds
        : [removedImageIds];

      const imagesToRemove = listing.images.filter((img) =>
        ids.includes(img.id),
      );

      for (const img of imagesToRemove) {
        const publicId = this.cloudinary.extractPublicId(img.url);
        if (publicId) {
          await this.cloudinary.deleteFile(publicId);
        }
      }

      await this.prisma.listingImage.deleteMany({
        where: {
          id: { in: ids },
          listingId: id,
        },
      });
    }

    const newImageRecords = [];

    for (const file of images) {
      const uploadResult = await this.cloudinary.uploadFile(file);
      newImageRecords.push({
        listingId: id,
        url: uploadResult.secure_url,
        name: uploadResult.original_filename,
      });
    }

    if (newImageRecords.length > 0) {
      await this.prisma.listingImage.createMany({
        data: newImageRecords,
      });
    }

    await this.prisma.listing.update({
      where: { id },
      data: updateData,
    });

    return { message: "Cập nhật bài đăng thành công" };
  }

  async hostRemove(id: number, hostId: number) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing) {
      throw new NotFoundException("Không tìm thấy bài đăng");
    }

    if (listing.hostId !== hostId) {
      throw new BadRequestException("Bạn không có quyền xoá bài đăng này");
    }

    for (const image of listing.images) {
      const publicId = this.cloudinary.extractPublicId(image.url);
      await this.cloudinary.deleteFile(publicId);
    }

    await this.prisma.listingImage.deleteMany({
      where: { listingId: id },
    });

    await this.prisma.listing.delete({
      where: { id },
    });

    return 'Xoá bài đăng thành công';
  }

  async findOne(id: number) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        host: true,
        images: true,
        Review: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Không tìm thấy bài đăng");
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId: id,
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
      select: {
        checkInDate: true,
        checkOutDate: true,
      },
    });

    const blockedDates = bookings.flatMap((booking) => {
      const dates = [];
      const current = new Date(booking.checkInDate);
      const end = new Date(booking.checkOutDate);
      while (current < end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    });

    return {
      ...listing,
      blockedDates,
    };
  }

  async search(keyword: string) {
    return await this.prisma.listing.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { city: { contains: keyword } },
          { address: { contains: keyword } },
          { country: { contains: keyword } },
        ],
      },
      include: {
        host: true,
        images: true,
        Review: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }
}
